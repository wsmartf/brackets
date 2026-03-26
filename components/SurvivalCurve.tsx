"use client";

import { useRef, useState } from "react";
import type { GameResult } from "@/hooks/useHomepageData";

interface SurvivalCurveSnapshot {
  remaining: number;
  gamesCompleted: number;
  createdAt: string;
}

interface SurvivalCurveProps {
  snapshots: SurvivalCurveSnapshot[];
  currentRemaining: number;
  results: GameResult[];
}

interface Point {
  x: number;
  y: number;
  snapshot: SurvivalCurveSnapshot;
  eliminated: number;
  eliminationRate: number;
  isMajorKnockout: boolean;
  game: GameResult | null;
}

const WIDTH = 880;
const HEIGHT = 320;
const PADDING = { top: 24, right: 24, bottom: 40, left: 96 };
const MAX_BRACKETS = 1_000_000_000;
const POWER_EXPONENT = 0.15;
const MAJOR_KNOCKOUT_THRESHOLD = 0.3;
const Y_AXIS_REFERENCE_TICKS = [
  1_000_000_000,
  100_000_000,
  10_000_000,
  1_000_000,
  100_000,
  10_000,
  1_000,
];

const ROUND_LABELS: Record<number, string> = {
  64: "R64",
  32: "R32",
  16: "S16",
  8: "E8",
  4: "F4",
  2: "Champ",
};

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return "1B";
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return value.toLocaleString();
}

