## Goal
Make the app game-day-ready for the morning of March 19, 2026 by:
- identifying the real launch risks in the current codebase
- defining the minimum acceptable operational behavior for tournament-day usage
- specifying a deterministic end-to-end simulation harness that can validate the ESPN ingest, result queueing, analysis runs, polling behavior, and operator fallback paths tonight

## Constraints
- Optimize for a small, reliable Next.js app, not a generalized test platform.
- Treat `Makefile` as the repo API where possible.
- Keep manual override and `?espn=false` fallback paths intact.
- Preserve cached stats if ESPN fetch fails.
- Do not require internet access for the simulation harness.
- The harness must not touch the production/runtime database by accident.
- Prefer deterministic fixtures and simple local scripts over broad abstractions or heavy testing frameworks.

## Acceptance Criteria
- There is a written launch-readiness checklist tied to the current implementation.
- The missing or risky behaviors are called out explicitly with file references.
- There is a clear build plan for a local replay harness that exercises the real app routes rather than bypassing them.
- The harness design includes:
  - isolated database usage
  - a stubbed ESPN source
  - scripted result arrival over time
  - polling assertions for `GET /api/stats`
  - verification of queue processing, snapshots, and audit logging
  - browser verification scope for the affected UI
- The doc is sufficient for another session or worktree to implement without re-discovering the codebase.

## Current Status
- Code review completed for the launch-critical flow.
- Implemented:
  - env-driven database path override via `MARCH_MADNESS_DB_PATH`
  - env-driven ESPN scoreboard override via `ESPN_SCOREBOARD_BASE_URL`
  - homepage refresh button removal
  - host-side 60-second refresh loop script for automatic ESPN polling
  - local ESPN stub, replay fixture, and replay driver scripts
  - runbook updates for replay rehearsal and manual result follow-up
- Verified locally on March 18, 2026:
  - `make verify`
  - `make build`
  - replay harness passed against `http://127.0.0.1:3001` with isolated DB `/tmp/brackets-replay-20260318b.db`
  - browser check on `/` confirmed updated results and no public refresh button
  - browser check on `/bracket/0` confirmed the replayed elimination state after reload
- Remaining launch-day work is operational:
  - run the same rehearsal in the intended launch environment if desired
  - use the runbook flow tomorrow morning

## Decisions Confirmed
- Remove or hide the public homepage refresh button for launch.
- Accept reload-only behavior for `/bracket/[id]` for launch day.
- Build the first simulation harness as scripts only.
- Use manual browser checking during the replay rather than building Playwright coverage first.
- Add an env-driven database path override as the preferred isolation mechanism.
- Start with a small 3 to 5 game Round of 64 replay.

## Next Steps
- Use the new replay harness for one more rehearsal if you want a pre-launch confidence check.
- On game day, treat manual result writes as a two-step flow: `POST /api/results`, then `POST /api/refresh?espn=false`.
- If a production-only issue appears, inspect `GET /api/audit` first before changing code.

## Affected Files
- `app/page.tsx`
- `app/api/refresh/route.ts`
- `app/api/results/route.ts`
- `app/api/stats/route.ts`
- `app/api/snapshots/route.ts`
- `app/api/audit/route.ts`
- `lib/db.ts`
- `lib/espn.ts`
- `lib/analysis-status.ts`
- `lib/tournament.ts`
- `components/GameFeed.tsx`
- `components/BracketViewer.tsx`
- `docs/runbooks/tournament-day.md`
- `docs/runbooks/deploy.md`
- `tasks/future/2026-03-18-08-tournament-replay-and-simulation-harness.md`
- `scripts/`

## Launch-Critical Concerns

### 1. Public refresh button is not compatible with the current auth boundary
- The homepage calls `POST /api/refresh` without an authorization header in `app/page.tsx`.
- `POST /api/refresh` is admin-protected via `requireAdmin`.
- Relevant files:
  - `app/page.tsx:117`
  - `app/api/refresh/route.ts:110`
  - `lib/admin.ts:13`
