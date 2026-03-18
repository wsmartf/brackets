## Goal
Allow a user to enter their own bracket picks and learn whether that exact bracket exists in the 1B deterministic universe.

## Why
- This is the strongest personal hook in the product.
- It is naturally shareable.
- It turns the project from passive tracker into interactive discovery.

## Constraints
- Start with an exact-match flow before adding "closest bracket" logic.
- Reuse the bracket-by-ID viewer where possible.
- Keep the first input method simple, even if it is a plain pick-entry grid.
- Avoid introducing accounts or heavy state.

## Acceptance Criteria
- A user can enter a complete bracket through the UI.
- The app returns whether the bracket exists in the generated universe.
- If it exists, the app returns one or more matching bracket IDs.
- The result links directly to the bracket-by-ID viewer.
- Browser verification covers the end-to-end flow.

## Current Status
- Not started.

## Next Steps
- Decide how to encode user-entered picks.
- Determine whether inversion can produce exact IDs directly or needs search/indexing support.
- Ship the simplest useful exact-match experience first.

## Affected Files
- `app/`
- `components/`
- `lib/prng.ts`
- `lib/tournament.ts`
- new matching/inversion utilities