function formatRound(round: number): string {
  return ROUND_LABELS[round] ?? `R${round}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function powerScale(value: number, min: number, max: number, height: number): number {
  if (max <= min) {
    return height / 2;
  }

  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return height - Math.pow(normalized, POWER_EXPONENT) * height;
}

function buildYTicks(min: number, max: number): number[] {
  if (max <= min) {
    return [max];
  }

  const ticks = new Set<number>([max, min]);
  for (const tick of Y_AXIS_REFERENCE_TICKS) {
    if (tick > min && tick < max) {
      ticks.add(tick);
    }
  }

  const sorted = Array.from(ticks).sort((a, b) => b - a);
  if (sorted.length <= 4) {
    return sorted;
  }

  return [sorted[0], ...sorted.slice(1, -1).slice(0, 2), sorted[sorted.length - 1]];
}

function buildXTicks(maxGamesCompleted: number): Array<{ value: number; label: string }> {
  if (maxGamesCompleted <= 0) {
    return [{ value: 0, label: "Start" }];
  }

  const tickValues = new Set<number>([0, maxGamesCompleted]);
  for (const tick of [16, 32, 48]) {
    if (tick > 0 && tick < maxGamesCompleted) {
      tickValues.add(tick);
    }
  }

  return Array.from(tickValues)
    .sort((a, b) => a - b)
    .map((value) => ({
      value,
      label: value === 0 ? "Start" : value.toLocaleString(),
    }));
}

function buildPoints(
  snapshots: SurvivalCurveSnapshot[],
  currentRemaining: number,
  results: GameResult[]
): { points: Point[]; minRemaining: number; maxGamesCompleted: number } {
  const data = [...snapshots].sort((a, b) => a.gamesCompleted - b.gamesCompleted);
  if (data.length === 0 || data[data.length - 1]?.remaining !== currentRemaining) {
    data.push({
      remaining: currentRemaining,
      gamesCompleted: data[data.length - 1]?.gamesCompleted ?? 0,
      createdAt: new Date().toISOString(),
    });
  }

  // Sort completed results by updated_at for correlating each snapshot to the
  // game that most recently triggered it.
  const completedByTime = results
    .filter((r) => r.winner !== null)
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const minRemaining = Math.max(1, Math.min(...data.map((s) => s.remaining)));
  const maxGamesCompleted = Math.max(0, ...data.map((s) => s.gamesCompleted));
  const xDenominator = Math.max(1, maxGamesCompleted);

  const points: Point[] = data.map((snapshot, i) => {
    const prev = data[i - 1];
    const eliminated = prev ? Math.max(0, prev.remaining - snapshot.remaining) : 0;
    const previousRemaining = prev?.remaining ?? snapshot.remaining;
    const eliminationRate = previousRemaining > 0 ? eliminated / previousRemaining : 0;

    // Walk backwards through sorted results to find the last one before this snapshot
    const snapshotTime = new Date(snapshot.createdAt).getTime();
    let game: GameResult | null = null;
    for (const r of completedByTime) {
      if (new Date(r.updated_at).getTime() <= snapshotTime) {
        game = r;
      } else {
        break;
      }
    }

    return {
      x: PADDING.left + (snapshot.gamesCompleted / xDenominator) * chartWidth,
      y: PADDING.top + powerScale(snapshot.remaining, minRemaining, MAX_BRACKETS, chartHeight),
      snapshot,
      eliminated,
      eliminationRate,
      isMajorKnockout: eliminationRate >= MAJOR_KNOCKOUT_THRESHOLD,
      game,
    };
  });

  return { points, minRemaining, maxGamesCompleted };
}

export default function SurvivalCurve({
  snapshots,
  currentRemaining,
  results,
}: SurvivalCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { points, minRemaining, maxGamesCompleted } = buildPoints(
    snapshots,
    currentRemaining,
    results
  );

  if (points.length === 0) {
    return <p className="text-sm text-white/45">No survival history yet.</p>;
  }

  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const yTicks = buildYTicks(minRemaining, MAX_BRACKETS);
  const xTicks = buildXTicks(maxGamesCompleted);

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${HEIGHT - PADDING.bottom} L ${points[0].x} ${HEIGHT - PADDING.bottom} Z`;

  const activePoint = activeIndex != null ? points[activeIndex] : null;
  const activePointEliminationRate =
    activePoint && activePoint.eliminated > 0 ? activePoint.eliminationRate : null;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - svgX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setActiveIndex(best);
  }

  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:gap-6">
      <div className="min-w-0 flex-1 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/88">Perfect brackets remaining</p>
            <p className="mt-1 text-sm text-white/45">
              Absolute survivor count after each completed game.
            </p>
          </div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/35">
            Power scale
          </p>
        </div>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-[260px] w-full cursor-crosshair overflow-visible sm:h-[320px] lg:h-[360px]"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0.22" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {xTicks.map(({ value }) => {
            const x =
              PADDING.left +
              (value / Math.max(1, maxGamesCompleted)) * (WIDTH - PADDING.left - PADDING.right);
            return (
              <line
                key={`grid-${value}`}
                x1={x}
                x2={x}
                y1={PADDING.top}
                y2={HEIGHT - PADDING.bottom}
                stroke="white"
                strokeOpacity="0.05"
                strokeWidth="1"
              />
            );
          })}

          {yTicks.map((tick) => {
            const y = PADDING.top + powerScale(tick, minRemaining, MAX_BRACKETS, chartHeight);
            return (
              <g key={tick}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  stroke="white"
                  strokeOpacity="0.08"
                  strokeWidth="1"
                />
                <text
                  x={PADDING.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.3)"
                  fontSize="10"
                >
                  {formatCompact(tick)}
                </text>
              </g>
            );
          })}

          <text
            x={10}
            y={PADDING.top + chartHeight / 2 - 10}
            fill="rgba(255,255,255,0.3)"
            fontSize="11"
          >
            <tspan x={10} dy="0">Perfect</tspan>
            <tspan x={10} dy="1.2em">Brackets</tspan>
          </text>

          {/* Fill under the curve */}
          <path d={fillPath} fill="url(#curve-fill)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="rgba(255,255,255,0.82)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          {/* Dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === activeIndex ? 6 : p.isMajorKnockout ? 4.5 : 3.5}
              fill={p.isMajorKnockout ? "#fb7185" : "white"}
              fillOpacity={i === activeIndex ? 1 : p.isMajorKnockout ? 0.95 : 0.5}
              stroke={p.isMajorKnockout ? "rgba(255,255,255,0.55)" : "none"}
              strokeWidth={p.isMajorKnockout ? 1.5 : 0}
            />
          ))}

          {/* Vertical cursor line snapped to active point */}
          {activePoint && (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={PADDING.top}
              y2={HEIGHT - PADDING.bottom}
              stroke="white"
              strokeOpacity="0.3"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}

          {/* X-axis labels */}
          {xTicks.map(({ value, label }) => {
            const x =
              PADDING.left +
              (value / Math.max(1, maxGamesCompleted)) * (WIDTH - PADDING.left - PADDING.right);
            return (
              <text
                key={value}
                x={x}
                y={HEIGHT - 8}
                textAnchor="middle"
                fill="rgba(255,255,255,0.3)"
                fontSize="11"
              >
                {label}
              </text>
            );
          })}
        </svg>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-white/70" />
              <span>Normal game</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400 ring-1 ring-white/50" />
              <span>{`30%+ knocked out`}</span>
            </div>
          </div>
          <span>Games Played</span>
        </div>
      </div>

      <div className="flex flex-col justify-center rounded-[24px] border border-white/10 bg-white/[0.04] p-5 xl:w-60 xl:shrink-0">
        {activePoint ? (
          <div className="space-y-4">
            {activePoint.game?.winner && (
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Last game</p>
                <p className="mt-1 text-sm font-medium text-white leading-snug">
                  {activePoint.game.winner}{" "}
                  <span className="text-white/40">over</span>{" "}
                  {activePoint.game.winner === activePoint.game.team1
                    ? activePoint.game.team2
                    : activePoint.game.team1}
                </p>
                <p className="text-xs text-white/45">{formatRound(activePoint.game.round)}</p>
              </div>
            )}
            {activePoint.eliminated > 0 && (
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-white/35">Knocked out</p>
                <p className="mt-1 text-sm font-medium text-rose-400">
                  {activePoint.eliminated.toLocaleString()}
                  {activePointEliminationRate != null
                    ? ` (${formatPercent(activePointEliminationRate)})`
                    : ""}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">Remaining</p>
              <p className="mt-1 text-sm font-medium text-white">
                {activePoint.snapshot.remaining.toLocaleString()}
              </p>
              {activePoint.snapshot.remaining > 0 && (
                <p className="text-xs text-white/40">
                  1 in{" "}
                  {Math.round(
                    MAX_BRACKETS / activePoint.snapshot.remaining
                  ).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/35">Current</p>
              <p className="mt-1 text-xl font-semibold text-white">
                {currentRemaining.toLocaleString()}
              </p>
              <p className="text-xs text-white/40">Perfect brackets are still alive.</p>
            </div>
            <p className="text-sm text-white/35">
              Move across the chart to inspect each elimination event and the game that caused it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
