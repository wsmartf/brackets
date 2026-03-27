# Homepage width

## Goal
Make the site UI use more of the browser width on desktop without breaking the current homepage, Final N layout, or bracket viewer.

## Constraints
- Keep the existing visual language and page structure intact.
- Verify with the smallest useful test layers for a UI-only change.

## Acceptance Criteria
- Desktop layouts are visibly wider than the old `max-w-5xl` shell.
- Home and bracket pages still load in smoke tests after the width change.

## Current Status
- Status: Done
- Last updated: 2026-03-26
- Notes:
  - Repeated `max-w-5xl` containers on the home and bracket views were constraining desktop width.
  - Widened the shared shells to `max-w-7xl`, then tightened the gutters back up with larger responsive side padding.
  - Final N cards now stay at 2 or 3 columns until extra-wide screens can support 5 columns cleanly.
  - Verification passed with `make test` and `npx playwright test tests/smoke.spec.ts`.

## Next Steps
- Archive or delete this task note if no further layout follow-up is needed.

## Affected Files
- `components/SiteNav.tsx`
- `components/StandardHomepage.tsx`
- `components/FinalNHomepage.tsx`
- `components/BracketViewer.tsx`
- `components/UpcomingGames.tsx`
- `tests/smoke.spec.ts`
