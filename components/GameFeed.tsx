/**
 * GameFeed — Recent results with bracket impact.
 *
 * Shows a feed of completed games, each with:
 * - Team1 vs Team2 (round label)
 * - Winner name
 * - "X% of brackets eliminated" (if per-game impact data is available)
 *
 * Props:
 *   results: Array<{ game_index, round, team1, team2, winner, updated_at }>
 *
 * TODO: Add per-game impact percentage once analysis tracks this.
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

interface GameFeedProps {
  results: GameResult[];
}

const ROUND_LABELS: Record<number, string> = {
  64: "Round of 64",
  32: "Round of 32",
  16: "Sweet 16",
  8: "Elite 8",
  4: "Final Four",
  2: "Championship",
};

export default function GameFeed({ results }: GameFeedProps) {
  const completed = results
    .filter((r) => r.winner)
    .sort((a, b) => {
      // Sort by most recent first
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  if (completed.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        No results yet. The tournament starts Thursday, March 19.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-3">
        Results
      </h3>
      {completed.map((r) => (
        <div
          key={r.game_index}
          className="flex items-center justify-between py-2 px-3 bg-gray-800 rounded text-sm"
        >
          <div className="flex-1">
            <span className="text-gray-300">
              {r.team1} vs {r.team2}
            </span>
            <span className="text-gray-600 ml-2 text-xs">
              {ROUND_LABELS[r.round] ?? `Round ${r.round}`}
            </span>
          </div>
          <span className="text-green-400 font-medium">{r.winner}</span>
        </div>
      ))}
    </div>
  );
}
