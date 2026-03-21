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
- `make test` — unit + integration tests (fast, no server)
- `make test-watch` — unit tests in watch mode
- `make test-ui` — Playwright e2e smoke tests (starts dev server if needed)
- `make test-all` — full test suite (unit + e2e)

## Testing Strategy

Three layers — use the smallest layer that covers the change:

**1. Unit tests (`make test`) — tests/**/*.test.ts, vitest**
- Pure logic: PRNG, probability math, bitmask ops, survival state, ESPN parsing
- No server, no DB. Run in seconds. Always run after touching lib/.
- For DB-dependent tests, use `createTestDb()` from `tests/test-helpers.ts`:
  it creates a temp SQLite file, sets `MARCH_MADNESS_DB_PATH`, and returns a cleanup fn.

**2. E2e smoke tests (`make test-ui`) — tests/*.spec.ts, Playwright**
- Test that pages load and APIs return correct shapes.
- State-agnostic: tests pass regardless of tournament progress.
- Playwright auto-starts `npm run dev` if no server is running. For faster iteration,
  start `make dev` in a separate terminal first (server reuse avoids the startup delay).

**3. Manual / exploratory — Playwright MCP or browser**
- Use Playwright MCP only for step-by-step interactive debugging.
- Use Playwright CLI (`npx playwright test --headed`) for everything else.
- Screenshots are expensive (context tokens). Use DOM assertions first; screenshot only when visual judgment is needed.

**When to add tests:**
- Logic with a non-obvious invariant: add a unit test.
- Bug fix likely to recur: add a test that would have caught it.
- New API endpoint or page: add an API shape assertion to smoke.spec.ts.
- Don't add tests for straightforward wiring, config, or one-off scripts.

**Test isolation:**
- Unit tests that touch the DB: use `createTestDb()` + beforeEach/afterEach.
- Never write to `march-madness.db` from tests — always use a temp path.
- `MARCH_MADNESS_DB_PATH` controls which DB the app uses; tests set this to a temp file.

## UI development and browser verification

**Default workflow for any UI change:**
1. Make the change.
2. Run `make test` — catch any broken logic first.
3. Run `npx playwright test tests/smoke.spec.ts` (headless) — confirm nothing regressed.
4. If the specific behavior you changed isn't covered by smoke tests, add a targeted assertion
   to `tests/smoke.spec.ts` (or a new `tests/xxx.spec.ts`), run it, and keep it if it's durable.
5. If you need to visually confirm layout/appearance: `npx playwright test --headed` to watch
   the tests run, or take a single screenshot if visual judgment genuinely requires it.

**Playwright CLI vs MCP:**
- **CLI** (`npx playwright test`) — use for everything: running tests, headless assertions,
  headed visual checks. Fast, no context cost.
- **MCP** (`mcp__playwright__browser_*`) — use only for interactive debugging: clicking through
  a flow step-by-step, inspecting live state, or when the test setup itself is the problem.
  Avoid in agentic loops — each screenshot embeds the full image in context (~150k–300k tokens).

**Writing assertions (prefer these over screenshots):**
- `expect(locator).toBeVisible()` / `toHaveText()` / `toHaveCount()` — behavioral checks
- `expect(page).toHaveURL()` / `toHaveTitle()` — navigation checks
- `page.getByRole()` / `getByLabel()` / `getByText()` — stable, semantic selectors
- Add `data-testid` only when a reliable selector doesn't exist and the element needs
  repeated verification.

**Screenshots — use sparingly:**
- Only when visual judgment (spacing, alignment, layout) genuinely requires it.
- One screenshot per visual check, not one per step.
- In MCP: `mcp__playwright__browser_take_screenshot` costs ~150k–300k context tokens per call.
  In CLI tests: `page.screenshot()` writes to disk, costs nothing in context.
- Prefer `--headed` over screenshots when you just want to "see" what's happening.

**When to add a persistent test:**
- A bug was fixed and the regression would be silent without a test.
- A new API endpoint or page was added — add an API shape assertion to `smoke.spec.ts`.
- A critical user flow changed materially.
- Don't add tests for cosmetic tweaks or things that are obvious from the running app.

**A UI task is done when:**
- The Playwright check passes (headless).
- The resulting UI isn't obviously broken or inconsistent (verify headed or via screenshot if needed).

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
- `lib/worker.mts` — hot loop for bracket generation/filtering
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

For work spanning multiple sessions or more than about 5 meaningful steps, create or update a task file under `tasks/` with:
- goal
- constraints
- acceptance criteria
- current status
- next steps
- affected files

Archive or delete task docs when they stop being useful.
