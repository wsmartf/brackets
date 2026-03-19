# 03 — Bracket Viewer API (MUST ship before tip-off)

## Goal
Add a server-side endpoint that reconstructs any bracket by ID, returns all 63 picks, and marks which picks are alive/dead/pending.

## Why this is #3
The bracket viewer is the single feature that makes the concept tangible. "Bracket #418,275,901 always produces these exact picks" is the proof that this isn't hand-waving. The API must exist before the UI can be built (task 05).

## API Design
```
GET /api/bracket/[id]
```

Response:
```json
{
  "id": 418275901,
  "picks": [
    {
      "game_index": 0,
      "round": 64,
      "team1": "Duke",
      "team2": "Robert Morris",
      "pick": "Duke",
      "result": "alive" | "dead" | "pending"
    },
    ...
  ],
  "alive": true,
  "summary": {
    "correct": 5,
    "wrong": 1,
    "pending": 57
  }
}
```

- `alive`: false if any pick disagrees with a known result
- `result`: "alive" if pick matches known winner, "dead" if it doesn't, "pending" if game hasn't been played

## Implementation
1. Add `reconstructBracket(index: number)` to `lib/prng.ts` or `lib/tournament.ts` — runs the PRNG for that index and returns all 63 game picks as structured objects
2. Add `getBracketSurvivalState(picks, knownResults)` that annotates each pick
3. Add the API route at `app/api/bracket/[id]/route.ts`
4. Validate: id must be integer 0–999,999,999, return 400 otherwise

## Key constraint
The reconstruction must produce identical results to what the worker threads produce. Use the same PRNG and probability table. Consider extracting the shared logic if it's currently inlined in worker.mts.

## Acceptance Criteria
- `GET /api/bracket/418275901` returns a valid, deterministic bracket
- Calling it twice returns identical results
- Picks are annotated with alive/dead/pending status
- Invalid IDs return 400

## Affected Files
- `lib/prng.ts` or `lib/tournament.ts`
- `app/api/bracket/[id]/route.ts` (new)
