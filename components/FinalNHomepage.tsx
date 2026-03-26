"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BracketCard from "@/components/BracketCard";
import BracketPathVisualizer from "@/components/BracketPathVisualizer";
import SiteNav from "@/components/SiteNav";
import type { HomepageData, SurvivorBracket } from "@/hooks/useHomepageData";
import { useTrackedBrackets } from "@/hooks/useTrackedBrackets";
import { useReturningVisitor } from "@/hooks/useReturningVisitor";
import { getTeamAccentColor } from "@/lib/team-colors";
import type { BracketPickStatus, EliminatedByPick } from "@/lib/tournament";

interface HistoricBracketResponse {
  id: number;
  picks: BracketPickStatus[];
  alive: boolean;
  eliminated_by: EliminatedByPick | null;
}

function useCountAnimation(
  target: number,
  from: number | null,
  shouldAnimate: boolean,
  duration = 1500
): number {
  const [display, setDisplay] = useState(from ?? target);

  useEffect(() => {
    if (!shouldAnimate || from == null || from === target) {
      const resetFrame = requestAnimationFrame(() => {
        setDisplay(target);
      });

      return () => cancelAnimationFrame(resetFrame);
    }

    const primeFrame = requestAnimationFrame(() => {
      setDisplay(from);
    });
    const start = performance.now();
    let frame = 0;

    const tick = (nowValue: number) => {
      const elapsed = nowValue - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (target - from) * eased);
      setDisplay(current);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(primeFrame);
      cancelAnimationFrame(frame);
    };
  }, [duration, from, shouldAnimate, target]);

  return shouldAnimate && from != null ? display : target;
}

function buildHistoricBracket(
  data: HistoricBracketResponse
): SurvivorBracket {
  const semifinalOne = data.picks[60];
  const semifinalTwo = data.picks[61];
  const championship = data.picks[62];

  return {
    index: data.id,
    picks: data.picks,
    alive: data.alive,
    likelihood: 0,
    championPick: championship?.pick ?? "",
    championshipGame: [
      championship?.team1 ?? "",
      championship?.team2 ?? "",
    ] as [string, string],
    finalFour: [
      semifinalOne?.team1 ?? "",
      semifinalOne?.team2 ?? "",
      semifinalTwo?.team1 ?? "",
      semifinalTwo?.team2 ?? "",
    ].filter(Boolean),
    eliminatedBy: data.eliminated_by,
  };
}

function formatBracketList(indices: number[]): string {
  const formatter = new Intl.ListFormat(undefined, {
    style: "long",
    type: "conjunction",
  });

  return formatter.format(
    indices.map((index) => `Bracket #${index.toLocaleString()}`)
  );
}

function formatOdds(probability: number): string {
  if (probability <= 0) {
    return "zero";
  }

  const oneIn = Math.round(1 / probability);
  if (oneIn <= 1) {
    return "about 1 in 1";
  }

  return `1 in ${oneIn.toLocaleString()}`;
}

function findMilestoneOdds(
  insights: HomepageData["finalNInsights"],
  id: string
): string | null {
  const probability = insights?.milestones.find((milestone) => milestone.id === id)?.probability;
  if (probability == null || probability >= 0.9999) {
    return null;
  }

  return formatOdds(probability);
}

