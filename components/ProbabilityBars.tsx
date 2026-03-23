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

import { useState } from "react";
import Link from "next/link";

const DEFAULT_VISIBLE_TEAMS = 12;
const SHOW_MORE_STEP = 12;

function teamSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export function getInitialVisibleTeamCount(
  totalTeams: number,
  initialVisibleTeams: number = DEFAULT_VISIBLE_TEAMS
): number {
  return Math.min(totalTeams, Math.max(1, initialVisibleTeams));
}

export function getNextVisibleTeamCount(
  totalTeams: number,
  currentVisibleTeams: number,
  showMoreStep: number = SHOW_MORE_STEP
): number {
  return Math.min(totalTeams, currentVisibleTeams + Math.max(1, showMoreStep));
}

interface ProbabilityBarsProps {
  probs: Record<string, number>;
  maxTeams?: number;
  remaining?: number;
}

export default function ProbabilityBars({
  probs,
  maxTeams = DEFAULT_VISIBLE_TEAMS,
  remaining,
}: ProbabilityBarsProps) {
  const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);
  const [visibleTeams, setVisibleTeams] = useState(() =>
    getInitialVisibleTeamCount(sorted.length, maxTeams)
  );
  const initialVisibleTeams = getInitialVisibleTeamCount(sorted.length, maxTeams);
  const visibleCount = Math.min(sorted.length, Math.max(initialVisibleTeams, visibleTeams));

  if (sorted.length === 0) {
    return (
      <div className="text-white/40 text-sm italic">
        Championship picks will appear after the first analysis.
      </div>
    );
  }

  const maxProb = sorted[0][1];

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <p className="text-xs text-white/40">
          Championship picks · Among the{" "}
          {remaining != null ? remaining.toLocaleString() : "surviving"} still-perfect brackets
        </p>
        <p className="text-xs text-white/30 mt-1">
          {sorted.length} team{sorted.length === 1 ? "" : "s"} represented
        </p>
      </div>
      {sorted.slice(0, visibleCount).map(([team, prob]) => {
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
      {visibleCount < sorted.length && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() =>
              setVisibleTeams((currentVisibleTeams) =>
                getNextVisibleTeamCount(sorted.length, currentVisibleTeams)
              )
            }
            className="text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            Show {Math.min(SHOW_MORE_STEP, sorted.length - visibleCount)} more team
            {sorted.length - visibleCount > 1 ? "s" : ""}
          </button>
        </div>
      )}
    </div>
  );
}
