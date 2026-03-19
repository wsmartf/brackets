## Goal
Materialize surviving bracket IDs once the field is small enough that people can browse them directly.

## Why
- A raw count is less compelling than a concrete list of exact surviving bracket numbers.
- This creates a natural bridge from "X brackets left" to "show me one of them."
- It pairs cleanly with the bracket-by-ID viewer without requiring full bracket storage.

## Constraints
- Do not slow down the main refresh/analysis path while the survivor set is still large.
- Store bracket IDs only, not full reconstructed brackets.
- Gate materialization behind a simple threshold such as `remaining <= 10_000` or `50_000`.

## Acceptance Criteria
- When the survivor count falls below the threshold, the app persists the exact surviving bracket IDs for that snapshot.
- The API can return a paginated list of alive bracket IDs for the latest snapshot.
- A listed bracket ID can be opened in the bracket viewer.

## Current Status
- Not started.

## Next Steps
- Choose the survivor threshold and storage shape.
- Decide whether materialization happens during refresh or as a follow-up job.
- Add a minimal API for listing survivor IDs.

## Affected Files
- `lib/analyze.ts`
- `lib/db.ts`
- `app/api/*`
- `components/`
