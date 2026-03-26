# Local E2E Testing Runbook

How to set up local dev state to test specific homepage scenarios, including the
Final N threshold UI, and how to copy the prod DB from the Intel Mac.

## Overview of homepage states

| Condition | What renders |
|-----------|-------------|
| `remaining > 20` | `StandardHomepage` — tabs, ByTheNumbers, etc. |
| `remaining <= 20` | `FinalNHomepage` — bracket cards, matrix, survival curve |

The threshold is `stats.remaining <= 20` in `app/page.tsx`, driven by the
`surviving_indices` table in SQLite.

---

## Copying the prod DB from the Intel Mac

The production DB lives on your Intel Mac (the server). Copy it locally with `rsync` or `scp`.

**Important:** SQLite in WAL mode stores recent writes in `-wal` and `-shm` sidecar
files. The main `.db` file alone may contain only empty/stale data. Always copy all
three files together.

```bash
rsync -avz --progress \
  intel-mac:~/dev/brackets/march-madness.db \
  intel-mac:~/dev/brackets/march-madness.db-wal \
  intel-mac:~/dev/brackets/march-madness.db-shm \
  /tmp/

# Rename to avoid collisions with the local working copy
mv /tmp/march-madness.db     /tmp/brackets-prod-copy.db
mv /tmp/march-madness.db-wal /tmp/brackets-prod-copy.db-wal
mv /tmp/march-madness.db-shm /tmp/brackets-prod-copy.db-shm
```

Replace `intel-mac` with the SSH host alias (or `user@hostname`).

Once copied, start dev against it:

```bash
MARCH_MADNESS_DB_PATH=/tmp/brackets-prod-copy.db ADMIN_TOKEN=test make dev
```

> **Never point `MARCH_MADNESS_DB_PATH` at the live `march-madness.db` on the
> server while running a local dev server** — the dev server's analysis runs
> would overwrite production data.

---

## Simulating game results via the API

The simplest way to test future states is to add/remove results through the admin
API while the dev server is running against a **copy** of the prod DB. This tests
the actual production flow (result → analysis → UI update) without fixtures.

Start the dev server with an admin token:

```bash
MARCH_MADNESS_DB_PATH=/tmp/brackets-prod-copy.db ADMIN_TOKEN=test make dev
```

### Add a game result

Look up the game fields from `http://localhost:3000/api/results` (search for the
matchup), then POST with the exact `game_index`, `round`, `team1`, `team2` values:

```bash
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"game_index":51,"round":16,"team1":"Texas","team2":"Purdue","winner":"Texas"}'
```

### Trigger analysis (skip ESPN)

```bash
curl -X POST "http://localhost:3000/api/refresh?espn=false" \
  -H "Authorization: Bearer test"
```

Analysis runs in the background (~30s for 1B brackets). Poll `/api/stats` or watch
the UI — the "Refreshing against the latest result set" indicator appears while it
runs.

### Undo a result

Set winner to `null` and re-run analysis:

```bash
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"game_index":51,"round":16,"team1":"Texas","team2":"Purdue","winner":null}'

curl -X POST "http://localhost:3000/api/refresh?espn=false" \
  -H "Authorization: Bearer test"
```

### Tips

- **Clear localStorage** between tests to switch between fresh-visitor and
  returning-visitor experiences: `localStorage.clear()` in the browser console.
- **Don't clear it** to test the returning-visitor banner and count animation.
- Check the browser Network tab for `/api/final-n-insights` — milestones update
  on the next 60s poll after analysis completes, or on hard refresh.

---

## Scenario-based local testing (fixture approach)

> **Known issue:** `seed-scenario.cjs` runs analysis on a fresh DB with no prior
> stats. The `collectIndices` flag in `analyze.ts` requires a previous analysis
> run with `remaining <= threshold` to store survivor indices. On a first run from
> a clean DB, `surviving_indices` is not populated, so the survivors API returns
> empty results. The API-based approach above avoids this by using a copy of the
> prod DB that already has analysis history.

Scenarios are JSON fixtures in `scripts/dev/fixtures/`. Each captures a complete
set of game results. You seed a fresh `/tmp` DB from a fixture and start dev
against it. This is fully isolated from the real DB.

### Step 1 — Create a scenario fixture from the current DB

```bash
# Export the current prod DB state as a fixture named "final-5"
MARCH_MADNESS_DB_PATH=/tmp/brackets-prod-copy.db make export-scenario NAME=final-5
```

This writes `scripts/dev/fixtures/final-5.json`. Commit it if you want the
scenario to be reproducible for others.

### Step 2 — Seed and start dev from a scenario

```bash
make dev-scenario SCENARIO=final-5
```

This:
1. Reads `scripts/dev/fixtures/final-5.json`
2. Creates a fresh DB at `/tmp/brackets-final-5.db`
3. Seeds all game results and runs full analysis (~30s)
4. Starts `make dev` with that DB

