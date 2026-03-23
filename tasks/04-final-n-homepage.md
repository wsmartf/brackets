# Final N Homepage Redesign — Master Task

## Goal
When remaining brackets <= 20, replace the standard dashboard with a "Final N" experience
showcasing individual surviving brackets, upcoming game stakes, and the path to a winner.
Ship before Thursday 2026-03-26 games.

## Current State (2026-03-22)
- 5 brackets remaining, 43/63 games complete
- ~20 remaining games, subset are divergence points between the 5 brackets

## Architecture Decisions (finalized)

### One API enhancement
Enhance `/api/survivors` with `?detail=full` to return picks, survival state, and
bracket likelihood for each survivor. One request replaces 5 individual bracket fetches.
Likelihood (product of model win probabilities for pending picks) computed server-side.

Other existing APIs used as-is:
- `/api/stats` → remaining, gamePickCounts, championshipProbs, analysisStatus
- `/api/future-killers` → scheduled upcoming games with pick counts
- `/api/snapshots` → time-series for survival curve
- `/api/results` → game results

### No live scores (but "likely in progress" detection)
ESPN integration only handles STATUS_FINAL and STATUS_SCHEDULED.
Client-side heuristic: if scheduledAt has passed and no result exists,
show "In progress" indicator. No new API work.

### Threshold switching
```
app/page.tsx:
  if (remaining <= 20) → <FinalNHomepage />
  else → <StandardHomepage />  (current homepage, extracted)
```
Data fetching in shared hook. Easy to add more thresholds later.

## Design Decisions (all resolved)

### Layout (top to bottom)
1. **Hero + stats strip** — "THE FINAL N" + games/63, eliminated, biggest kill
2. **Upcoming games** — between hero and cards. Scheduled games with survivor stakes.
   "Likely in progress" indicator when scheduled time has passed without result.
3. **Bracket cards** — one per survivor, championship matchup title, F4, needs next,
   bracket likelihood (odds format: "1 in 32,000"), view bracket link.
   Dead cards: greyed, elimination reason, stay visible.
4. **Survival matrix** — standalone section below cards.
   Shared-fate columns muted/summarized. Divergence columns highlighted.
   Bottom row: survival counts per outcome. Color-coded by team.
5. **Bracket browser** — compact, bottom of page
6. **Footer**

### What's removed from Final N homepage
- AnalysisCardSwitcher tabs (Survivors, My Team, Killers, Future Killers)
- ByTheNumbers sidebar
- "Latest result: X over Y" text

### What's kept
- Bracket browser (compact)
- SiteNav

### Card colors
Per-champion team color accent (border/stripe):
- Duke → blue (#003087)
- Michigan → maize/amber (#FFCB05)
- Houston → red (#C8102E)
Same colors used in matrix cells.

### Bracket Likelihood
- Odds format: "1 in 32,000"
- Computed server-side: product of model win probabilities for all pending picks
- Displayed on each card

### Mobile
- Single column stack for bracket cards
- Matrix: horizontal scroll, row labels sticky left

## Sub-tasks (in implementation order)

### Phase 1 — Core (must ship)
- `tasks/04a-homepage-shell.md` — threshold switch, data hook, StandardHomepage extraction
- `tasks/04b-bracket-cards.md` — BracketCard component + survivors API enhancement

### Phase 2 — Compelling (should ship)
- `tasks/04c-survival-matrix.md` — matrix visualization
- `tasks/04d-upcoming-games.md` — upcoming games with "likely live" detection

### Phase 3 — Polish (if time permits)
- `tasks/04e-polish.md` — localStorage, animations, survival curve graph