- Consequence:
  - Public users clicking "Refresh analysis" will get `401 Unauthorized`.
  - The button appears to be a public control even though the route is private.
- Game-day requirement:
  - Remove or hide the button from the public homepage for launch. Do not leave it visible unless there is a real authenticated admin UI.

### 2. Manual result entry does not trigger analysis
- `POST /api/results` writes the result, resets tournament caches, and writes an audit log, but it does not enqueue analysis or call `runAnalysis`.
- Relevant file:
  - `app/api/results/route.ts:24`
- Consequence:
  - An operator can set or clear a result and believe the site is updated, while cached stats still reflect the prior state.
  - The homepage only polls stats, not raw results, during idle periods.
- Game-day requirement:
  - The runbook must say clearly: after any manual `POST /api/results`, run `POST /api/refresh?espn=false` and wait for `analysisStatus.isRunning` to become `false`.
  - Better long-term behavior would be auto-refresh after manual result writes, but that is optional for launch if the runbook is corrected and tested.

### 3. The result queue only drains when refresh runs
- ESPN results are queued in `lib/espn.ts`, but pending events are processed only inside the refresh route.
- Relevant files:
  - `lib/espn.ts:283`
  - `app/api/refresh/route.ts:35`
- Consequence:
  - There is no background worker or scheduler.
  - "Queueing works" currently means: refresh fetches ESPN, queues finals, and then processes the queue during the same refresh run.
- Game-day requirement:
  - The harness must exercise the real `POST /api/refresh` flow, not just call lower-level library functions.
  - Operations must assume that refresh is the orchestrator.

### 4. The homepage only refreshes results and snapshots after analysis transitions from running to idle
- The homepage polls `GET /api/stats`, but `GET /api/results` and `GET /api/snapshots` are refreshed only when `analysisStatus.isRunning` flips from `true` to `false`.
- Relevant file:
  - `app/page.tsx:98`
- Consequence:
  - If results change without an analysis cycle, the public results feed and elimination views stay stale until reload.
  - This interacts badly with manual result writes.
- Game-day requirement:
  - Treat analysis completion as the public update boundary.
  - The no-code manual drill and the scripted harness should verify that results and snapshots refresh after analysis completion.

### 5. The bracket detail page is not live-updating
- The bracket detail page is rendered server-side from current DB state.
- The client-side viewer has no polling or refresh loop.
- Relevant files:
  - `app/bracket/[id]/page.tsx:20`
  - `components/BracketViewer.tsx:59`
- Consequence:
  - A user sitting on `/bracket/[id]` will not see their bracket status change unless they reload or navigate again.
  - The "Live Bracket Status" label is stronger than the current behavior.
- Game-day requirement:
  - Reload-only behavior is acceptable for launch.
  - Document it and verify reload behavior during the replay drill.
  - Do not spend launch-night time adding live polling unless another blocking issue is already resolved.

### 6. The database path is hard-coded, which makes safe simulation harder
- `lib/db.ts` always opens `join(process.cwd(), "march-madness.db")`.
- `lib/tournament.ts` separately opens the same hard-coded DB for play-in row overrides.
- Relevant files:
  - `lib/db.ts:122`
  - `lib/tournament.ts:437`
- Consequence:
  - A replay harness launched in the main worktree will mutate the real runtime DB by default.
  - Isolated rehearsal is awkward.
- Game-day requirement:
  - Add one shared database path helper, driven by env, for example `MARCH_MADNESS_DB_PATH`.
  - Both `lib/db.ts` and `lib/tournament.ts` must use the same helper.
  - The harness should run against a disposable DB file under `/tmp` or another explicit path.

### 7. The running-analysis flag is process-memory state
- `analysisStatus.isRunning` is derived from the in-memory `activeRun`.
- Relevant file:
  - `lib/analysis-status.ts:27`
