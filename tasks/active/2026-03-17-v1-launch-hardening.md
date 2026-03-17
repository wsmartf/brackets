# Task: V1 Launch Hardening

## Goal
Finish the remaining work needed to safely run the public site for tournament day.

## Constraints
- Keep the implementation simple and local to this app
- Prefer CLI/API admin flows over building admin UI first
- Preserve cached stats if refresh or ESPN fetch fails
- Keep manual result override available

## Acceptance Criteria
- Mutating/admin APIs require a secret token
- Only one refresh can run at a time
- Dashboard shows refresh status and last updated state
- A simple audit trail exists for admin and auto-applied actions
- Refresh can pull finalized ESPN results before analysis
- Later-round matchups use the KenPom model via a precomputed matchup table
- First Four placeholders can be handled without editing repo files on the live machine
- Deploy/restart behavior is documented and tested on the host machine

## Subtasks
1. Admin auth
2. Refresh lock
3. Analysis status and cached stats behavior
4. Audit log
5. Full-round weighted matchup probabilities
6. ESPN final-result integration
7. First Four/play-in handling
8. Host-machine deploy/restart validation

## Current Status
- Task briefs exist
- Base analysis engine and dashboard are running
- Makefile-based workflow exists
- Admin auth complete and locally verified
- Refresh lock and status complete and locally verified
- Audit log complete and locally verified
- Full-round weighted probabilities complete and locally verified
- ESPN integration complete and locally verified
- First Four runtime substitution complete and locally verified

## Next Step
Do final end-to-end verification, tighten docs/runbooks where behavior changed, and hand off the host-machine restart/release checks.

## Affected Areas
- `app/api/*`
- `lib/analyze.ts`
- `lib/db.ts`
- `lib/tournament.ts`
- `lib/worker.ts`
- `lib/espn.ts`
- `README.md`
- `docs/runbooks/*`
