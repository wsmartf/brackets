/**
 * GameFeed — Recent results with bracket impact.
 *
 * Shows a feed of completed games, each with:
 * - Team1 vs Team2 (round label)
 * - Winner name
 * - Elimination count if impact data is available
 *
 * Props:
 *   results: Array<{ game_index, round, team1, team2, winner, updated_at }>
 *   impacts?: EliminationImpact[] — per-game elimination counts from /api/snapshots
 */

"use client";

interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

export interface EliminationImpact {
  snapshotId: number;
  gameIndex: number;
  eliminated: number | null;
  remainingAfter: number;
  exact: boolean;
  createdAt: string;
}

interface GameFeedProps {
  results: GameResult[];
  impacts?: EliminationImpact[];
}

const ROUND_LABELS: Record<number, string> = {
  64: "R64",
  32: "R32",
  16: "S16",
  8: "E8",
  4: "F4",
  2: "Championship",
};

export default function GameFeed({ results, impacts }: GameFeedProps) {
  const completed = results
    .filter((r) => r.winner)
    .sort((a, b) => {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  const impactByGame = new Map<number, EliminationImpact>();
  if (impacts) {
    for (const impact of impacts) {
      if (impact.gameIndex != null) {
        impactByGame.set(impact.gameIndex, impact);
      }
    }
  }

  if (completed.length === 0) {
    return (
      <div className="text-white/40 text-sm italic">
        No results yet. The tournament starts Thursday, March 19.
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-base font-semibold text-white mb-4">
        Game results
      </h3>
      {completed.map((r) => {
        const impact = impactByGame.get(r.game_index);
        const loser = r.winner === r.team1 ? r.team2 : r.team1;
        return (
          <div
            key={r.game_index}
            className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-white/8 bg-white/5 text-sm"
          >
            <div className="flex-1 min-w-0">
              <span className="text-white/80 font-medium">{r.winner}</span>
              <span className="text-white/30 mx-1.5">over</span>
              <span className="text-white/50">{loser}</span>
              <span className="text-white/20 ml-2 text-xs">
                {ROUND_LABELS[r.round] ?? `R${r.round}`}
              </span>
            </div>
            {impact && impact.eliminated != null && (
              <span
                className={`ml-3 text-xs tabular-nums font-medium shrink-0 ${
                  impact.exact
                    ? "text-rose-400"
                    : "text-amber-400"
                }`}
              >
                {impact.exact ? "" : "~"}
                {impact.eliminated.toLocaleString()} eliminated
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
