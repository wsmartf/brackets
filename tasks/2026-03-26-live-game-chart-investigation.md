# Live Game Chart Investigation

## Goal
Understand why a tournament game disappears from the bracket paths chart when it starts, and identify the safest code path to change so live games can remain visible.

## Constraints
- Keep the site working during the tournament with small, reliable changes.
- Preserve manual override and fallback paths if ESPN schedule data is incomplete.

## Acceptance Criteria
- The current disappearing-game behavior is traced to a specific condition in code or upstream data.
- The likely fix surface and its tradeoffs are documented well enough to choose an implementation approach next.

## Current Status
- Status: Done
- Last updated: 2026-03-26
- Notes:
  - Implemented a backend-owned Final Five cohort and a shared pending-game timeline that includes live games.
  - Final N chart/cards now render from server-owned display brackets instead of browser-local storage.
  - Final N insights now use the same pending-game timeline, fixing live-game date grouping.

## Next Steps
- Monitor the live site during the next game transition and confirm the Final Five cohort remains stable in a fresh browser.
- Add a higher-level workflow test harness for `runAnalysis`/refresh-driven Final N transitions if we want end-to-end regression coverage.

## Affected Files
- `lib/espn.ts`
- `lib/future-killers.ts`
- `app/api/future-killers/route.ts`
- `components/BracketPathVisualizer.tsx`
