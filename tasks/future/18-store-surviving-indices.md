# 18 — Store Surviving Indices (Phase 4: Backend)

## Goal
During each analysis run, persist the actual integer indices of surviving brackets to SQLite. At ~100K remaining, this is feasible and unlocks per-team bracket browsing and future correlation queries.

## Why now
At 100K remaining: 100K × 4 bytes = ~400KB. Trivial to store and query. Earlier it was impossible (1B indices). The window is now.

## Schema
```sql
CREATE TABLE surviving_indices (
  index INTEGER NOT NULL,
  champion_index INTEGER NOT NULL  -- position in initialOrder array
);
CREATE INDEX idx_surviving_champion ON surviving_indices (champion_index);
```

`champion_index` stored alongside each index so we can filter by champion without reconstructing every bracket.

## Worker changes (lib/worker.mts)
- Collect `survivingIndices: number[]` alongside the existing champion tracking
- Each surviving bracket already knows its champion (used for championCounts) — emit `{ index, championIndex }` pairs
- Return as part of worker message: `survivingIndices: Array<{ index: number, championIndex: number }>`

## Orchestrator changes (lib/analyze.ts)
- Aggregate index lists from all workers (concat, no dedup needed)
- After aggregation, call `replaceSurvivingIndices(indices)`

## DB changes (lib/db.ts)
New function `replaceSurvivingIndices`:
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
- Use case: "show me a surviving bracket where Duke wins" → pick first result, link to /bracket/[index]
- Paginate if needed (limit=50 default)

## Acceptance Criteria
- After analysis, `surviving_indices` table has exactly `remaining` rows
- `champion_index` values match `championCounts` totals
- `GET /api/survivors?champion=Duke` returns correct indices
- Transaction is atomic — no partial writes visible
- No meaningful regression to analysis runtime

## Supersedes
`tasks/future/2026-03-18-11-surviving-bracket-browser.md` — same concept, this is the full spec.

## Affected Files
- `lib/worker.mts`
- `lib/analyze.ts`
- `lib/db.ts`
- `app/api/survivors/route.ts` (new)
