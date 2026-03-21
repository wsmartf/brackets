# 02 — My Team Tab

## Depends on
- Task 01 (store surviving indices + GET /api/survivors)
- Task 15 (analysis card switcher shell — tab already exists as placeholder)

## Goal
Replace the My Team tab placeholder with real content: pick your team, see how many
surviving brackets have them winning at each round, and browse a surviving bracket
where they win.

## Default state (no team selected)
- Prompt: "Which team are you rooting for?"
- Dropdown: all teams with at least 1 surviving bracket, sorted by champion count descending
- Counts come from existing `championCounts` in stats blob

## Team selected
```
Duke
─────────────────────────────────────────
Champion        18,412    18.4%   (#2)
Final Four      24,800    24.7%
Elite Eight     38,100    38.0%
Sweet 16        61,200    61.0%

→ Browse a surviving Duke bracket  [links to /bracket/[index]]
→ Another one
```

- Champion count + rank from `championCounts` (already in stats blob)
- Round-by-round counts computed from stored indices during analysis, stored in stats JSON
  as `roundSurvivorCounts[roundIndex][teamIndex]` (6 rounds × 64 teams)
- Browse link fetches `GET /api/survivors?champion=Duke&limit=1`, links to `/bracket/[index]`
- "Another one" cycles through a few more

## Eliminated team selected
- Show clearly that the team has been eliminated
- Show champion count at time of elimination (from last snapshot)

## Make default tab
Once this ships, replace Survivors as the default active tab.

## Acceptance Criteria
- Dropdown shows only teams with surviving brackets, sorted by champion count
- Round-by-round counts display correctly for any selected team
- Eliminated teams show a clear eliminated state
- Browse link resolves to a valid surviving bracket
- Tab becomes the default active tab

## Affected Files
- `components/AnalysisCardSwitcher.tsx` (change default tab)
- `components/MyTeamTab.tsx` (new)
- `lib/analyze.ts` (compute roundSurvivorCounts from stored indices, add to stats JSON)
- `app/page.tsx` (pass roundSurvivorCounts through)
- `app/api/survivors/route.ts` (consumed here)
