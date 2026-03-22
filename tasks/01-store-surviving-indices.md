# 01 — Store Surviving Indices

**Do this now — we're down to ~30K brackets (~120KB to store).**

## Goal
During each analysis run, persist the integer indices of surviving brackets to SQLite.
Storing an index is storing everything — brackets are deterministic by seed.

## Schema
```sql
CREATE TABLE surviving_indices (
  index INTEGER NOT NULL,
  champion_index INTEGER NOT NULL  -- position in initialOrder array
);
CREATE INDEX idx_surviving_champion ON surviving_indices (champion_index);
```

`champion_index` stored alongside each index so we can filter by champion without
reconstructing every bracket.

## Worker changes (lib/worker.mts)
- Collect `survivingIndices: Array<{ index: number; championIndex: number }>` alongside
  existing champion tracking
- Each surviving bracket already knows its champion (used for championCounts)
- Return in worker message

## Orchestrator changes (lib/analyze.ts)
- Concat index lists from all workers
- After aggregation, call `replaceSurvivingIndices(indices)`

## DB changes (lib/db.ts)
```typescript
function replaceSurvivingIndices(
  indices: Array<{ index: number; championIndex: number }>
): void {
  // Single transaction: DELETE all + bulk INSERT
}
```

## New API endpoint
`GET /api/survivors?champion=Duke`
- Optional `champion` param (team name) — filter by champion_index
- Returns array of bracket indices
- Default limit 50

## Acceptance Criteria
- After analysis, `surviving_indices` table has exactly `remaining` rows
- `champion_index` values match `championCounts` totals
- `GET /api/survivors?champion=Duke` returns correct indices
- Transaction is atomic
- No meaningful regression to analysis runtime

## Current Status
- Status: Done
- Last updated: 2026-03-22
- Notes:
  - Surviving-index persistence is implemented in the worker, analysis, DB, and API layers.
  - Verified against the cached analysis blob: `surviving_indices` row count matches `remaining`, and grouped `champion_index` counts match the cached champion totals.
  - Positive and negative `/api/survivors` API paths are covered by smoke tests.
  - Analysis runtime benchmarking was completed separately.

## Next Steps
- None. Task is complete.

## Affected Files
- `lib/worker.mts`
- `lib/analyze.ts`
- `lib/db.ts`
- `app/api/survivors/route.ts` (new)
