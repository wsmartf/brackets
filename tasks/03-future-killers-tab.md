# 20 — Future Killers Tab

## Depends on
- Task 18 (store surviving indices)
- Task 15 (analysis card switcher shell — tab already exists as placeholder)

## Goal
Replace the Future Killers tab placeholder with real content: upcoming games ranked
by how many brackets they are guaranteed to eliminate, regardless of outcome.

## Data needed
For each undecided game where both participants are known, compute:
- How many surviving brackets picked team1 to win
- How many surviving brackets picked team2 to win
- Guaranteed kills = min(team1 picks, team2 picks)

This requires `gamePickCounts[63][2]` — per-game pick distribution across survivors.
Compute this during analysis from stored indices (reconstruct each bracket, tally picks)
and store in the stats JSON blob.

## Content per game row
```
#1  Kentucky vs Duke  ·  Elite Eight
    ███████████░░░░░  63K pick Duke / 37K pick Kentucky
    37,000 brackets die no matter what
    If Kentucky wins: 63,000 more die
```

Sorted by guaranteed kills descending.
Only show games where both participants are determined from completed prior rounds.

## Empty state
"No upcoming matchups with determined participants yet."

## Acceptance Criteria
- Games ranked correctly by guaranteed kills
- Bar split is proportional and visually clear
- Only shows games with known participants
- Handles empty state cleanly

## Affected Files
- `components/AnalysisCardSwitcher.tsx`
- `components/FutureKillersTab.tsx` (new)
- `lib/analyze.ts` (compute gamePickCounts from stored indices, add to stats JSON)
- `app/page.tsx` (pass gamePickCounts through)
