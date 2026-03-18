# 09 — Team Survival Page (Ship during round of 64)

## Goal
Add a per-team page that shows a still-alive team's live title odds, round-by-round survival probabilities, most probable remaining path, and their single most important upcoming game.

## Why
This is the personal hook the site currently lacks. "My team's chances" is the most natural reason someone returns to a sports analytics site during the tournament. It's also a strong portfolio feature — it requires joining live analysis results, the probability model, and bracket structure into a coherent view.

## URL
`/teams/[name]` — e.g., `/teams/duke`, `/teams/michigan`

Entry points:
- Team names in the championship probability bars on the homepage
- Direct URL (shareable: "here's Duke's survival outlook")

## Data needed
The `stats` cache already has `championshipProbs`. To power this page well, we also want:

- **Round-by-round survival odds** — probability of reaching Sweet 16, Elite Eight, Final Four, championship. This is computable from the current probability model (not from the bracket scan — it's a forward-looking estimate).
- **Most probable remaining path** — the sequence of most likely opponents through each remaining round, with win probabilities at each step.
- **Leverage game** — the next unplayed game involving this team, and the model's win probability for it.
- **Eliminated / alive status** — if the team has already lost, show that cleanly.

## Where the data comes from

**Option A: Compute from the model at request time**
Use `computeWinProbability()` to walk the expected bracket path. Cheap, always current, no new DB columns needed. Good enough for v1.

**Option B: Compute during analysis and cache**
More accurate (based on surviving brackets, not just forward model), but requires analysis pipeline changes.

Recommendation: **Start with Option A** — model-based forward probabilities. Accurate enough, immediate to implement. Can upgrade to surviving-bracket counts later.

## Page design

```
Duke                                    East Region | #1 seed
─────────────────────────────────────────────────────────────
Championship odds (model):   23.4%     ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░

Round-by-round
  Round of 32    96.1%
  Sweet 16       74.2%
  Elite Eight    52.8%
  Final Four     38.1%
  Champion       23.4%

Most probable path
  Round of 32:   vs Robert Morris      Win prob: 96.1%
  Sweet 16:      vs Kentucky           Win prob: 71.3%
  Elite Eight:   vs Houston            Win prob: 63.2%
  Final Four:    vs Tennessee          Win prob: 58.4%
  Champion:      vs Kansas             Win prob: 56.7%

Biggest game
  Next up: vs Robert Morris (Round of 32)
  A loss here eliminates every bracket with Duke in the Final Four or beyond.
```

Keep it clean. No unnecessary chrome. The numbers are the thing.

## Implementation

1. Add `getTeamSurvivalStats(teamName, tournamentData)` to `lib/tournament.ts`:
   - Walk the expected bracket path from current position
   - Compute cumulative win probability to each round
   - Return path with per-round opponent and win probability
2. Add route `app/teams/[name]/page.tsx` as a server component
3. Load team data from `tournament-2026.json` + current results from DB
4. Render the survival stats (server-rendered, no polling needed — stats update when analysis runs)
5. Add team links from `ProbabilityBars` component on homepage
6. Add a `/teams` index page listing all still-alive teams (optional but helpful)

## Eliminated teams
Show a clear "eliminated" state for teams that have already lost. Don't redirect — keep the page up as a historical record.

## Acceptance Criteria
- `/teams/duke` (or equivalent slug) shows title odds, round-by-round survival, most probable path
- Eliminated teams show a clear eliminated state
- Team names in the homepage probability bars link to their team page
- Page is server-rendered (no client polling needed — just shows current cached data)
- Browser-verified on desktop and mobile

## Affected Files
- `lib/tournament.ts`
- `app/teams/[name]/page.tsx` (new)
- `app/teams/page.tsx` (new, optional index)
- `components/ProbabilityBars.tsx` (add links)
