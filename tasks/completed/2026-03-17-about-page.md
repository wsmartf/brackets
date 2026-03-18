## Goal
Add an `/about` page that explains how the bracket model works, how seeds fit into the presentation, and how the app deterministically generates and verifies 1 billion brackets.

## Constraints
- Keep the explanation faithful to the current implementation.
- Make the page visually intentional, not a plain document.
- Keep the explanation high-level first, then progressively more technical.
- Add lightweight graphics/animation only if they do not complicate the route.
- Ensure the page is discoverable from the homepage.

## Acceptance Criteria
- `/about` exists and is linked from the homepage.
- The page explains the KenPom-based model and seed structure in understandable terms.
- The page explains deterministic generation, canonical ordering, 63 game bits, worker scanning, and bitmask verification.
- The page includes graphical UI elements beyond plain paragraphs.
- `make verify` passes and the route is checked in the browser.

## Current Status
- Completed. `/about` was rewritten around a simpler narrative: what the site is, how one number becomes one bracket, why the picks are model-driven, and how real results eliminate brackets. Verified with `make verify` and browser checks on desktop and mobile.

## Next Steps
- Monitor for any additional copy or visual simplification after live review.

## Affected Files
- `app/about/page.tsx`
- `app/page.tsx`
- `app/globals.css`
- `tasks/active/2026-03-17-about-page.md`
