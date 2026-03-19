#!/usr/bin/env python3
"""
Calibration analysis for the V2 logistic-regression model.

Reads the same historical matchup CSV used for training and reports
calibration buckets: for each predicted probability band, what fraction
of games did the predicted favorite actually win?

A well-calibrated model should have avg_pred ≈ actual_rate in each bucket.

Requirements:
    model-data/processed/historical-tourney-matchups.csv  (from build_backtest_dataset.py)
    data/model-v2.json

Usage:
    python3 scripts/calibrate_v2.py
    python3 scripts/calibrate_v2.py --holdout-only   # only 2022-2025 games
"""

from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "model-data" / "processed" / "historical-tourney-matchups.csv"
MODEL_PATH = ROOT / "data" / "model-v2.json"

HOLDOUT_START = 2022
HOLDOUT_ONLY = "--holdout-only" in sys.argv

FEATURES = [
    "net_rating_diff",
    "offense_rating_diff",
    "defense_rating_diff",
    "adj_tempo_diff",
    "schedule_net_rating_diff",
    "seed_num_diff",
]

FEATURE_MAP = {
    "net_rating_diff": "netRatingDiff",
    "offense_rating_diff": "offenseRatingDiff",
    "defense_rating_diff": "defenseRatingDiff",
    "adj_tempo_diff": "adjTempoDiff",
    "schedule_net_rating_diff": "scheduleNetRatingDiff",
    "seed_num_diff": "seedNumDiff",
}

EPSILON = 1e-15
BUCKETS = [0.0, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0]


def logistic(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


def load_model():
    return json.loads(MODEL_PATH.read_text())


def load_rows():
    rows = []
    with DATASET_PATH.open(newline="") as f:
        for row in csv.DictReader(f):
            season = int(row["season"])
            if HOLDOUT_ONLY and season < HOLDOUT_START:
                continue
            parsed = {"season": season, "winner_low": int(row["winner_low"]), "round_name": row.get("round_name", "")}
            for feat in FEATURES:
                val = row.get(feat, "")
                parsed[feat] = float(val) if val else 0.0
            rows.append(parsed)
    return rows


def predict(row: dict, model: dict) -> float:
    w = model["weights"]
    s = model["standardization"]
    linear = model["bias"]
    for csv_feat, model_feat in FEATURE_MAP.items():
        raw = row[csv_feat]
        std_val = (raw - s[model_feat]["mean"]) / s[model_feat]["std"]
        linear += w[model_feat] * std_val
    p = logistic(linear)
    return min(max(p, EPSILON), 1 - EPSILON)


def calibration_report(rows: list[dict], model: dict) -> None:
    # Convert all predictions to "probability that the favorite wins"
    # i.e., always frame it as P(favored side wins) > 0.5
    fav_preds = []
    for row in rows:
        p = predict(row, model)
        actual = int(row["winner_low"])
        # Reframe: fav_prob = max(p, 1-p), fav_won = 1 if higher-prob side won
        fav_prob = max(p, 1.0 - p)
        fav_won = (p >= 0.5 and actual == 1) or (p < 0.5 and actual == 0)
        fav_preds.append((fav_prob, int(fav_won), row["round_name"]))

    print(f"\n{'='*65}")
    label = "HOLDOUT (2022-2025)" if HOLDOUT_ONLY else "ALL SEASONS (2002-2025)"
    print(f"V2 CALIBRATION — {label}  (n={len(rows)} games)")
    print(f"{'='*65}")
    print(f"{'Pred band':<15} {'N':>5}  {'Avg pred':>9}  {'Actual win%':>11}  {'Diff':>7}")
    print(f"{'-'*55}")

    bucket_counts = [0] * (len(BUCKETS) - 1)
    bucket_pred_sum = [0.0] * (len(BUCKETS) - 1)
    bucket_actual_sum = [0.0] * (len(BUCKETS) - 1)

    for fav_prob, fav_won, _ in fav_preds:
        for i in range(len(BUCKETS) - 1):
            lo, hi = BUCKETS[i], BUCKETS[i + 1]
            if lo <= fav_prob < hi or (i == len(BUCKETS) - 2 and fav_prob == hi):
                bucket_counts[i] += 1
                bucket_pred_sum[i] += fav_prob
                bucket_actual_sum[i] += fav_won
                break

    for i in range(len(BUCKETS) - 1):
        n = bucket_counts[i]
        if n == 0:
            continue
        avg_pred = bucket_pred_sum[i] / n
        actual_rate = bucket_actual_sum[i] / n
        diff = actual_rate - avg_pred
        flag = "  <<" if abs(diff) > 0.05 else ""
        lo, hi = BUCKETS[i], BUCKETS[i + 1]
        print(f"  {lo:.2f}-{hi:.2f}     {n:>5}  {avg_pred:>9.3f}  {actual_rate:>11.3f}  {diff:>+7.3f}{flag}")

    # Overall stats
    total_log_loss = 0.0
    total_brier = 0.0
    correct = 0
    for row in rows:
        p = predict(row, model)
        actual = int(row["winner_low"])
        total_log_loss += -(actual * math.log(p) + (1 - actual) * math.log(1 - p))
        total_brier += (p - actual) ** 2
        correct += int((p >= 0.5) == bool(actual))

    n = len(rows)
    print(f"\n  Log loss:    {total_log_loss/n:.6f}")
    print(f"  Brier score: {total_brier/n:.6f}")
    print(f"  Accuracy:    {correct/n:.4f}  ({correct}/{n})")

    # By round
    print(f"\n{'='*55}")
    print("BY ROUND")
    print(f"{'='*55}")
    rounds: dict[str, list] = {}
    for fav_prob, fav_won, rname in fav_preds:
        rounds.setdefault(rname, []).append((fav_prob, fav_won))
    for rname in ["Round of 64", "Round of 32", "Sweet 16", "Elite 8", "Final Four", "Championship"]:
        if rname not in rounds:
            continue
        items = rounds[rname]
        n_r = len(items)
        avg_fav_p = sum(x[0] for x in items) / n_r
        win_rate = sum(x[1] for x in items) / n_r
        print(f"  {rname:<20} n={n_r:>3}  avg_fav_prob={avg_fav_p:.3f}  actual_win={win_rate:.3f}")


def main() -> None:
    if not DATASET_PATH.exists():
        print(f"ERROR: Dataset not found at {DATASET_PATH.relative_to(ROOT)}")
        print("Run: python3 scripts/build_backtest_dataset.py")
        print("(Requires: march-machine-learning-mania-2026/ and kenpom-historical-data/ directories)")
        sys.exit(1)

    model = load_model()
    rows = load_rows()
    print(f"Loaded {len(rows)} matchup rows")
    calibration_report(rows, model)


if __name__ == "__main__":
    main()