- Consequence:
  - If the process restarts during analysis, the running flag is lost.
  - Persisted timestamps survive, but the live run state does not.
- Game-day requirement:
  - For launch, this is acceptable if documented.
  - The harness should include a note that restart-mid-analysis is not covered by the in-memory lock alone.
  - Optional follow-up: infer stale active runs from persisted timestamps plus a pid/lease, but this is not required tonight.

### 8. There is no existing automated replay or browser test coverage for the live flow
- There are no Playwright tests or simulation scripts in the repo.
- The missing harness is already recognized in the future task file.
- Relevant file:
  - `tasks/future/2026-03-18-08-tournament-replay-and-simulation-harness.md:1`
- Consequence:
  - Confidence currently depends on ad hoc curl usage and manual page refreshing.
- Game-day requirement:
  - Build at least one repeatable scripted drill tonight.

## What "Game-Day-Ready" Should Mean

The app should be considered ready only if all of the following are true:

### Operational readiness
- You can start the app locally and under `pm2`.
- You can confirm public `GET /api/stats` and admin `GET /api/audit`.
- You can trigger `POST /api/refresh` and correctly observe the async lifecycle through `analysisStatus`.
- You can recover from ESPN failure using `?espn=false`.
- You can set and clear a manual result, then refresh and observe the expected public changes.

### Data integrity readiness
- A new finalized game never increases `remaining`.
- `gamesCompleted` increases only when a newly completed game is incorporated.
- Duplicate ESPN finals do not create duplicate pending queue items.
- A manual override blocks ESPN from replacing that result.
- Cached stats remain available if ESPN fetch fails.
- Snapshots and elimination impact continue to accumulate in sensible order.

### UI readiness
- The homepage reflects analysis progress while a refresh is running.
- The homepage updates results and impact views when the run finishes.
- The bracket page correctly shows alive/dead state after reload for a bracket known to be affected by a result.
- The misleading public refresh button is removed or hidden.

### Rehearsal readiness
- You can run a fast local simulation from a fresh DB and fixture set.
- You can complete the drill in under about 10 minutes.
- The simulation produces a pass/fail summary instead of requiring eyeballing raw JSON.

## Recommended Approach For Tonight

Run two rehearsals, in this order:

### Rehearsal A: No-code operational drill
Purpose:
- validate the current manual fallback path before writing new harness code

Flow:
1. Start the app with a small bracket count.
2. Use a disposable DB path if available; otherwise copy the existing DB and work in an isolated directory/worktree.
3. Call `POST /api/results` with one known Round of 64 result.
4. Confirm `GET /api/results` reflects that winner.
5. Call `POST /api/refresh?espn=false`.
6. Poll `GET /api/stats` until `analysisStatus.isRunning` becomes `false`.
7. Confirm:
   - `gamesCompleted` increased
   - `remaining` decreased or stayed equal in a degenerate case
   - `GET /api/snapshots` contains a new snapshot
   - `GET /api/audit` contains `result_set` and `refresh_succeeded`
8. Clear the result and repeat the refresh flow once.

This should be done even if the ESPN replay harness is also built.

### Rehearsal B: Stubbed ESPN replay drill
Purpose:
- validate the real refresh orchestration path end to end with fake finals arriving over time

Flow:
1. Point the app at a local ESPN stub.
2. Start from a clean disposable DB.
3. Advance one fake finalized game at a time.
4. Trigger `POST /api/refresh`.
5. Poll to completion.
6. Assert API state, audit events, queue draining, and homepage behavior.
7. Repeat for several games, plus failure scenarios.

## How The Current UI Actually Behaves

### Homepage
- The homepage does not require a full browser reload after a refresh run completes.
- It polls `GET /api/stats` every 15 seconds while idle and every 3 seconds while analysis is running.
- Relevant file:
  - `app/page.tsx:98`
