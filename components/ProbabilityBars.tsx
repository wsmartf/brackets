/**
 * ProbabilityBars — Horizontal bar chart showing championship odds per team.
 *
 * Displays top N teams sorted by probability, with colored bars.
 * Only renders if championship probability data is available.
 *
 * Props:
 *   probs: Record<string, number> — team name → probability (0-1)
 *   maxTeams: number — how many teams to show (default 10)
 *   remaining?: number — number of surviving brackets, for framing label
 */

"use client";

import Link from "next/link";

function teamSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

interface ProbabilityBarsProps {
  probs: Record<string, number>;
  maxTeams?: number;
  remaining?: number;
}

export default function ProbabilityBars({
  probs,
  maxTeams = 10,
  remaining,
}: ProbabilityBarsProps) {
  const sorted = Object.entries(probs)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxTeams);

  if (sorted.length === 0) {
    return (
      <div className="text-white/40 text-sm italic">
        Championship picks will appear after the first analysis.
      </div>
    );
  }

  const maxProb = sorted[0][1];

  const allEntries = Object.entries(probs).sort(([, a], [, b]) => a - b);
  const rarest = allEntries[0] ?? null;
  const rarestIsShown = rarest ? sorted.some(([t]) => t === rarest[0]) : false;

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-white">
          What survivors believe
        </h3>
        <p className="text-xs text-white/40 mt-0.5">
          Championship picks · Among the{" "}
          {remaining != null ? remaining.toLocaleString() : "surviving"} still-perfect brackets
        </p>
      </div>
      {sorted.map(([team, prob]) => {
        const count = remaining != null ? Math.round(prob * remaining) : null;
        const percentage = `${(prob * 100).toFixed(1)}%`;
        return (
          <div key={team} className="flex items-center gap-3">
            <Link
              href={`/teams/${teamSlug(team)}`}
              className="w-28 text-sm text-white/70 truncate text-right hover:text-white transition-colors"
            >
              {team}
            </Link>
            <div className="flex-1 bg-white/10 rounded h-4 overflow-hidden">
              <div
                className="bg-rose-500/70 h-full rounded transition-all duration-500"
                style={{ width: `${(prob / maxProb) * 100}%` }}
              />
            </div>
            <div className="w-28 text-right">
              <span className="block text-sm text-white/60 tabular-nums">
                {percentage}
              </span>
              {count != null && (
                <span className="block text-xs text-white/35 tabular-nums">
                  {count.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
      {rarest && !rarestIsShown && remaining != null && (
        <p className="text-xs text-white/30 pt-1">
          Rarest: {rarest[0]} — {Math.round(rarest[1] * remaining).toLocaleString()} bracket{Math.round(rarest[1] * remaining) === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
