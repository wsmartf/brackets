"use client";

import { useMemo, useState } from "react";
import tournamentData from "@/data/tournament-2026.json";
import type { GameResult } from "@/hooks/useHomepageData";
import type { TrackedBracket } from "@/hooks/useTrackedBrackets";
import type { FutureKillerRow } from "@/lib/future-killers";

interface Props {
  trackedBrackets: TrackedBracket[];
  results: GameResult[];
  futureKillers: FutureKillerRow[];
  now: number;
}

// "solid": bracket committed here — completed fact or correctly-toggled hypothesis
// "ended": bracket eliminated here — wrong pick (real or hypothetical). Line stops.
// "gone": after elimination — nothing shown
// "none": untoggled upcoming game — nothing shown; trailing half from previous solid
type CellState = "solid" | "ended" | "gone" | "none";

interface GameColumn {
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  sameMatchup: boolean;
  isCompleted: boolean;
  winner: string | null;
  scheduledAt: string | null;
  sortKey: number;
}

const ROUND_LABELS: Record<number, string> = {
  16: "Sweet 16",
  8: "Elite 8",
  4: "Final Four",
  2: "Championship",
};

const PLAY_IN_SEED_OVERRIDES: Record<string, number> = {
  "NC State": 11,
  Lehigh: 16,
  UMBC: 16,
  SMU: 11,
};

const TEAM_SEEDS = new Map<string, number>([
  ...tournamentData.teams.map((team) => [team.name, team.seed] as const),
  ...Object.entries(PLAY_IN_SEED_OVERRIDES),
]);

function formatRound(round: number): string {
  return ROUND_LABELS[round] ?? `Round ${round}`;
}

