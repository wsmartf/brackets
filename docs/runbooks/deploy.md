# Deploy Runbook

This runbook is for code deploys, process restarts, replay rehearsal, and
rollback. For live tournament operations, use
`docs/runbooks/tournament-day.md`.

## Deploy
1. Pull latest code.
2. Install deps if needed: `make install`
3. Verify locally: `make verify`
4. Build: `make build`
5. Ensure `ADMIN_TOKEN` is set in the app process environment.
6. Restart the app process with `pm2`.
7. Restart `cloudflared` if needed.
8. Confirm the site works locally and publicly.
9. Confirm stats and admin access still work.

Suggested verification:

```bash
source .env.ops
make ops-status
make ops-audit LIMIT=10
```

If you need a local-only check on the host:

```bash
source .env.ops
export ADMIN_BASE_URL='http://127.0.0.1:3000'
make ops-status
```

## PM2
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

If you are using a named tunnel, restart it after deploy and confirm the public
hostname still resolves to the local app.

Typical command:

```bash
cloudflared tunnel run <tunnel-name-or-id>
```

Public verification:

```bash
curl https://brackets.willjsmart.com/api/stats
```

## Replay Rehearsal
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

## Production Data Rehearsal
Run this on the production host before a deploy if you want to preview the
exact deploy candidate against the current production DB state without touching
the live app on `127.0.0.1:3000`.

The preferred workflow uses the main checkout plus a separate Next build output
directory:
- live app keeps using `.next`
- rehearsal build uses `.next-rehearsal`
- rehearsal DB copy lives at `/tmp/brackets-prod-rehearsal.db`
- rehearsal app listens on `127.0.0.1:3001`

This is lower friction than a separate worktree and includes local uncommitted
changes in the rehearsal.

From the live checkout, run the full local rehearsal in one command:

```bash
export MARCH_MADNESS_DB_PATH='/tmp/brackets-prod-rehearsal.db'
export ADMIN_TOKEN='replace-with-local-rehearsal-token'
export PORT=3001
export HOSTNAME=127.0.0.1

make rehearse-prod
```

This does three things in order:
- snapshots the live SQLite DB into `/tmp/brackets-prod-rehearsal.db`
- builds the rehearsal app into `.next-rehearsal`
- starts the rehearsal app on `127.0.0.1:3001`

If you want to run the steps separately:

```bash
make rehearse-prod-copy
make rehearse-prod-build
make rehearse-prod-start
```

In another shell on the production host, point admin commands at the rehearsal
instance:

```bash
source .env.ops
export ADMIN_BASE_URL='http://127.0.0.1:3001'
export ADMIN_TOKEN='replace-with-local-rehearsal-token'
```

Recommended checks before a refresh:

```bash
curl -s "$ADMIN_BASE_URL/api/stats" | jq .
curl -s "$ADMIN_BASE_URL/api/future-killers" | jq .
```

Run the full rehearsal refresh only if the change touches refresh, analysis, or
ESPN-sync behavior:

```bash
make ops-refresh
make ops-status
# repeat `make ops-status` until `.analysisStatus.isRunning` is false
curl -s "$ADMIN_BASE_URL/api/future-killers" | jq .
```

### Browser Access From Your Laptop
Open a second terminal on your laptop, not on the production host:

```bash
ssh -N -L 3001:127.0.0.1:3001 your-user@your-prod-host
```

Then open this URL in your local browser:

```text
http://127.0.0.1:3001
```

If local port `3001` is already in use, forward a different local port:

```bash
ssh -N -L 33001:127.0.0.1:3001 your-user@your-prod-host
```

Then browse to `http://127.0.0.1:33001`.

What to verify:
- homepage loads and shows the expected current results
- `/api/future-killers` returns the expected rows and ordering
- the fallback note looks sane if ESPN is unavailable
- live `3000` is unchanged while rehearsal `3001` is running

Cleanup:

```bash
rm -f /tmp/brackets-prod-rehearsal.db
rm -rf .next-rehearsal
```

## Pre-Tournament Restart Check
Run this once on the actual host before games start:

1. Confirm `pm2` is supervising the app.
2. Confirm the site is reachable.
3. Kill the process listening on `:3000` and confirm `pm2` restarts it.
4. Reboot the machine and confirm the app returns.
5. Confirm SQLite data is intact.
6. Confirm one refresh still works.
7. Confirm one manual result set and clear still work.

Use the commands in `docs/runbooks/tournament-day.md` for the actual checks.

## Cloudflare Web Analytics
Use the existing `willjsmart.com` Web Analytics site in Cloudflare.

1. In the Cloudflare dashboard, go to `Web Analytics`.
2. Open the existing site for `willjsmart.com`.
3. Filter by host or URL to inspect `brackets.willjsmart.com`.
4. After deploy, open `https://brackets.willjsmart.com` in a browser to
   generate page views.
5. Recheck the Web Analytics dashboard after a few minutes.

Notes:
- `brackets.willjsmart.com` appears under the parent `willjsmart.com`
  analytics site, not as a separate required app-side beacon.
- There is no Cloudflare analytics snippet in the app layout.

## Rollback
1. Check out the last known good code.
2. Run `make build`.
3. Restart `pm2`.
4. Restart `cloudflared` if needed.
5. Confirm homepage and admin API access.

## Secrets
- Keep the admin token in the process environment.
- Rotate it by updating the process env and restarting the app.
- Do not commit `.env.local` or production secret files.
- Write down where the production `ADMIN_TOKEN` is stored so future deploys do
  not depend on memory.
