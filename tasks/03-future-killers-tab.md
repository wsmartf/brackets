# 03 — Future Killers Tab

## Depends on
- Task 01 (store surviving indices)

## Constraints
- Prefer live ESPN schedule data when available so the tab reflects the actual next games on the slate.
- Fall back to locally derived known matchups if ESPN schedule data is unavailable.
- Only show scheduled games whose participants are already known.

## Goal
Show the next scheduled tournament games that are guaranteed to eliminate surviving
brackets, using ESPN schedule ordering when available.

## Data needed
For each upcoming game where both participants are known, compute:
- How many surviving brackets picked team1 to win
- How many surviving brackets picked team2 to win
- Guaranteed kills = min(team1 picks, team2 picks)
- Scheduled tip time from ESPN when available

This requires `gamePickCounts[63][2]` — per-game pick distribution across survivors.
That data is already computed during analysis from stored indices.

Live schedule data should come from ESPN scoreboard responses, matched back to the
current canonical bracket state.

## Content per game row
```
Thu 7:10 PM  Kentucky vs Duke  ·  Elite Eight
             ███████████░░░░░  63K pick Duke / 37K pick Kentucky
             37,000 guaranteed kills
```

Primary ordering should be by actual upcoming schedule, not by guaranteed kills.
Only show games where both participants are determined from completed prior rounds.
Default to the next 5 scheduled games.

## Empty state
- "No upcoming scheduled tournament games with known participants yet."
- If ESPN is unavailable, show a fallback note and use locally derived known matchups.

## Acceptance Criteria
- Uses ESPN schedule ordering when available
- Limits the list to the next 5 scheduled games
- Falls back cleanly when ESPN schedule data is unavailable
- Bar split is proportional and visually clear
- Only shows games with known participants
- Handles empty state cleanly

## Current Status
- Status: Done
- Last updated: 2026-03-22
- Notes:
  - Added live ESPN schedule extraction for upcoming tournament games, including calendar date discovery.
  - Added `/api/future-killers` to merge ESPN-scheduled games with local `gamePickCounts` and canonical bracket state.
  - The UI now shows the next scheduled games with known participants, ordered by schedule, with a fallback to locally derived matchups if ESPN is unavailable.
  - Added tests for schedule extraction, schedule matching, TBD exclusion, fallback behavior, and API shape.

## Next Steps
- None. Task is complete.

## Affected Files
- `components/AnalysisCardSwitcher.tsx`
- `components/FutureKillersTab.tsx`
- `lib/espn.ts`
- `app/api/future-killers/route.ts` (new)
- `app/page.tsx`
- `tests/future-killers.test.ts`
- `tests/smoke.spec.ts`
