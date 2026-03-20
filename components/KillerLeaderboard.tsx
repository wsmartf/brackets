/**
 * KillerLeaderboard — Top games by proportional elimination impact.
 *
 * Ranks games by the share of still-alive brackets they eliminated
 * (eliminated / (eliminated + remainingAfter)), so late-round upsets
 * compete fairly against early-round ones. Raw count shown as context.
 * Only shows exact=true impacts.
 *
 * Props:
 *   impacts: EliminationImpact[]
 *   results: GameResult[]
 */

"use client";

import type { EliminationImpact } from "./GameFeed";

interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

interface KillerLeaderboardProps {
  impacts: EliminationImpact[];
  results: GameResult[];
  maxRows?: number;
}

const ROUND_LABELS: Record<number, string> = {
  64: "R64",
  32: "R32",
  16: "S16",
  8: "E8",
  4: "F4",
  2: "Championship",
};

function killPct(impact: EliminationImpact): number {
  const total = (impact.eliminated ?? 0) + impact.remainingAfter;
  if (total === 0) return 0;
  return (impact.eliminated ?? 0) / total;
}

export default function KillerLeaderboard({
  impacts,
  results,
  maxRows = 8,
}: KillerLeaderboardProps) {
  const resultByGame = new Map<number, GameResult>();
  for (const r of results) {
    resultByGame.set(r.game_index, r);
  }

  const rows = impacts
    .filter((i) => i.exact && i.eliminated != null && i.gameIndex != null)
    .sort((a, b) => killPct(b) - killPct(a))
    .slice(0, maxRows);

  if (rows.length === 0) {
    return (
      <div className="text-white/40 text-sm italic">
        Killer stats will appear after games are analyzed.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          Killer leaderboard
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          Games that wiped out the highest share of surviving brackets
        </p>
      </div>
      {rows.map((impact, idx) => {
        const game = resultByGame.get(impact.gameIndex);
        const winner = game?.winner ?? "Unknown";
        const loser = game
          ? game.winner === game.team1
            ? game.team2
            : game.team1
          : "Unknown";
        const roundLabel = game
          ? (ROUND_LABELS[game.round] ?? `R${game.round}`)
          : "";
        const pct = killPct(impact);

        return (
          <div
            key={impact.snapshotId}
            className="flex items-center gap-3 py-2 text-sm"
          >
            <span className="w-5 text-white/20 tabular-nums text-right shrink-0 text-xs">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-white/80 font-medium">{winner}</span>
              <span className="text-white/30 mx-1.5">over</span>
              <span className="text-white/50">{loser}</span>
              {roundLabel && (
                <span className="text-white/20 ml-2 text-xs">{roundLabel}</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-rose-400 tabular-nums font-medium text-xs">
                {(pct * 100).toFixed(1)}%
              </span>
              <span className="text-white/20 tabular-nums text-xs ml-1.5">
                ({(impact.eliminated ?? 0).toLocaleString()})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
