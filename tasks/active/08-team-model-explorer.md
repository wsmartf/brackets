# 08 — Team & Model Explorer (Ship during tournament, nice-to-have)

## Goal
Add a page where visitors can browse teams, see their model inputs, and compare any two teams' matchup probability.

## Why
This makes the model inspectable and builds trust. It's also a strong portfolio signal — "you can look under the hood and see exactly what the model thinks about every possible matchup."

## Scope for v1
Keep it simple:
- List all 64 teams with seed, region, KenPom net rating
- Click a team to see its full stats
- Select two teams to see the head-to-head win probability
- Show which model features drive the prediction

## URL
`/teams` or `/model` — pick one

## Implementation
1. Create a new route
2. Load team data from `tournament-2026.json` (server component, no API needed)
3. Build a team list with search/filter
4. Build a comparison view that computes matchup probability using the existing `computeWinProbability` function
5. Show the feature breakdown (which factors favor which team)

## Acceptance Criteria
- All 64 teams are browsable
- Two-team comparison shows win probability with explanation
- Data matches what the bracket generator actually uses
- Browser-verified

## Affected Files
- `app/teams/page.tsx` (new) or `app/model/page.tsx`
- `components/` (team list, comparison view)
- `lib/tournament.ts` (may need to export helpers)
