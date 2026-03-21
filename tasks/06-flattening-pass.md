# 06 — Flattening Pass

## Goal
Reduce indirection that is not paying for itself in the current codebase, while
keeping the app stable during tournament usage.

This is not a broad architecture rewrite. It is a targeted cleanup pass aimed at:
- making runtime dependencies more explicit
- shrinking "smart" control flow that mixes multiple concerns
- keeping hot-path and UI code easier for autonomous agents to edit safely

## Constraints
- Keep changes small, local, and behavior-preserving unless a bug fix is part of the work.
- Do not introduce generic service layers, framework-heavy abstractions, or reusable utilities without a specific need.
- Preserve local manual paths for debugging and repair.
- Preserve cached stats if refresh or ESPN fetch fails.
- Be careful in hot paths (`lib/analyze.ts`, `lib/worker.mts`, tournament/model logic).

## Acceptance Criteria
- Runtime dependencies that affect bracket generation or tournament state are explicit at the call site rather than hidden in "pure-looking" helpers.
- Refresh flow responsibilities are split into smaller concrete units instead of one route doing everything.
- Homepage data-loading logic is simpler to read and modify without changing user-facing behavior.
- Small duplicate type/conversion layers are removed where they do not add safety or clarity.
- No new abstraction layer is introduced unless it directly replaces more complexity than it adds.

## Concrete Recommendations

### 1. Make play-in overrides explicit
Current issue:
- `lib/tournament.ts` looks like pure data/model code, but `getTournamentTeams()` calls `readPlayInRowOverrides()`, which reads SQLite state.
- This creates hidden runtime coupling between tournament/model helpers and the DB.

Recommendation:
- Move play-in override reading into a narrower runtime-oriented helper or make overrides an explicit input at the call site.
- Keep the tournament/model layer as close to "data in, answers out" as possible.

Good direction:
- `loadTournament()` stays static-data only.
- A separate function derives current participants from tournament data plus runtime overrides.
- Callers that truly need runtime-aware participants opt into that explicitly.

Likely files:
- `lib/tournament.ts`
- possibly `lib/db.ts` or a small new runtime helper if needed

### 2. Split refresh responsibilities by behavior
Current issue:
- `app/api/refresh/route.ts` handles auth, optional ESPN fetch, queue processing, analysis orchestration, status transitions, and audit logging in one route.
- The route is still understandable, but it is doing too much for a live-ops path.

Recommendation:
- Implement the split already described in `tasks/05-refresh-v2.md`.
- Prefer two concrete endpoints over a generic orchestration layer:
  - `POST /api/espn-sync`
  - `POST /api/analyze` or a thin `POST /api/refresh?espn=false` compatibility path

Good direction:
- ESPN polling decides whether there is new work.
- Analysis endpoint processes pending events and runs analysis when needed.
- Shared helpers can exist, but keep them concrete and local to the flow.

Likely files:
- `app/api/refresh/route.ts`
- `app/api/espn-sync/route.ts` (new)
- possibly `app/api/analyze/route.ts` (new)
- `lib/espn.ts`
- `lib/analysis-status.ts`
- `scripts/ops/refresh_loop.sh`

### 3. Flatten homepage fetch/poll logic
Current issue:
- `app/page.tsx` has multiple fetch callbacks, multiple effects, `queueMicrotask()` usage, and a ref for tracking analysis completion transitions.
- The page is still manageable, but edits require more care than necessary.

Recommendation:
- Collapse the fetch logic into one small local helper with clear modes.
- Keep polling logic obvious:
  - initial load
  - stats polling
  - results/snapshots refresh when analysis completes

Good direction:
- One helper for fetching homepage data pieces.
- Fewer `useCallback` wrappers unless they are actually needed.
- Avoid `queueMicrotask()` unless it is solving a real issue that simpler code cannot.

Likely files:
- `app/page.tsx`

### 4. Remove tiny type/conversion layers that add ceremony
Current issue:
- `lib/analysis-status.ts` has both `AnalysisStatus` and `PersistedAnalysisStatus`, but they currently have the same shape.
- `toStatus()` mainly copies fields one-to-one.

Recommendation:
- Collapse identical status types unless a real shape difference appears.
- Keep a single default object and a small parse/reconcile flow.

Good direction:
- One `AnalysisStatus` type.
- One default status constant.
- Keep reconciliation logic, but reduce the type ceremony around it.

Likely files:
- `lib/analysis-status.ts`

### 5. Trim stale implementation archaeology from hot-path code
Current issue:
- `lib/analyze.ts` includes a large comment block describing historical worker-path alternatives.
- This comment is now longer than the decision it documents.

Recommendation:
- Replace long historical explanation with the short current rule:
  - worker runs from `lib/worker.mts`
  - `tsx/esm` is used to execute it
- Keep only the context needed to maintain the current approach.

Good direction:
- Short comment or tiny helper like `createAnalysisWorker()`.
- Keep the file focused on analysis flow.

Likely files:
- `lib/analyze.ts`

### 6. Simplify small hot-path lookups where it also improves readability
Current issue:
- `computeDerivedStats()` in `lib/analyze.ts` does repeated `initialOrder.indexOf(...)` lookups inside survivor reconstruction.

Recommendation:
- Build a `Map<string, number>` once and reuse it.
- This is both simpler to reason about and less wasteful.

Likely files:
- `lib/analyze.ts`

## Current Status
- Status: Not started
- Last updated: 2026-03-21
- Notes:
  - Repo structure is generally good; this task is about targeted flattening, not a large redesign.
  - Highest-value simplifications are in runtime coupling and refresh flow boundaries.

## Next Steps
- Start with the smallest safe cleanup:
  - simplify `lib/analysis-status.ts`
  - simplify homepage fetch/poll logic in `app/page.tsx`
- Then do the more structural work:
  - split refresh responsibilities
  - make play-in/runtime overrides explicit
- Run the smallest verification layer after each step:
  - `make test`
  - `make test-ui` when route/UI behavior changes

## Affected Files
- `app/page.tsx`
- `app/api/refresh/route.ts`
- `lib/analyze.ts`
- `lib/tournament.ts`
- `lib/analysis-status.ts`
- `lib/espn.ts`
- `scripts/ops/refresh_loop.sh`
