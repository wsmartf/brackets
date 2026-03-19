# Tournament Day Checklist

## Before Games Start
1. Confirm the app is running under `pm2`.
2. Confirm the Cloudflare Tunnel is running.
3. Open `https://brackets.willjsmart.com`.
4. Run one admin refresh:

```bash
export ADMIN_BASE_URL='https://brackets.willjsmart.com'
export ADMIN_TOKEN='replace-me'

curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl "$ADMIN_BASE_URL/api/stats"
```

5. Check the audit log:

```bash
curl "$ADMIN_BASE_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## During The Tournament
- The homepage no longer exposes a public refresh control.
- All refreshes and manual result changes should go through the admin API.
- There is no built-in server-side ESPN poller. If you want automatic ESPN
  ingest, run the refresh loop below on the host.

- Optional 60-second auto-refresh loop:

```bash
export ADMIN_BASE_URL='https://brackets.willjsmart.com'
export ADMIN_TOKEN='replace-me'
export REFRESH_INTERVAL_SECONDS=60

make refresh-loop
```

  The loop calls `POST /api/refresh` every 60 seconds.
  - `200` means ESPN found nothing new and cached analysis was already current.
  - `202` means new work was accepted and analysis started.
  - `409` means the previous analysis is still running, so the loop simply tries
    again on the next interval.

- Optional `pm2` version of the same loop:

```bash
ADMIN_BASE_URL='https://brackets.willjsmart.com' \
ADMIN_TOKEN='replace-me' \
REFRESH_INTERVAL_SECONDS=60 \
pm2 start ./scripts/refresh_loop.sh --name march-madness-refresh --interpreter bash
```

  Useful commands:

```bash
pm2 logs march-madness-refresh --lines 100
pm2 stop march-madness-refresh
pm2 delete march-madness-refresh
```

- Use normal refresh:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

  `POST /api/refresh` returns `200` when nothing changed and `202 Accepted` when
  analysis actually starts. If you get `202`, poll `GET /api/stats` and wait for
  `analysisStatus.isRunning` to become `false` before treating the refresh as
  complete.

- If ESPN is failing, refresh without ESPN:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl "$ADMIN_BASE_URL/api/stats"
```

- Manually set a result if needed:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":"Duke"}'
```

  After any manual result write, immediately run a no-ESPN refresh and wait for
  it to finish before trusting the homepage:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl "$ADMIN_BASE_URL/api/stats"
curl "$ADMIN_BASE_URL/api/results"
curl "$ADMIN_BASE_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- Clear a bad manual result:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":null}'
```

  Clearing a result has the same follow-up requirement:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Quick Health Checks
Public:

```bash
curl https://brackets.willjsmart.com/api/stats
```

Admin:

```bash
curl "$ADMIN_BASE_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Local host checks:

```bash
pm2 status
pm2 logs march-madness --lines 100
```

## Stuck Analysis Recovery
If the homepage shows `recomputing against the latest results...` for a long time
and `POST /api/refresh` keeps returning `409 Analysis is already running`, the
app likely restarted during an in-flight analysis run and left
`analysis_status.isRunning=true` behind.

Recovery steps:

```bash
pm2 stop march-madness-refresh
export DB_PATH="${MARCH_MADNESS_DB_PATH:-march-madness.db}"

sqlite3 "$DB_PATH" "select key, value from stats where key in ('analysis','analysis_status');"
```

If `analysis_status.isRunning` is still `true` and no analysis is actually
running, clear it:

```bash
DB_PATH="$DB_PATH" node - <<'EOF'
const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH);
const status = JSON.parse(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis_status").value);
const analysis = JSON.parse(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis").value);

status.isRunning = false;
status.lastFinishedAt = analysis.analyzedAt || status.lastStartedAt || new Date().toISOString();

db.prepare(`
  INSERT INTO stats (key, value, updated_at)
  VALUES (?, ?, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at
`).run("analysis_status", JSON.stringify(status));

console.log(db.prepare("SELECT value FROM stats WHERE key = ?").get("analysis_status").value);
EOF
```

Then verify one manual refresh before restarting the loop:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- `200` means no new results and the system is healthy again.
- `202` means real analysis work started.

After that:

```bash
pm2 start march-madness-refresh
pm2 logs march-madness-refresh --lines 20
```

## First Four
- The app now handles First Four winner substitution at runtime.
- Do not edit `data/tournament-2026.json` on the live machine.
- If ESPN does not apply a play-in winner correctly, set the relevant Round of 64 slot manually and refresh.