- When `analysisStatus.isRunning` flips from `true` to `false`, the homepage fetches:
  - `GET /api/results`
  - `GET /api/snapshots`
- Relevant file:
  - `app/page.tsx:108`
- Practical meaning:
  - if `POST /api/refresh` is called and completes successfully, the homepage should update on its own
  - the user should not need a browser reload to see the updated homepage stats and game feed

### Manual result caveat
- `POST /api/results` alone does not kick off analysis.
- Relevant file:
  - `app/api/results/route.ts:24`
- Practical meaning:
  - if an operator manually sets a result but does not run `POST /api/refresh?espn=false`, the homepage may remain stale
  - manual result writes must be treated as a two-step operator flow: write result, then refresh analysis

### Bracket detail page
- `/bracket/[id]` is server-rendered from the current DB state at request time.
- Relevant file:
  - `app/bracket/[id]/page.tsx:20`
- The client-side viewer has no polling logic.
- Relevant file:
  - `components/BracketViewer.tsx:59`
- Practical meaning:
  - a user sitting on a bracket page will not see the status change live
  - reloading the page should show the latest alive/dead state
  - this reload-only behavior is acceptable for launch

## Simulation Harness Design

### Design goals
- Use the real app routes:
  - `POST /api/refresh`
  - `GET /api/stats`
  - `GET /api/results`
  - `GET /api/snapshots`
  - `GET /api/audit`
- Stub only the ESPN upstream, not the refresh route itself.
- Keep the replay deterministic and small.
- Make failures obvious and actionable.
- Optimize for launch confidence, not broad automation coverage.

### Required code changes before the harness exists

#### A. Add an ESPN base URL override
Current behavior:
- `fetchScoreboard` uses a hard-coded ESPN URL in `lib/espn.ts`.

Needed change:
- Read a base URL from env, for example `ESPN_SCOREBOARD_BASE_URL`.
- Default it to the current ESPN endpoint when unset.
- Build the request URL from that base.

Why this matters:
- It lets the app exercise the same ingest code against a local stub server.

Target file:
- `lib/espn.ts`

#### B. Add a shared configurable database path
Current behavior:
- DB path is duplicated and hard-coded in two places.

Needed change:
- Introduce a helper used by both modules, for example:
  - `lib/runtime-paths.ts`
  - `getDatabasePath(): string`
- Suggested env:
  - `MARCH_MADNESS_DB_PATH`

Why this matters:
- The harness must not mutate the real `march-madness.db`.
- This is the simplest and safest isolation mechanism for tomorrow.

Target files:
- `lib/db.ts`
- `lib/tournament.ts`
- possibly a new helper under `lib/`

#### C. Optionally add stable test selectors
Only if browser validation is awkward.

Likely candidates:
- homepage remaining count
- analysis status text
- refresh button
- game feed container
- bracket alive/dead badge

Target files:
- `app/page.tsx`
- `components/GameFeed.tsx`
- `components/BracketViewer.tsx`

This is optional if roles/text remain stable enough.

## Stubbed ESPN Architecture

### Replay fixture format
Use a small JSON scenario file, for example under `scripts/analysis/fixtures/`.
The first pass should cover only 3 to 5 Round of 64 finals.

Suggested shape:

```json
{
  "scenario": "round-of-64-smoke",
  "dates": ["20260319"],
  "steps": [
    {
      "step": 1,
      "visibleEventIds": []
    },
    {
      "step": 2,
      "visibleEventIds": ["401"]
    },
    {
      "step": 3,
      "visibleEventIds": ["401", "402"]
    }
  ],
  "events": [
    {
      "id": "401",
      "date": "2026-03-19T17:15Z",
      "team1": "Duke",
      "team2": "Siena",
      "winner": "Duke",
      "score1": 82,
      "score2": 61,
      "status": "STATUS_FINAL"
    }
  ]
}
```

