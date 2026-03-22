# Build Typecheck Boundary

## Goal
Keep `make build` working when only runtime dependencies are installed, while still typechecking test and tooling files during normal local verification.

## Constraints
- Production Next.js builds should not depend on Playwright or Vitest packages.
- Keep the Makefile as the repo API and preserve the existing local test workflows.

## Acceptance Criteria
- `make build` no longer typechecks Playwright or Vitest files.
- `make verify` still typechecks app code plus test/tooling code when dev dependencies are installed.
- `make init` works as an alias for dependency installation.

## Current Status
- Status: Done
- Last updated: 2026-03-22
- Notes:
  - Root `tsconfig.json` now includes only app/build files, so `next build` no longer touches Playwright or Vitest files.
  - Test and tooling files moved to `tsconfig.dev.json`, which `npm run typecheck` still checks when dev dependencies are installed.

## Next Steps
- Install dev dependencies with `make init` before running `make verify`, `make test`, or `make test-ui` in a fresh environment.

## Affected Files
- `tsconfig.json`
- `package.json`
- `Makefile`
- `README.md`
- `tasks/08-build-typecheck-boundary.md`
