## Goal
Show how upcoming games could change the surviving bracket universe before they happen.

## Why
- This turns the site from passive tracker into forward-looking instrument.
- It is both impressive and genuinely useful.
- It creates strong "what if" content for social sharing during game windows.

## Constraints
- Keep the first version narrow: next unplayed games only.
- Reuse existing deterministic analysis machinery where possible.
- Avoid expensive full recomputation on every page load.

## Acceptance Criteria
- The site can show projected survivor impact for at least the next set of unplayed games.
- Visitors can compare the universe impact of each possible winner.
- The UI clearly separates actual results from projected scenarios.
- Browser verification covers the scenario view.

## Current Status
- Not started.

## Next Steps
- Decide whether to compute scenarios during refresh or on demand.
- Define the minimal scenario API shape.
- Build a UI that makes the deltas legible.

## Affected Files
- `lib/analyze.ts`
- `lib/tournament.ts`
- `app/api/*`
- `components/`
- `app/page.tsx`
