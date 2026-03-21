/**
 * Homepage — editorial redesign.
 *
 * Fetches stats, results, and snapshots. Polls for analysis updates.
 * Renders the hero, stats strip, two-column section, and bracket browser.
 */

"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import AnalysisCardSwitcher from "@/components/AnalysisCardSwitcher";
import ByTheNumbers from "@/components/ByTheNumbers";
import SiteNav from "@/components/SiteNav";
import type { EliminationImpact } from "@/components/GameFeed";

interface Stats {
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  analyzedAt: string | null;
  championshipProbs?: Record<string, number>;
  analysisStatus?: {
    isRunning: boolean;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastError: string | null;
    triggerSource: string | null;
  };
}

interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
}

function parseTimestampMs(timestamp: string): number {
  const normalized = timestamp.includes("T") ? timestamp : timestamp.replace(" ", "T");
  const hasTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
  const parseable = hasTimezone ? normalized : `${normalized}Z`;
  const parsed = new Date(parseable).getTime();

  if (Number.isFinite(parsed)) {
    return parsed;
  }

  return new Date(timestamp).getTime();
}

function formatRelativeTime(timestamp: string, now: number): string {
  const then = parseTimestampMs(timestamp);
  if (!Number.isFinite(then)) {
    return "";
  }

  const elapsedMinutes = Math.max(0, Math.floor((now - then) / 60_000));
  if (elapsedMinutes < 1) {
    return "just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function formatAlivePercentage(remaining: number, totalBrackets: number): string {
  if (totalBrackets <= 0) {
    return "0.0000%";
  }

  return `${((remaining / totalBrackets) * 100).toFixed(4)}%`;
}

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    remaining: 1_000_000_000,
    totalBrackets: 1_000_000_000,
    gamesCompleted: 0,
    analyzedAt: null,
  });
  const [results, setResults] = useState<GameResult[]>([]);
  const [impacts, setImpacts] = useState<EliminationImpact[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const previousIsRunningRef = useRef(false);

  // Stable random ID — initialized to 0 on SSR, set after mount to avoid hydration mismatch
  const [randomId, setRandomId] = useState(0);
  useEffect(() => {
    queueMicrotask(() => {
      setRandomId(Math.floor(Math.random() * 1_000_000_000));
    });
  }, []);
  const [bracketInput, setBracketInput] = useState("");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch("/api/results");
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error("Failed to fetch results:", err);
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshots");
      const data = await res.json();
      if (data.eliminationImpact) {
        setImpacts(data.eliminationImpact);
      }
    } catch (err) {
      console.error("Failed to fetch snapshots:", err);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchStats();
      void fetchResults();
      void fetchSnapshots();
    });
  }, [fetchStats, fetchResults, fetchSnapshots]);

  useEffect(() => {
    const intervalMs = stats.analysisStatus?.isRunning ? 3000 : 15000;
    const intervalId = window.setInterval(() => {
      void fetchStats();
    }, intervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchStats, stats.analysisStatus?.isRunning]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const isRunning = stats.analysisStatus?.isRunning ?? false;
    if (previousIsRunningRef.current && !isRunning) {
      queueMicrotask(() => {
        void fetchResults();
        void fetchSnapshots();
      });
    }
    previousIsRunningRef.current = isRunning;
  }, [fetchResults, fetchSnapshots, stats.analysisStatus?.isRunning]);

  const isAnalysisRunning = stats.analysisStatus?.isRunning ?? false;
  const gamesStarted = stats.gamesCompleted > 0;
  const hasData =
    Object.keys(stats.championshipProbs ?? {}).length > 0 || impacts.length > 0;

  const exactImpacts = impacts.filter(
    (i) => i.exact && i.eliminated != null && i.gameIndex != null
  );
  const completedResults = results
    .filter((result) => result.winner)
    .sort(
      (a, b) => parseTimestampMs(b.updated_at) - parseTimestampMs(a.updated_at)
    );
  const latestGame = completedResults[0] ?? null;

  const impactByGame = new Map<number, EliminationImpact>();
  for (const impact of impacts) {
    if (impact.gameIndex != null) {
      impactByGame.set(impact.gameIndex, impact);
    }
  }
  const latestGameImpact = latestGame
    ? impactByGame.get(latestGame.game_index) ?? null
    : null;
  const latestGameLoser =
    latestGame && latestGame.winner
      ? latestGame.winner === latestGame.team1
        ? latestGame.team2
        : latestGame.team1
      : null;
  const latestGameRelativeTime =
    latestGame ? formatRelativeTime(latestGame.updated_at, now) : null;

  // Stats strip numbers
  const eliminated = stats.totalBrackets - stats.remaining;
  const alivePercentage = formatAlivePercentage(stats.remaining, stats.totalBrackets);
  const biggestKill =
    exactImpacts.length > 0
      ? Math.max(...exactImpacts.map((i) => i.eliminated ?? 0))
      : null;

  const bracketTarget =
    bracketInput.trim() !== "" ? bracketInput.trim() : String(randomId);

  return (
    <div className="home-shell min-h-screen text-white">
      <SiteNav activePage="home" />

      {/* Hero */}
      <section className="home-hero px-6 pt-14 sm:pt-20 pb-10">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40 mb-6">
            I generated 1 billion March Madness brackets.
          </p>

          <h1 className="text-7xl sm:text-8xl lg:text-[9rem] font-bold tabular-nums leading-none text-white">
            {stats.remaining.toLocaleString()}
          </h1>

          <p className="text-xl sm:text-2xl text-white/60 mt-4 font-medium">
            {isAnalysisRunning
              ? (
                <span className="inline-block animate-pulse text-white/75">
                  recomputing against the latest results...
                </span>
              )
              : gamesStarted
                ? "still perfect"
                : "brackets generated, waiting for tip-off"}
          </p>

          {latestGame && latestGame.winner && latestGameLoser && (
            <div className="mt-4 space-y-1">
              <p className="text-rose-400 text-base sm:text-lg font-medium">
                Latest result: {latestGame.winner} over {latestGameLoser}
              </p>
              <p className="text-sm text-white/40">
                {latestGameImpact?.eliminated != null && (
                  <>
                    {latestGameImpact.exact ? "" : "~"}
                    {latestGameImpact.eliminated.toLocaleString()} brackets
                    eliminated
                    {latestGameRelativeTime ? " • " : ""}
                  </>
                )}
                {latestGameRelativeTime && (
                  <span suppressHydrationWarning>{latestGameRelativeTime}</span>
                )}
              </p>
            </div>
          )}

          <p className="mt-4 text-white/30 text-sm italic">
            The perfect bracket is in here somewhere. Probably.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/bracket/${randomId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-black px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
            >
              Explore a bracket →
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-transparent text-white px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/8"
            >
              How it works →
            </Link>
          </div>
        </div>
      </section>

      {/* Stats strip — only if games have started */}
      {gamesStarted && (
        <section className="px-6 py-8 border-t border-white/8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center divide-x divide-white/10">
              <div className="flex-1 min-w-[140px] px-6 first:pl-0 py-2 text-center">
                <p className="text-3xl sm:text-4xl font-bold tabular-nums text-white">
                  {stats.gamesCompleted}{" "}
                  <span className="text-white/30 text-2xl">/ 63</span>
                </p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
                  games complete
                </p>
              </div>
              <div className="flex-1 min-w-[140px] px-6 py-2 text-center">
                <p className="text-3xl sm:text-4xl font-bold tabular-nums text-rose-400">
                  {eliminated.toLocaleString()}
                </p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
                  brackets eliminated
                </p>
              </div>
              <div className="flex-1 min-w-[140px] px-6 py-2 text-center">
                <p className="text-3xl sm:text-4xl font-bold tabular-nums text-white">
                  {alivePercentage}
                </p>
                <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
                  brackets still alive
                </p>
              </div>
              {biggestKill != null && (
                <div className="flex-1 min-w-[140px] px-6 py-2 text-center">
                  <p className="text-3xl sm:text-4xl font-bold tabular-nums text-white">
                    {biggestKill.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/40 mt-1 uppercase tracking-wide">
                    most from one game
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Analysis section — only if data exists */}
      {hasData && (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              <AnalysisCardSwitcher
                probs={stats.championshipProbs ?? {}}
                remaining={stats.remaining}
                impacts={impacts}
                results={results}
              />
            </div>
            <div className="w-full md:w-64 shrink-0">
              <ByTheNumbers
                probs={stats.championshipProbs ?? {}}
                remaining={stats.remaining}
                gamesCompleted={stats.gamesCompleted}
                impacts={impacts}
              />
            </div>
          </div>
        </section>
      )}

      {/* Bracket browser */}
      <section className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40 mb-2">
              Browse the universe
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Every integer 0–999,999,999 is a bracket.
            </h2>
            <p className="text-white/50 mt-2 text-sm">
              Pick a number. It always generates the same picks.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 items-center">
              <div className="flex items-center rounded-xl border border-white/15 bg-white/8 overflow-hidden">
                <span className="px-4 py-3 text-sm text-white/40 border-r border-white/10 shrink-0">
                  Bracket #
                </span>
                <input
                  type="number"
                  min={0}
                  max={999_999_999}
                  value={bracketInput}
                  onChange={(e) => setBracketInput(e.target.value)}
                  placeholder={randomId.toLocaleString()}
                  className="bg-transparent px-4 py-3 text-sm text-white placeholder:text-white/25 outline-none w-40"
                />
              </div>
              <Link
                href={`/bracket/${bracketTarget}`}
                className="rounded-xl bg-white text-black px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                View →
              </Link>
              <Link
                href={`/bracket/${randomId}`}
                className="text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Try #{randomId.toLocaleString()}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-white/30">
          <div className="space-y-0.5">
            {isAnalysisRunning && stats.analysisStatus?.lastStartedAt && (
              <p className="text-amber-400/80">
                Analysis running since{" "}
                {new Date(stats.analysisStatus.lastStartedAt).toLocaleTimeString()}
              </p>
            )}
            {stats.analyzedAt && (
              <p>
                Last updated:{" "}
                {new Date(stats.analyzedAt).toLocaleString()}
              </p>
            )}
            {stats.analysisStatus?.lastError && (
              <p className="text-rose-400/70">
                Last refresh failed: {stats.analysisStatus.lastError}
              </p>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
