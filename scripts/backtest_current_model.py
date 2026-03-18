#!/usr/bin/env python3
"""Backtest the current production probability model on historical NCAA games."""

from __future__ import annotations

import csv
import json
import math
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "model-data" / "processed" / "historical-tourney-matchups.csv"

CURRENT_BETA = 0.07
DEFAULT_TRAIN_END = 2017
DEFAULT_VALIDATE_END = 2021
DEFAULT_HOLDOUT_END = 2025
DEFAULT_BETA_MIN = 0.01
DEFAULT_BETA_MAX = 0.15
DEFAULT_BETA_STEP = 0.001
EPSILON = 1e-15
CALIBRATION_BUCKETS = [i / 10 for i in range(11)]


def get_env_float(name: str, fallback: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return fallback
    try:
        return float(raw)
    except ValueError:
        return fallback


def get_env_int(name: str, fallback: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return fallback
    try:
        return int(raw)
    except ValueError:
        return fallback


def logistic(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1 / (1 + z)
    z = math.exp(x)
    return z / (1 + z)


def load_rows() -> list[dict[str, float | int | str]]:
    rows: list[dict[str, float | int | str]] = []
    with DATASET_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "season": int(row["season"]),
                    "round_name": row["round_name"],
                    "winner_low": int(row["winner_low"]),
                    "net_rating_diff": float(row["net_rating_diff"]),
                    "seed_num_diff": float(row["seed_num_diff"]) if row["seed_num_diff"] else 0.0,
                }
            )
    return rows


def split_name(season: int, train_end: int, validate_end: int, holdout_end: int) -> str:
    if season <= train_end:
        return "train"
    if season <= validate_end:
        return "validate"
    if season <= holdout_end:
        return "holdout"
    return "future"


def evaluate_predictions(rows: list[dict[str, float | int | str]], beta: float) -> dict[str, object]:
    total_log_loss = 0.0
    total_brier = 0.0
    correct = 0
    favorite_correct = 0
    favorite_games = 0
    calibration = []

    bucket_counts = [0 for _ in range(len(CALIBRATION_BUCKETS) - 1)]
    bucket_pred_sum = [0.0 for _ in range(len(CALIBRATION_BUCKETS) - 1)]
    bucket_actual_sum = [0.0 for _ in range(len(CALIBRATION_BUCKETS) - 1)]

    for row in rows:
        actual = int(row["winner_low"])
        probability = logistic(beta * float(row["net_rating_diff"]))
        probability = min(max(probability, EPSILON), 1 - EPSILON)

        total_log_loss += -(actual * math.log(probability) + (1 - actual) * math.log(1 - probability))
        total_brier += (probability - actual) ** 2
        correct += int((probability >= 0.5) == bool(actual))

        favorite_probability = max(probability, 1 - probability)
        favorite_won = (probability >= 0.5 and actual == 1) or (probability < 0.5 and actual == 0)
        favorite_correct += int(favorite_won)
        favorite_games += 1

        for index in range(len(CALIBRATION_BUCKETS) - 1):
            lower = CALIBRATION_BUCKETS[index]
            upper = CALIBRATION_BUCKETS[index + 1]
            is_last = index == len(CALIBRATION_BUCKETS) - 2
            if lower <= probability < upper or (is_last and probability == upper):
                bucket_counts[index] += 1
                bucket_pred_sum[index] += probability
                bucket_actual_sum[index] += actual
                break

    for index in range(len(bucket_counts)):
        count = bucket_counts[index]
        if count == 0:
            continue
        calibration.append(
            {
                "bucket": f"{CALIBRATION_BUCKETS[index]:.1f}-{CALIBRATION_BUCKETS[index + 1]:.1f}",
                "count": count,
                "avg_pred": round(bucket_pred_sum[index] / count, 4),
                "actual_rate": round(bucket_actual_sum[index] / count, 4),
            }
        )

    num_rows = len(rows)
    return {
        "games": num_rows,
        "beta": round(beta, 6),
        "log_loss": round(total_log_loss / num_rows, 6),
        "brier_score": round(total_brier / num_rows, 6),
        "accuracy": round(correct / num_rows, 6),
        "favorite_accuracy": round(favorite_correct / favorite_games, 6),
        "calibration": calibration,
    }


def build_split_summary(
    rows: list[dict[str, float | int | str]],
    beta: float,
    train_end: int,
    validate_end: int,
    holdout_end: int,
) -> dict[str, object]:
    grouped: dict[str, list[dict[str, float | int | str]]] = {"all": rows}
    for split in ("train", "validate", "holdout"):
        grouped[split] = [
            row
            for row in rows
            if split_name(int(row["season"]), train_end, validate_end, holdout_end) == split
        ]

    summary: dict[str, object] = {}
    for split, split_rows in grouped.items():
        if split_rows:
            summary[split] = evaluate_predictions(split_rows, beta)
    return summary


def season_metrics(rows: list[dict[str, float | int | str]], beta: float) -> list[dict[str, object]]:
    seasons = sorted({int(row["season"]) for row in rows})
    result = []
    for season in seasons:
        season_rows = [row for row in rows if int(row["season"]) == season]
        metrics = evaluate_predictions(season_rows, beta)
        result.append(
            {
                "season": season,
                "games": metrics["games"],
                "log_loss": metrics["log_loss"],
                "brier_score": metrics["brier_score"],
                "accuracy": metrics["accuracy"],
            }
        )
    return result


def search_best_beta(
    rows: list[dict[str, float | int | str]],
    train_end: int,
    beta_min: float,
    beta_max: float,
    beta_step: float,
) -> dict[str, float]:
    train_rows = [row for row in rows if int(row["season"]) <= train_end]
    best_beta = beta_min
    best_log_loss = float("inf")
    current = beta_min

    while current <= beta_max + 1e-12:
        metrics = evaluate_predictions(train_rows, current)
        log_loss = float(metrics["log_loss"])
        if log_loss < best_log_loss:
            best_log_loss = log_loss
            best_beta = current
        current += beta_step

    return {
        "beta": round(best_beta, 6),
        "train_log_loss": round(best_log_loss, 6),
    }


def main() -> None:
    train_end = get_env_int("BACKTEST_TRAIN_END", DEFAULT_TRAIN_END)
    validate_end = get_env_int("BACKTEST_VALIDATE_END", DEFAULT_VALIDATE_END)
    holdout_end = get_env_int("BACKTEST_HOLDOUT_END", DEFAULT_HOLDOUT_END)
    beta_min = get_env_float("BACKTEST_BETA_MIN", DEFAULT_BETA_MIN)
    beta_max = get_env_float("BACKTEST_BETA_MAX", DEFAULT_BETA_MAX)
    beta_step = get_env_float("BACKTEST_BETA_STEP", DEFAULT_BETA_STEP)

    rows = load_rows()
    best_beta = search_best_beta(rows, train_end, beta_min, beta_max, beta_step)

    result = {
        "dataset": str(DATASET_PATH.relative_to(ROOT)),
        "splits": {
            "train_end": train_end,
            "validate_end": validate_end,
            "holdout_end": holdout_end,
        },
        "current_model": {
            "beta": CURRENT_BETA,
            "metrics": build_split_summary(rows, CURRENT_BETA, train_end, validate_end, holdout_end),
        },
        "best_train_beta": {
            "beta": best_beta["beta"],
            "train_log_loss": best_beta["train_log_loss"],
            "metrics": build_split_summary(
                rows, float(best_beta["beta"]), train_end, validate_end, holdout_end
            ),
        },
        "season_metrics_current_beta": season_metrics(rows, CURRENT_BETA),
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
