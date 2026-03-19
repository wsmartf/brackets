# 04 — Homepage Redesign (Ship before tip-off or early day 1)

## Goal
Redesign the homepage so it tells a story, not just shows stats. The page should make a visitor immediately understand what this is, why it's interesting, and want to explore.

## Why
The current page is a functional dashboard. It works, but it doesn't make anyone care. The redesign should feel like walking into an exhibit, not reading a monitoring panel.

## What's wrong now
- The hero is "March Madness 2026" with "Tracking 1 billion generated brackets against reality" — generic, tells you nothing specific
- The big number (remaining brackets) has no context — is that a lot? what changed?
- The championship probability bars are the most interesting thing on the page and they're buried below the fold
- The game feed is a flat list with no narrative framing
- The whole page is `max-w-2xl` — feels cramped, like a side project

## Design direction
This is a HUMAN task primarily. The developer (you) should write the copy and make layout decisions. Claude can implement the layout changes, but the words and story need a human voice.

Suggested structure (revise as you see fit):

### Above the fold
- **Headline**: Something dramatic and specific, not generic. Examples to riff on:
  - "X brackets are still perfect." (where X is the live count)
  - "Before tip-off, there were 1 billion brackets. Now there are X."
  - Let the number BE the headline
- **The delta**: How many died since last game? Which game killed them?
- **CTA**: "Pick a bracket" or "Explore the model" — something that invites interaction

### Below the fold
- Championship odds (promoted up — this is the most interesting live data)
- Recent eliminations with impact ("Game 7: Duke over Robert Morris — 0.2% eliminated" vs "Game 12: 12-seed Oregon over 5-seed Marquette — 18% eliminated")
- Link to bracket viewer once it exists

## Implementation notes for Claude
- Widen the layout (max-w-4xl or max-w-5xl)
- Consider SSR for initial data (server component that fetches stats, passes to client shell)
- The dark theme is fine but could use more visual variety — the about page's design language is actually better
- Don't over-build. The words matter more than the components.

## Acceptance Criteria
- A visitor understands the concept within 5 seconds
- The page has a human-written headline and subhead (not AI-generated placeholder text)
- The elimination delta is visible (depends on task 02 for data, can use placeholder until then)
- Championship odds are above the fold on desktop
- Layout feels intentional, not cramped
- Browser-verified on desktop and mobile

## Affected Files
- `app/page.tsx`
- `components/Dashboard.tsx`
- `components/ProbabilityBars.tsx`
- `components/GameFeed.tsx`
- `app/globals.css`
