# Deploy Runbook

## Deploy
1. Pull latest code.
2. Install deps if needed: `make install`
3. Verify locally: `make verify`
4. Build: `make build`
5. Ensure `ADMIN_TOKEN` is set in the app process environment.
6. Restart app process with `pm2`
7. Confirm homepage loads
8. Confirm one admin API call works
9. Confirm stats/results are still present

## PM2 Commands
Initial setup:

```bash
pm2 start "npm run start" --name march-madness
pm2 save
pm2 startup
```

Normal restart after deploy:

```bash
pm2 restart march-madness
pm2 logs march-madness --lines 100
```

## Pre-Tournament Restart Check
1. Start the app with `pm2`.
2. Confirm the site is reachable.
3. Kill the app process and confirm `pm2` restarts it.
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
```

## Rollback
1. Check out last known good code
2. Run `make build`
3. Restart `pm2`
4. Confirm homepage and admin API

## Secrets
- Keep the admin token in the process environment
- Rotate it by updating the process env and restarting the app
- Do not commit `.env.local` or production secret files
