#!/usr/bin/env python3
"""
Quick Monte Carlo simulation of champion probabilities using the V2 model.
Runs N independent tournament simulations and reports champion + Final Four frequencies.

Usage:
    python3 scripts/model/champion_probs.py
    python3 scripts/model/champion_probs.py 1000000
"""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOURNAMENT_PATH = ROOT / "data" / "tournament-2026.json"
MODEL_PATH = ROOT / "data" / "model-v2.json"

N_SIMS = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000

SEED_MATCHUP_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]


def logistic(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def standardize(feature: str, value: float, standardization: dict) -> float:
    s = standardization[feature]
    return (value - s["mean"]) / s["std"]


def win_prob(a: dict, b: dict, model: dict) -> float:
    w = model["weights"]
    s = model["standardization"]
    T = model.get("temperature", 1.0)
    linear = (
        model["bias"]
        + w["netRatingDiff"] * standardize("netRatingDiff", a["netRating"] - b["netRating"], s)
        + w["offenseRatingDiff"] * standardize("offenseRatingDiff", a["offenseRating"] - b["offenseRating"], s)
        + w["defenseRatingDiff"] * standardize("defenseRatingDiff", a["defenseRating"] - b["defenseRating"], s)
        + w["adjTempoDiff"] * standardize("adjTempoDiff", a["adjTempo"] - b["adjTempo"], s)
        + w["scheduleNetRatingDiff"] * standardize("scheduleNetRatingDiff", a["scheduleNetRating"] - b["scheduleNetRating"], s)
        + w["seedNumDiff"] * standardize("seedNumDiff", a["seed"] - b["seed"], s)
    )
    return logistic(linear / T)


def simulate_tournament(bracket: list[dict], model: dict) -> tuple[str, set[str]]:
    """Returns (champion_name, {final_four_names})."""
    field = list(bracket)
    final_four: set[str] = set()
    round_num = len(field)

    while len(field) > 1:
        if len(field) == 4:
            final_four = {t["name"] for t in field}
        next_round = []
        for i in range(0, len(field), 2):
            a = field[i]
            b = field[i + 1]
            p = win_prob(a, b, model)
            winner = a if random.random() < p else b
            next_round.append(winner)
        field = next_round

    return field[0]["name"], final_four


def build_bracket(tournament: dict) -> list[dict]:
    """Build initial bracket in canonical seed matchup order."""
    bracket = []
    for region in tournament["regions"]:
        region_teams = [t for t in tournament["teams"] if t["region"] == region]
        by_seed = {t["seed"]: t for t in region_teams}
        for seed in SEED_MATCHUP_ORDER:
            bracket.append(by_seed[seed])
    return bracket


def main() -> None:
    tournament = json.loads(TOURNAMENT_PATH.read_text())
    model = json.loads(MODEL_PATH.read_text())

    bracket = build_bracket(tournament)
    n_teams = len(bracket)
    assert n_teams == 64, f"Expected 64 teams, got {n_teams}"

    champ_counts: dict[str, int] = {}
    ff_counts: dict[str, int] = {}

    print(f"Running {N_SIMS:,} simulations...", flush=True)
    for _ in range(N_SIMS):
        champ, ff = simulate_tournament(bracket, model)
        champ_counts[champ] = champ_counts.get(champ, 0) + 1
        for name in ff:
            ff_counts[name] = ff_counts.get(name, 0) + 1

    print(f"\n{'='*60}")
    print(f"CHAMPION PROBABILITIES  (n={N_SIMS:,})")
    print(f"{'='*60}")
    print(f"{'Team':<25} {'Seed':>4} {'Region':<10} {'Champ%':>7}")
    print(f"{'-'*55}")

    # Sort by champ probability descending
    team_info = {t["name"]: t for t in tournament["teams"]}
    sorted_champs = sorted(champ_counts.items(), key=lambda x: x[1], reverse=True)
    for name, count in sorted_champs:
        t = team_info[name]
        pct = 100.0 * count / N_SIMS
        print(f"{name:<25} {t['seed']:>4} {t['region']:<10} {pct:>6.1f}%")

    print(f"\n{'='*60}")
    print(f"FINAL FOUR PROBABILITIES  (n={N_SIMS:,})")
    print(f"{'='*60}")
    print(f"{'Team':<25} {'Seed':>4} {'Region':<10} {'FF%':>7}")
    print(f"{'-'*55}")

    sorted_ff = sorted(ff_counts.items(), key=lambda x: x[1], reverse=True)
    for name, count in sorted_ff[:20]:
        t = team_info[name]
        pct = 100.0 * count / N_SIMS
        print(f"{name:<25} {t['seed']:>4} {t['region']:<10} {pct:>6.1f}%")

    # Sanity: sum of champ probs should be ~100%
    total = sum(champ_counts.values()) / N_SIMS * 100
    print(f"\nTotal champ prob sum: {total:.1f}% (should be 100%)")

    # Seed distribution of champions
    print(f"\n{'='*40}")
    print("CHAMPION SEED DISTRIBUTION")
    print(f"{'='*40}")
    seed_champ: dict[int, int] = {}
    for name, count in champ_counts.items():
        s = team_info[name]["seed"]
        seed_champ[s] = seed_champ.get(s, 0) + count
    for seed in sorted(seed_champ):
        pct = 100.0 * seed_champ[seed] / N_SIMS
        bar = "#" * int(pct / 0.5)
        print(f"  Seed {seed:>2}: {pct:>5.1f}%  {bar}")


if __name__ == "__main__":
    main()
