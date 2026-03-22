# ESPN Matching Hardening

## Goal
Make ESPN result ingestion resilient to common team-name variants without weakening the safety check that blocks mismatched finalized games.

## Constraints
- Keep exact canonical matching as the final safety bar.
- Prefer local matcher improvements over broad fuzzy matching.

## Acceptance Criteria
- ESPN aliases like `CA Baptist` map cleanly to canonical team names.
- Ambiguous short names like `Miami` can resolve safely when the current matchup makes the intended team unique.
- Same-batch later-round ESPN finals can match after earlier games in the same batch are queued.

## Current Status
- Status: Done
- Last updated: 2026-03-22
- Notes:
  - ESPN alias and contextual name matching are patched.
  - Same-batch later-round matching now uses projected queued results during the sync pass.

## Next Steps
- Monitor the next live refresh for any new unmatched ESPN variants.

## Affected Files
- `lib/espn.ts`
- `tests/espn.test.ts`
- `tests/test-helpers.ts`
