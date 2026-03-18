## Goal
Refactor the app so it can cleanly support future tournaments without a scramble next year.

## Why
- You are likely to keep growing this project.
- Multi-year support increases the value of every feature built now.
- It makes the project more credible as a durable product, not only a one-off tournament experiment.

## Constraints
- Keep the first pass simple.
- Avoid premature abstractions that slow down the live 2026 product.
- Preserve the current deterministic model architecture.

## Acceptance Criteria
- Core year-specific data and copy are isolated cleanly.
- The routing and data-loading story can support another tournament year.
- Hardcoded `2026` assumptions are identified and reduced in core paths.
- The repo has a clear procedure for adding the next tournament year.

## Current Status
- Not started.

## Next Steps
- Audit hardcoded year assumptions in routes, copy, and data loading.
- Decide whether year should live in routing, config, or both.
- Separate 2026-specific presentation from reusable core logic.

## Affected Files
- `app/`
- `components/`
- `lib/tournament.ts`
- `data/`
- `README.md`
