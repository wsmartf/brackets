# ESPN Name Audit

## Goal
Add a small operator-facing command that shows the ESPN team names currently on
the scoreboard and flags any names that do not map to canonical tournament
teams.

## Constraints
- Keep the solution local and simple.
- Use `Makefile` as the repo API.
- Do not add background scheduling or new services.
- Preserve the existing refresh loop as the main live ingest path.

## Acceptance Criteria
- There is a `make` command for auditing ESPN team names.
- The command exits non-zero when ESPN names do not map cleanly.
- The tournament-day runbook explains when to run it and why it exists.

## Current Status
- Script added under `scripts/ops/`.
- `Makefile` target added.
- Runbook updated.
- Verified against the local ESPN stub and with `make verify`.

## Next Steps
- Use the command during live ops before tip-off or when ESPN ingest looks suspicious.

## Affected Files
- `scripts/ops/espn_name_audit.mjs`
- `Makefile`
- `docs/runbooks/tournament-day.md`
- `lib/espn.ts`
