#!/usr/bin/env python3
"""Build a historical NCAA tournament matchup table joined with KenPom data."""

from __future__ import annotations

import csv
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
KAGGLE_DIR = ROOT / "march-machine-learning-mania-2026"
KENPOM_PATH = ROOT / "kenpom-historical-data" / "kenpom-ratings.csv"
OUTPUT_DIR = ROOT / "model-data" / "processed"
OUTPUT_PATH = OUTPUT_DIR / "historical-tourney-matchups.csv"

SEASON_START = 2002
SEASON_END = 2025

TEAM_NORM_RE = re.compile(r"[^a-z0-9]+")
SEED_NUM_RE = re.compile(r"(\d{2})")

# The remaining seeded-team gaps after Kaggle TeamSpellings coverage.
MANUAL_TEAM_ALIASES = {
    "calstbakersfield": 1167,  # CS Bakersfield
    "csbakersfield": 1167,  # CS Bakersfield
    "mississippivalleyst": 1290,  # MS Valley St
    "semissourist": 1369,  # SE Missouri St
    "southeastmissourist": 1369,  # SE Missouri St
    "southwestmissourist": 1283,  # Missouri St
    "southwesttexasst": 1402,  # Texas St
    "saintfrancis": 1384,  # St Francis PA
    "stfrancis": 1384,  # St Francis PA
    "texasaandmcorpuschris": 1394,  # TAM C. Christi
    "texasandmcorpuschris": 1394,  # TAM C. Christi
    "texasamcorpuschris": 1394,  # TAM C. Christi
    "utriograndevalley": 1410,  # UTRGV
    "winstonsalemst": 1445,  # Winston-Salem
}


ROUND_BY_DAY = {
    134: "First Four",
    135: "First Four",
    136: "Round of 64",
    137: "Round of 64",
    138: "Round of 32",
    139: "Round of 32",
    143: "Sweet 16",
    144: "Sweet 16",
    145: "Elite 8",
    146: "Elite 8",
    152: "Final Four",
    154: "Championship",
}


def normalize_name(name: str) -> str:
    lowered = name.lower().replace("&", "and")
    return TEAM_NORM_RE.sub("", lowered)


def parse_seed_number(raw_seed: str) -> int | None:
    match = SEED_NUM_RE.search(raw_seed)
    return int(match.group(1)) if match else None


