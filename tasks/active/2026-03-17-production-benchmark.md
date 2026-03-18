# Task: Production 1B Benchmark

## Goal
Measure the real runtime of a full `1_000_000_000` bracket analysis on the production Mac and record the result.

## Why
- The app is designed around a brute-force `1B` scan.
- The real production runtime matters more than estimates.
- Tournament-day operating decisions depend on knowing the actual wall-clock time.

## Constraints
- Run this on the actual production Mac.
- Use the real production build and runtime path.
- Keep the benchmark simple.
- Do not change code just for the benchmark.

## Acceptance Criteria
- A full `1B` analysis completes successfully on the host machine.
- Start time, end time, and total elapsed time are recorded.
- Basic machine context is recorded:
  - Mac model
  - CPU
  - available memory
- The result is written back into the deploy/run documentation or this task file.

## Pre-Run Checklist
- App builds successfully with `make build`
- App starts successfully under `pm2`
- `ADMIN_TOKEN` is configured
- No stray dev server is running on port `3000`
- Cloudflare Tunnel is not required for the benchmark itself

## Benchmark Commands
Set local admin vars:

```bash
export ADMIN_BASE_URL='http://127.0.0.1:3000'
export ADMIN_TOKEN='replace-me'
```

Confirm baseline health:

```bash
curl "$ADMIN_BASE_URL/api/stats"
curl "$ADMIN_BASE_URL/api/results"
```

If you want to benchmark just the analysis and avoid ESPN/network variability:

```bash
time curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

If you also want the real production path including ESPN fetch:

```bash
time curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Recommended Procedure
1. Start from a known state.
   If you do not want game results to affect runtime interpretation, benchmark with no completed results or with a clearly documented number of completed games.
2. Run the benchmark with `?espn=false` first.
   This gives the cleanest measurement of analysis time alone.
3. Optionally run a second benchmark with ESPN enabled.
   This measures the real production path.
4. Save the elapsed time and the number of completed games for each run.

## Suggested Recording Format
- Date:
- Host machine:
- CPU:
- Memory:
- App mode: `pm2` / production build
- Benchmark 1:
  - Endpoint: `/api/refresh?espn=false`
  - Completed games before run:
  - Elapsed time:
- Benchmark 2:
  - Endpoint: `/api/refresh`
  - Completed games before run:
  - Elapsed time:
- Notes:

## Measured Result
- Date: 2026-03-17
- Host machine: production Mac
- CPU: not recorded in this task run
- Memory: not recorded in this task run
- App mode: `pm2` / production build
- Benchmark 1:
  - Endpoint: `/api/refresh?espn=false`
  - Completed games before run: `1`
  - Elapsed time: `78.35s`
  - Remaining brackets after run: `939,813,625`
  - `analysisStatus.lastStartedAt`: `2026-03-18T01:12:00.670Z`
  - `analysisStatus.lastFinishedAt`: `2026-03-18T01:13:18.863Z`
- Benchmark 2:
  - Endpoint: `/api/refresh`
  - Completed games before run: not yet recorded
  - Elapsed time: not yet recorded
- Notes:
  - Measured with `/usr/bin/time -lp curl ...`
  - This is end-to-end wall-clock time as seen from the admin client.
  - `espnSummary` was `null` because the run used `?espn=false`.

## Follow-Up
After the benchmark:
- add the measured runtime to `docs/runbooks/deploy.md` or `README.md` if useful
- keep only the real measured number, not guesses
- if runtime is worse than expected, document the observed number before making changes
