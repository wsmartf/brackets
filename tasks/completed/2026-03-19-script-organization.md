## Goal
Reorganize `scripts/` so live ops, analysis tooling, and model-building scripts
are grouped separately without changing the public commands operators and
developers use.

## Constraints
- Keep the change shallow: one level of folders only.
- Preserve `Makefile` and npm command behavior.
- Update references so moved scripts still work from the repo root.
- Keep replay fixtures near the replay and stub tooling.

## Acceptance Criteria
- `scripts/ops`, `scripts/analysis`, and `scripts/model` exist and contain the
  appropriate scripts.
- `make` and npm commands still work with the moved files.
- Docs and task notes no longer point at stale script paths.

## Current Status
- Scripts moved into `scripts/ops`, `scripts/analysis`, and `scripts/model`.
- References updated and verification completed.

## Next Steps
- Archive this task note after commit.

## Affected Files
- `Makefile`
- `package.json`
- `scripts/**`
- `README.md`
- `docs/runbooks/*`
- `tasks/active/*`
- `tasks/completed/*`
