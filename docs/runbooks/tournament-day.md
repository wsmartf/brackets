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
```

5. Check the audit log:

```bash
curl "$ADMIN_BASE_URL/api/audit?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## During The Tournament
- Use normal refresh:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- If ESPN is failing, refresh without ESPN:

```bash
curl -X POST "$ADMIN_BASE_URL/api/refresh?espn=false" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

- Manually set a result if needed:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":"Duke"}'
```

- Clear a bad manual result:

```bash
curl -X POST "$ADMIN_BASE_URL/api/results" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"game_index":0,"round":64,"team1":"Duke","team2":"Siena","winner":null}'
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

## First Four
- The app now handles First Four winner substitution at runtime.
- Do not edit `data/tournament-2026.json` on the live machine.
- If ESPN does not apply a play-in winner correctly, set the relevant Round of 64 slot manually and refresh.