function formatShortTime(scheduledAt: string | null, now: number): string | null {
  if (!scheduledAt) return null;
  const date = new Date(scheduledAt);
  if (!Number.isFinite(date.getTime())) return null;
  const elapsed = now - date.getTime();
  if (elapsed > 0 && elapsed < 3 * 60 * 60 * 1000) return "In Progress";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function abbreviate(name: string): string {
  const overrides: Record<string, string> = {
    "Michigan State": "Mich St",
    "Iowa State": "Iowa St",
    "Saint John's": "St. John's",
    "St. John's": "St. John's",
    "Prairie View A&M": "PV A&M",
  };
  return overrides[name] ?? name.slice(0, 9);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TeamOptionLabel({
  team,
  selected,
}: {
  team: string;
  selected: boolean;
}) {
  const seed = TEAM_SEEDS.get(team);

  return (
    <span className="flex min-w-0 items-baseline justify-center gap-1">
      {seed != null && (
        <span className={selected ? "font-normal text-black/55" : "font-normal text-white/38"}>
          {seed}
        </span>
      )}
      <span className="overflow-hidden whitespace-nowrap">{abbreviate(team)}</span>
    </span>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function buildColumns(
  trackedBrackets: TrackedBracket[],
  results: GameResult[],
  futureKillers: FutureKillerRow[]
): GameColumn[] {
  if (trackedBrackets.length === 0) return [];

  const resultsByIndex = new Map(results.map((r) => [r.game_index, r]));
  const scheduledByIndex = new Map(futureKillers.map((g) => [g.gameIndex, g]));

  const gameIndices = new Set<number>();
  for (const b of trackedBrackets) {
    for (const [gi] of b.picks) gameIndices.add(gi);
  }

  const all: GameColumn[] = [];
  for (const gameIndex of gameIndices) {
    const result = resultsByIndex.get(gameIndex);
    const scheduled = scheduledByIndex.get(gameIndex);

    const matchups = trackedBrackets
      .map((b) => b.picks.get(gameIndex))
      .filter(Boolean)
      .map((p) => `${p!.team1}|||${p!.team2}`);
    const firstMatchup = matchups[0] ?? "";
    const sameMatchup = matchups.every((m) => m === firstMatchup);
    const [team1 = "TBD", team2 = "TBD"] = firstMatchup.split("|||");

    const isCompleted = Boolean(result?.winner);
    const round =
      result?.round ?? scheduled?.round ?? trackedBrackets[0]?.picks.get(gameIndex)?.round ?? 0;

    all.push({
      gameIndex,
      round,
      team1: isCompleted ? (result?.team1 ?? team1) : team1,
      team2: isCompleted ? (result?.team2 ?? team2) : team2,
      sameMatchup,
      isCompleted,
      winner: result?.winner ?? null,
      scheduledAt: scheduled?.scheduledAt ?? null,
      sortKey: isCompleted
        ? new Date(result!.updated_at).getTime()
        : scheduled?.scheduledAt
          ? new Date(scheduled.scheduledAt).getTime()
          : Infinity,
    });
  }

  // Sort: completed first (by finish time), then upcoming (by scheduled time).
  // gameIndex is the stable tiebreaker.
  all.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? -1 : 1;
    if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
    return a.gameIndex - b.gameIndex;
  });

  return all;
}

/**
 * Returns the index of the first untoggled upcoming game.
 * The line never extends past this boundary — "none" zone starts here.
 * Returns columns.length when all upcoming games are toggled.
 */
function getConsecutiveBoundaryIdx(
  columns: GameColumn[],
  toggles: Map<number, string>
): number {
  const firstUpcomingIdx = columns.findIndex((c) => !c.isCompleted);
  if (firstUpcomingIdx === -1) return columns.length;
  for (let i = firstUpcomingIdx; i < columns.length; i++) {
    if (!toggles.has(columns[i].gameIndex)) return i;
  }
  return columns.length;
}


function computeCellStates(
  bracket: TrackedBracket,
  columns: GameColumn[],
  toggles: Map<number, string>,
  consecutiveBoundaryIdx: number
): CellState[] {
  // Real death: from a completed game result
  let realDeathColIdx = -1;
  if (bracket.eliminatedAtGame !== null) {
    realDeathColIdx = columns.findIndex((c) => c.gameIndex === bracket.eliminatedAtGame);
  }

  // Hypothetical death: first wrong toggle within the consecutive committed range
  let hypotheticalDeathColIdx = -1;
  for (let i = 0; i < consecutiveBoundaryIdx; i++) {
    const col = columns[i];
    if (col.isCompleted) continue;
    const toggle = toggles.get(col.gameIndex);
    const pick = bracket.picks.get(col.gameIndex);
    if (toggle && pick && pick.pick !== toggle) {
      hypotheticalDeathColIdx = i;
      break;
    }
  }

  // Effective death is whichever comes first
  const effectiveDeath =
    realDeathColIdx !== -1 && hypotheticalDeathColIdx !== -1
      ? Math.min(realDeathColIdx, hypotheticalDeathColIdx)
      : realDeathColIdx !== -1
        ? realDeathColIdx
        : hypotheticalDeathColIdx;

  // Was the effective death a real (completed-game) elimination or a hypothetical one?
  const isRealDeath = effectiveDeath !== -1 && effectiveDeath === realDeathColIdx;

  return columns.map((col, i) => {
    if (effectiveDeath !== -1 && i === effectiveDeath) return "ended";
    if (effectiveDeath !== -1 && i > effectiveDeath) {
      // After real death: nothing. After hypothetical death: faint dots remain.
      return isRealDeath ? "gone" : "none";
    }
    if (col.isCompleted) return "solid";
    if (i >= consecutiveBoundaryIdx) return "none";
    return "solid";
  });
}

// ── Rendering primitives ──────────────────────────────────────────────────────

function HalfLine({ color, visible }: { color: string; visible: boolean }) {
  if (!visible) return <div className="flex-1" />;
  return <div className="flex-1 rounded-full" style={{ height: 5, backgroundColor: color }} />;
}

function Dot({ state, color }: { state: CellState; color: string }) {
  // After elimination — invisible placeholder
  if (state === "gone") {
    return <div className="w-4 h-4 flex-shrink-0" />;
  }
  // Untoggled upcoming game — faint dot showing the bracket could still go here
  if (state === "none") {
    return (
      <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
      </div>
    );
  }
  // Elimination marker
  if (state === "ended") {
    return (
      <div
        className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold leading-none text-white"
        style={{ backgroundColor: hexToRgba(color, 0.25) }}
      >
        ✕
      </div>
    );
  }
  // Solid: full-brightness dot
  return (
    <div
      className="w-4 h-4 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

// ── Column header ─────────────────────────────────────────────────────────────

const COMPLETED_COL_W = 112;
const UPCOMING_COL_W = 160;
const STICKY_COL_CLASS = "sticky left-0 border-r border-white/6 bg-[#19191d]";

function ColumnHeader({
  col,
  toggles,
  onToggle,
  now,
  isNextStep,
  shouldPulse,
  isDimmed,
}: {
  col: GameColumn;
  toggles: Map<number, string>;
  onToggle: (gameIndex: number, team: string) => void;
  now: number;
  isNextStep?: boolean;
  shouldPulse?: boolean;
  isDimmed?: boolean;
}) {
  const timeLabel = formatShortTime(col.scheduledAt, now);
  const isLive = timeLabel === "In Progress";

  if (col.isCompleted) {
    return (
      <div
        className="flex flex-col gap-0.5 px-2 pb-2"
        style={{ width: COMPLETED_COL_W, minWidth: COMPLETED_COL_W }}
      >
        <span className="text-[10px] uppercase tracking-wide text-white/25 truncate">
          {formatRound(col.round)}
        </span>
        <span className="text-xs font-medium text-white/50 truncate">
          {abbreviate(col.winner ?? "?")} ✓
        </span>
        <span className="text-[10px] text-white/25 truncate">
          {abbreviate(col.team1)} v {abbreviate(col.team2)}
        </span>
      </div>
    );
  }

  const selected = toggles.get(col.gameIndex);
  return (
    <div
      className={[
        "flex flex-col gap-1 px-1 pb-2 rounded-lg transition-opacity",
        isNextStep ? "ring-1 ring-white/30 bg-white/[0.04]" : "",
        isNextStep && shouldPulse ? "animate-pulse" : "",
        isDimmed ? "opacity-35" : "",
      ].join(" ")}
      style={{ width: UPCOMING_COL_W, minWidth: UPCOMING_COL_W }}
    >
      <div className="flex items-center gap-1">
        {isLive && (
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
        )}
        <span className="text-[10px] uppercase tracking-wide text-white/35 truncate">
          {formatRound(col.round)}
          {timeLabel && !isLive ? ` · ${timeLabel}` : ""}
          {isLive ? " · Live" : ""}
        </span>
      </div>
      {col.sameMatchup ? (
        <div className="flex gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {[col.team1, col.team2].map((team) => {
            const isSelected = selected === team;
            return (
              <button
                key={team}
                type="button"
                onClick={() => onToggle(col.gameIndex, team)}
                className={`flex-1 text-[10px] font-medium px-1 py-1 rounded text-center transition-colors truncate ${
                  isSelected
                    ? "bg-white text-black"
                    : isNextStep
                      ? "bg-white/14 text-white/75 hover:bg-white/20"
                      : "bg-white/8 text-white/60 hover:bg-white/15"
                }`}
              >
                <TeamOptionLabel team={team} selected={isSelected} />
              </button>
            );
          })}
        </div>
      ) : (
        <span className="text-[10px] text-white/30 italic">TBD</span>
      )}
    </div>
  );
}

// ── Bracket label ─────────────────────────────────────────────────────────────

const LABEL_COL_W = 172;
const ROW_H = 44;

function BracketLabel({
  bracket,
  onClick,
  isActive,
}: {
  bracket: TrackedBracket;
  onClick: () => void;
  isActive: boolean;
}) {
  const isAlive = bracket.eliminatedAtGame === null;
  return (
    <button
      type="button"
      className={`${STICKY_COL_CLASS} group z-10 flex-shrink-0 flex flex-col justify-center pr-3 text-left cursor-pointer`}
      style={{ width: LABEL_COL_W, height: ROW_H }}
      onClick={onClick}
      title="Click to trace this bracket's path"
    >
      <span
        className={`text-xs truncate leading-tight underline-offset-3 decoration-white/35 transition-[color,text-decoration-color] ${
          isActive
            ? "underline text-white/80"
            : "group-hover:underline group-hover:text-white/75"
        }`}
      >
        <span
          className="font-bold"
          style={{ color: isAlive ? bracket.color : hexToRgba(bracket.color, 0.4) }}
        >
          {bracket.championPick}
        </span>
        <span
          className={
            isActive
              ? isAlive
                ? "text-white/70"
                : "text-white/40"
              : isAlive
                ? "text-white/55"
                : "text-white/25"
          }
        >
          {" "}over {bracket.opponent}
        </span>
      </span>
    </button>
  );
}

function ClearSelectionsButton({
  disabled,
  onClear,
}: {
  disabled: boolean;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      className={`inline-flex h-6 items-center rounded-full px-2 text-[11px] font-medium transition-colors ${
        disabled
          ? "text-white/30"
          : "text-white/45 hover:bg-white/[0.06] hover:text-white/75"
      }`}
    >
      Clear
    </button>
  );
}

// ── Desktop grid ──────────────────────────────────────────────────────────────

function DesktopGrid({
  sortedBrackets,
  bracketStates,
  columns,
  toggles,
  consecutiveBoundaryIdx,
  hasInteracted,
  activeBracketIndex,
  onToggle,
  onClearSelections,
  onBracketClick,
  now,
}: {
  sortedBrackets: TrackedBracket[];
  bracketStates: CellState[][];
  columns: GameColumn[];
  toggles: Map<number, string>;
  consecutiveBoundaryIdx: number;
  hasInteracted: boolean;
  activeBracketIndex: number | null;
  onToggle: (gameIndex: number, team: string) => void;
  onClearSelections: () => void;
  onBracketClick: (bracket: TrackedBracket) => void;
  now: number;
}) {
  const totalW = columns.reduce(
    (sum, c) => sum + (c.isCompleted ? COMPLETED_COL_W : UPCOMING_COL_W),
    LABEL_COL_W
  );

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalW }}>
        {/* Header row */}
        <div className="flex pt-1">
          <div
            className={`${STICKY_COL_CLASS} z-20 -mt-1 flex items-center justify-end pr-3 pt-2 pb-2`}
            style={{ width: LABEL_COL_W, minWidth: LABEL_COL_W }}
          >
            <ClearSelectionsButton
              disabled={toggles.size === 0}
              onClear={onClearSelections}
            />
          </div>
          <div className="flex pl-1">
            {columns.map((col, idx) => (
              <ColumnHeader
                key={col.gameIndex}
                col={col}
                toggles={toggles}
                onToggle={onToggle}
                now={now}
                isNextStep={idx === consecutiveBoundaryIdx && idx < columns.length}
                shouldPulse={!hasInteracted}
                isDimmed={idx > consecutiveBoundaryIdx}
              />
            ))}
          </div>
        </div>

        {/* Bracket rows */}
        {sortedBrackets.map((bracket, bIdx) => {
          const states = bracketStates[bIdx];
          return (
            <div
              key={bracket.index}
              className="flex items-center"
              style={{ height: ROW_H }}
            >
              <BracketLabel
                bracket={bracket}
                onClick={() => onBracketClick(bracket)}
                isActive={activeBracketIndex === bracket.index}
              />

              {columns.map((col, i) => {
                const state = states[i];
                const colW = col.isCompleted ? COMPLETED_COL_W : UPCOMING_COL_W;
                // i===0: always show entry tail for any alive/pending bracket (even "none")
                const showLeft =
                  i === 0
                    ? state !== "gone"
                    : (state === "solid" || state === "ended") && states[i - 1] === "solid";
                // Right half: only for solid cells; naturally trails into "none" zone
                const showRight = state === "solid" && i < columns.length - 1;

                return (
                  <div
                    key={col.gameIndex}
                    className="flex items-center flex-shrink-0"
                    style={{ width: colW, height: ROW_H }}
                  >
                    <HalfLine color={bracket.color} visible={showLeft} />
                    <div className="relative z-10 -mx-1.5 flex-shrink-0">
                      <Dot state={state} color={bracket.color} />
                    </div>
                    <HalfLine color={bracket.color} visible={showRight} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Mobile grid (games = rows, brackets = cols) ───────────────────────────────

const MOBILE_BRACKET_MIN_W = 28;
const MOBILE_GAME_LABEL_W = 80;

function MobileBracketCells({
  sortedBrackets,
  bracketStates,
  rowIdx,
  totalRows,
  onBracketClick,
}: {
  sortedBrackets: TrackedBracket[];
  bracketStates: CellState[][];
  rowIdx: number;
  totalRows: number;
  onBracketClick: (bracket: TrackedBracket) => void;
}) {
  return (
    <>
      {sortedBrackets.map((bracket, bIdx) => {
        const states = bracketStates[bIdx];
        const state = states[rowIdx];
        const showAbove =
          rowIdx === 0
            ? state !== "gone"
            : (state === "solid" || state === "ended") && states[rowIdx - 1] === "solid";
        const showBelow = state === "solid" && rowIdx < totalRows - 1;

        return (
          <button
            key={bracket.index}
            type="button"
            className="flex-1 min-w-0 flex flex-col items-center justify-center cursor-pointer"
            style={{ minWidth: MOBILE_BRACKET_MIN_W }}
            onClick={() => onBracketClick(bracket)}
          >
            {showAbove ? (
              <div className="flex-1 rounded-full" style={{ width: 5, backgroundColor: bracket.color }} />
            ) : (
              <div className="flex-1" />
            )}
            <div className="relative z-10 -my-1.5 flex-shrink-0">
              <Dot state={state} color={bracket.color} />
            </div>
            {showBelow ? (
              <div className="flex-1 rounded-full" style={{ width: 5, backgroundColor: bracket.color }} />
            ) : (
              <div className="flex-1" />
            )}
          </button>
        );
      })}
    </>
  );
}

function MobileGrid({
  sortedBrackets,
  bracketStates,
  columns,
  toggles,
  consecutiveBoundaryIdx,
  hasInteracted,
  activeBracketIndex,
  showOutcomes,
  onToggle,
  onToggleOutcomes,
  onClearSelections,
  onBracketClick,
  now,
}: {
  sortedBrackets: TrackedBracket[];
  bracketStates: CellState[][];
  columns: GameColumn[];
  toggles: Map<number, string>;
  consecutiveBoundaryIdx: number;
  hasInteracted: boolean;
  activeBracketIndex: number | null;
  showOutcomes: boolean;
  onToggle: (gameIndex: number, team: string) => void;
  onToggleOutcomes: () => void;
  onClearSelections: () => void;
  onBracketClick: (bracket: TrackedBracket) => void;
  now: number;
}) {
  // Shared bracket name header (used in both modes)
  const bracketNameHeader = (
    <div className="flex items-end pb-2 border-b border-white/10">
      {showOutcomes && (
        <div
          className={`${STICKY_COL_CLASS} z-20 flex-shrink-0`}
          style={{ width: MOBILE_GAME_LABEL_W, minWidth: MOBILE_GAME_LABEL_W }}
        />
      )}
      {sortedBrackets.map((bracket) => (
        <button
          key={bracket.index}
          type="button"
          className="group flex-1 min-w-0 flex flex-col items-center gap-0.5 cursor-pointer"
          style={{ minWidth: MOBILE_BRACKET_MIN_W }}
          onClick={() => onBracketClick(bracket)}
        >
          <span
            className={`w-full overflow-hidden whitespace-nowrap font-bold text-center leading-tight ${
              showOutcomes ? "text-xs" : "text-base"
            } ${activeBracketIndex === bracket.index ? "underline underline-offset-2" : ""}`}
            style={{ color: bracket.eliminatedAtGame === null ? bracket.color : hexToRgba(bracket.color, 0.4) }}
          >
            {abbreviate(bracket.championPick)}
          </span>
        </button>
      ))}
    </div>
  );

  const controlRow = (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggleOutcomes}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
          showOutcomes
            ? "border-white/40 bg-white/15 text-white/90"
            : "border-white/20 bg-white/[0.07] text-white/60 hover:text-white/85 hover:border-white/35"
        }`}
      >
        Pick outcomes
      </button>
      {showOutcomes && (
        <div className="flex items-center gap-2 mt-1.5 pl-1">
          <button
            type="button"
            onClick={onToggleOutcomes}
            className="text-[10px] text-white/40 hover:text-white/65 transition-colors"
          >
            ← Hide
          </button>
          <ClearSelectionsButton disabled={toggles.size === 0} onClear={onClearSelections} />
        </div>
      )}
    </div>
  );

  if (!showOutcomes) {
    return (
      <div>
        {controlRow}

        {bracketNameHeader}

        {/* Game rows grouped by round */}
        {columns.map((col, rowIdx) => {
          const prevCol = columns[rowIdx - 1];
          const roundChanged = !prevCol || prevCol.round !== col.round;
          return (
            <div key={col.gameIndex}>
              {roundChanged && (
                <div className="pt-2 pb-0.5 text-xs uppercase tracking-[0.15em] text-white/25">
                  {formatRound(col.round)}
                </div>
              )}
              <div className="flex items-stretch min-h-[72px] border-b border-white/[0.04]">
                <MobileBracketCells
                  sortedBrackets={sortedBrackets}
                  bracketStates={bracketStates}
                  rowIdx={rowIdx}
                  totalRows={columns.length}
                  onBracketClick={onBracketClick}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Outcomes view: sticky label column + bracket columns
  return (
    <div>
      {controlRow}

      <div className="overflow-x-auto">
      <div style={{ minWidth: MOBILE_GAME_LABEL_W + sortedBrackets.length * MOBILE_BRACKET_MIN_W }}>
        {bracketNameHeader}

        {/* Game rows */}
        {columns.map((col, rowIdx) => {
          const timeLabel = formatShortTime(col.scheduledAt, now);
          const isLive = timeLabel === "In Progress";
          const selected = toggles.get(col.gameIndex);
          const isNextStep = rowIdx === consecutiveBoundaryIdx && !col.isCompleted;
          const isDimmed = rowIdx > consecutiveBoundaryIdx && !col.isCompleted;

          return (
            <div key={col.gameIndex} className="flex items-stretch min-h-[48px] border-b border-white/5">
              {/* Game label + toggle */}
              <div
                className={[
                  STICKY_COL_CLASS,
                  "z-10 flex-shrink-0 flex flex-col gap-0.5 pt-1.5 pb-0 rounded-lg transition-opacity",
                  isNextStep ? "ring-1 ring-inset ring-white/30 bg-white/[0.04]" : "",
                  isNextStep && !hasInteracted ? "animate-pulse" : "",
                  isDimmed ? "opacity-35" : "",
                ].join(" ")}
                style={{ width: MOBILE_GAME_LABEL_W, minWidth: MOBILE_GAME_LABEL_W }}
              >
                <div className="flex items-center justify-center gap-1">
                  {isLive && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />}
                  <span className="text-[9px] uppercase tracking-wide text-white/30 truncate">
                    {formatRound(col.round)}{isLive ? " · Live" : ""}
                  </span>
                </div>
                {timeLabel && !isLive && (
                  <span className="text-[9px] text-white/25 truncate text-center">{timeLabel}</span>
                )}
                {col.isCompleted ? (
                  <span className="text-[10px] font-medium text-white/50 text-center">
                    {abbreviate(col.winner ?? "?")} ✓
                  </span>
                ) : col.sameMatchup ? (
                  <div className="flex flex-col gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                    {[col.team1, col.team2].map((team) => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => onToggle(col.gameIndex, team)}
                        className={`w-full text-xs font-medium px-1 py-2 rounded overflow-hidden whitespace-nowrap transition-colors ${
                          selected === team
                            ? "bg-white text-black"
                            : isNextStep
                              ? "bg-white/14 text-white/75 hover:bg-white/20"
                              : "bg-white/8 text-white/55 hover:bg-white/15"
                        }`}
                      >
                        <TeamOptionLabel team={team} selected={selected === team} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[9px] text-white/25 italic">TBD</span>
                )}
              </div>

              <MobileBracketCells
                sortedBrackets={sortedBrackets}
                bracketStates={bracketStates}
                rowIdx={rowIdx}
                totalRows={columns.length}
                onBracketClick={onBracketClick}
              />
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BracketPathVisualizer({
  trackedBrackets,
  results,
  futureKillers,
  now,
}: Props) {

  const columns = useMemo(
    () => buildColumns(trackedBrackets, results, futureKillers),
    [trackedBrackets, results, futureKillers]
  );

  const [toggles, setToggles] = useState<Map<number, string>>(() => new Map());
  const [hasInteracted, setHasInteracted] = useState(false);
  const [activeBracketIndex, setActiveBracketIndex] = useState<number | null>(null);
  const [showOutcomes, setShowOutcomes] = useState(false);

  const consecutiveBoundaryIdx = useMemo(
    () => getConsecutiveBoundaryIdx(columns, toggles),
    [columns, toggles]
  );

  const sortedBrackets = useMemo(
    () =>
      [...trackedBrackets].sort((a, b) => {
        const aAlive = a.eliminatedAtGame === null ? 1 : 0;
        const bAlive = b.eliminatedAtGame === null ? 1 : 0;
        if (aAlive !== bAlive) return bAlive - aAlive;
        return b.likelihood - a.likelihood;
      }),
    [trackedBrackets]
  );

  const bracketStates = useMemo(
    () =>
      sortedBrackets.map((b) =>
        computeCellStates(b, columns, toggles, consecutiveBoundaryIdx)
      ),
    [sortedBrackets, columns, toggles, consecutiveBoundaryIdx]
  );

  function handleToggle(gameIndex: number, team: string) {
    setHasInteracted(true);
    setActiveBracketIndex(null);
    setToggles((prev) => {
      const next = new Map(prev);
      if (next.get(gameIndex) === team) {
        next.delete(gameIndex);
      } else {
        next.set(gameIndex, team);
      }
      return next;
    });
  }

  function handleClearSelections() {
    setHasInteracted(true);
    setActiveBracketIndex(null);
    setToggles(new Map());
  }

  function handleBracketClick(bracket: TrackedBracket) {
    const toggleable = columns.filter((c) => !c.isCompleted && c.sameMatchup);
    const isFullySelected =
      toggleable.length > 0 &&
      toggleable.every((c) => {
        const pick = bracket.picks.get(c.gameIndex);
        return pick && toggles.get(c.gameIndex) === pick.pick;
      });

    setHasInteracted(true);
    if (isFullySelected) {
      setActiveBracketIndex(null);
      setToggles(new Map());
    } else {
      const next = new Map<number, string>();
      for (const col of columns) {
        if (!col.isCompleted && col.sameMatchup) {
          const pick = bracket.picks.get(col.gameIndex);
          if (pick) next.set(col.gameIndex, pick.pick);
        }
      }
      setActiveBracketIndex(bracket.index);
      setToggles(next);
    }
  }

  if (trackedBrackets.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/45">
        Loading bracket paths…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-white/35">Bracket Paths</p>
          <p className="mt-1 text-sm text-white/50 hidden sm:block">
            Choose game outcomes to see which brackets stay alive. Click a bracket name on the left to trace its path.
          </p>
        </div>
      </div>

      <div className="hidden sm:block">
        <DesktopGrid
          sortedBrackets={sortedBrackets}
          bracketStates={bracketStates}
          columns={columns}
          toggles={toggles}
          consecutiveBoundaryIdx={consecutiveBoundaryIdx}
          hasInteracted={hasInteracted}
          activeBracketIndex={activeBracketIndex}
          onToggle={handleToggle}
          onClearSelections={handleClearSelections}
          onBracketClick={handleBracketClick}
          now={now}
        />
      </div>

      <div className="block sm:hidden">
        <MobileGrid
          sortedBrackets={sortedBrackets}
          bracketStates={bracketStates}
          columns={columns}
          toggles={toggles}
          consecutiveBoundaryIdx={consecutiveBoundaryIdx}
          hasInteracted={hasInteracted}
          activeBracketIndex={activeBracketIndex}
          showOutcomes={showOutcomes}
          onToggle={handleToggle}
          onToggleOutcomes={() => setShowOutcomes((v) => !v)}
          onClearSelections={handleClearSelections}
          onBracketClick={handleBracketClick}
          now={now}
        />
      </div>
    </div>
  );
}