Implementation notes:
- Keep fixture team names aligned with the app's canonical names or known ESPN aliases.
- The stub should emit ESPN-shaped scoreboard JSON, not an app-specific format.
- Model only the fields `extractResults` and `fetchAndQueueEspnResults` need.

### Stub server behavior
Build a tiny local HTTP server script under `scripts/`, for example:
- `scripts/analysis/espn_stub.mjs`

Responsibilities:
- serve the scoreboard endpoint path used by `fetchScoreboard`
- read the scenario fixture
- expose a simple way to advance the current step:
  - HTTP admin endpoint like `POST /admin/step`
  - or file-based state
  - or CLI command against a local state file

Recommended behavior:
- `GET /apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?...`
  returns only the finalized events visible at the current step
- `POST /admin/reset`
  resets to step 0
- `POST /admin/step`
  advances by one step
- `GET /admin/state`
  returns current step and visible event ids

Do not overbuild this. A single-process local stub is enough.

## Replay Driver Design

Create a separate orchestration script, for example:
- `scripts/analysis/replay_tournament.mjs`

Responsibilities:
- boot or expect the app and stub to already be running
- reset stub state
- optionally reset or recreate the disposable DB
- advance the stub one step at a time
- call `POST /api/refresh`
- poll `GET /api/stats`
- query `GET /api/results`, `GET /api/snapshots`, and `GET /api/audit`
- run assertions and print a concise pass/fail report

### Suggested environment inputs
- `ADMIN_BASE_URL`
- `ADMIN_TOKEN`
- `ESPN_STUB_BASE_URL`
- `MARCH_MADNESS_DB_PATH`
- `ANALYZE_NUM_BRACKETS`
- `ANALYZE_NUM_WORKERS`
- `REPLAY_STEP_DELAY_MS`

### Suggested assertions after each step
- refresh returns `202`
- a concurrent second refresh while the first is active returns `409`
- `analysisStatus.isRunning` becomes `true`, then `false`
- `gamesCompleted` equals expected completed-game count
- `remaining` is monotonic non-increasing across completed-game steps
- `result_events` were effectively drained:
  - via audit entries for `result_event_processed`
  - and optionally by inspecting pending events if a debug endpoint or direct DB query is added
- `refresh_succeeded` exists in the audit log
- `espn_result_queued` count matches the number of newly visible finals
- the latest snapshot exists and includes the new game index

### Recommended report output
After each step, print:
- step number
- newly visible event ids
- queued result count
- processed result count
- games completed
- remaining
- audit summary
- pass/fail

At the end, print:
- total steps
- whether monotonicity held
- whether any duplicate queues occurred
- whether any ESPN mapping failures occurred

## Browser Verification Scope

Per repo policy, any user-facing UI change or user-visible flow should be checked in the browser.

For the first pass, the harness itself can stay script-only and browser validation can be manual during the replay. That manual verification should cover:

### Homepage
- open `/`
- confirm initial values render
- trigger a refresh through the operator path under test
- verify analysis-running text appears while `analysisStatus.isRunning` is true
- verify final remaining count changes after completion
- verify the game feed updates after completion
- verify elimination-impact UI updates after completion

Relevant file:
- `app/page.tsx`

### Bracket detail page
- open a bracket id that should be affected by one of the replayed results
- verify its alive/dead state before a result
- complete the result
- reload or re-open the page
- verify the status changed as expected

Relevant files:
- `app/bracket/[id]/page.tsx`
- `components/BracketViewer.tsx`

### Refresh button decision
For launch, the public refresh button should be removed or hidden rather than browser-tested in its current form.

## Scenario Coverage Matrix

Tonight's harness should cover at least these cases:

### Scenario 1: Clean happy path
- one final appears
- refresh queues it
- queue drains
- analysis completes
- homepage updates

### Scenario 2: Two sequential finals
- final A appears
- refresh completes
- final B appears
- refresh completes
- `remaining` never increases
- `gamesCompleted` increments each time

