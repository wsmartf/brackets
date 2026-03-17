# March Madness 2026 — Architecture

## Overview

A single Next.js app that generates and tracks 1 billion March Madness brackets
in real-time as tournament results come in. Brackets are not stored — they are
deterministically reconstructed on demand using a seeded PRNG, making the system
a "Library of Babel" for tournament brackets.

## How It Works

### Bracket Generation (the core idea)

Each bracket is defined by an integer index (0 to 999,999,999). Given an index:

1. Seed a **mulberry32 PRNG** with the index
2. For each of the 63 tournament games (in canonical order):
   - Draw a random float from the PRNG
   - Compare it to the **win probability** for that matchup (derived from KenPom ratings)
   - If the random float < probability, the favored team wins; otherwise, the underdog wins
3. The 63 game outcomes form a complete bracket

This is **fully deterministic**: bracket #1,047,391 always produces the same 63 outcomes.
No storage is needed — any bracket can be reconstructed from its index alone.

### Win Probability Model

Uses a **logistic function** on KenPom rating difference:

```
P(team_A wins) = 1 / (1 + exp(-beta * (rating_A - rating_B)))
```

Where `beta = 0.07` (calibrated against historical NCAA tournament upset rates).

For rounds after Round of 64, probabilities are computed dynamically based on
which teams the PRNG has advancing. Each bracket has a unique path through the
tournament tree.

### Analysis (filtering brackets against real results)

When real results come in, we need to count how many of our 1B brackets match.

For each bracket index 0..999,999,999:
1. Reconstruct the bracket (63 PRNG calls)
2. For each known result: check if the bracket agrees
3. If ALL known results match: increment "remaining" counter + track the champion

This runs in **parallel across worker threads** (~10 workers on an 8-core i9).
Expected throughput: ~5-7M brackets/sec → **~150-200 seconds for 1B brackets**.

The results are cached in SQLite. A "refresh" action triggers a full re-analysis.

### Canonical Game Ordering

Games are numbered 0-62 in this order:
- Games 0-31: Round of 64 (32 games)
- Games 32-47: Round of 32 (16 games)
- Games 48-55: Sweet 16 (8 games)
- Games 56-59: Elite 8 (4 games)
- Games 60-61: Final Four (2 games)
- Game 62: Championship (1 game)

Within each round, games follow the standard bracket order:
- Region order: East, West, Midwest, South
- Within each region: (1v16), (8v9), (5v12), (4v13), (6v11), (3v14), (7v10), (2v15)

Teams are paired consecutively in the initial order: games[0] = initial_order[0] vs
initial_order[1], games[1] = initial_order[2] vs initial_order[3], etc.

Winners advance to the next round by pairing: winner of game 0 plays winner of game 1
(that's game 32), winner of game 2 plays winner of game 3 (game 33), etc.

### 63-Bit Representation

Each bracket can be packed into 63 bits (fits in a single JS number using two Uint32s):
- Bit N = 0: the first team in the canonical matchup won game N
- Bit N = 1: the second team won

This allows fast bitmask comparison against known results:
```
match = (bracket_lo & mask_lo) === (value_lo & mask_lo)
     && (bracket_hi & mask_hi) === (value_hi & mask_hi)
```

## Data Flow

```
ESPN API → /api/refresh → fetch scores → update results in SQLite
                        → spawn worker threads → iterate 1B brackets
                        → aggregate stats (remaining count, championship probs)
                        → cache in SQLite
                        → return stats to client

Client (page.tsx) → GET /api/stats → read cached stats → render dashboard
```

## File Structure

```
lib/
  prng.ts           — mulberry32 PRNG (FULLY IMPLEMENTED, do not modify)
  tournament.ts     — Team data loading, probability computation, initial order
  worker.ts         — Worker thread: generates + filters a chunk of bracket indices
  analyze.ts        — Orchestrates workers, aggregates results, writes to SQLite
  db.ts             — SQLite schema + query helpers
  espn.ts           — Fetch + parse ESPN scoreboard API for game results

app/
  page.tsx          — Dashboard: remaining count, championship probs, game feed
  layout.tsx        — Root layout with fonts
  api/stats/        — GET cached stats
  api/refresh/      — POST trigger analysis
  api/results/      — GET/POST manual result management
  bracket/[id]/     — View a single bracket by index (stretch goal)

components/
  Dashboard.tsx     — Main stats display with refresh button
  ProbabilityBars.tsx — Horizontal bar chart of championship odds
  GameFeed.tsx      — Recent results with "% brackets eliminated"

data/
  tournament-2026.json — 64 teams with seeds, regions, KenPom ranks
```

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS results (
  game_index INTEGER PRIMARY KEY,  -- 0-62
  round INTEGER NOT NULL,          -- 64, 32, 16, 8, 4, 2
  team1 TEXT NOT NULL,
  team2 TEXT NOT NULL,
  winner TEXT,                     -- NULL if game not yet played
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,             -- JSON string
  updated_at TEXT DEFAULT (datetime('now'))
);
```

Stats keys:
- `remaining_count` — integer, how many brackets still match all results
- `total_brackets` — integer, always 1,000,000,000
- `championship_probs` — JSON object: { "Duke": 0.342, "Michigan": 0.221, ... }
- `best_bracket` — JSON: { index: number, wrong_count: number, picks: [...] }
- `per_game_impact` — JSON array: [{ game_index, winner, pct_eliminated }, ...]

## Key Constants

```ts
const NUM_BRACKETS = 1_000_000_000;
const BETA = 0.07;  // logistic function steepness
const NUM_WORKERS = 10; // parallel worker threads (adjust for host CPU)
```

## Hosting

Self-hosted on a 2019 MacBook Pro (8-core i9, 32GB RAM) with Cloudflare Tunnel
for public HTTPS access. The analysis (1B brackets) takes ~2.5-3.5 minutes per
refresh on this hardware.
