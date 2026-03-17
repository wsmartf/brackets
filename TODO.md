# TODO — Build Order

Each task is independent enough for Codex to pick up. Complete them in order.

## Phase 1: Core Engine (MUST complete before Thursday March 19)

### 1. ✅ PRNG (lib/prng.ts) — DONE
mulberry32 implementation. Do not modify.

### 2. Tournament Data (data/tournament-2026.json + lib/tournament.ts)
- [ ] Populate tournament-2026.json with all 64 teams (seeds, regions, KenPom ranks)
      Source: 2026 NCAA bracket (Selection Sunday March 15, 2026)
      Note: First Four play-in games determine 4 of the 64 spots. Use the higher-seeded
      play-in team as placeholder, or leave TBD and update after First Four results.
- [ ] Implement tournament.ts:
      - loadTournament(): reads JSON, returns typed tournament data
      - getInitialOrder(): returns 64 teams in canonical bracket order
      - computeProbability(teamA_rank, teamB_rank): logistic function
      - getFirstRoundProbabilities(): returns 32 probabilities for Round of 64

### 3. Worker Thread (lib/worker.ts) — DONE (skeleton)
- [ ] Fill in the worker message handler:
      - Receives: { startIndex, endIndex, probabilities, maskLo, maskHi, valueLo, valueHi }
      - For each index in range: generate bracket, check against mask, count matches
      - Also track championship winner (bit 62) for probability calculation
      - Posts back: { remaining, championCounts: Record<number, number> }

### 4. Analysis Orchestrator (lib/analyze.ts)
- [ ] Implement runAnalysis():
      - Reads current results from SQLite → computes mask/value
      - Splits 1B index range across NUM_WORKERS workers
      - Collects results from all workers
      - Aggregates: total remaining, championship probabilities, per-game impact
      - Writes stats to SQLite
      - Returns the stats object

### 5. Database (lib/db.ts)
- [ ] Implement:
      - initDb(): create tables if not exist
      - getResults(): read all game results
      - setResult(gameIndex, round, team1, team2, winner): upsert a result
      - getStats(): read cached stats
      - setStats(key, value): write a stat

## Phase 2: API Routes (needed for the website to work)

### 6. GET /api/stats (app/api/stats/route.ts)
- [ ] Read stats from SQLite, return as JSON
- [ ] If no stats cached yet, return defaults (remaining=1B, no probs)

### 7. POST /api/refresh (app/api/refresh/route.ts)
- [ ] Optionally fetch latest results from ESPN first (lib/espn.ts)
- [ ] Run analysis (calls analyze.ts runAnalysis)
- [ ] Return updated stats
- [ ] Should be async — may take 2-3 minutes. Consider streaming progress updates
      or just returning immediately with a "processing" status.

### 8. GET/POST /api/results (app/api/results/route.ts)
- [ ] GET: return current results from SQLite
- [ ] POST: manually add/update a game result, save to SQLite

## Phase 3: Frontend (can iterate during tournament)

### 9. Dashboard Page (app/page.tsx + components/)
- [ ] Show "X of 1,000,000,000 brackets remaining" (big hero number)
- [ ] Progress: X/63 games complete
- [ ] Championship probability bars (horizontal, sorted by probability)
- [ ] Recent results feed with "% eliminated" per game
- [ ] "Refresh" button that calls POST /api/refresh
- [ ] Loading state during analysis (spinner or progress bar)

### 10. ESPN Integration (lib/espn.ts) — Nice to Have
- [ ] Fetch from: https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
- [ ] Parse game results: status, teams, winner, scores
- [ ] Map ESPN team names to our tournament-2026.json team names
- [ ] Update SQLite results table with any new final results

### 11. Bracket Viewer (app/bracket/[id]/page.tsx) — Stretch Goal
- [ ] Given a bracket index, reconstruct and display all 63 game outcomes
- [ ] Show as a simple round-by-round table (not a fancy bracket graphic)
- [ ] Highlight which picks match/don't match actual results
- [ ] Client-side reconstruction (runs the PRNG in the browser)

## Phase 4: Polish (during/after tournament)

- [ ] Better mobile layout
- [ ] Auto-refresh on interval during game days
- [ ] "Closest to perfect" bracket finder
- [ ] Historical tracking (bracket count over time chart)
- [ ] Nice domain name via Cloudflare
