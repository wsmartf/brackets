# 05 — Refresh V2

## Goal
Design a cleaner V2 refresh flow that separates:
- cheap ESPN polling and result queueing
- expensive bracket analysis runs

The immediate live fix keeps the current `/api/refresh` endpoint but avoids
starting analysis when nothing changed. This task documents the cleaner follow-up
design for later tonight.

## Constraints
- Keep the external host-side scheduler model. Do not move polling into an
  in-process Next.js timer.
- Preserve the current manual fallback path: `POST /api/results`, then
  authenticated analysis refresh when needed.
- Preserve cached stats if ESPN fetch fails.
- Keep the implementation small and operationally obvious for tournament usage.
- Avoid introducing queues, workers, or background orchestration beyond what the
  host already runs under `pm2`.

## Acceptance Criteria
- There is a concrete V2 endpoint split with responsibilities defined.
- The runtime behavior for no-op ESPN polls is explicitly described.
- The migration path from the current `/api/refresh` behavior is clear.
- The operator runbook impact is called out.
- Another session can implement the refactor without rediscovering today’s bug.

## Current Status
- Live fix in progress:
  - `/api/refresh` now short-circuits when ESPN finds nothing new and cached
    analysis already matches current results.
  - The host refresh loop can keep polling every 60 seconds without flipping the
    public homepage into `analysis running` on every poll.
  - Production incident found a separate gap: if the app restarts mid-analysis,
    `analysis_status.isRunning` can remain stranded as `true` and force every
    later refresh into `409 Analysis is already running` until manually cleared.
- Current architecture remains mixed:
  - `/api/refresh` still does ESPN sync and analysis orchestration in one route.
  - The external `pm2` loop still calls `POST /api/refresh`.

## Proposed V2 Design
- Add a dedicated authenticated endpoint for ESPN polling, for example:
  - `POST /api/espn-sync`
- Keep a dedicated authenticated endpoint for analysis orchestration:
  - either `POST /api/refresh?espn=false`
  - or rename to `POST /api/analyze`

### V2 Endpoint Responsibilities
- `POST /api/espn-sync`
  - fetch recent ESPN scoreboards
  - map finals into app matchups
  - enqueue result events when new finals appear
  - return a summary such as:
    - `queued`
    - `skipped`
    - `finalResultsSeen`
    - `needsAnalysis`
  - never set `analysisStatus.isRunning`
  - never call `runAnalysis()`

- `POST /api/analyze`
  - process pending result events
  - detect manual-result drift against the latest analyzed snapshot
  - start and finish `analysisStatus`
  - run analysis only when needed
  - return:
    - `200` for a no-op
    - `202` when analysis actually starts

### Host Loop Behavior
- The `pm2` loop should call `POST /api/espn-sync` every 60 seconds.
- If `needsAnalysis` is `true`, it should immediately call `POST /api/analyze`.
- If `needsAnalysis` is `false`, do nothing else.

This keeps routine polls cheap and prevents public UI flicker during idle
periods, while preserving the external scheduler model.

## Why V2 Is Better
- Clearer operational boundaries:
  - ESPN polling is data ingestion
  - analysis is cache recomputation
- Easier logs and audit interpretation
- Easier future rate limiting or ESPN-specific retries
- Simpler mental model when debugging:
  - “Did ESPN find anything?”
  - “Did we run analysis?”

## Migration Notes
- Keep the current `/api/refresh` route working until the host loop is updated.
- After the loop switches to V2, either:
  - preserve `/api/refresh` as a thin compatibility wrapper
  - or remove it only after runbooks and deploy scripts are updated

## Next Steps
- Add `POST /api/espn-sync`.
- Refactor the current refresh route so analysis orchestration can be called
  without ESPN fetch side effects.
- Add stale-run recovery for analysis state so restart-mid-run does not require
  manual SQLite intervention.
- Update `scripts/ops/refresh_loop.sh` to call the split endpoints.
- Update runbooks after the host loop changes.
- Optionally add a small integration script that asserts:
  - no-op ESPN sync does not flip `analysisStatus.isRunning`
  - queued ESPN results do trigger analysis

## Affected Files
- `app/api/refresh/route.ts`
- `lib/espn.ts`
- `lib/analysis-status.ts`
- `lib/db.ts`
- `scripts/ops/refresh_loop.sh`
- `README.md`
- `docs/runbooks/tournament-day.md`
- `docs/runbooks/deploy.md`
