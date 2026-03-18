## Goal
Add a public model explorer that shows team strength, matchup odds, and why the model likes each team.

## Why
- This makes the model feel real and inspectable.
- It helps normal users understand the bracket generator without reading implementation notes.
- It strengthens the project as a technical portfolio piece.

## Constraints
- Stay faithful to the actual production model and input data.
- Start with read-only explanations and simple comparisons.
- Keep the UI approachable for non-technical users.

## Acceptance Criteria
- Visitors can browse teams and see key model inputs.
- The site shows team title odds and other meaningful probabilities.
- A user can compare two teams and see the matchup win probability.
- The UI explains the model in plain language without hand-waving.
- Browser verification covers the explorer flow.

## Current Status
- Not started.

## Next Steps
- Decide whether the entry point is a standalone route or homepage module.
- Expose team/model data through a simple read path.
- Design one strong comparison view.

## Affected Files
- `data/tournament-2026.json`
- `lib/tournament.ts`
- `app/`
- `components/`
