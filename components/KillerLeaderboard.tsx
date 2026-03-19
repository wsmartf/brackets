/**
 * KillerLeaderboard — Top games by elimination count.
 *
 * Shows top 8 games sorted by number of brackets eliminated.
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

export default function KillerLeaderboard({
  impacts,
  results,
  maxRows = 8,
}: KillerLeaderboardProps) {
  const resultByGame = new Map<number, GameResult>();
  for (const r of results) {
    resultByGame.set(r.game_index, r);
  }

  const exactImpacts = impacts
    .filter((i) => i.exact && i.eliminated != null && i.gameIndex != null)
    .sort((a, b) => (b.eliminated ?? 0) - (a.eliminated ?? 0))
    .slice(0, maxRows);

  if (exactImpacts.length === 0) {
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
          Games that eliminated the most brackets
        </p>
      </div>
      {exactImpacts.map((impact, idx) => {
        const game = resultByGame.get(impact.gameIndex);
        const winner = game?.winner ?? "Unknown";
        const loser = game
          ? game.winner === game.team1
            ? game.team2
            : game.team1
          : "Unknown";
        const roundLabel = game ? (ROUND_LABELS[game.round] ?? `R${game.round}`) : "";

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
            <span className="text-rose-400 tabular-nums font-medium shrink-0 text-xs">
              {(impact.eliminated ?? 0).toLocaleString()} eliminated
            </span>
          </div>
        );
      })}
    </div>
  );
}
