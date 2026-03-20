# Tournament Day Runbook

This runbook is for live monitoring, refreshes, manual overrides, and incident
recovery while games are in progress.

## Shell Setup
Run once in the shell you are using for live ops:

```bash
source .env.ops
```

This sets `ADMIN_BASE_URL` and `ADMIN_TOKEN`. The Makefile targets and curl
commands below all read from those env vars.

Optional override when running directly on the server:

```bash
export ADMIN_BASE_URL='http://127.0.0.1:3000'
```

## Before Games Start
1. Confirm the app is running under `pm2`.
2. Confirm the Cloudflare Tunnel is running.
3. Open `https://brackets.willjsmart.com`.
4. Run a basic admin check:

```bash
make ops-status
make ops-audit LIMIT=10
make ops-espn-names
```

`make ops-espn-names` is the preflight check for ESPN naming drift. It fetches
the current tournament scoreboard, lists the team names ESPN is using, and
exits non-zero if any name does not map to a canonical bracket team. Keep this
as a manual check for now. The live refresh loop already polls ESPN
continuously, and unmatched finalized games now fail loudly during refresh, so
adding a second scheduled job would add operational surface area without much
benefit.

## Common Actions

- Check current app state:

```bash
make ops-status
```

- Read recent audit log:

```bash
make ops-audit
make ops-audit LIMIT=50
```

- Trigger a refresh (fetches ESPN + runs analysis if anything changed):

```bash
make ops-refresh
```

  Returns `200` if nothing changed, `202` if analysis started. If `202`, watch
  `make ops-status` until `analysisStatus.isRunning` is false.

- Refresh without ESPN (use if ESPN is failing or returning bad data):

```bash
make ops-refresh-no-espn
```

## Manually Set a Result

Use this when ESPN hasn't picked up a game, or picked it up wrong.

```bash
curl -s -X POST $ADMIN_BASE_URL/api/results \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":"Duke"}' | jq .

make ops-refresh-no-espn
make ops-status
```

`manual_override` is set automatically when winner is non-null — ESPN won't
overwrite it.

## Clear a Bad Manual Result

```bash
curl -s -X POST $ADMIN_BASE_URL/api/results \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":null}' | jq .

- Audit ESPN team names before tip-off or when ingest looks suspicious:

```bash
make ops-espn-names
ESPN_AUDIT_DAYS_AHEAD=1 make ops-espn-names
ESPN_AUDIT_DATES=20260320,20260321 make ops-espn-names
```

  Use this to catch scoreboard naming mismatches before games finish. The
  command exits with a non-zero status if ESPN is using a team name that the
  app cannot map to a canonical tournament team.

- Manually set a result:

```bash
make ops-result ACTION=set GAME=0 ROUND=64 TEAM1='Duke' TEAM2='Siena' WINNER='Duke'
make ops-refresh-no-espn
```

## Fix a Stale `updated_at` (Wrong "Latest Result" Display)

The homepage sorts results by `updated_at`. If a game shows as "latest" but
shouldn't, fix it directly in SQLite on the host:

```bash
sqlite3 march-madness.db "UPDATE results SET updated_at = '2026-03-20 02:24:00' WHERE game_index = 13;"
```

Use UTC times. The site reflects the change on the next poll (~15s), no restart
needed.

## Refresh Loop

The refresh loop calls `POST /api/refresh` every 60 seconds. Start it with pm2:

```bash
source .env.ops
pm2 start scripts/ops/refresh_loop.sh --name refresh-loop
export REFRESH_INTERVAL_SECONDS=60

make refresh-loop
```

The loop calls `POST /api/refresh` every 60 seconds.
- `200` means ESPN found nothing new and cached analysis was already current.
- `202` means new work was accepted and analysis started.
- `502` means ESPN returned finalized tournament results that did not match a
  canonical game cleanly. Valid queued results may still process, but you
  should inspect `make ops-audit` and run `make ops-espn-names`.
- `409` means the previous analysis is still running, so the loop tries again
  on the next interval.

If you want it supervised by `pm2`:

```bash
ADMIN_BASE_URL='https://brackets.willjsmart.com' \
ADMIN_TOKEN='replace-me' \
REFRESH_INTERVAL_SECONDS=60 \
pm2 start ./scripts/ops/refresh_loop.sh --name march-madness-refresh --interpreter bash
```

Useful commands:

```bash
pm2 logs refresh-loop --lines 100
pm2 stop refresh-loop
pm2 restart refresh-loop
pm2 delete refresh-loop
```

Response codes the loop logs:
- `200` — nothing new, analysis already current
- `202` — new results found, analysis started
- `409` — previous analysis still running, will retry next interval

## Stuck Analysis Recovery

Symptom: homepage shows "recomputing..." indefinitely, `make ops-refresh`
keeps returning `409`.

Cause: app restarted mid-analysis, leaving `isRunning=true` in the DB.

Fix:

```bash
pm2 stop refresh-loop

sqlite3 march-madness.db "SELECT value FROM stats WHERE key = 'analysis_status';"
```

If `isRunning` is true and nothing is actually running:

```bash
DB_PATH="${MARCH_MADNESS_DB_PATH:-march-madness.db}" node - <<'EOF'
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH);
const status = JSON.parse(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis_status").value);
const analysis = JSON.parse(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis").value);
status.isRunning = false;
status.lastFinishedAt = analysis.analyzedAt || status.lastStartedAt || new Date().toISOString();
db.prepare(`INSERT INTO stats (key, value, updated_at) VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
  .run("analysis_status", JSON.stringify(status));
console.log(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis_status").value);
EOF

make ops-refresh
pm2 start refresh-loop
```

## Diagnosing a Stuck or Missing Result

1. Check what's in the DB:

```bash
sqlite3 march-madness.db "SELECT game_index, team1, team2, winner, updated_at FROM results WHERE winner IS NOT NULL ORDER BY updated_at DESC LIMIT 10;"
```

2. Check the pending queue:

```bash
sqlite3 march-madness.db "SELECT id, game_index, team1, team2, winner, detected_at, processed_at FROM result_events WHERE processed_at IS NULL;"
```

  Pending rows mean results were fetched from ESPN but analysis hasn't run yet.
  Run `make ops-refresh` to process them.

3. Check the audit log for skipped ESPN results:

```bash
make ops-audit LIMIT=50
```

  Look for `espn_result_skipped` with `reason: team_mapping_failed`. Those
  games need either a name alias added to `lib/espn.ts` or a manual result set.

4. If a game keeps re-processing (same game_index appearing repeatedly in the
   audit), check whether a play-in game is resetting it. Look for
   `play_in_override_applied` firing every refresh.

## First Four

- Play-in winner substitution happens automatically at runtime.
- Do not edit `data/tournament-2026.json` on the live machine.
- If a play-in winner isn't being applied correctly, set the Round of 64 slot
  manually (with the actual play-in winner as team2) and refresh.
