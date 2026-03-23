# 04d — Upcoming Games Section

## Goal
Show scheduled upcoming games with survivor stakes and "likely in progress"
detection. Sits between hero and bracket cards on the Final N homepage.

## Implementation

### Data source

Uses existing `/api/future-killers` response (already fetched in useHomepageData):
```typescript
interface FutureKillerRow {
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  team1Count: number;      // survivors picking team1
  team2Count: number;      // survivors picking team2
  guaranteedKills: number;  // min(team1Count, team2Count)
  scheduledAt: string | null;
  espnEventId: string | null;
}
```

### Cross-reference with survivor picks

For Final N mode, enhance the display with per-bracket context.
From survivors' picks, determine:
- Is this game shared fate (all N picked same team)?
- Or divergence (split)?
- Which specific brackets need which team?

```typescript
function classifyGame(
  row: FutureKillerRow,
  survivors: SurvivorBracket[]
): {
  isSharedFate: boolean;
  sharedPick: string | null;
  team1Brackets: number[];  // indices of brackets needing team1
  team2Brackets: number[];  // indices of brackets needing team2
} {
  const team1Brackets: number[] = [];
  const team2Brackets: number[] = [];

  for (const bracket of survivors) {
    const pick = bracket.picks.find(p => p.game_index === row.gameIndex);
    if (!pick) continue;
    if (pick.pick === row.team1) team1Brackets.push(bracket.index);
    else team2Brackets.push(bracket.index);
  }

  const isSharedFate = team1Brackets.length === 0 || team2Brackets.length === 0;
  const sharedPick = isSharedFate
    ? (team1Brackets.length > 0 ? row.team1 : row.team2)
    : null;

  return { isSharedFate, sharedPick, team1Brackets, team2Brackets };
}
```

### "Likely in progress" detection

Client-side heuristic. No new API work.

```typescript
function getGameStatus(
  row: FutureKillerRow,
  results: GameResult[],
  now: number
): "scheduled" | "likely-live" | "completed" {
  // Check if result exists
  const result = results.find(r =>
    r.game_index === row.gameIndex && r.winner != null
  );
  if (result) return "completed";

  // Check if scheduled time has passed
  if (!row.scheduledAt) return "scheduled";
  const scheduledMs = new Date(row.scheduledAt).getTime();
  if (!Number.isFinite(scheduledMs)) return "scheduled";

  const elapsed = now - scheduledMs;
  if (elapsed > 0 && elapsed < 3 * 60 * 60 * 1000) {
    // Started but < 3 hours ago — likely still playing
    return "likely-live";
  }

  return "scheduled";
}
```

### Component rendering

**File: `components/UpcomingGames.tsx`**

```tsx
interface UpcomingGamesProps {
  futureKillers: FutureKillerRow[];
  survivors: SurvivorBracket[];
  results: GameResult[];
  now: number;
}
```

**Layout per game:**

```
Scheduled:
┌─────────────────────────────────────────────────────┐
│  Duke vs Tennessee · Elite 8 · Thu 7:09 PM          │
│  All 5 need Duke — shared fate                      │
└─────────────────────────────────────────────────────┘

Likely live:
┌─────────────────────────────────────────────────────┐
│  [pulsing dot] Duke vs Tennessee · Elite 8          │
│  In progress (started 7:09 PM)                      │
│  All 5 need Duke — if Duke loses, it's over         │
└─────────────────────────────────────────────────────┘

Divergence game:
┌─────────────────────────────────────────────────────┐
│  Alabama vs Purdue · Elite 8 · Thu 9:30 PM          │
│  2 of 5 need Alabama · 3 of 5 need Purdue           │
└─────────────────────────────────────────────────────┘
```

**"Likely live" indicator:**
```tsx
<span className="inline-flex items-center gap-1.5">
  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
  <span className="text-red-400 text-xs font-medium">In progress</span>
</span>
```

**Shared fate emphasis**: When all brackets need the same team:
- "All N need [team]" in emphasized text
- "If [team] loses, it's over" or "shared fate" label
- This is the most dramatic case — one loss kills everything

**Section wrapper:**
```tsx
<section className="px-6 py-6">
  <div className="max-w-5xl mx-auto space-y-3">
    <p className="text-xs uppercase tracking-[0.15em] text-white/40">
      {hasLiveGame ? "Games Today" : "Upcoming Games"}
    </p>
    {games.map(game => <GameCard key={game.gameIndex} ... />)}
  </div>
</section>
```

**When no games scheduled**: Show minimal text:
"Next games: Thursday, March 26" or "No games scheduled yet"

**Ordering**: Live games first, then scheduled by scheduledAt ascending.

### Latest result display

When the most recent game has a result (from completedResults):
Show at the top of this section:
```
Latest: Duke 78, Tennessee 71 · Elite 8
All 5 survived
```
Or if brackets were eliminated:
```
Latest: Alabama 65, Purdue 62 · Elite 8
2 brackets eliminated — 3 remain
```

Use the existing `latestGame` + `latestGameImpact` from useHomepageData.

## Acceptance Criteria
- [ ] Scheduled games shown with team names, round, date/time
- [ ] Each game shows survivor stake: shared fate or split count
- [ ] "Likely in progress" pulsing indicator when scheduled time passed, no result
- [ ] Live games sorted to top
- [ ] Latest completed result shown if available
- [ ] Compact when no games imminent
- [ ] `make verify` passes

## Affected Files
- `components/UpcomingGames.tsx` — new
