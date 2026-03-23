# Production Rehearsal Workflow

## Goal
Set up a safe, low-friction workflow to preview the latest local code against
the current production SQLite state on the live host using a separate server on
`127.0.0.1:3001`, with browser access via SSH port forwarding.

## Constraints
- Do not disturb the live app process on `127.0.0.1:3000`.
- Use a SQLite backup, not a raw file copy, because the runtime DB uses WAL mode.
- Prefer the main checkout when possible so the rehearsal includes the exact
  deploy candidate, including local uncommitted changes.
- Keep the operator path explicit and local.
- Prefer Makefile commands and repo scripts over ad hoc shell.

## Acceptance Criteria
- There is a repo-supported way to build a rehearsal instance from the main
  checkout without touching the live `.next` output.
- There is a repo-supported way to snapshot the production DB for rehearsal.
- There is a repo-supported way to run the rehearsal app on `127.0.0.1:3001`,
  including a single wrapper command for the common case.
- The deploy/runbook explains how to run the full end-to-end rehearsal,
  including SSH port forwarding for browser access.

## Current Status
- Status: Done
- Last updated: 2026-03-23
- Notes:
  - The live app runs from this repo under `pm2`, so the rehearsal build output
    must stay separate from the live `.next` directory.
  - The runtime DB is in WAL mode, so rehearsal copies use `sqlite3 .backup`.
  - The preferred same-checkout flow now builds into `.next-rehearsal`, starts
    cleanly on `127.0.0.1:3001`, and keeps live `3000` on `.next`.
  - A single `make rehearse-prod` wrapper now handles snapshot, build, and
    start for the common case.

## Next Steps
- Use the streamlined rehearsal flow before deploys that need production-data
  checks.
- Remove or archive this task note if the workflow becomes routine and no longer
  needs active tracking.

## Affected Files
- `tasks/07-prod-rehearsal.md`
- `.gitignore`
- `Makefile`
- `next.config.ts`
- `tsconfig.json`
- `docs/runbooks/deploy.md`
- `scripts/ops/backup_prod_db.sh`
