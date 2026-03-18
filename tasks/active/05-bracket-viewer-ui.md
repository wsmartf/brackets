# 05 — Bracket Viewer UI (Ship during tournament)

## Goal
Build a public page where a visitor can enter a bracket ID (or get a random one) and see the full bracket with alive/dead/pending status for every pick.

## Why
This is the feature that makes "every bracket is a number" real. Without it, the concept is just words on the about page. With it, people can actually touch a bracket, see its picks, and watch it live or die.

## Depends on
- Task 03 (bracket viewer API)

## URL
`/bracket/[id]` — already stubbed as `app/bracket/[id]/page.tsx`

## UI Design
Keep it simple for v1. NOT a full graphical bracket visualization (that's complex and fragile). Instead:

### Option A: Round-by-round list (recommended for v1)
```
Bracket #418,275,901 — ALIVE (5/6 correct, 57 pending)

Round of 64
  Duke vs Robert Morris → Duke ✓
  Kentucky vs Montana → Kentucky ✓
  ...

Round of 32
  Duke vs Kentucky → Duke (pending)
  ...
```

Color-code: green for correct, red for wrong, gray for pending.

### Entry points
- Direct URL: `/bracket/418275901`
- "Random bracket" button on the page
- Input field to type/paste a bracket ID
- Eventually: link from homepage ("Explore a bracket")

### Random bracket
Generate a random ID client-side (Math.floor(Math.random() * 1_000_000_000)) and navigate to it. Simple, no server needed.

## Implementation
1. Build the page component at `app/bracket/[id]/page.tsx`
2. Fetch from `/api/bracket/[id]` on load
3. Render picks grouped by round
4. Add input field + "Random" button in a header bar
5. Handle loading, error, and invalid-ID states
6. Add navigation link from homepage

## Acceptance Criteria
- `/bracket/418275901` shows a full, correct bracket
- Picks are visually marked alive/dead/pending
- "Random bracket" works
- Invalid IDs show a clear error
- Page is navigable from the homepage
- Browser-verified on desktop and mobile

## Affected Files
- `app/bracket/[id]/page.tsx`
- `components/` (new bracket display component)
- `app/page.tsx` (add link)