### Scenario 3: Multiple finals visible in a single refresh
- two finals appear before one refresh call
- both are queued
- both are processed
- snapshots reflect multi-game ingestion behavior
- elimination impact is approximate if one snapshot covers multiple new games

### Scenario 4: Duplicate ESPN data
- the same final remains visible on the next refresh
- no duplicate pending event is created
- remaining counts do not change again

### Scenario 5: Manual override wins over ESPN
- set a manual result
- replay an ESPN final for the same game
- verify ESPN is skipped due to manual override
- verify the audit log records that skip reason

### Scenario 6: ESPN failure
- stub returns `500` or malformed payload
- refresh still finishes
- cached stats remain readable
- audit log records `espn_fetch_failed`

### Scenario 7: Concurrent refresh
- issue refresh twice
- second call returns `409`
- first call still completes correctly

### Scenario 8: Bracket detail correctness
- pick one bracket id that is alive before a replayed result and dead after it
- validate the detail page reflects that after reload

## Suggested Implementation Order

1. Add DB path override support.
2. Add ESPN base URL override support.
3. Remove or hide the public homepage refresh button.
4. Build the local ESPN stub.
5. Create one minimal replay fixture with 3 to 5 Round of 64 games.
6. Build the replay driver script.
7. Validate API-only assertions first.
8. Manually watch the homepage during a replay run and verify one bracket page by reload.

## What Should Be In The Harness Implementation

### Files to add
- `scripts/analysis/espn_stub.mjs`
- `scripts/analysis/replay_tournament.mjs`
- `scripts/analysis/fixtures/replay-round64-smoke.json`

### Files likely to modify
- `lib/espn.ts`
- `lib/db.ts`
- `lib/tournament.ts`
- `Makefile`
- `README.md` or `docs/runbooks/tournament-day.md`

### Optional Makefile targets
- `make replay-dev`
- `make replay-smoke`

Example intent:
- `make replay-smoke` should run the stub and replay against a fast bracket count in an isolated DB.

## Minimum API Assertions For A Pass

For the harness to count as sufficient, every replayed finalized game should produce:
- one visible result in `GET /api/results`
- one completed-game increment in `GET /api/stats`
- one monotonic remaining count update in `GET /api/stats`
- one new snapshot in `GET /api/snapshots`
- one `refresh_succeeded` audit entry

And the overall run should show:
- no duplicate pending events for identical finals
- no unexpected mapping failures
- no silent refresh failures

## Specific Runbook Corrections Needed

The current runbooks are close, but they do not yet encode the real operator flow tightly enough.

### `docs/runbooks/tournament-day.md`
Should explicitly say:
- after any manual `POST /api/results`, run `POST /api/refresh?espn=false`
- wait for `analysisStatus.isRunning` to become `false`
- then confirm `GET /api/results`, `GET /api/stats`, and `GET /api/audit`

### `docs/runbooks/deploy.md`
Should include:
- a pre-launch isolated rehearsal step using the simulation harness
- a warning that the homepage refresh button is not an authenticated admin control
- a note about any DB path override used for rehearsal

## Questions That Need Decisions
No blocking product questions remain for the first-pass implementation.

The decisions for the next session should be treated as:
- remove or hide the public refresh button
- keep `/bracket/[id]` reload-only for launch
- build the harness as scripts first
- add env-driven DB path override
- start with a small Round of 64 replay

## Recommendation

For launch tomorrow morning, the minimum viable path is:
- remove or hide the public refresh button
- add isolated DB and ESPN URL overrides
- implement one deterministic replay harness
- run one full local rehearsal
- update the tournament-day runbook with the exact operator steps that were validated

Without those pieces, the app may still work, but you will be operating it tomorrow with unnecessary ambiguity about auth, refresh behavior, and what "queued analysis" really means in practice.
