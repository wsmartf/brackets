# 04b — Bracket Cards

## Goal
Build BracketCard component showing an individual surviving bracket with its
championship matchup, Final Four, next game need, and bracket likelihood (odds).

## Implementation

### BracketCard component

**File: `components/BracketCard.tsx`**

```tsx
interface BracketCardProps {
  index: number;
  championPick: string;
  championshipGame: [string, string];     // [team1, team2] of game 62
  finalFour: string[];                     // 4 teams from games 60-61
  alive: boolean;
  eliminatedBy: EliminatedByPick | null;
  likelihood: number;                      // raw probability (e.g., 0.000031)
  pendingPicks: BracketPickStatus[];       // only pending picks, for "needs next"
  scheduledGames: FutureKillerRow[];       // for matching "needs next" to schedule
  accentColor: string;                     // CSS color for champion team
}
```

### Card layout (alive)

```
┌─ left border accent (3px, champion color) ─────────────┐
│                                                         │
│  Bracket #4,821,033                    1 in 32,000      │
│                                                         │
│  DUKE vs Iowa State                                     │
│  ─────────────────────────────────────                  │
│  Final Four                                             │
│  Duke / Arizona  ·  Iowa St / Iowa                      │
│                                                         │
│  Needs next: Duke over Tennessee (Thu)                  │
│                                                         │
│                                     View full bracket → │
└─────────────────────────────────────────────────────────┘
```

**Title**: `CHAMPION vs [opponent]` — derived from championshipGame.
Champion name bold/white, "vs" in white/30, opponent in white/60.

**Bracket Likelihood**: top-right corner, odds format.
```typescript
function formatOdds(likelihood: number): string {
  if (likelihood <= 0) return "—";
  const oneIn = Math.round(1 / likelihood);
  if (oneIn <= 1) return "~1 in 1";
  return `1 in ${oneIn.toLocaleString()}`;
}
```

**Final Four**: Two semifinal matchups. From the picks data:
- Game 60: team1 vs team2 → semifinal 1
- Game 61: team1 vs team2 → semifinal 2
Display as: "team1 / team2  ·  team3 / team4"
The winning pick from each semifinal is highlighted/bold (those are the
championship game participants).

**Needs next**: The earliest pending pick that maps to a scheduled game.
```typescript
function getNextNeed(
  pendingPicks: BracketPickStatus[],
  scheduledGames: FutureKillerRow[]
): { team: string; opponent: string; when: string } | null {
  // Sort pending picks by game_index (which is chronological by round)
  const sorted = [...pendingPicks].sort((a, b) => a.game_index - b.game_index);

  // Try to match to a scheduled game for the day label
  const scheduledByGameIndex = new Map(
    scheduledGames.map(g => [g.gameIndex, g])
  );

  for (const pick of sorted) {
    const scheduled = scheduledByGameIndex.get(pick.game_index);
    const opponent = pick.pick === pick.team1 ? pick.team2 : pick.team1;
    const when = scheduled?.scheduledAt
      ? formatDay(scheduled.scheduledAt)   // "Thu", "Fri", etc.
      : formatRound(pick.round);           // "E8", "F4", etc.
    return { team: pick.pick, opponent, when };
  }
  return null;
}
```

**View full bracket**: Link to `/bracket/${index}`.

### Card layout (dead)

Same structure but:
- Entire card at `opacity-50`
- Left accent border changes to white/20 (no color)
- "Needs next" line replaced with:
  "Eliminated: [winner] over [pick] ([round label])"
  in rose-400 text
- "View full bracket →" still works

### Champion team colors

```typescript
const TEAM_COLORS: Record<string, string> = {
  "Duke": "#003087",
  "Michigan": "#FFCB05",
  "Houston": "#C8102E",
  // Add more as needed — fallback to white/30 neutral
};

function getAccentColor(champion: string): string {
  return TEAM_COLORS[champion] ?? "rgba(255,255,255,0.3)";
}
```

These colors are defined once and shared with the SurvivalMatrix (04c).
Consider putting in a shared file: `lib/team-colors.ts`.

### Card grid layout

Desktop (>= md): `grid-cols-2` or `grid-cols-3` depending on count.
For 5 cards: 3+2 grid (first row 3, second row 2).
Mobile: `grid-cols-1`, full width.

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {survivors.map(bracket => (
    <BracketCard key={bracket.index} ... />
  ))}
</div>
```

### CSS styling

Dark theme matching existing homepage:
- Card background: `bg-white/5`
- Border: `border border-white/10` + left accent `border-l-[3px]`
- Rounded: `rounded-2xl`
- Padding: `p-5`
- Text: white with opacity variants for hierarchy

## Acceptance Criteria
- [ ] Alive cards show: title (champ matchup), Final Four, needs next, likelihood (odds), link
- [ ] Dead cards show: elimination reason, visually muted, stay visible
- [ ] Champion color accent on left border
- [ ] Odds format: "1 in N" with comma formatting
- [ ] "Needs next" shows earliest pending pick with day or round label
- [ ] Links to /bracket/[id]
- [ ] Responsive: single column mobile, grid desktop
- [ ] `make verify` passes

## Affected Files
- `components/BracketCard.tsx` — new
- `lib/team-colors.ts` — new (shared champion colors)
