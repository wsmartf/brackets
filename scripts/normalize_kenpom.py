#!/usr/bin/env python3
"""Normalize raw KenPom TSV exports into one clean CSV file.

The raw exports in `kenpom-historical-data/` are copied directly from the
KenPom table. They are tab-delimited, may include an extra leading label row,
and encode the NCAA seed inside the team column. This script preserves the raw
files and writes a normalized CSV for modeling/backtesting.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "kenpom-historical-data"
OUTPUT_PATH = RAW_DIR / "kenpom-ratings.csv"
INPUT_GLOB = "kp-*.tsv"

TEAM_SEED_RE = re.compile(r"^(?P<team>.+?)\s+(?P<seed>\d+)\*?$")
YEAR_RE = re.compile(r"kp-(?P<year>\d{4})\.tsv$")


@dataclass(frozen=True)
class NormalizedRow:
    year: int
    rank: int
    team_raw: str
    team_name: str
    seed: int | None
    conf: str
    wins: int
    losses: int
    net_rating: float
    offense_rating: float
    offense_rank: int
    defense_rating: float
    defense_rank: int
    adj_tempo: float
    adj_tempo_rank: int
    luck: float
    luck_rank: int
    schedule_net_rating: float
    schedule_rank: int
    schedule_offense_rating: float
    schedule_offense_rank: int
    schedule_defense_rating: float
    schedule_defense_rank: int
    nonconf_schedule_net_rating: float
    nonconf_schedule_rank: int


def parse_int(value: str) -> int:
    return int(value.strip())


def parse_float(value: str) -> float:
    cleaned = value.strip().replace("+", "")
    return float(cleaned)


def parse_record(year: int, row: list[str]) -> NormalizedRow:
    team_raw = row[1].strip()
    match = TEAM_SEED_RE.match(team_raw)
    if match:
      team_name = match.group("team")
      seed = parse_int(match.group("seed"))
    else:
      team_name = team_raw
      seed = None

    wins_str, losses_str = row[3].split("-", 1)

    return NormalizedRow(
        year=year,
        rank=parse_int(row[0]),
        team_raw=team_raw,
        team_name=team_name,
        seed=seed,
        conf=row[2].strip(),
        wins=parse_int(wins_str),
        losses=parse_int(losses_str),
        net_rating=parse_float(row[4]),
        offense_rating=parse_float(row[5]),
        offense_rank=parse_int(row[6]),
        defense_rating=parse_float(row[7]),
        defense_rank=parse_int(row[8]),
        adj_tempo=parse_float(row[9]),
        adj_tempo_rank=parse_int(row[10]),
        luck=parse_float(row[11]),
        luck_rank=parse_int(row[12]),
        schedule_net_rating=parse_float(row[13]),
        schedule_rank=parse_int(row[14]),
        schedule_offense_rating=parse_float(row[15]),
        schedule_offense_rank=parse_int(row[16]),
        schedule_defense_rating=parse_float(row[17]),
        schedule_defense_rank=parse_int(row[18]),
        nonconf_schedule_net_rating=parse_float(row[19]),
        nonconf_schedule_rank=parse_int(row[20]),
    )


def iter_rows(path: Path) -> list[NormalizedRow]:
    year_match = YEAR_RE.search(path.name)
    if not year_match:
        raise ValueError(f"Could not parse season year from {path.name}")
    year = parse_int(year_match.group("year"))

    normalized: list[NormalizedRow] = []
    with path.open(newline="") as handle:
        reader = csv.reader(handle, delimiter="\t")
        for row in reader:
            if not row:
                continue
            if len(row) == 2:
                # Example: "Strength of Schedule\tNCSOS"
                continue
            if len(row) == 13 and row[0] == "Rk":
                continue
            if len(row) != 21:
                continue
            normalized.append(parse_record(year, row))
    return normalized


def main() -> None:
    rows: list[NormalizedRow] = []
    input_paths = sorted(RAW_DIR.glob(INPUT_GLOB))

    if not input_paths:
        raise SystemExit(f"No raw KenPom TSV files found in {RAW_DIR}")

    for path in input_paths:
        file_rows = iter_rows(path)
        rows.extend(file_rows)
        print(f"{path.name}: parsed {len(file_rows)} rows")

    rows.sort(key=lambda row: (row.year, row.rank))

    with OUTPUT_PATH.open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(NormalizedRow.__annotations__.keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(row.__dict__)

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
