# Final N Homepage Implementation Status

## Goal
Implement the Final N homepage redesign in the required phase order, keeping the
existing homepage behavior intact above the threshold and verifying each phase
before continuing.

## Constraints
- Follow `tasks/04-final-n-homepage.md` and subtask docs `04a` through `04e` in order.
- Use `make verify`, `make test`, and `make build` at the checkpoints requested by the user.
- Do not use Playwright or network access during this task.

## Acceptance Criteria
- Each required step is implemented in the specified phase order.
- Required verification commands pass for each completed phase.
- Final status report captures completed steps, verifications, gaps, and remaining manual checks.

## Current Status
- Status: Done
- Last updated: 2026-03-23
- Notes:
  - Completed phases 1 through 3 in the required order.
  - Phase 1 Step 1 completed successfully: survivors detail mode, bracket likelihood, homepage hook extraction, StandardHomepage extraction, FinalNHomepage threshold path, and build checkpoint all passed.
  - Phase 1 Step 2 completed successfully: `BracketCard` and `lib/team-colors.ts` were present in the worktree and verified with the required `make verify && make test && make build` pass.
  - Phase 2 Step 3 completed successfully: added `components/SurvivalMatrix.tsx`, wired it into `FinalNHomepage`, and passed `make verify && make build`.
  - Phase 2 Step 4 completed successfully: added `components/UpcomingGames.tsx`, wired it into `FinalNHomepage`, and passed `make verify && make build`.
  - Phase 3 Step 5 completed successfully: added `hooks/useReturningVisitor.ts`, `components/SurvivalCurve.tsx`, animated eliminated-card support in `BracketCard`, and wired banner/count/card animation/curve behavior into `FinalNHomepage`, then passed `make verify && make build`.
  - Verifications passed:
    - `make build`
    - `make verify && make test && make build` (Phase 1 Step 1)
    - `make verify && make test && make build` (Phase 1 Step 2)
    - `make verify && make build` (Phase 2 Step 3)
    - `make verify && make build` (Phase 2 Step 4)
    - `make verify && make build` (Phase 3 Step 5)
  - Known issues / gaps:
    - The eliminated-card animation only applies to brackets eliminated since the visitor's last saved state; those cards are hydrated client-side from `/api/bracket/[id]`.
    - No Playwright or browser-based validation was run, per task constraints.
  - Manual visual verification still needed:
    - Final N threshold switch on a real low-survivor dataset
    - Survival matrix desktop/mobile layout and sticky first column
    - Upcoming-games live/shared-fate/divergence presentation
    - Returning-visitor banner dismissal and hero count animation
    - Eliminated-card transition timing
    - Survival curve hover behavior and overall spacing
    - Final N mobile stacking and bracket-card grid balance

## Next Steps
- Manual browser or Playwright visual verification when allowed.
- Trim or refine styling only if visual QA finds issues.

## Affected Files
- `app/api/survivors/route.ts`
- `app/page.tsx`
- `components/BracketCard.tsx`
- `components/FinalNHomepage.tsx`
- `components/StandardHomepage.tsx`
- `components/SurvivalCurve.tsx`
- `components/SurvivalMatrix.tsx`
- `components/UpcomingGames.tsx`
- `hooks/useHomepageData.ts`
- `hooks/useReturningVisitor.ts`
- `lib/team-colors.ts`
- `lib/tournament.ts`
- `tasks/04-implementation-status.md`