export default function FinalNHomepage({
  stats,
  survivors,
  futureKillers,
  finalNInsights,
  results,
  impacts,
  now,
  randomId,
  isAnalysisRunning,
  eliminated,
}: HomepageData) {
  const [bracketInput, setBracketInput] = useState("");
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [deadBrackets, setDeadBrackets] = useState<SurvivorBracket[]>([]);
  const bracketTarget =
    bracketInput.trim() !== "" ? bracketInput.trim() : String(randomId);
  const {
    previousState,
    isReturning,
    eliminatedSince,
    remainingDelta,
  } = useReturningVisitor(stats.remaining, survivors, stats.gamesCompleted);
  const displayRemaining = useCountAnimation(
    stats.remaining,
    previousState?.remaining ?? null,
    isReturning && remainingDelta > 0
  );
  const trackedBrackets = useTrackedBrackets(survivors, results);
  const trackedBracketColors = new Map(
    trackedBrackets.map((bracket) => [bracket.index, bracket.color])
  );
  const finalFourOdds = findMilestoneOdds(finalNInsights, "final-four");
  const championshipOdds = findMilestoneOdds(finalNInsights, "championship");
  const eliminatedKey = eliminatedSince.join(",");
  const shouldShowBanner =
    isReturning && remainingDelta > 0 && dismissedKey !== eliminatedKey;

  const isOver = stats.remaining === 0;
  const isSingular = stats.remaining === 1;

  // When it's all over, find the game that delivered the final blow.
  const lastKillerImpact = isOver
    ? (impacts.find((i) => i.remainingAfter === 0 && i.exact) ?? impacts.find((i) => i.remainingAfter === 0))
    : null;
  const lastKillerGame = lastKillerImpact
    ? (results.find((r) => r.game_index === lastKillerImpact.gameIndex) ?? null)
    : null;
  const lastKillerLoser = lastKillerGame?.winner
    ? (lastKillerGame.team1 === lastKillerGame.winner ? lastKillerGame.team2 : lastKillerGame.team1)
    : null;

  // Dead brackets: tracked brackets that have been eliminated (known from results)
  const deadTrackedIndices = trackedBrackets
    .filter((b) => b.eliminatedAtGame !== null)
    .map((b) => b.index);
  const deadTrackedKey = deadTrackedIndices.join(",");

  const visibleCards = [
    ...(survivors ?? []).slice().sort((a, b) => b.likelihood - a.likelihood),
    ...deadBrackets.filter(
      (bracket) => !(survivors ?? []).some((survivor) => survivor.index === bracket.index)
    ),
  ];

  useEffect(() => {
    if (!shouldShowBanner) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDismissedKey(eliminatedKey);
    }, 10_000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [eliminatedKey, shouldShowBanner]);

  // Fetch full bracket data for any tracked bracket that's been eliminated
  useEffect(() => {
    const indices = deadTrackedKey
      ? deadTrackedKey.split(",").map(Number).filter(Number.isFinite)
      : [];
    let cancelled = false;

    if (indices.length === 0) {
      queueMicrotask(() => {
        if (!cancelled) setDeadBrackets([]);
      });
      return;
    }

    async function loadDeadCards() {
      try {
        const loaded = await Promise.all(
          indices.map(async (index) => {
            const response = await fetch(`/api/bracket/${index}`, { cache: "no-store" });
            if (!response.ok) {
              throw new Error(`Failed to load bracket ${index}`);
            }

            return buildHistoricBracket((await response.json()) as HistoricBracketResponse);
          })
        );

        if (!cancelled) {
          setDeadBrackets(loaded);
        }
      } catch (error) {
        console.error("Failed to load dead bracket cards:", error);
        if (!cancelled) {
          setDeadBrackets([]);
        }
      }
    }

    void loadDeadCards();

    return () => {
      cancelled = true;
    };
  }, [deadTrackedKey]);

  return (
    <div className="home-shell min-h-screen text-white">
      <SiteNav activePage="home" />

      <section className="px-6 pt-4 sm:pt-6 pb-6">
        <div className="max-w-5xl mx-auto lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10 lg:items-center">
          <div className="lg:col-start-1 lg:row-start-2">
            <p className="mb-4 text-xs tracking-[0.2em] text-white/40">
              I created 1 billion March Madness brackets.
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-none text-white">
              <span className={`block ${isOver ? "text-red-400" : "text-[#ff5a36]"}`}>
                {displayRemaining} PERFECT
              </span>
              <span className="block text-white/72">
                {isSingular ? "BRACKET LEFT" : "BRACKETS LEFT"}
              </span>
            </h1>
            <div className="mt-4 max-w-2xl text-base sm:mt-5 sm:text-lg text-white/58">
              {isOver ? (
                <>
                  <p>Not one of our 1 billion brackets survived the tournament.</p>
                  {lastKillerGame?.winner && lastKillerLoser && (
                    <p>
                      The last bracket was eliminated by{" "}
                      <span className="font-medium text-white/82">{lastKillerGame.winner}</span>{" "}
                      over {lastKillerLoser}.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  Having any perfect brackets this deep is already wildly unlikely.
                  {" "}
                  {isAnalysisRunning ? (
                    <span className="inline-block animate-pulse text-white/75">
                      Recomputing against the latest results...
                    </span>
                  ) : finalNInsights === null ? (
                    <span className="inline-block animate-pulse text-white/75">
                      Loading best-case outlook...
                    </span>
                  ) : finalNInsights.bestCaseAfter ? (
                    <>
                      Best case after {finalNInsights.bestCaseAfter.label}:{" "}
                      <span className="font-medium text-white/82">
                        {finalNInsights.bestCaseAfter.remaining.toLocaleString()} perfect bracket
                        {finalNInsights.bestCaseAfter.remaining === 1 ? "" : "s"}{" "}
                        {finalNInsights.bestCaseAfter.remaining === 1 ? "remains" : "remain"}
                      </span>
                      .
                    </>
                  ) : (
                    <>They probably will not stay perfect much longer.</>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:p-5 lg:col-start-2 lg:row-span-2 lg:mt-0">
            <div className="space-y-2 sm:space-y-3 text-sm">
              <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-2 sm:pb-3">
                <span className="text-white/45">Games played</span>
                <span className="font-medium tabular-nums text-white/84">
                  {stats.gamesCompleted} / 63
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-b border-white/8 pb-2 sm:pb-3">
                <span className="text-white/45">Eliminated</span>
                <span className="font-medium tabular-nums text-white/84">
                  {eliminated.toLocaleString()}
                </span>
              </div>
              {(finalFourOdds || isAnalysisRunning) ? (
                <div className="pt-1 sm:pt-2">
                  <p className="text-white/45">Odds to reach Final Four</p>
                  <p className="mt-0.5 sm:mt-1 text-lg font-medium tabular-nums text-white/86">
                    {isAnalysisRunning ? (
                      <span className="animate-pulse">—</span>
                    ) : finalFourOdds}
                  </p>
                </div>
              ) : null}
              {(championshipOdds || isAnalysisRunning) ? (
                <div className="pt-0.5 sm:pt-1">
                  <p className="text-white/45">Odds to survive the championship</p>
                  <p className="mt-1 text-lg font-medium tabular-nums text-white/86">
                    {isAnalysisRunning ? (
                      <span className="animate-pulse">—</span>
                    ) : championshipOdds}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {shouldShowBanner && (
        <section className="px-6 pb-2">
          <button
            type="button"
            className="mx-auto block w-full max-w-5xl rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-left"
            onClick={() => setDismissedKey(eliminatedKey)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-amber-100">
                  Since your last visit: {remainingDelta} bracket{remainingDelta === 1 ? "" : "s"} eliminated
                </p>
                {eliminatedSince.length > 0 && (
                  <p className="mt-1 text-sm text-amber-50/80">
                    {formatBracketList(eliminatedSince)} were knocked out.
                  </p>
                )}
              </div>
              <span className="text-xs uppercase tracking-[0.15em] text-amber-50/70">
                dismiss
              </span>
            </div>
          </button>
        </section>
      )}

      <section className="px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                Bracket Cards
              </p>
              <h2 className="text-2xl font-bold text-white">
                {isOver ? "Tournament post-mortem" : "Every survivor, side by side"}
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleCards.map((bracket, index) => (
              <BracketCard
                key={bracket.index}
                index={bracket.index}
                championPick={bracket.championPick}
                championshipGame={bracket.championshipGame}
                finalFour={bracket.finalFour}
                alive={bracket.alive}
                eliminatedBy={bracket.eliminatedBy}
                likelihood={bracket.likelihood}
                pendingPicks={bracket.picks.filter((pick) => pick.result === "pending")}
                scheduledGames={futureKillers}
                accentColor={
                  trackedBracketColors.get(bracket.index) ??
                  getTeamAccentColor(bracket.championPick)
                }
                animateElimination={eliminatedSince.includes(bracket.index)}
                animationDelayMs={index * 500}
              />
            ))}
            {!survivors && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-white/45">
                Loading surviving brackets...
              </div>
            )}
            {survivors?.length === 0 && visibleCards.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-white/45">
                {isOver ? "All brackets have been eliminated." : "No surviving brackets found."}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="px-3 py-4 sm:px-6 sm:py-6">
        <div className="max-w-5xl mx-auto">
          <BracketPathVisualizer
            trackedBrackets={trackedBrackets}
            results={results}
            futureKillers={futureKillers}
            now={now}
          />
        </div>
      </section>

      <section className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-white/40">
              Browse the universe
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">Open any bracket by number</h2>
            <p className="mt-2 text-sm text-white/50">
              Every integer 0–999,999,999 is a bracket.
            </p>

            <div className="mt-5 flex flex-wrap gap-3 items-center">
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
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 px-6 py-4">
        <div className="max-w-5xl mx-auto text-xs text-white/30 space-y-0.5">
          {isAnalysisRunning && stats.analysisStatus?.lastStartedAt && (
            <p className="text-amber-400/80">
              Analysis running since{" "}
              {new Date(stats.analysisStatus.lastStartedAt).toLocaleTimeString()}
            </p>
          )}
          {stats.analyzedAt && (
            <p>
              Last updated: {new Date(stats.analyzedAt).toLocaleString()}
            </p>
          )}
          {stats.analysisStatus?.lastError && (
            <p className="text-rose-400/70">
              Last refresh failed: {stats.analysisStatus.lastError}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
