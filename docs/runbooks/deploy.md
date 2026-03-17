# Deploy Runbook

## Deploy
1. Pull latest code.
2. Install deps if needed: `make install`
3. Verify locally: `make verify`
4. Build: `make build`
5. Restart app process with `pm2`
6. Confirm homepage loads
7. Confirm one admin API call works
8. Confirm stats/results are still present

## Pre-Tournament Restart Check
1. Start the app with `pm2`
2. Confirm the site is reachable
3. Kill the app process and confirm `pm2` restarts it
4. Reboot the machine and confirm the app returns
5. Confirm SQLite data is intact
6. Confirm refresh still works

## Rollback
1. Check out last known good code
2. Run `make build`
3. Restart `pm2`
4. Confirm homepage and admin API

## Secrets
- Keep the admin token in the process environment
- Rotate it by updating the process env and restarting the app