def load_kaggle_team_lookup() -> tuple[dict[str, int], dict[int, str]]:
    name_to_id: dict[str, int] = {}
    id_to_name: dict[int, str] = {}

    with (KAGGLE_DIR / "MTeams.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            team_id = int(row["TeamID"])
            id_to_name[team_id] = row["TeamName"]
            name_to_id[normalize_name(row["TeamName"])] = team_id

    with (KAGGLE_DIR / "MTeamSpellings.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            name_to_id[normalize_name(row["TeamNameSpelling"])] = int(row["TeamID"])

    name_to_id.update(MANUAL_TEAM_ALIASES)
    return name_to_id, id_to_name


def load_kenpom_rows(name_to_id: dict[str, int]) -> tuple[dict[tuple[int, int], dict[str, str]], list[tuple[int, str]]]:
    by_season_team: dict[tuple[int, int], dict[str, str]] = {}
    unmatched: list[tuple[int, str]] = []

    with KENPOM_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            season = int(row["year"])
            if season < SEASON_START or season > SEASON_END:
                continue

            team_id = name_to_id.get(normalize_name(row["team_name"]))
            if team_id is None:
                unmatched.append((season, row["team_name"]))
                continue

            by_season_team[(season, team_id)] = row

    return by_season_team, unmatched


def load_seeds() -> dict[tuple[int, int], str]:
    seeds: dict[tuple[int, int], str] = {}
    with (KAGGLE_DIR / "MNCAATourneySeeds.csv").open(newline="") as handle:
        for row in csv.DictReader(handle):
            season = int(row["Season"])
            if season < SEASON_START or season > SEASON_END:
                continue
            seeds[(season, int(row["TeamID"]))] = row["Seed"]
    return seeds


def build_rows() -> tuple[list[dict[str, object]], dict[str, int]]:
    name_to_id, id_to_name = load_kaggle_team_lookup()
    kenpom, unmatched_kenpom_rows = load_kenpom_rows(name_to_id)
    seeds = load_seeds()
    rows: list[dict[str, object]] = []
    stats = {
        "games_seen": 0,
        "games_written": 0,
        "missing_kp_rows": 0,
        "missing_seed_rows": 0,
        "unmatched_kenpom_rows": len(set(unmatched_kenpom_rows)),
    }

    with (KAGGLE_DIR / "MNCAATourneyCompactResults.csv").open(newline="") as handle:
        for game in csv.DictReader(handle):
            season = int(game["Season"])
            if season < SEASON_START or season > SEASON_END:
                continue

            stats["games_seen"] += 1
            winner_id = int(game["WTeamID"])
            loser_id = int(game["LTeamID"])
            low_id, high_id = sorted((winner_id, loser_id))

            low_kp = kenpom.get((season, low_id))
            high_kp = kenpom.get((season, high_id))
            if low_kp is None or high_kp is None:
                stats["missing_kp_rows"] += 1
                continue

            low_seed_raw = seeds.get((season, low_id))
            high_seed_raw = seeds.get((season, high_id))
            if low_seed_raw is None or high_seed_raw is None:
                stats["missing_seed_rows"] += 1
                continue

            low_net = float(low_kp["net_rating"])
            high_net = float(high_kp["net_rating"])
            low_off = float(low_kp["offense_rating"])
            high_off = float(high_kp["offense_rating"])
            low_def = float(low_kp["defense_rating"])
            high_def = float(high_kp["defense_rating"])
            low_tempo = float(low_kp["adj_tempo"])
            high_tempo = float(high_kp["adj_tempo"])
            low_sos = float(low_kp["schedule_net_rating"])
            high_sos = float(high_kp["schedule_net_rating"])
            low_seed_num = parse_seed_number(low_seed_raw)
            high_seed_num = parse_seed_number(high_seed_raw)

            rows.append(
                {
                    "season": season,
                    "day_num": int(game["DayNum"]),
                    "round_name": ROUND_BY_DAY.get(int(game["DayNum"]), "Unknown"),
                    "team_low_id": low_id,
                    "team_low_name": id_to_name[low_id],
                    "team_low_seed": low_seed_raw,
                    "team_low_seed_num": low_seed_num,
                    "team_high_id": high_id,
                    "team_high_name": id_to_name[high_id],
                    "team_high_seed": high_seed_raw,
                    "team_high_seed_num": high_seed_num,
                    "winner_low": 1 if winner_id == low_id else 0,
                    "winner_id": winner_id,
                    "winner_name": id_to_name[winner_id],
                    "loser_id": loser_id,
                    "loser_name": id_to_name[loser_id],
                    "low_net_rating": low_net,
                    "high_net_rating": high_net,
                    "low_offense_rating": low_off,
                    "high_offense_rating": high_off,
                    "low_defense_rating": low_def,
                    "high_defense_rating": high_def,
                    "low_adj_tempo": low_tempo,
                    "high_adj_tempo": high_tempo,
                    "low_schedule_net_rating": low_sos,
                    "high_schedule_net_rating": high_sos,
                    "net_rating_diff": low_net - high_net,
                    "offense_rating_diff": low_off - high_off,
                    "defense_rating_diff": low_def - high_def,
                    "adj_tempo_diff": low_tempo - high_tempo,
                    "schedule_net_rating_diff": low_sos - high_sos,
                    "seed_num_diff": (low_seed_num - high_seed_num)
                    if low_seed_num is not None and high_seed_num is not None
                    else "",
                }
            )
            stats["games_written"] += 1

    return rows, stats


def write_rows(rows: list[dict[str, object]]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else []
    with OUTPUT_PATH.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    rows, stats = build_rows()
    if not rows:
        raise RuntimeError("No matchup rows were built")
    write_rows(rows)
    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH.relative_to(ROOT)}")
    for key, value in stats.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    main()
