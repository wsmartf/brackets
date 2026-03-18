# 10 — Add Cloudflare Web Analytics (Ship tonight)

## Goal
Add Cloudflare Web Analytics so we have real traffic numbers from day one of the tournament.

## Why
"2,400 visitors during the first weekend" on the README is worth more than any feature. Can't get those numbers retroactively.

## Implementation
1. Go to Cloudflare dashboard → Web Analytics → Add site
2. Copy the beacon script tag with your site token
3. Add the script to `app/layout.tsx` in the `<head>` or before `</body>`
4. Deploy and verify the beacon fires by visiting the site and checking the Cloudflare analytics dashboard

## Notes
- No cookies, no GDPR concerns, no server-side changes
- Free tier is sufficient
- Gives: page views, unique visitors, top pages, referrers, countries
- Already behind Cloudflare Tunnel so this is the natural choice

## Acceptance Criteria
- Beacon script is in the production layout
- Cloudflare dashboard shows at least one page view after deploy
- No visible impact on page load

## Affected Files
- `app/layout.tsx`
