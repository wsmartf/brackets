## Goal
Let a visitor enter a bracket ID and inspect the full generated bracket, its picks, and whether it is still alive.

## Why
- This makes the deterministic system tangible.
- It is the cleanest way to show that bracket numbers are real objects, not marketing copy.
- It creates a natural shareable URL and a foundation for several future features.

## Constraints
- Reconstruct brackets on demand from the existing deterministic generator.
- Do not store bracket rows in the database.
- Keep the first version fast and read-only.
- Use a stable URL shape so this can become a shareable page later.

## Acceptance Criteria
- A public route exists for viewing a bracket by ID.
- Visitors can enter a bracket ID and load the matching bracket.
- The page shows the full bracket and highlights picks that are already dead or still alive.
- Invalid IDs are handled cleanly.
- Browser verification covers the route on desktop and mobile.

## Current Status
- Not started.

## Next Steps
- Decide the URL format.
- Add a server-side helper to reconstruct a full bracket plus survival state.
- Build a readable bracket-view UI.

## Affected Files
- `app/`
- `components/`
- `lib/prng.ts`
- `lib/tournament.ts`
- `lib/db.ts`
