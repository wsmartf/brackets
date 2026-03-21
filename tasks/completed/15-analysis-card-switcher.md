# 15 — Analysis Card Switcher (Phase 1: UI Shell)

## Goal
Refactor the two-column analysis section on the homepage into a tab-switched card (left) + persistent "By the Numbers" sidebar (right). No backend changes. Existing content moves into tabs; new tabs are placeholders.

## Layout
```
[Tab Card ~60%]                    [By the Numbers ~40%]
Survivors | Killers | My Team | Future Killers
(active tab content)               (always visible)
```
Mobile: stack vertically — Tab Card first, By the Numbers below.

## Tab Card — tabs

**Survivors** (default until My Team is built)
- Move existing ProbabilityBars content here
- Show exact counts alongside percentages (already available from championCounts)
- Add rarest contender line at bottom: "Rarest: [Team] — N brackets"
- Team names link to /teams/[name] (prep for Task 09)

**Killers**
- Move existing KillerLeaderboard content here, unchanged

**My Team**
- Placeholder: "Coming soon — search for your team"

**Future Killers**
- Placeholder: "Coming soon — see what's about to blow up the pool"

## By the Numbers sidebar
Always visible. Header: "By the Numbers". Grid of stat callouts.
Phase 1 ships with free stats (no new backend data needed):
- Rarest contender: [Team] (N brackets) — from championCounts min
- Most backed: [Team] (N brackets, X%) — from championCounts max
- Games remaining: N of 63 — from gamesCompleted
- Biggest single-game kill: N brackets — already in impacts data

## Acceptance Criteria
- Tab row renders, switching works, active tab highlighted
- Survivors and Killers tabs show existing content unchanged
- My Team and Future Killers show placeholder states
- By the Numbers shows all 4 free stats with real data
- Two-column on md+, stacked on mobile
- No regressions to existing homepage behavior

## Affected Files
- `app/page.tsx`
- `components/ProbabilityBars.tsx` (add team links, rarest line, exact counts)
- `components/KillerLeaderboard.tsx` (no change, just moved into tab)
- `components/AnalysisCardSwitcher.tsx` (new — tab shell)
- `components/ByTheNumbers.tsx` (new — sidebar)
