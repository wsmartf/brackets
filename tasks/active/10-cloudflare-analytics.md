# 10 — Add Cloudflare Web Analytics (Ship tonight)

## Goal
Add Cloudflare Web Analytics so we have real traffic numbers from day one of the tournament.

## Why
"2,400 visitors during the first weekend" on the README is worth more than any feature. Can't get those numbers retroactively.

## Implementation
1. In Cloudflare dashboard, go to Web Analytics
2. Open the existing `willjsmart.com` analytics site
3. Use host or URL breakdowns to inspect `brackets.willjsmart.com`
4. Deploy as normal, visit the live site, and confirm page views appear in the Cloudflare analytics dashboard without any app-side snippet

## Notes
- No cookies, no GDPR concerns, no server-side changes
- Free tier is sufficient
- Gives: page views, unique visitors, top pages, referrers, countries
- Already behind Cloudflare Tunnel so this is the natural choice
- Cloudflare Web Analytics is already active for the parent site `willjsmart.com`
- `brackets.willjsmart.com` shows up as a host/subdomain within that site
- A separate manual beacon in the app is not required and only adds configuration confusion

## Current Status
- Repo review completed on March 19, 2026
- Removed the temporary manual Cloudflare Web Analytics beacon from `app/layout.tsx`
- `make verify` should remain clean because this is only a layout cleanup
- Browser verification should confirm the site still renders normally without any analytics-specific UI impact

## Next Steps
- Build and restart the production app
- Open `https://brackets.willjsmart.com` in a browser and generate at least one page view
- Confirm the page view appears in the existing `willjsmart.com` Web Analytics site after a few minutes
- Filter by host or URL for `brackets.willjsmart.com` if needed

## Acceptance Criteria
- No Cloudflare analytics snippet is present in the production layout
- Cloudflare dashboard shows `brackets.willjsmart.com` traffic through the existing `willjsmart.com` analytics site
- No visible impact on page load
- Analytics usage path is documented without adding app-side instrumentation

## Affected Files
- `app/layout.tsx`
- `docs/runbooks/deploy.md`
- `tasks/active/10-cloudflare-analytics.md`