Or as two separate steps if you want to inspect the seeded state before starting:

```bash
SCENARIO=final-5 node --require tsx/cjs scripts/dev/seed-scenario.cjs
# inspect: remaining, gamesCompleted printed to stdout
MARCH_MADNESS_DB_PATH=/tmp/brackets-final-5.db make dev
```

### Recommended scenarios to keep checked in

| Fixture name | Description | remaining | How to create |
|---|---|---|---|
| `final-5` | Live 5-survivor state (Final N mode) | ≤ 5 | Export from prod at Elite Eight |
| `standard-mode` | Early tournament, many survivors | > 20 | Export from prod at Round of 32 |

Create them once by running `export-scenario` against the appropriate DB snapshot,
then commit the fixture files.

---

## Testing the Final N homepage

### What to verify manually

After `make dev-scenario SCENARIO=final-5` (or any Final N scenario):

1. **Hero + stats strip** — "THE FINAL 5" heading, Games/Eliminated/Biggest Kill tiles
2. **Bracket cards** — one card per survivor; champion name, odds, Final Four, "Needs next"
3. **Survival matrix** — divergence columns highlighted, shared-fate summary above
4. **Upcoming games** — game list with shared-fate vs split-count labels
5. **Survival curve** — log-scale chart with hover tooltips
6. **Threshold switch** — if you increase `remaining` above 20 in the DB, Standard Homepage renders

To force-render Standard Homepage while in a Final N scenario (for visual regression checks):

```bash
sqlite3 /tmp/brackets-final-5.db "
  UPDATE stats SET value = json_set(value, '$.remaining', 21)
  WHERE key = 'analysis';
"
```

Then reload the page (stats poll fires within 15s, or restart dev to pick it up immediately).

### Testing the returning-visitor banner

The banner fires when `localStorage` has a prior state with a different `remaining`
or different surviving bracket indices.

**Simulate a returning visit (brackets eliminated since last visit):**

```javascript
// Paste in browser devtools console while on the page
localStorage.setItem('brackets-visitor-state', JSON.stringify({
  remaining: 7,
  gamesCompleted: 41,
  survivingIndices: [1, 2, 3, 4, 5, 99999, 100000],
  timestamp: Date.now() - 3_600_000,
}));
location.reload();
// → banner: "Since your last visit: 2 brackets eliminated"
```

**Clear localStorage to simulate a fresh visit (no banner):**

```javascript
localStorage.removeItem('brackets-visitor-state');
location.reload();
```

**Simulate no changes since last visit (no banner):**

```javascript
// First load the page normally, then reload — the hook will have saved current state
location.reload();
```

---

## Running automated tests

```bash
# Unit + integration tests (fast, no server)
make test

# Playwright smoke tests (starts dev server if needed)
make test-ui

# Specific test file
npx playwright test tests/smoke.spec.ts

# Headed mode — watch tests run in a browser
make test-ui-headed
```

The smoke tests are state-aware: the `detail=full` and Final N homepage tests use
`test.skip()` when the current DB is not in the relevant state. Run them against a
Final N scenario DB to exercise those paths:

```bash
make dev-scenario SCENARIO=final-5 &   # start server in background
make test-ui                            # all smoke tests, Final N paths active
```

---

## Quick reference

```bash
# Copy prod DB from Intel Mac (include WAL files!)
rsync -avz intel-mac:~/dev/brackets/march-madness.db{,-wal,-shm} /tmp/
mv /tmp/march-madness.db     /tmp/brackets-prod-copy.db
mv /tmp/march-madness.db-wal /tmp/brackets-prod-copy.db-wal
mv /tmp/march-madness.db-shm /tmp/brackets-prod-copy.db-shm

# Start dev against prod copy
MARCH_MADNESS_DB_PATH=/tmp/brackets-prod-copy.db ADMIN_TOKEN=test make dev

# Add a result + trigger analysis
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" -H "Authorization: Bearer test" \
  -d '{"game_index":51,"round":16,"team1":"Texas","team2":"Purdue","winner":"Texas"}'
curl -X POST "http://localhost:3000/api/refresh?espn=false" -H "Authorization: Bearer test"

# Undo a result
curl -X POST http://localhost:3000/api/results \
  -H "Content-Type: application/json" -H "Authorization: Bearer test" \
  -d '{"game_index":51,"round":16,"team1":"Texas","team2":"Purdue","winner":null}'
curl -X POST "http://localhost:3000/api/refresh?espn=false" -H "Authorization: Bearer test"

# Check what's in a dev DB
sqlite3 /tmp/brackets-prod-copy.db "SELECT key, value FROM stats WHERE key = 'analysis';" | jq .

# Run smoke tests (assumes dev server already running on :3000)
make test-ui
```
