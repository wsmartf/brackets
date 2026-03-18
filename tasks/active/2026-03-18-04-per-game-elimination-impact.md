## Goal
Show how much each completed game reduced the surviving bracket universe.

## Why
- This makes the live tournament feel dramatic.
- It produces the most naturally shareable stat on the site.
- It gives the results feed real explanatory power.

## Constraints
- Keep the computation cheap enough for tournament-day refreshes.
- Preserve cached stats if the new metadata computation fails.
- Prefer storing compact derived metadata over expensive per-page recomputation.

## Acceptance Criteria
- Completed games show `% eliminated` or equivalent impact in the results feed.
- The site can identify the biggest elimination events so far.
- Refreshes persist the derived impact metadata alongside cached stats or snapshots.
- Browser verification covers the updated results feed.

## Current Status
- Not started.

## Next Steps
- Decide whether to compute impact during refresh or as a second pass.
- Define where the impact metadata lives.
- Update the game feed UI.

## Affected Files
- `lib/analyze.ts`
- `lib/db.ts`
- `app/api/*`
- `components/GameFeed.tsx`
- `app/page.tsx`
