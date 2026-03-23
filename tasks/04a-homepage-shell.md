# 04a — Homepage Shell & Threshold Switch

## Goal
Restructure app/page.tsx to switch between FinalNHomepage and StandardHomepage
based on remaining bracket count. Extract shared data fetching into a hook.
Enhance /api/survivors to return full bracket data with server-side likelihood.

## Implementation

### 1. Enhance /api/survivors — `?detail=full` mode

**File: `app/api/survivors/route.ts`**

When `detail=full` query param is present AND total count <= 50:
1. Fetch all survivor indices (no pagination, get them all)
2. For each index: `reconstructBracket(index)` + `getBracketSurvivalState(picks, results)`
3. Compute likelihood using the pre-built probability table
4. Extract champion, championship game, Final Four from picks
5. Return enriched response

**Likelihood computation** (add to `lib/tournament.ts`):
```typescript
export function computeBracketLikelihood(picks: BracketPickStatus[]): number {
  const table = buildMatchupProbabilityTable();
  const initialOrder = getInitialOrder();
  const nameToIndex = new Map(initialOrder.map((name, i) => [name, i]));

  let likelihood = 1;
  for (const pick of picks) {
    if (pick.result !== "pending") continue;
    const pickedIdx = nameToIndex.get(pick.pick);
    const opponentName = pick.pick === pick.team1 ? pick.team2 : pick.team1;
    const opponentIdx = nameToIndex.get(opponentName);
    if (pickedIdx == null || opponentIdx == null) continue;
    likelihood *= table[pickedIdx * 64 + opponentIdx];
  }
  return likelihood;
}
```

Uses the cached 64×64 probability table — no Team object loading needed.

**Response shape** (detail=full):
```typescript
{
  brackets: Array<{
    index: number;
    picks: BracketPickStatus[];     // all 63, annotated with result status
    alive: boolean;
    likelihood: number;             // product of pending pick probabilities
    championPick: string;           // picks[62].pick
    championshipGame: [string, string]; // [picks[62].team1, picks[62].team2]
    finalFour: string[];            // [picks[60].team1, picks[60].team2,
                                    //  picks[61].team1, picks[61].team2]
    eliminatedBy: EliminatedByPick | null;
  }>;
  total: number;
}
```

**Extracting Final Four**: Game 60 has team1/team2 (semifinal 1 participants),
Game 61 has team1/team2 (semifinal 2 participants). The four teams across
both games are the Final Four. Note: these are the bracket's EXPECTED matchups
based on its picks, not necessarily the actual matchups.

**Extracting championship**: Game 62's team1/team2 are the expected championship
participants (winners of games 60 and 61 in this bracket). pick is the champion.

**Fallback**: If `detail=full` but total > 50, return regular `{ indices, total }`
response to avoid expensive computation.

### 2. Create useHomepageData hook

**File: `hooks/useHomepageData.ts`**

Extract ALL state and effects from current app/page.tsx:

**State to move:**
- `stats` (Stats) — from /api/stats, polled
- `results` (GameResult[]) — from /api/results
- `impacts` (EliminationImpact[]) — from /api/snapshots
- `snapshots` (Snapshot[]) — from /api/snapshots
- `now` (number) — updated every 60s
- `randomId` (number) — stable random bracket ID
- `previousIsRunningRef` (ref) — analysis completion detection

**NEW state for Final N mode:**
- `survivors` (SurvivorBracket[] | null) — from /api/survivors?detail=full
  Only fetched when stats.remaining <= 20

**Effects to move:**
- Initial fetch (stats, results, snapshots) on mount
- Stats polling (3s when running, 15s otherwise)
- Time ticker (60s)
- Analysis completion detection (re-fetch results + snapshots when running→done)
- NEW: fetch survivors when remaining <= 20 (and re-fetch when analysis completes)

**Computed values to move:**
- isAnalysisRunning, gamesStarted, hasData
- exactImpacts, completedResults, latestGame, latestGameImpact
- latestGameLoser, latestGameRelativeTime
- eliminated, alivePercentage, biggestKill

**Return type:**
```typescript
interface HomepageData {
  // Raw state
  stats: Stats;
  results: GameResult[];
  impacts: EliminationImpact[];
  snapshots: Snapshot[];
  now: number;
  randomId: number;

  // Survivors (only populated when remaining <= 20)
  survivors: SurvivorBracket[] | null;

  // Computed
  isAnalysisRunning: boolean;
  gamesStarted: boolean;
  hasData: boolean;
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  eliminated: number;
  alivePercentage: string;
  biggestKill: number | null;
  latestGame: GameResult | null;
  latestGameImpact: EliminationImpact | null;
  latestGameLoser: string | null;
  latestGameRelativeTime: string | null;
  completedResults: GameResult[];
}
```

### 3. Extract StandardHomepage

**File: `components/StandardHomepage.tsx`**

Move the entire current JSX from app/page.tsx into this component.
It receives `HomepageData` as props plus manages its own UI-only state:
- `bracketInput` / `setBracketInput` (bracket browser input)

No behavior changes from current homepage. Existing child components
(AnalysisCardSwitcher, ByTheNumbers, SiteNav) used exactly as before.

### 4. Create FinalNHomepage shell

**File: `components/FinalNHomepage.tsx`**

Receives `HomepageData` props. Layout:

```tsx
<div className="home-shell min-h-screen text-white">
  <SiteNav activePage="home" />

  {/* Hero */}
  <section>
    "THE FINAL {remaining}" hero + stats strip
    (games/63, eliminated count, biggest kill)
  </section>

  {/* Upcoming Games */}
  {futureKillers.length > 0 && <UpcomingGames ... />}

  {/* Bracket Cards */}
  <section>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {survivors.map(b => <BracketCard key={b.index} ... />)}
    </div>
  </section>

  {/* Survival Matrix */}
  <SurvivalMatrix ... />

  {/* Bracket browser (compact) */}
  <section> ... </section>

  <footer> ... </footer>
</div>
```

Initially a shell — child components built in 04b-04d.

### 5. Threshold switch in app/page.tsx

**File: `app/page.tsx`**

```tsx
"use client";
import { useHomepageData } from "@/hooks/useHomepageData";
import StandardHomepage from "@/components/StandardHomepage";
import FinalNHomepage from "@/components/FinalNHomepage";

export default function Home() {
  const data = useHomepageData();

  if (data.remaining <= 20 && data.survivors && data.survivors.length > 0) {
    return <FinalNHomepage {...data} />;
  }
  return <StandardHomepage {...data} />;
}
```

## Acceptance Criteria
- [ ] `/api/survivors?detail=full` returns enriched bracket data with likelihood
- [ ] `computeBracketLikelihood` correctly multiplies pending pick probabilities
- [ ] `useHomepageData` hook manages all state, effects, and polling
- [ ] StandardHomepage renders identically to current homepage
- [ ] FinalNHomepage shell renders when remaining <= 20
- [ ] Survivor data fetched only when remaining <= 20
- [ ] No visual regression in standard mode
- [ ] `make verify` passes

## Affected Files
- `app/page.tsx` — simplify to threshold switch
- `app/api/survivors/route.ts` — add detail=full mode
- `lib/tournament.ts` — add computeBracketLikelihood()
- `hooks/useHomepageData.ts` — new
- `components/StandardHomepage.tsx` — new (extracted)
- `components/FinalNHomepage.tsx` — new (shell)
