"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PendingGameRow } from "@/lib/pending-games";
import type { BracketPickStatus, EliminatedByPick } from "@/lib/tournament";

interface BracketCardProps {
  index: number;
  championPick: string;
  championshipGame: [string, string];
  finalFour: string[];
  alive: boolean;
  eliminatedBy: EliminatedByPick | null;
  likelihood: number;
  pendingPicks: BracketPickStatus[];
  pendingGames: PendingGameRow[];
  accentColor: string;
  animateElimination?: boolean;
  animationDelayMs?: number;
}

const ROUND_LABELS: Record<number, string> = {
  64: "R64",
  32: "R32",
  16: "S16",
  8: "E8",
  4: "F4",
  2: "Champ",
};

function formatOdds(likelihood: number): string {
  if (likelihood <= 0) {
    return "—";
  }

  const oneIn = Math.round(1 / likelihood);
  if (oneIn <= 1) {
    return "~1 in 1";
  }

  return `1 in ${oneIn.toLocaleString()}`;
}

function formatOddsDescription(likelihood: number): string {
  if (likelihood <= 0) {
    return "This bracket no longer has a chance of staying perfect through the championship.";
  }

  const odds = formatOdds(likelihood).replace("~", "about ");
  return `This bracket has a ${odds} chance of staying perfect through the championship.`;
}

function formatDay(value: string): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function formatRound(round: number): string {
  return ROUND_LABELS[round] ?? `R${round}`;
}

function getNextNeed(
  pendingPicks: BracketPickStatus[],
  pendingGames: PendingGameRow[]
): { team: string; opponent: string; when: string } | null {
  const pendingByGameIndex = new Map(pendingGames.map((game) => [game.gameIndex, game]));
  const sortOrder = new Map(pendingGames.map((game, index) => [game.gameIndex, index]));
  const sortedPicks = [...pendingPicks].sort(
    (a, b) => (sortOrder.get(a.game_index) ?? Number.POSITIVE_INFINITY) -
      (sortOrder.get(b.game_index) ?? Number.POSITIVE_INFINITY) ||
      a.game_index - b.game_index
  );

  for (const pick of sortedPicks) {
    const opponent = pick.pick === pick.team1 ? pick.team2 : pick.team1;
    const pending = pendingByGameIndex.get(pick.game_index);
    const when = pending?.phase === "live"
      ? pending.liveDetail ?? "Live"
      : pending?.scheduledAt
        ? formatDay(pending.scheduledAt) ?? formatRound(pick.round)
        : formatRound(pick.round);

    return { team: pick.pick, opponent, when };
  }

  return null;
}

function renderFinalFour(finalFour: string[], championshipGame: [string, string]) {
  if (finalFour.length < 4) {
    return <span className="text-white/35">TBD</span>;
  }

  const championshipTeams = new Set(championshipGame.filter(Boolean));
  const groups = [
    [finalFour[0], finalFour[1]],
    [finalFour[2], finalFour[3]],
  ];

  return groups.map((group, groupIndex) => (
    <div key={`${group.join("-")}-${groupIndex}`} className="truncate">
      {group.map((team, teamIndex) => (
        <span
          key={`${team}-${teamIndex}`}
          className={championshipTeams.has(team) ? "font-semibold text-white" : "text-white/55"}
        >
          {team}
          {teamIndex === 0 ? " / " : ""}
        </span>
      ))}
    </div>
  ));
}

export default function BracketCard({
  index,
  championPick,
  championshipGame,
  finalFour,
  alive,
  eliminatedBy,
  likelihood,
  pendingPicks,
  pendingGames,
  accentColor,
  animateElimination = false,
  animationDelayMs = 0,
}: BracketCardProps) {
  const [showDead, setShowDead] = useState(false);
  const [showOddsInfo, setShowOddsInfo] = useState(false);
  const oddsInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!animateElimination) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShowDead(true);
    }, animationDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [animateElimination, animationDelayMs]);

  useEffect(() => {
    if (!showOddsInfo) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!oddsInfoRef.current?.contains(event.target as Node)) {
        setShowOddsInfo(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowOddsInfo(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showOddsInfo]);

  const nextNeed = getNextNeed(pendingPicks, pendingGames);
  const opponent =
    championshipGame[0] === championPick ? championshipGame[1] : championshipGame[0];
  const isVisuallyAlive = alive || (animateElimination && !showDead);
  const borderLeftColor = isVisuallyAlive ? accentColor : "rgba(255,255,255,0.2)";

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border border-white/10 border-l-[3px] bg-white/5 p-5 transition-[opacity,transform,border-color] duration-700 ${
        isVisuallyAlive ? "opacity-100 translate-y-0" : "opacity-50 translate-y-0"
      }`}
      style={{ borderLeftColor }}
    >
      <div>
        <h3 className="text-xl leading-tight">
          <span className="font-semibold" style={{ color: accentColor }}>
            {championPick}
          </span>
          <span className="text-white/55"> over {opponent}</span>
        </h3>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p className="text-sm text-white/40">Bracket #{index.toLocaleString()}</p>
          <div ref={oddsInfoRef} className="relative shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium tabular-nums text-white/65">
                {formatOdds(likelihood)}
              </p>
              <button
                type="button"
                aria-label="Explain odds"
                aria-expanded={showOddsInfo}
                onClick={() => setShowOddsInfo((current) => !current)}
                className="flex h-4 w-4 items-center justify-center rounded-full border border-white/12 text-[10px] font-medium text-white/45 transition-colors hover:border-white/22 hover:text-white/75"
              >
                i
              </button>
            </div>
            {showOddsInfo ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-white/10 bg-[#19191d] p-3 text-xs leading-5 text-white/70 shadow-2xl shadow-black/30">
                {formatOddsDescription(likelihood)}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="text-xs uppercase tracking-[0.15em] text-white/35">Final Four</p>
        <div className="mt-2 h-12 text-sm leading-6">
          {renderFinalFour(finalFour, championshipGame)}
        </div>
      </div>

      <div className="mt-5 text-sm">
        {isVisuallyAlive ? (
          nextNeed ? (
            <p className="text-white/70">
              <span className="text-white/40">Needs next:</span>{" "}
              <span className="font-medium text-white">{nextNeed.team}</span>
              <span className="text-white/35"> over </span>
              <span className="text-white/60">{nextNeed.opponent}</span>
              <span className="text-white/35"> ({nextNeed.when})</span>
            </p>
          ) : (
            <p className="text-white/40">No pending picks left.</p>
          )
        ) : eliminatedBy ? (
          <p className="text-rose-400">
            Eliminated: {eliminatedBy.winner} over {eliminatedBy.pick} ({formatRound(eliminatedBy.round)})
          </p>
        ) : (
          <p className="text-white/40">Eliminated.</p>
        )}
      </div>

      <div className="mt-auto pt-5">
        <Link
          href={`/bracket/${index}`}
          className="text-sm font-medium text-white/75 transition-colors hover:text-white"
        >
          View full bracket →
        </Link>
      </div>
    </article>
  );
}
