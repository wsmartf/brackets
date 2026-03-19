# 10 — Add Cloudflare Web Analytics (Ship tonight)

## Goal
Add Cloudflare Web Analytics so we have real traffic numbers from day one of the tournament.

## Why
"2,400 visitors during the first weekend" on the README is worth more than any feature. Can't get those numbers retroactively.

## Implementation
1. In Cloudflare dashboard, go to Web Analytics → Add a site
2. Enter `brackets.willjsmart.com`
3. Because this hostname is not recognized as a website on the current Cloudflare account, use manual JS snippet installation
4. Add the Cloudflare beacon snippet to `app/layout.tsx`
5. Deploy, visit the live site, and confirm page views appear in the Cloudflare analytics dashboard

## Notes
- No cookies, no GDPR concerns, no server-side changes
- Free tier is sufficient
- Gives: page views, unique visitors, top pages, referrers, countries
- Already behind Cloudflare Tunnel so this is the natural choice
- Cloudflare dashboard currently reports that `brackets.willjsmart.com` does not belong to a website on this Cloudflare account for automatic Web Analytics setup
- Manual script installation is therefore the correct path for this app right now

## Current Status
- Repo review completed on March 19, 2026
- Added the Cloudflare Web Analytics beacon to `app/layout.tsx`
- `make verify` passed
- Browser verification on `http://127.0.0.1:3000` confirmed one `beacon.min.js` script with the expected token in the rendered DOM
- Local dev shows a Cloudflare RUM POST CORS error, which is expected because the beacon is for `brackets.willjsmart.com`, not `127.0.0.1`

## Next Steps
- Build and restart the production app
- Open `https://brackets.willjsmart.com` in a browser and generate at least one page view
- Confirm the page view appears in Cloudflare Web Analytics after a few minutes
- If Cloudflare still shows no data, verify the token in the dashboard matches the token in `app/layout.tsx`

## Acceptance Criteria
- Beacon script is in the production layout
- Cloudflare dashboard shows at least one page view after deploy
- No visible impact on page load
- Manual Cloudflare setup path is documented and verified locally

## Affected Files
- `app/layout.tsx`
- `docs/runbooks/deploy.md`
- `tasks/active/10-cloudflare-analytics.md`
