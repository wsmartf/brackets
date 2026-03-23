"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "brackets:my-team-selection";
const SURVIVOR_PAGE_SIZE = 24;

function getStoredTeamSelection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(STORAGE_KEY);
}

interface Snapshot {
  id: number;
  remaining: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  createdAt: string;
}

interface TeamEntry {
  team: string;
  count: number;
  prob: number;
  rank: number;
}

interface MyTeamTabProps {
  probs: Record<string, number>;
  remaining: number;
  roundSurvivorCounts?: Record<string, number[]>;
  snapshots: Snapshot[];
}

const DISPLAY_ROWS = [
  { label: "Champion", index: 6 },
  { label: "Title Game", index: 5 },
  { label: "Final Four", index: 4 },
  { label: "Elite Eight", index: 3 },
  { label: "Sweet 16", index: 2 },
];

function formatPct(count: number, total: number): string {
  if (total <= 0) {
    return "0.0%";
  }

  return `${((count / total) * 100).toFixed(1)}%`;
}

export default function MyTeamTab({
  probs,
  remaining,
  roundSurvivorCounts,
  snapshots,
}: MyTeamTabProps) {
  const survivorTeams = Object.entries(probs)
    .map(([team, prob]) => ({
      team,
      prob,
      count: Math.round(prob * remaining),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.team.localeCompare(b.team))
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

  const survivorTeamByName = new Map<string, TeamEntry>(
    survivorTeams.map((entry) => [entry.team, entry])
  );

  const [selectedTeam, setSelectedTeam] = useState<string | null>(() => getStoredTeamSelection());
  const [survivorIndices, setSurvivorIndices] = useState<number[]>([]);
  const [loadingIndices, setLoadingIndices] = useState(false);
  const [survivorListExpanded, setSurvivorListExpanded] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedTeam) {
      window.localStorage.setItem(STORAGE_KEY, selectedTeam);
      return;
    }

    window.localStorage.removeItem(STORAGE_KEY);
  }, [selectedTeam]);

  const selectedEntry = selectedTeam ? survivorTeamByName.get(selectedTeam) ?? null : null;
  const currentChampionCount = selectedEntry?.count ?? 0;
  const isEliminated = selectedTeam !== null && currentChampionCount === 0;
  const selectedRoundCounts = selectedTeam
    ? (roundSurvivorCounts?.[selectedTeam] ?? null)
    : null;
  const lastLiveSnapshot = selectedTeam
    ? [...snapshots]
        .reverse()
        .find((snapshot) => (snapshot.championshipProbs[selectedTeam] ?? 0) > 0) ?? null
    : null;
  const eliminatedChampionCount = selectedTeam && lastLiveSnapshot
    ? Math.round((lastLiveSnapshot.championshipProbs[selectedTeam] ?? 0) * lastLiveSnapshot.remaining)
    : 0;
  const selectValue = selectedTeam ?? "";

  function handleTeamChange(nextTeam: string) {
    setSurvivorIndices([]);
    setSurvivorListExpanded(false);
    setFetchError(null);
    setLoadingIndices(false);
    setSelectedTeam(nextTeam || null);
  }

  async function loadSurvivorPage(offset: number) {
    if (!selectedTeam || currentChampionCount === 0) {
      return;
    }

    setLoadingIndices(true);
    setFetchError(null);

    try {
      const response = await fetch(
        `/api/survivors?champion=${encodeURIComponent(selectedTeam)}&limit=${SURVIVOR_PAGE_SIZE}&offset=${offset}`
      );
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = await response.json() as { indices?: number[] };
      const nextIndices = Array.isArray(data.indices) ? data.indices : [];
      setSurvivorIndices((current) => (offset === 0 ? nextIndices : [...current, ...nextIndices]));
    } catch (error) {
      console.error("Failed to fetch survivor indices:", error);
      setFetchError("Could not load surviving brackets right now.");
    } finally {
      setLoadingIndices(false);
    }
  }

  async function toggleSurvivorList() {
    if (survivorListExpanded) {
      setSurvivorListExpanded(false);
      return;
    }

    setSurvivorListExpanded(true);
    if (survivorIndices.length === 0 && !loadingIndices) {
      await loadSurvivorPage(0);
    }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-2xl">
        <div className="relative rounded-2xl border border-white/14 bg-white/[0.03] transition-colors hover:border-white/22 hover:bg-white/[0.05]">
          <label
            htmlFor="my-team-select"
            className="pointer-events-none absolute left-4 top-3 text-[11px] font-medium uppercase tracking-[0.16em] text-white/35"
          >
            Team
          </label>
          <select
            id="my-team-select"
            value={selectValue}
            onChange={(event) => handleTeamChange(event.target.value)}
            className={`w-full appearance-none bg-transparent px-4 pb-4 pt-7 pr-16 text-2xl font-semibold tracking-tight outline-none sm:text-3xl ${
              selectedTeam ? "text-white" : "text-white/45"
            }`}
          >
            <option value="">Choose a team</option>
            {isEliminated && selectedTeam && (
              <option value={selectedTeam}>
                {selectedTeam} (eliminated)
              </option>
            )}
            {survivorTeams.map((entry) => (
              <option key={entry.team} value={entry.team}>
                {entry.team} ({entry.count.toLocaleString()})
              </option>
            ))}
          </select>
          <span
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-white/35"
            aria-hidden="true"
          >
            Change Team ▾
          </span>
        </div>
      </div>

      {!selectedTeam && (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-5 py-6 text-sm text-white/45">
          Pick a team to see how often surviving brackets still have them alive deep into the tournament.
        </div>
      )}

      {selectedTeam && isEliminated && (
        <div className="border-t border-rose-500/20 pt-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-rose-300">
              Eliminated
            </span>
          </div>
          <p className="mt-3 text-sm text-white/65">
            No surviving brackets still have {selectedTeam} winning the tournament.
          </p>
          {lastLiveSnapshot && (
            <p className="mt-2 text-sm text-white/50">
              At the last snapshot where they were still alive, {eliminatedChampionCount.toLocaleString()} surviving bracket
              {eliminatedChampionCount === 1 ? "" : "s"} had {selectedTeam} winning it all.
            </p>
          )}
          {!lastLiveSnapshot && (
            <p className="mt-2 text-sm text-white/50">
              No prior surviving-title snapshot is available for {selectedTeam}.
            </p>
          )}
        </div>
      )}

      {selectedEntry && selectedRoundCounts && (
        <div className="border-t border-white/10 pt-5">
          <div className="space-y-3">
            {DISPLAY_ROWS.map((row) => {
              const count = selectedRoundCounts[row.index] ?? 0;
              return (
                <div
                  key={row.label}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(8.5rem,10rem)_auto] items-baseline gap-x-4 text-base sm:text-lg"
                >
                  <span className="whitespace-nowrap leading-tight text-white/68">
                    {row.label}
                  </span>
                  <span className="whitespace-nowrap leading-tight">
                    <span className="font-semibold tabular-nums text-white">
                      {count.toLocaleString()}
                    </span>{" "}
                    <span className="text-white/68">
                      bracket{count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="whitespace-nowrap tabular-nums leading-tight text-amber-200/75">
                    {formatPct(count, remaining)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <button
              type="button"
              onClick={() => void toggleSurvivorList()}
              className={`inline-flex items-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                survivorListExpanded
                  ? "border border-white/18 bg-white/8 text-white hover:bg-white/12"
                  : "bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.14)] hover:opacity-90"
              }`}
            >
              {survivorListExpanded
                ? "Hide surviving brackets"
                : `See ${selectedEntry.count.toLocaleString()} surviving ${selectedEntry.team} brackets`}
            </button>

            {survivorListExpanded && (
              <div className="mt-4 space-y-4">
                {loadingIndices && survivorIndices.length === 0 && (
                  <p className="text-sm text-white/40">Loading surviving brackets...</p>
                )}

                {fetchError && (
                  <p className="text-sm text-amber-300/80">{fetchError}</p>
                )}

                {survivorIndices.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs text-white/35">
                      Showing {survivorIndices.length.toLocaleString()} of {selectedEntry.count.toLocaleString()} surviving bracket
                      {selectedEntry.count === 1 ? "" : "s"} with {selectedEntry.team} as champion.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {survivorIndices.map((index) => (
                        <Link
                          key={index}
                          href={`/bracket/${index}`}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm tabular-nums text-white/80 transition-colors hover:border-white/20 hover:text-white"
                        >
                          #{index.toLocaleString()}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {survivorIndices.length < selectedEntry.count && (
                  <button
                    type="button"
                    onClick={() => void loadSurvivorPage(survivorIndices.length)}
                    disabled={loadingIndices}
                    className="rounded-xl border border-white/14 px-4 py-2.5 text-sm font-medium text-white/75 transition-colors hover:border-white/24 hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingIndices ? "Loading..." : "Show more"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
