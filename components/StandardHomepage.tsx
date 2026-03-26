"use client";

import Link from "next/link";
import { useState } from "react";
import AnalysisCardSwitcher from "@/components/AnalysisCardSwitcher";
import ByTheNumbers from "@/components/ByTheNumbers";
import SiteNav from "@/components/SiteNav";
import type { HomepageData } from "@/hooks/useHomepageData";

export default function StandardHomepage({
  stats,
  results,
  impacts,
  snapshots,
  randomId,
  isAnalysisRunning,
  gamesStarted,
  hasData,
  eliminated,
  alivePercentage,
  biggestKill,
  latestGame,
  latestGameImpact,
  latestGameLoser,
  latestGameRelativeTime,
}: HomepageData) {
  const [bracketInput, setBracketInput] = useState("");
  const bracketTarget =
    bracketInput.trim() !== "" ? bracketInput.trim() : String(randomId);

  return (
    <div className="home-shell min-h-screen text-white">
      <SiteNav activePage="home" />

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
            The perfect bracket is in here somewhere. Maybe.
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

      {hasData && (
        <section className="px-6 py-12">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              <AnalysisCardSwitcher
                probs={stats.championshipProbs ?? {}}
                remaining={stats.remaining}
                impacts={impacts}
                results={results}
                roundSurvivorCounts={stats.roundSurvivorCounts}
                snapshots={snapshots}
              />
            </div>
            <div className="w-full md:w-64 shrink-0">
              <ByTheNumbers
                probs={stats.championshipProbs ?? {}}
                remaining={stats.remaining}
                impacts={impacts}
              />
            </div>
          </div>
        </section>
      )}

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
                  onChange={(event) => setBracketInput(event.target.value)}
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
