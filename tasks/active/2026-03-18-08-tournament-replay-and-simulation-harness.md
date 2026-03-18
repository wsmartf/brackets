## Goal
Build a scriptable replay harness that simulates ESPN results arriving over time and verifies API/UI behavior across a full tournament flow.

## Why
- This is the highest-value reliability and demo tool still missing.
- It de-risks tournament-day operations.
- It is also a strong technical showcase for the project.

## Constraints
- Prefer local scripts and deterministic fixtures over heavy test infrastructure.
- Keep manual override paths available.
- Add small stable UI hooks only where they materially improve browser verification.

## Acceptance Criteria
- A script can replay a sequence of finalized game results into the app.
- The run verifies monotonic bracket elimination and core cached stats behavior.
- The browser flow can be exercised against replayed data.
- Critical UI elements have stable selectors where needed.

## Current Status
- Not started.

## Next Steps
- Define a replay input format.
- Add a small harness for stepping through results.
- Add targeted `data-testid` hooks only where browser automation needs them.

## Affected Files
- `scripts/`
- `app/api/*`
- `lib/db.ts`
- `components/`
- Playwright/browser validation flow
