# 19 — Index-Powered Features (Phase 5: UI)

## Depends on
- Task 18 (store surviving indices)
- Task 15 (card switcher shell)
- Task 09 (team survival page at /teams/[name])

## Features

### "Browse a survivor for your team" — My Team tab enhancement
Add to the My Team tab (below the round-by-round stats):
```
→ Browse a surviving Duke bracket  [links to /bracket/[index]]
```
Fetches `GET /api/survivors?champion=Duke&limit=1`, links to that specific bracket.
If multiple exist, could offer "→ Another one" to cycle through a few.

### By the Numbers enrichments
Additional one-liner stats enabled by having the index list:
- Brackets picking all 1-seeds in Final Four: count brackets where all 4 champions of their regional semifinals are seed 1
- Most common Final Four: the single most frequently occurring Final Four combination among survivors (requires grouping by F4 set — expensive, compute during analysis or on-demand with a cap)

### Bracket Browser — "Surviving only" filter
Add a toggle to the existing bracket browser section:
"Show a random surviving bracket" — picks a random index from `surviving_indices` table instead of a fully random number. Makes the bracket browser actually useful at this stage of the tournament.

## Note on compute
Some of these queries (e.g. most common Final Four) require reconstructing brackets from indices. At 100K brackets, `reconstructBracket()` × 100K = ~6M PRNG calls — fast enough to run at analysis time and cache, not at request time.

If a query is too slow for request time, compute it during analysis and store in the stats JSON (same pattern as gamePickCounts/roundSurvivorCounts).

## Acceptance Criteria
- My Team tab shows a live link to a surviving bracket for the selected team
- Bracket browser has a "surviving only" random option
- All links resolve to valid, currently-alive brackets

## Affected Files
- `components/MyTeamTab.tsx`
- `components/ByTheNumbers.tsx`
- `app/page.tsx` (bracket browser section)
- `app/api/survivors/route.ts`
