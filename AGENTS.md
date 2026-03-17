# AGENTS.md

This repo is a small, time-sensitive Next.js app for analyzing 1 billion deterministic March Madness brackets. Optimize for simple, reliable changes that keep the site working during the tournament.

## Defaults
- Treat `Makefile` as the repo API.
- Work in small steps and verify each step.
- Prefer local, explicit solutions over reusable abstractions.
- Keep manual override paths available even when automation exists.
- Preserve cached stats if refresh or ESPN fetch fails.

## Standard Commands
- `make dev` — run the site locally
- `make verify` — run typecheck and lint
- `make build` — production build
- `make analyze` — full analysis with default bracket count
- `make analyze-smoke` — quick analysis smoke test

## Delivery Standard
A task is done when:
- the code path works end to end
- the simplest useful verification has been run
- docs are updated only if setup, workflow, public behavior, architecture constraints, operational procedure, or a durable decision changed

## Project Constraints
- The app is self-hosted on a Mac and uses SQLite.
- `GET /api/stats` is public.
- Mutating/admin actions should be token-protected.
- Avoid over-engineering. No queues, no user system, no ORM unless explicitly needed.
- The bracket space is deterministic by seed/index. Brackets are reconstructed on demand, not stored.

## Code Areas
- `app/` — Next.js routes and UI
- `components/` — dashboard components
- `lib/prng.ts` — deterministic PRNG, do not change lightly
- `lib/tournament.ts` — tournament data and probability/model logic
- `lib/worker.ts` — hot loop for bracket generation/filtering
- `lib/analyze.ts` — orchestration and aggregation
- `lib/db.ts` — SQLite access
- `lib/espn.ts` — ESPN fetch/parse logic
- `data/tournament-2026.json` — canonical tournament team data

## Documentation Policy
Prefer code, types, tests, and scripts over explanatory prose.

Only update documentation when one of these changes:
1. Setup or developer workflow: `README.md`, `Makefile`
2. Public behavior or interface: `README.md`
3. Cross-cutting architecture or constraints: `docs/architecture/*`
4. A durable technical decision: `docs/decisions/*`
5. Operational procedure: `docs/runbooks/*`

Do not create new docs for straightforward local implementation details that are already clear from code and tests.

For work spanning multiple sessions or more than about 5 meaningful steps, create or update a task file under `tasks/active/` with:
- goal
- constraints
- acceptance criteria
- current status
- next steps
- affected files

Archive or delete task docs when they stop being useful.
