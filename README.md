# March Madness 2026

Track how many of 1 billion deterministic March Madness brackets still match real tournament results.

This app does not store brackets. Each bracket is reconstructed on demand from an integer index used as a PRNG seed. Real results are stored in SQLite, and analysis scans the configured bracket space to count which generated brackets are still alive.

For architecture constraints, see [docs/architecture/overview.md](/Users/willsmart/dev/brackets/docs/architecture/overview.md).

## Repo API
Use `Makefile` commands by default:

```bash
make install
make dev
make verify
make build
make analyze
make analyze-smoke
make collision-stats
make backtest-current-model
make train-v2-model
```

## Requirements
- Node.js >= 20.9.0
- npm

## Local Development
```bash
make install
make dev
```

Open `http://localhost:3000`.

To use admin routes locally, set an admin token first:

```bash
cat > .env.local <<'EOF'
ADMIN_TOKEN=replace-me
EOF
```

## Validation
Quick validation:

```bash
make verify
make analyze-smoke
```

Production-style build:

```bash
make build
```

Full analysis:

```bash
make analyze
```

Collision sampling for duplicate-seed analysis:

```bash
make collision-stats
COLLISION_NUM_BRACKETS=1000000 make collision-stats
```

Historical baseline backtest for the current probability model:

```bash
make backtest-current-model
```

Train and evaluate the simple V2 logistic-regression model:

```bash
make train-v2-model
```

## How The Bracket Space Works
- Bracket indices range from `0` to `999,999,999` by default.
- Each index deterministically seeds the PRNG.
- The PRNG produces 63 decisions in canonical game order.
- Each decision is compared against a win probability.
- The resulting 63 bits are the bracket.

The same index always produces the same bracket for the same model and tournament data. Brackets are reconstructed, not stored.

## Public Site
Public users can:
- load the homepage
- read cached stats from `GET /api/stats`
- read current results from `GET /api/results`

## Admin API
Mutating/admin actions should be called with an admin token:

```bash
export ADMIN_TOKEN='replace-me'
export ADMIN_BASE_URL='http://localhost:3000'
```

Refresh analysis:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Refresh analysis without ESPN fetch first:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Set a result:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "game_index": 0,
    "round": 64,
    "team1": "Duke",
    "team2": "Siena",
    "winner": "Duke"
  }'
```

Clear a result:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "game_index": 0,
    "round": 64,
    "team1": "Duke",
    "team2": "Siena",
    "winner": null
  }'
```

Inspect results:

```bash
curl "$ADMIN_BASE_URL/api/results"
```

Inspect stats:

```bash
curl "$ADMIN_BASE_URL/api/stats"
```

Inspect audit log:

```bash
curl "$ADMIN_BASE_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Data And Runtime State
- Static tournament input: [data/tournament-2026.json](/Users/willsmart/dev/brackets/data/tournament-2026.json)
- Runtime DB: `march-madness.db`
- Analysis engine: [lib/analyze.ts](/Users/willsmart/dev/brackets/lib/analyze.ts)
- Worker hot loop: [lib/worker.ts](/Users/willsmart/dev/brackets/lib/worker.ts)
- Tournament/model logic: [lib/tournament.ts](/Users/willsmart/dev/brackets/lib/tournament.ts)

## Deployment
Use the runbook in [docs/runbooks/deploy.md](/Users/willsmart/dev/brackets/docs/runbooks/deploy.md).

The intended production model is:
- build locally on the host Mac
- run `next start` under `pm2` directly
- expose the app via Cloudflare Tunnel

For a custom public hostname, the recommended setup is:
- app served on the host Mac at `http://127.0.0.1:3000`
- Cloudflare Tunnel publishing `https://brackets.willjsmart.com`
- remote admin calls using the same bearer token

Remote admin example:

```bash
export ADMIN_BASE_URL='https://brackets.willjsmart.com'
export ADMIN_TOKEN='replace-me'
```

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Current Product Scope
- 1 billion bracket target
- SQLite-backed cached stats and results
- public read-only dashboard
- token-protected admin mutations
- ESPN final-result ingestion
- manual result override path

## Notes
- Full `1B` analysis is intentionally expensive and should be benchmarked on the host machine before tournament day.
- First Four play-in handling should be driven by runtime mappings rather than rewriting source files on the live machine.
