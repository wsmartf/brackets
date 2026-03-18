## Goal
Persist analysis snapshots over time and visualize the collapse of the bracket universe across games and days.

## Why
- Historical memory makes the site feel alive instead of only current-state.
- It supports charts, stories, and postgame recaps.
- It increases both public appeal and portfolio depth.

## Constraints
- Keep snapshot storage compact and append-only.
- Prefer one snapshot per refresh or per materially changed state.
- Do not complicate the hot analysis path more than necessary.

## Acceptance Criteria
- Analysis snapshots are stored with timestamp and core metrics.
- The site exposes a timeline/chart of remaining brackets over time.
- The UI can connect major drops to completed games.
- Browser verification covers the timeline on desktop and mobile.

## Current Status
- Not started.

## Next Steps
- Add a snapshot table and write path.
- Decide the minimum snapshot schema.
- Build a chart that is readable on mobile.

## Affected Files
- `lib/db.ts`
- `lib/analyze.ts`
- `app/api/*`
- `components/`
- `app/page.tsx`
