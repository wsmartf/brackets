# 17 — My Team + Future Killers Tabs (Phase 3: UI)

## Depends on
- Task 15 (card switcher shell)
- Task 16 (analysis enrichment — gamePickCounts, roundSurvivorCounts)

## My Team Tab

Replace placeholder with real content.

**Default state (no team selected):**
- Prompt: "Which team are you rooting for?"
- Dropdown: all teams with at least 1 surviving bracket, sorted by count descending

**Team selected:**
```
Duke
─────────────────────────────────────────
Championship    18,412 brackets    18.4%
Ranked #2 among survivors

Round of 32     91,200             91.0%
Sweet 16        62,400             62.2%
Elite Eight     31,800             31.7%
Final Four      18,412             18.4%

→ Full team breakdown  [links to /teams/duke]
```
Data comes from `roundSurvivorCounts` in the stats blob.

**Eliminated team selected:**
- Show which round they were eliminated
- Show how many brackets had them at time of elimination (last snapshot data)

**Default active tab:** My Team (once this ships, replace Survivors as default)

## Future Killers Tab

Replace placeholder with real content.

**Content:** All undecided games where both participants are currently known, ranked by guaranteed kills.

```
Guaranteed kills = min(picks for team1, picks for team2)
(the number of brackets that die no matter who wins)
```

**Per-game row:**
```
#1  Kentucky vs Duke  ·  Elite Eight
    ███████████░░░░░  63K pick Duke / 37K pick Kentucky
    37,000 brackets die no matter what
    If Kentucky wins: 63,000 more die
```

Sorted by guaranteed kills descending. "Known participants" = games where the teams are determined from completed prior rounds (check results table to see if both prior games in the bracket half are complete).

**Empty state:** "No upcoming matchups with determined participants yet."

Data comes from `gamePickCounts` in the stats blob, cross-referenced with current results to find undecided games.

## By the Numbers enrichment (also in this phase)
Add two more stats to the sidebar using the new data:
- Longest-surviving underdog: highest-seed team still with surviving brackets (from roundSurvivorCounts — find highest seed still present in any round)
- Most dangerous upcoming game: same as #1 in Future Killers tab, shown as a one-liner

## Acceptance Criteria
- My Team dropdown shows only alive teams
- Round-by-round survival counts display correctly for any selected team
- Eliminated team state is clear and accurate
- Future Killers ranks games correctly by guaranteed kills
- Bar split is visually clear (proportional fill)
- Both tabs handle empty/loading states cleanly
- By the Numbers shows 2 new stats

## Affected Files
- `components/AnalysisCardSwitcher.tsx`
- `components/MyTeamTab.tsx` (new)
- `components/FutureKillersTab.tsx` (new)
- `components/ByTheNumbers.tsx`
- `app/page.tsx` (pass new stats fields through)
