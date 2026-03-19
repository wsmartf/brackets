# 02 — Per-Game Elimination Tracking (MUST ship before tip-off)

## Goal
After each analysis run, record how many brackets each completed game eliminated. This powers the "Duke's loss just killed 312 million brackets" narrative.

## Why this is #2
This is the single most shareable stat the site can produce. It requires a data pipeline change, so it needs to land before games start. The UI can come later, but the data must be captured from game 1.

## Approach
The cheapest way: after a full analysis completes, re-run a quick per-game impact estimation. For each completed game, temporarily flip that one result and re-count survivors (or estimate from the probability model). But that's expensive for 1B brackets.

**Simpler approach using snapshots:** The elimination impact of game N is approximately `snapshot[N-1].remaining - snapshot[N].remaining`. This works if we run analysis after each new result. Snapshots (task 01) already capture `remaining` and `games_completed`. The per-game attribution can be computed as a view over snapshots — no separate pipeline needed.

**Recommendation:** Skip a separate computation pipeline. Instead:
1. Ensure snapshots capture enough info (task 01 handles this)
2. Add a `last_game_index` or `new_results` field to snapshots so we can attribute the delta
3. Compute elimination impact as `previous_snapshot.remaining - current_snapshot.remaining` when displaying

## Schema addition to snapshots
Add to the snapshot row:
```
new_game_indices TEXT  -- JSON array of game_index values that are new since last snapshot
```

## Implementation
1. In `createSnapshot()`, compute which game results are new vs the previous snapshot
2. Store the new game indices in the snapshot row
3. Add a helper `getEliminationImpact()` that returns `{ game_index, eliminated, remaining_after }` for each transition
4. Expose via `GET /api/snapshots` (enrich response with computed deltas)

## Acceptance Criteria
- Each snapshot records which games were newly completed
- The API can return the elimination impact per game
- No separate expensive analysis pass is needed

## Affected Files
- `lib/db.ts`
- `app/api/snapshots/route.ts`
