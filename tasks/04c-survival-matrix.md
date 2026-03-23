# 04c — Survival Matrix

## Goal
Build a matrix visualization: rows = surviving brackets, columns = remaining
divergence games, cells = which team that bracket needs to win.

## Implementation

### Data computation

**Input**: survivors' picks (from useHomepageData), game results (from /api/results)

**Step 1**: Identify all pending games across survivors.
```typescript
// Collect all game_indices where at least one survivor has result === "pending"
const pendingGameIndices = new Set<number>();
for (const bracket of survivors) {
  for (const pick of bracket.picks) {
    if (pick.result === "pending") {
      pendingGameIndices.add(pick.game_index);
    }
  }
}
```

**Step 2**: Classify as shared fate or divergence.
```typescript
interface MatrixColumn {
  gameIndex: number;
  round: number;
  // Actual matchup if known (from buildCurrentGameDefinitions)
  team1: string;  // might be "Winner of Game X" if TBD
  team2: string;
  isSharedFate: boolean;
  sharedPick: string | null;  // if shared fate, which team all picked
  // Per-survivor picks (in same order as survivors array)
  picks: string[];
}

for (const gameIndex of pendingGameIndices) {
  const picksForGame = survivors.map(b => {
    const pick = b.picks.find(p => p.game_index === gameIndex);
    return pick?.pick ?? "?";
  });
  const allSame = picksForGame.every(p => p === picksForGame[0]);
  // classify accordingly
}
```

**Step 3**: Get actual matchup labels from buildCurrentGameDefinitions.
This is a server-side function — but we already have results data client-side.
For column headers, use the game definitions to show real team names when known.
Alternative: the survivors' picks already contain team1/team2 per game. For
shared-fate games, all brackets have the same team1/team2. For divergence games
where the matchup is TBD (later rounds), brackets may have different expected
team1/team2 — in that case, use a round label ("Championship", "F4 Game 1").

**Getting column headers:**
```typescript
const ROUND_LABELS: Record<number, string> = {
  64: "R64", 32: "R32", 16: "S16", 8: "E8", 4: "F4", 2: "Champ"
};

function getColumnHeader(gameIndex: number, column: MatrixColumn): string {
  // Check if all survivors expect the same matchup for this game
  const firstBracket = survivors[0].picks.find(p => p.game_index === gameIndex);
  const allSameMatchup = survivors.every(b => {
    const pick = b.picks.find(p => p.game_index === gameIndex);
    return pick?.team1 === firstBracket?.team1 && pick?.team2 === firstBracket?.team2;
  });

  if (allSameMatchup && firstBracket) {
    // Known matchup: "Duke vs Tennessee"
    return `${firstBracket.team1} vs ${firstBracket.team2}`;
  }
  // TBD matchup: use round label
  return ROUND_LABELS[column.round] ?? `Game ${gameIndex}`;
}
```

### Shared fate summary

Above the matrix, a one-liner:
```
All [N] need: Duke (×3 games), Arizona, Iowa St, Michigan, Houston, ...
```

Computed by collecting the shared pick from all shared-fate games.
Group by team name, count occurrences, format as "[team] (×N)" when N > 1.

### Matrix rendering

Only divergence columns shown in the grid.

```
             ALA/PUR    MIC/ILL    F4         Champ
             E8 Fri     E8 Fri     Mon        Wed

Duke/ISU     Alabama    Iowa       Duke       Duke
Duke/ALA     Alabama    Illinois   Duke       Duke
Duke/MICH    Purdue     Michigan   Duke       Duke
Mich/ARI     Purdue     Iowa       Arizona    Michigan
Hou/PUR      Purdue     Illinois   Purdue     Houston
             ───        ───        ───        ───
             ALA: 2     Iowa: 2    Duke: 3    Duke: 3
             PUR: 3     Ill: 2     ARI: 1     Mich: 1
                        MIC: 1     PUR: 1     Hou: 1
```

### Styling

**Table structure:**
```tsx
<div className="overflow-x-auto">
  <table className="w-full text-sm">
    <thead>
      <tr>
        <th className="sticky left-0 bg-[...] ...">Bracket</th>
        {divergenceColumns.map(col => (
          <th key={col.gameIndex}>
            <div>{col.headerLine1}</div>  {/* "ALA vs PUR" or "Champ" */}
            <div>{col.headerLine2}</div>  {/* "E8 · Fri" */}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {survivors.map((bracket, i) => (
        <tr key={bracket.index}>
          <td className="sticky left-0">{bracketTitle(bracket)}</td>
          {divergenceColumns.map(col => (
            <td key={col.gameIndex} style={{ color: teamColor(col.picks[i]) }}>
              {col.picks[i]}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
    <tfoot>
      {/* Summary row */}
    </tfoot>
  </table>
</div>
```

**Cell colors**: Use team accent colors from `lib/team-colors.ts`.
Cells are text-colored by team. Background stays dark/neutral.

**Row labels**: Match bracket card titles — "Duke vs ISU", "Mich vs ARI", etc.
Abbreviated to fit. Sticky left on horizontal scroll.

**Column headers**: Two lines — matchup on top, round + day below.
```
  ALA vs PUR
  E8 · Fri
```

**Summary row** (bottom): For each column, show team split counts.
```
  ALA: 2 / PUR: 3
```
This tells you: "If Alabama wins, 2 survive that game. If Purdue wins, 3 survive."

**Mobile**: `overflow-x-auto` with sticky left column.
Shared fate summary is always visible (outside the scrollable area).

### Section wrapper

```tsx
<section className="px-6 py-8">
  <div className="max-w-5xl mx-auto">
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.15em] text-white/40 mb-1">
        Remaining Games
      </p>
      <p className="text-sm text-white/50 mb-4">
        All {N} need: {sharedFateSummary}
      </p>
      {/* Matrix table */}
    </div>
  </div>
</section>
```

## Acceptance Criteria
- [ ] Shared-fate games shown as summary text (not columns)
- [ ] Divergence games shown as matrix columns with per-bracket picks
- [ ] Cells color-coded by team (using shared team-colors)
- [ ] Summary row shows survival counts per possible outcome
- [ ] Row labels match bracket card titles (championship matchup abbreviation)
- [ ] Column headers show matchup + round/day
- [ ] Mobile: horizontal scroll with sticky row labels
- [ ] Handles edge cases: all games shared fate (no matrix), all divergence (no summary)
- [ ] `make verify` passes

## Affected Files
- `components/SurvivalMatrix.tsx` — new
- Uses `lib/team-colors.ts` from 04b
