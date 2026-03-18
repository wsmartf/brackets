# 06 — Collapse Timeline Chart (Ship during round of 64)

## Goal
Add a chart to the homepage showing the remaining bracket count over time, with major drops annotated by the game that caused them.

## Why
This is the visual payoff of the snapshot infrastructure. The line going down is the entire story of the tournament compressed into one image. It's the most shareable visual the site can produce.

## Depends on
- Task 01 (snapshot infrastructure)
- Task 02 (per-game elimination tracking, for annotations)

## Design
- Simple line chart (or step chart — the drops are discrete, so steps may be more honest)
- X-axis: time or game number
- Y-axis: remaining brackets (log scale probably needed — drops from 1B to thousands)
- Hover/tap on a drop to see which game caused it
- Keep it clean. No chart library bloat — consider a lightweight option (e.g., recharts, or even SVG drawn by hand if the data points are few)

## Chart library decision
Recharts is the pragmatic choice for a Next.js app. It's React-native, handles responsive sizing, and the bundle cost is acceptable for a single chart. Don't add D3 unless you need custom behavior recharts can't handle.

## Implementation
1. Fetch snapshots from `/api/snapshots`
2. Build a `CollapseTimeline` component
3. Render as a step chart with log-scale Y axis
4. Annotate the largest drops with game labels
5. Add to homepage below the hero stats

## Acceptance Criteria
- Chart renders with real snapshot data
- Drops are visually dramatic (step function, not smoothed)
- At least the top 3 drops are annotated with the game that caused them
- Responsive on mobile (simplified if needed)
- Works with 0 snapshots (empty state) and 1+ snapshots

## Affected Files
- `components/CollapseTimeline.tsx` (new)
- `app/page.tsx`
- `package.json` (if adding chart library)
