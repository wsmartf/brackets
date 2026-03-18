#!/usr/bin/env python3
"""Train and evaluate a simple V2 logistic-regression tournament model."""

from __future__ import annotations

import csv
import json
import math
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = ROOT / "model-data" / "processed" / "historical-tourney-matchups.csv"

TRAIN_END = int(os.environ.get("V2_TRAIN_END", "2017"))
VALIDATE_END = int(os.environ.get("V2_VALIDATE_END", "2021"))
HOLDOUT_END = int(os.environ.get("V2_HOLDOUT_END", "2025"))
LEARNING_RATE = float(os.environ.get("V2_LEARNING_RATE", "0.05"))
ITERATIONS = int(os.environ.get("V2_ITERATIONS", "1500"))
EPSILON = 1e-15
REGULARIZATION_VALUES = [0.0, 0.001, 0.01, 0.03, 0.1]

FEATURES = [
    "net_rating_diff",
    "offense_rating_diff",
    "defense_rating_diff",
    "adj_tempo_diff",
    "schedule_net_rating_diff",
    "seed_num_diff",
]


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
            parsed = {"season": int(row["season"]), "winner_low": int(row["winner_low"])}
            for feature in FEATURES:
                parsed[feature] = float(row[feature])
            rows.append(parsed)
    return rows


def split_name(season: int) -> str:
    if season <= TRAIN_END:
        return "train"
    if season <= VALIDATE_END:
        return "validate"
    if season <= HOLDOUT_END:
        return "holdout"
    return "future"


def compute_standardization(rows: list[dict[str, float | int | str]]) -> tuple[dict[str, float], dict[str, float]]:
    means: dict[str, float] = {}
    stds: dict[str, float] = {}
    for feature in FEATURES:
        values = [float(row[feature]) for row in rows]
        mean = sum(values) / len(values)
        variance = sum((value - mean) ** 2 for value in values) / len(values)
        std = math.sqrt(variance) or 1.0
        means[feature] = mean
        stds[feature] = std
    return means, stds


def standardize_rows(
    rows: list[dict[str, float | int | str]],
    means: dict[str, float],
    stds: dict[str, float],
) -> list[dict[str, float | int | str]]:
    standardized = []
    for row in rows:
        updated = dict(row)
        for feature in FEATURES:
            updated[feature] = (float(row[feature]) - means[feature]) / stds[feature]
        standardized.append(updated)
    return standardized


def train_logistic_regression(
    rows: list[dict[str, float | int | str]],
    regularization: float,
) -> tuple[dict[str, float], float]:
    weights = {feature: 0.0 for feature in FEATURES}
    bias = 0.0
    n = len(rows)

    for _ in range(ITERATIONS):
        gradient_w = {feature: 0.0 for feature in FEATURES}
        gradient_b = 0.0

        for row in rows:
            linear = bias + sum(weights[feature] * float(row[feature]) for feature in FEATURES)
            probability = logistic(linear)
            error = probability - int(row["winner_low"])

            for feature in FEATURES:
                gradient_w[feature] += error * float(row[feature])
            gradient_b += error

        for feature in FEATURES:
            gradient_w[feature] = gradient_w[feature] / n + regularization * weights[feature]
            weights[feature] -= LEARNING_RATE * gradient_w[feature]

        gradient_b /= n
        bias -= LEARNING_RATE * gradient_b

    return weights, bias


def predict_probability(row: dict[str, float | int | str], weights: dict[str, float], bias: float) -> float:
    linear = bias + sum(weights[feature] * float(row[feature]) for feature in FEATURES)
    probability = logistic(linear)
    return min(max(probability, EPSILON), 1 - EPSILON)


def evaluate(
    rows: list[dict[str, float | int | str]],
    weights: dict[str, float],
    bias: float,
) -> dict[str, float]:
    total_log_loss = 0.0
    total_brier = 0.0
    correct = 0

    for row in rows:
        actual = int(row["winner_low"])
        probability = predict_probability(row, weights, bias)
        total_log_loss += -(actual * math.log(probability) + (1 - actual) * math.log(1 - probability))
        total_brier += (probability - actual) ** 2
        correct += int((probability >= 0.5) == bool(actual))

    return {
        "games": len(rows),
        "log_loss": round(total_log_loss / len(rows), 6),
        "brier_score": round(total_brier / len(rows), 6),
        "accuracy": round(correct / len(rows), 6),
    }


def season_metrics(
    rows: list[dict[str, float | int | str]],
    weights: dict[str, float],
    bias: float,
) -> list[dict[str, float | int]]:
    seasons = sorted({int(row["season"]) for row in rows})
    output = []
    for season in seasons:
        season_rows = [row for row in rows if int(row["season"]) == season]
        metrics = evaluate(season_rows, weights, bias)
        output.append(
            {
                "season": season,
                "games": metrics["games"],
                "log_loss": metrics["log_loss"],
                "brier_score": metrics["brier_score"],
                "accuracy": metrics["accuracy"],
            }
        )
    return output


def main() -> None:
    rows = load_rows()
    train_rows = [row for row in rows if split_name(int(row["season"])) == "train"]
    validate_rows = [row for row in rows if split_name(int(row["season"])) == "validate"]
    holdout_rows = [row for row in rows if split_name(int(row["season"])) == "holdout"]

    means, stds = compute_standardization(train_rows)
    standardized_rows = standardize_rows(rows, means, stds)
    standardized_train = [row for row in standardized_rows if split_name(int(row["season"])) == "train"]
    standardized_validate = [
        row for row in standardized_rows if split_name(int(row["season"])) == "validate"
    ]
    standardized_holdout = [
        row for row in standardized_rows if split_name(int(row["season"])) == "holdout"
    ]

    best = None
    search_results = []

    for regularization in REGULARIZATION_VALUES:
        weights, bias = train_logistic_regression(standardized_train, regularization)
        train_metrics = evaluate(standardized_train, weights, bias)
        validate_metrics = evaluate(standardized_validate, weights, bias)
        result = {
            "regularization": regularization,
            "train": train_metrics,
            "validate": validate_metrics,
            "weights": {feature: round(weights[feature], 6) for feature in FEATURES},
            "bias": round(bias, 6),
        }
        search_results.append(result)

        if best is None or validate_metrics["log_loss"] < best["validate"]["log_loss"]:
            best = result

    assert best is not None

    best_reg = float(best["regularization"])
    final_weights, final_bias = train_logistic_regression(standardized_train + standardized_validate, best_reg)

    result = {
        "dataset": str(DATASET_PATH.relative_to(ROOT)),
        "splits": {
            "train_end": TRAIN_END,
            "validate_end": VALIDATE_END,
            "holdout_end": HOLDOUT_END,
        },
        "features": FEATURES,
        "standardization": {
            feature: {"mean": round(means[feature], 6), "std": round(stds[feature], 6)}
            for feature in FEATURES
        },
        "regularization_search": search_results,
        "selected_regularization": best_reg,
        "selected_model_validate_metrics": best["validate"],
        "final_model": {
            "trained_on": "train+validate",
            "regularization": best_reg,
            "weights": {feature: round(final_weights[feature], 6) for feature in FEATURES},
            "bias": round(final_bias, 6),
            "metrics": {
                "train": evaluate(standardized_train, final_weights, final_bias),
                "validate": evaluate(standardized_validate, final_weights, final_bias),
                "holdout": evaluate(standardized_holdout, final_weights, final_bias),
                "all": evaluate(standardized_rows, final_weights, final_bias),
            },
            "season_metrics": season_metrics(standardized_rows, final_weights, final_bias),
        },
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
