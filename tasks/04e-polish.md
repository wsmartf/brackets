# 04e — Polish: localStorage, Animations, Survival Curve

## Goal
Add returning-visitor UX (localStorage), elimination card flip animations,
animated bracket count, and survival curve graph.

Phase 3 — implement after core features (04a-04d) are working.

## Implementation

### 1. localStorage — returning visitor state

**File: `hooks/useReturningVisitor.ts`**

```typescript
const STORAGE_KEY = "brackets-visitor-state";

interface VisitorState {
  remaining: number;
  gamesCompleted: number;
  survivingIndices: number[];
  timestamp: number;  // Date.now()
}

interface ReturningVisitorResult {
  previousState: VisitorState | null;
  isReturning: boolean;           // true if stored state exists and differs
  eliminatedSince: number[];      // bracket indices that died since last visit
  remainingDelta: number;         // how many brackets were eliminated since last visit
}
```

**Hook logic:**
```typescript
export function useReturningVisitor(
  currentRemaining: number,
  currentSurvivors: SurvivorBracket[] | null
): ReturningVisitorResult {
  const [previousState, setPreviousState] = useState<VisitorState | null>(null);

  // Load stored state once on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPreviousState(JSON.parse(stored));
    } catch {}
  }, []);

  // Save current state on each change
  useEffect(() => {
    if (!currentSurvivors) return;
    const state: VisitorState = {
      remaining: currentRemaining,
      gamesCompleted: ...,
      survivingIndices: currentSurvivors.map(s => s.index),
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [currentRemaining, currentSurvivors]);

  // Compute deltas
  const eliminatedSince = previousState
    ? previousState.survivingIndices.filter(
        idx => !currentSurvivors?.some(s => s.index === idx)
      )
    : [];

  return {
    previousState,
    isReturning: previousState != null && previousState.remaining > currentRemaining,
    eliminatedSince,
    remainingDelta: previousState
      ? previousState.remaining - currentRemaining
      : 0,
  };
}
```

### 2. "Since your last visit" banner

**In FinalNHomepage:**

When `isReturning && remainingDelta > 0`, show a dismissible banner:

```
┌─────────────────────────────────────────────────────────────┐
│  Since your last visit: 2 brackets eliminated               │
│  Bracket #128,447,902 and #892,003,204 were knocked out     │
│                                                    dismiss  │
└─────────────────────────────────────────────────────────────┘
```

Auto-dismiss after ~10 seconds, or on click.

### 3. Animated bracket count

**In FinalNHomepage hero:**

When `isReturning`, animate the hero number from previous count to current.

```typescript
function useCountAnimation(
  target: number,
  from: number | null,
  duration: number = 1500
): number {
  const [display, setDisplay] = useState(from ?? target);

  useEffect(() => {
    if (from == null || from === target) {
      setDisplay(target);
      return;
    }

    const start = performance.now();
    let raf: number;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      setDisplay(current);
      if (progress < 1) raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, from, duration]);

  return display;
}
```

Usage: `const displayCount = useCountAnimation(remaining, previousState?.remaining);`

### 4. Card elimination animation

**In BracketCard (04b):**

Add optional animation prop:
```tsx
interface BracketCardProps {
  // ... existing props ...
  animateElimination?: boolean;  // true if this card should animate from alive → dead
}
```

When `animateElimination` is true:
- Card renders in alive state initially
- After a delay (staggered: card index × 500ms), transitions to dead state
- Transition: opacity fades, accent color desaturates, CSS transition over 600ms

```tsx
const [showDead, setShowDead] = useState(false);

useEffect(() => {
  if (animateElimination) {
    const timer = setTimeout(() => setShowDead(true), delay);
    return () => clearTimeout(timer);
  }
}, [animateElimination, delay]);

// Use showDead to toggle between alive/dead styling
const isVisuallyAlive = alive && !showDead;
```

### 5. Survival curve graph

**File: `components/SurvivalCurve.tsx`**

**Input:** snapshots array from useHomepageData.
```typescript
interface SurvivalCurveProps {
  snapshots: Array<{
    remaining: number;
    gamesCompleted: number;
    createdAt: string;
  }>;
  currentRemaining: number;
}
```

**Visualization:**
- Pure SVG, no charting library
- Y axis: log scale, 1,000,000,000 → currentRemaining
- X axis: games completed (0 → 63) or time
- Line connecting snapshot points
- Responsive: viewBox-based scaling

**Log scale computation:**
```typescript
function logScale(value: number, min: number, max: number, height: number): number {
  const logMin = Math.log10(Math.max(min, 1));
  const logMax = Math.log10(max);
  const logVal = Math.log10(Math.max(value, 1));
  return height - ((logVal - logMin) / (logMax - logMin)) * height;
}
```

**Hover/tooltip:** On hover over a data point, show:
"After game 34: 12,847 remaining"

**Styling:**
- 200-250px tall
- Dark background (matches page)
- White/60 line, white dots at data points
- Y axis labels: "1B", "1M", "1K", "5" (log scale ticks)
- X axis labels: "Game 10", "Game 20", ... or dates

**Section wrapper:**
```tsx
<section className="px-6 py-6">
  <div className="max-w-5xl mx-auto">
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.15em] text-white/40 mb-4">
        The Great Elimination
      </p>
      <SurvivalCurve snapshots={snapshots} currentRemaining={remaining} />
    </div>
  </div>
</section>
```

## Acceptance Criteria
- [ ] localStorage saves { remaining, survivingIndices, timestamp } on each poll
- [ ] Returning visitors see "since your last visit" banner with elimination details
- [ ] Hero number animates from stored count to current (ease-out, ~1.5s)
- [ ] Eliminated bracket cards animate from alive → dead state (staggered)
- [ ] First-time visitors see current state immediately, no animation
- [ ] Survival curve renders log-scale graph from snapshot data
- [ ] Hover tooltip shows remaining count per data point
- [ ] All animations are CSS-transition or rAF based (no layout thrashing)
- [ ] localStorage errors handled gracefully (private browsing, quota)
- [ ] `make verify` passes

## Affected Files
- `hooks/useReturningVisitor.ts` — new
- `components/SurvivalCurve.tsx` — new
- `components/BracketCard.tsx` — add animateElimination prop
- `components/FinalNHomepage.tsx` — wire up animations and banner
