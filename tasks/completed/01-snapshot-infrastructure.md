# 01 — Snapshot Infrastructure (MUST ship before tip-off)

## Goal
Capture a timestamped snapshot every time analysis runs, so we have a historical record of the bracket collapse from game 1 onward.

## Why this is #1
If we don't have this before the first game, we lose that data forever. Every other feature (timeline chart, per-game elimination impact, collapse narrative) depends on having snapshots. This is pure infrastructure — no UI needed yet.

## Scope
- Add a `snapshots` table to SQLite
- Write one row at the end of every successful analysis run
- Expose snapshots through a read endpoint

## Schema
```sql
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  remaining INTEGER NOT NULL,
  games_completed INTEGER NOT NULL,
  championship_probs TEXT NOT NULL,  -- JSON string
  game_results_hash TEXT NOT NULL,   -- hash of current results for dedup
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The `game_results_hash` lets us avoid storing duplicate snapshots if analysis is re-run without new results.

## Implementation
1. Add `createSnapshot()` and `getSnapshots()` to `lib/db.ts`
2. Call `createSnapshot()` at the end of `runAnalysis()` in `lib/analyze.ts`, after writing stats
3. Add `GET /api/snapshots` — public, returns all snapshots ordered by created_at
4. Run `make verify` to confirm no type errors

## Acceptance Criteria
- Every successful analysis creates exactly one snapshot row
- Re-running analysis with identical results does NOT create a duplicate
- `GET /api/snapshots` returns the history
- Existing analysis behavior is unchanged

## Affected Files
- `lib/db.ts`
- `lib/analyze.ts`
- `app/api/snapshots/route.ts` (new)
