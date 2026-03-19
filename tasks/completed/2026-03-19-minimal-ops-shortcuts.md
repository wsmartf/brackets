## Goal
Add a minimal host-side ops surface so the common live actions are easy to run
without typing raw `curl` requests or ad hoc SQLite queries.

## Constraints
- Keep the change small and operationally obvious.
- Preserve the existing manual `curl`, `pm2`, and SQLite paths in the docs.
- Use `Makefile` as the main entrypoint.
- Focus only on the highest-frequency actions.

## Acceptance Criteria
- There are simple `make` commands for status, refresh, no-ESPN refresh, audit,
  result writes, and a DB summary.
- The wrappers work against the existing admin API and SQLite schema.
- The runbook mentions the new shortcuts without hiding the raw commands.

## Current Status
- Implemented and verified against a disposable local DB and running app.

## Next Steps
- Archive this task note after commit.

## Affected Files
- `Makefile`
- `scripts/admin.sh`
- `scripts/db.sh`
- `README.md`
- `docs/runbooks/tournament-day.md`
