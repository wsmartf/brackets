# Deploy Runbook

## Deploy
1. Pull latest code.
2. Install deps if needed: `make install`
3. Verify locally: `make verify`
4. Build: `make build`
5. Ensure `ADMIN_TOKEN` is set in the app process environment.
6. Restart app process with `pm2`.
7. Start or restart `cloudflared`.
8. Confirm homepage loads locally and publicly.
9. Confirm one admin API call works.
10. Confirm stats/results are still present.

## Pre-Launch Replay Rehearsal
Run this before games start if you want a full isolated drill against the real
refresh route without touching the live runtime DB.

Terminal 1, start the local ESPN stub:

```bash
make replay-stub
```

Terminal 2, start the app against a disposable DB and the stubbed ESPN source:

```bash
export ADMIN_TOKEN='replace-me'
export MARCH_MADNESS_DB_PATH="/tmp/brackets-replay-$(date +%s).db"
export ESPN_SCOREBOARD_BASE_URL='http://127.0.0.1:4100/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard'
export ANALYZE_NUM_BRACKETS=10000
export ANALYZE_NUM_WORKERS=2

make dev
```

Terminal 3, run the replay driver:

```bash
export ADMIN_BASE_URL='http://127.0.0.1:3000'
export ADMIN_TOKEN='replace-me'
export ESPN_STUB_BASE_URL='http://127.0.0.1:4100'
export MARCH_MADNESS_DB_PATH='/tmp/brackets-replay-REPLACE_ME.db'

make replay-smoke
```

Notes:
- The replay driver refuses to run against the default `march-madness.db`.
- Replace the `MARCH_MADNESS_DB_PATH` value in terminal 3 with the exact value
  used in terminal 2.
- The public homepage does not expose an admin refresh button; refresh testing
  is API-driven.
- During the rehearsal, watch `/` in the browser and reload `/bracket/0` after
  the final manual-override step to confirm the bracket page reflects the new
  eliminated state.

## Optional Auto-Refresh Loop
There is no built-in scheduler inside the app. If you want ESPN ingest every 60
seconds, run the host-side refresh loop:

```bash
export ADMIN_BASE_URL='https://brackets.willjsmart.com'
export ADMIN_TOKEN='replace-me'
export REFRESH_INTERVAL_SECONDS=60

make refresh-loop
```

If you want it supervised by `pm2`:

```bash
ADMIN_BASE_URL='https://brackets.willjsmart.com' \
ADMIN_TOKEN='replace-me' \
REFRESH_INTERVAL_SECONDS=60 \
pm2 start ./scripts/refresh_loop.sh --name march-madness-refresh --interpreter bash
```

## PM2 Commands
Initial setup:

```bash
pm2 start node_modules/next/dist/bin/next --name march-madness -- start
pm2 save
pm2 startup
```

Normal restart after deploy:

```bash
pm2 restart march-madness
pm2 logs march-madness --lines 100
```

## Cloudflare Tunnel
Recommended public hostname:

```bash
https://brackets.willjsmart.com
```

Recommended service target:

```bash
http://127.0.0.1:3000
```

If you are using a named tunnel, restart it after deploy and confirm the hostname still resolves to the local app.

Typical command:

```bash
cloudflared tunnel run <tunnel-name-or-id>
```

Public verification:

```bash
curl https://brackets.willjsmart.com/api/stats
```

## Cloudflare Web Analytics
This app uses the manual Cloudflare Web Analytics beacon in `app/layout.tsx`.

1. In the Cloudflare dashboard, go to `Web Analytics`.
2. Select `Add a site`.
3. Enter `brackets.willjsmart.com`.
4. If Cloudflare says the hostname does not belong to a website on this account, continue with manual JS snippet installation.
5. Confirm the token shown in Cloudflare matches the token in `app/layout.tsx`.
6. After deploy, open `https://brackets.willjsmart.com` in a browser to generate a page view.
7. Recheck the Web Analytics dashboard after a few minutes.

Local note:
- The beacon can log a CORS error on `localhost` or `127.0.0.1` during local development because the hostname does not match the production site. Verify analytics against the real production URL.

## Pre-Tournament Restart Check
1. Start the app with `pm2`.
2. Confirm the site is reachable.
3. Find the actual listener on port `3000` with `lsof -nP -iTCP:3000 -sTCP:LISTEN`.
4. Kill that listener PID and confirm `pm2` restarts the app.
4. Reboot the machine and confirm the app returns.
5. Confirm SQLite data is intact.
6. Confirm refresh still works.
7. Confirm a manual result set + clear still works.

Suggested verification commands:

```bash
export ADMIN_BASE_URL='http://127.0.0.1:3000'
export ADMIN_TOKEN='replace-me'
```

```bash
curl "$ADMIN_BASE_URL/api/stats"
curl "$ADMIN_BASE_URL/api/results"
curl "$ADMIN_BASE_URL/api/audit?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl "$ADMIN_BASE_URL/api/stats"
```

Remote admin from another Mac:

```bash
export ADMIN_BASE_URL='https://brackets.willjsmart.com'
export ADMIN_TOKEN='replace-me'
```

```bash
curl "$ADMIN_BASE_URL/api/stats"
curl "$ADMIN_BASE_URL/api/audit?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
curl "$ADMIN_BASE_URL/api/stats"
```

`POST /api/refresh` now returns immediately with `202 Accepted`. Use `GET /api/stats` to watch `analysisStatus.isRunning` and wait for it to become `false` before trusting the updated cached stats.

## If Something Goes Wrong
- If ESPN fetch is failing or slow, use `POST /api/refresh?espn=false`.
- If a game result is wrong or delayed, use the manual `POST /api/results` admin API,
  then immediately run `POST /api/refresh?espn=false`.
- Check `pm2 logs march-madness --lines 100`.
- Check `GET /api/audit` with the admin token.
- If the public site is down but the app is healthy locally, check the Cloudflare Tunnel process.

## Rollback
1. Check out last known good code
2. Run `make build`
3. Restart `pm2`
4. Restart `cloudflared` if needed
5. Confirm homepage and admin API

## Secrets
- Keep the admin token in the process environment
- Rotate it by updating the process env and restarting the app
- Do not commit `.env.local` or production secret files
- Write down where the production `ADMIN_TOKEN` is stored so future deploys do not depend on memory
