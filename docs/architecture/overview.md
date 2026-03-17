# Architecture Overview

## Purpose
This app tracks how many of 1 billion deterministic March Madness brackets still match real tournament results.

## Core Model
- A bracket is identified by an integer index from `0` to `999,999,999`.
- That index seeds a deterministic PRNG.
- The PRNG drives 63 game outcomes in canonical bracket order.
- Brackets are reconstructed on demand and never stored.

## Core Flow
1. Read known game results from SQLite.
2. Convert known winners into a compact bitmask.
3. Iterate through the configured bracket space in worker threads.
4. Reconstruct each bracket from its seed/index.
5. Keep only brackets whose bits match all known results.
6. Aggregate remaining count and champion distribution.
7. Cache the last good analysis result in SQLite.

## Boundaries
- `app/`: UI and API routes
- `lib/`: analysis engine, DB access, ESPN integration
- `data/`: static tournament input data
- `march-madness.db`: runtime state and cached results

## Invariants
- Bracket generation must be deterministic for a given seed and model.
- Canonical game ordering must stay consistent everywhere.
- Cached stats should survive refresh failures.
- Manual result override must remain possible.
- Mutating/admin routes should require a secret token.

## Performance Model
- The current product target is `1_000_000_000` brackets.
- Analysis is a brute-force parallel scan, so runtime scales roughly linearly with bracket count.
- Worker hot-loop changes should be evaluated carefully.

## Deployment Model
- Single Next.js app
- SQLite on the same machine
- Self-hosted on a Mac
- Public access via Cloudflare Tunnel
- Process supervision via `pm2`
