/**
 * ProbabilityBars — Horizontal bar chart showing championship odds per team.
 *
 * Displays top N teams sorted by probability, with colored bars.
 * Only renders if championship probability data is available.
 *
 * Props:
 *   probs: Record<string, number> — team name → probability (0-1)
 *   maxTeams: number — how many teams to show (default 10)
 *
 * TODO: Implement this component.
 * - Sort teams by probability descending
 * - Show top maxTeams teams
 * - Each row: team name, horizontal bar, percentage
 * - Use a color gradient (e.g., blue to gray) for the bars
 */

"use client";

interface ProbabilityBarsProps {
  probs: Record<string, number>;
  maxTeams?: number;
}

export default function ProbabilityBars({
  probs,
  maxTeams = 10,
}: ProbabilityBarsProps) {
  const sorted = Object.entries(probs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxTeams);

  if (sorted.length === 0) {
    return (
      <div className="text-gray-500 text-sm italic">
        Championship probabilities will appear after the first analysis refresh.
      </div>
    );
  }

  const maxProb = sorted[0][1];

  return (
    <div className="space-y-2">
      <h3 className="text-sm uppercase tracking-wide text-gray-500 mb-3">
        Championship Probability
      </h3>
      {sorted.map(([team, prob]) => (
        <div key={team} className="flex items-center gap-3">
          <span className="w-32 text-sm text-gray-300 truncate text-right">
            {team}
          </span>
          <div className="flex-1 bg-gray-700 rounded h-5 overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded transition-all duration-500"
              style={{ width: `${(prob / maxProb) * 100}%` }}
            />
          </div>
          <span className="w-16 text-sm text-gray-400 tabular-nums">
            {(prob * 100).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}
