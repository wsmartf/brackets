"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BracketPickStatus, EliminatedByPick } from "@/lib/tournament";

const ROUND_OPTIONS = [
  { value: 64, label: "Round of 64" },
  { value: 32, label: "Round of 32" },
  { value: 16, label: "Sweet 16" },
  { value: 8, label: "Elite 8" },
  { value: 4, label: "Final Four" },
  { value: 2, label: "Championship" },
] as const;

interface BracketViewerProps {
  id: number;
  picks: BracketPickStatus[];
  alive: boolean;
  summary: {
    correct: number;
    wrong: number;
    pending: number;
  };
  eliminatedBy: EliminatedByPick | null;
}

function formatBracketId(id: number): string {
  return new Intl.NumberFormat("en-US").format(id);
}

function statusClasses(result: BracketPickStatus["result"]): string {
  switch (result) {
    case "alive":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700";
    case "dead":
      return "border-rose-500/20 bg-rose-500/10 text-rose-700";
    default:
      return "border-stone-300 bg-stone-100 text-stone-600";
  }
}

function statusLabel(result: BracketPickStatus["result"]): string {
  switch (result) {
    case "alive":
      return "Correct";
    case "dead":
      return "Wrong";
    default:
      return "Pending";
  }
}

function roundLabel(round: number): string {
  return ROUND_OPTIONS.find((option) => option.value === round)?.label ?? `Round ${round}`;
}

export default function BracketViewer({
  id,
  picks,
  alive,
  summary,
  eliminatedBy,
}: BracketViewerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [inputValue, setInputValue] = useState(String(id));
  const [selectedRound, setSelectedRound] = useState<number>(64);
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(String(id));
  }, [id]);

  const picksByRound = useMemo(() => {
    return ROUND_OPTIONS.map((option) => ({
      ...option,
      picks: picks.filter((pick) => pick.round === option.value),
    }));
  }, [picks]);

  const visiblePicks = picksByRound.find((round) => round.value === selectedRound)?.picks ?? [];
  const championPick = picks.find((pick) => pick.game_index === 62)?.pick ?? null;

  const navigateToBracket = (targetId: number) => {
    startTransition(() => {
      router.push(`/bracket/${targetId}`);
    });
  };

  const handleViewSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!/^\d{1,10}$/.test(inputValue)) {
      setInputError("Enter a bracket ID from 0 to 999,999,999.");
      return;
    }

    const parsed = Number.parseInt(inputValue, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 999_999_999) {
      setInputError("Enter a bracket ID from 0 to 999,999,999.");
      return;
    }

    setInputError(null);
    navigateToBracket(parsed);
  };

  const handleRandom = () => {
    setInputError(null);
    navigateToBracket(Math.floor(Math.random() * 1_000_000_000));
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#efe8db_100%)] text-stone-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-[2rem] border border-black/8 bg-white/80 px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-stone-700 transition hover:bg-white"
              >
                Dashboard
              </Link>
              <Link
                href="/about"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-stone-700 transition hover:bg-white"
              >
                About
              </Link>
              <span className="rounded-full border border-black/8 bg-stone-950 px-4 py-2 text-white">
                Live Bracket Status
              </span>
            </div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
              One number, one bracket
            </p>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
                Live Bracket Status
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                Bracket <span className="font-mono">#{formatBracketId(id)}</span>
              </h1>
              <div className="mt-5 flex flex-wrap items-stretch gap-3">
                <span
                  className={`inline-flex items-center rounded-[1.1rem] border px-5 py-3 text-lg font-black uppercase tracking-[0.24em] shadow-sm sm:text-xl ${
                    alive
                      ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-700"
                      : "border-rose-500/25 bg-rose-500/12 text-rose-700"
                  }`}
                >
                  {alive ? "Alive" : "Dead"}
                </span>
                {championPick ? (
                  <span className="rounded-[1.1rem] border border-black/10 bg-stone-100 px-5 py-3 text-stone-700 shadow-sm">
                    <span className="block text-[11px] uppercase tracking-[0.22em] text-stone-500">
                      Champion Pick
                    </span>
                    <strong className="mt-1 block text-xl font-semibold text-stone-950 sm:text-2xl">
                      {championPick}
                    </strong>
                  </span>
                ) : null}
              </div>
              <p className="mt-4 text-base leading-7 text-stone-700">
                {summary.correct} correct • {summary.wrong} wrong • {summary.pending} pending
              </p>
              {eliminatedBy ? (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-rose-700">
                  Eliminated by <strong>{eliminatedBy.winner}</strong> over {eliminatedBy.pick} in{" "}
                  {roundLabel(eliminatedBy.round)}.
                </p>
              ) : (
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  This bracket still matches every completed game on the board.
                </p>
              )}
            </div>

            <form
              onSubmit={handleViewSubmit}
              className="rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-5 text-white shadow-[0_18px_50px_rgba(15,23,42,0.12)]"
            >
              <label htmlFor="bracket-id" className="text-xs uppercase tracking-[0.22em] text-stone-400">
                Enter a bracket ID
              </label>
              <input
                id="bracket-id"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                inputMode="numeric"
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/8 px-4 py-3 font-mono text-lg text-white outline-none transition focus:border-white/25"
                placeholder="418275901"
                aria-describedby="bracket-id-help"
              />
              <p id="bracket-id-help" className="mt-2 text-sm text-stone-400">
                Pick any number from 0 to 999,999,999.
              </p>
              {inputError ? (
                <p className="mt-3 text-sm text-amber-300">{inputError}</p>
              ) : null}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isPending ? "Loading..." : "View Bracket"}
                </button>
                <button
                  type="button"
                  onClick={handleRandom}
                  disabled={isPending}
                  className="rounded-full border border-white/12 bg-white/6 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Random Bracket
                </button>
              </div>
            </form>
          </div>
        </header>

        <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 sm:py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                Picks by Round
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                {roundLabel(selectedRound)}
              </h2>
            </div>
          </div>

          <div className="mt-5 sm:hidden">
            <label htmlFor="round-select" className="sr-only">
              Select round
            </label>
            <select
              id="round-select"
              value={selectedRound}
              onChange={(event) => setSelectedRound(Number.parseInt(event.target.value, 10))}
              className="w-full rounded-2xl border border-black/10 bg-stone-100 px-4 py-3 text-sm text-stone-900 outline-none"
            >
              {ROUND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
            {ROUND_OPTIONS.map((option) => {
              const isSelected = option.value === selectedRound;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedRound(option.value)}
                  className={`rounded-full border px-4 py-2 text-sm transition ${
                    isSelected
                      ? "border-stone-950 bg-stone-950 text-white"
                      : "border-black/10 bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4">
            {visiblePicks.map((pick) => (
              <article
                key={pick.game_index}
                className="rounded-[1.4rem] border border-black/8 bg-stone-50 px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                      Game {pick.game_index}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-stone-950">
                      {pick.team1} vs {pick.team2}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusClasses(
                      pick.result
                    )}`}
                  >
                    {statusLabel(pick.result)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                  <div className="rounded-2xl border border-black/8 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
                      Picked
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
                      {pick.pick}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-black/8 bg-stone-100 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-stone-500">
                      Actual winner
                    </p>
                    <p
                      className={`mt-2 text-lg font-semibold tracking-tight ${
                        pick.winner ? "text-stone-950" : "text-stone-500"
                      }`}
                    >
                      {pick.winner ?? "Not decided yet"}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
