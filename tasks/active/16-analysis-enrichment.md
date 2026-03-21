# 16 — Analysis Enrichment (Phase 2: Backend)

## Goal
Extend the worker and analysis pipeline to compute two new aggregate data structures during each analysis run. These power the My Team tab (round-by-round survival) and the Future Killers tab (per-game pick distribution). No stored indices yet — pure aggregate counts.

## New data: gamePickCounts
For each of 63 games, how many surviving brackets picked team1 vs team2.

```
gamePickCounts[gameIndex][0] = count of survivors who picked team1
gamePickCounts[gameIndex][1] = count of survivors who picked team2
```

Flattened to `number[]` of length 126 for worker message.

Used by: Future Killers tab (rank undecided games by guaranteed kills = min of the two counts).

## New data: roundSurvivorCounts
For each of 6 rounds × 64 teams, how many surviving brackets have that team reaching that round.

```
roundSurvivorCounts[roundIndex][teamIndex] = count
```

Rounds in order: R64 (idx 0), R32 (1), S16 (2), E8 (3), F4 (4), Championship (5).
Flattened to `number[]` of length 384 for worker message.

Used by: My Team tab (show round-by-round survival counts per team).

## Worker changes (lib/worker.mts)
- Allocate `gamePickCounts` (126 numbers) and `roundSurvivorCounts` (384 numbers)
- For each surviving bracket:
  - `gamePickCounts` already tracked during simulation — just record team1 vs team2 pick per game
  - `roundSurvivorCounts`: at each round boundary, for each team still alive, increment their round count
- Include both in the worker → main message

## Orchestrator changes (lib/analyze.ts)
- Aggregate `gamePickCounts` and `roundSurvivorCounts` from all workers (simple element-wise sum)
- Include in the `AnalysisResult` type
- Store in the stats JSON blob via `setStats("analysis", ...)`

## API changes
- `GET /api/stats` already returns the full stats blob — no new route needed
- Frontend consumes the new fields from the existing endpoint

## Acceptance Criteria
- After an analysis run, `GET /api/stats` includes `gamePickCounts` and `roundSurvivorCounts`
- Values sum to `remaining` across each dimension (sanity check)
- No regression to analysis runtime (both arrays are tiny, negligible overhead)
- Champion counts in `roundSurvivorCounts[5]` match existing `championCounts`

## Affected Files
- `lib/worker.mts`
- `lib/analyze.ts`
- `app/api/stats/route.ts` (type passthrough only, if needed)
