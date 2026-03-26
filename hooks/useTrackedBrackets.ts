"use client";

import { useEffect, useState } from "react";
import type { GameResult, SurvivorBracket } from "@/hooks/useHomepageData";

const STORAGE_KEY = "bkt-overnight-2026";

// Only track S16 and beyond (round <= 16 in the field-size notation: 16, 8, 4, 2)
const S16_ROUND_MAX = 16;

export interface StoredPick {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  pick: string;
}

export interface StoredBracket {
  index: number;
  picks: StoredPick[];
  championPick: string;
  championshipGame: [string, string];
  likelihood: number;
}

export interface TrackedBracket {
  index: number;
  label: string;
  championPick: string;
  opponent: string;
  color: string;
  likelihood: number;
  /** Map from game_index to pick data for all S16+ games */
  picks: Map<number, StoredPick>;
  /** game_index of the completed game that eliminated this bracket, or null if still alive */
  eliminatedAtGame: number | null;
}

// Per-champion color palettes — multiple Duke brackets get different blues
const CHAMPION_COLOR_PALETTES: Record<string, string[]> = {
  Duke: ["#003087", "#3B82F6", "#6366F1"],
  Michigan: ["#FFCB05"],
  Houston: ["#C8102E"],
  "Iowa State": ["#C8102E"],
  Tennessee: ["#FF8200"],
  Alabama: ["#9E1B32"],
  Purdue: ["#CFB991"],
  Arizona: ["#AB0520"],
  Illinois: ["#E84A27"],
};

const FALLBACK_COLORS = ["#6B7280", "#9CA3AF", "#D1D5DB"];

function getBracketLabel(bracket: StoredBracket): string {
  const [team1, team2] = bracket.championshipGame;
  const opponent = team1 === bracket.championPick ? team2 : team1;
  if (!bracket.championPick || !opponent) return `#${bracket.index.toLocaleString()}`;
  return `${bracket.championPick} over ${opponent}`;
}

function assignColors(brackets: StoredBracket[]): Map<number, string> {
  const sorted = [...brackets].sort((a, b) => a.index - b.index);
  const championCount = new Map<string, number>();
  const result = new Map<number, string>();
  let fallbackIdx = 0;

  for (const bracket of sorted) {
    const count = championCount.get(bracket.championPick) ?? 0;
    const palette = CHAMPION_COLOR_PALETTES[bracket.championPick] ?? FALLBACK_COLORS;
    result.set(bracket.index, palette[count] ?? FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length]);
    championCount.set(bracket.championPick, count + 1);
  }

  return result;
}

export function useTrackedBrackets(
  survivors: SurvivorBracket[] | null,
  results: GameResult[]
): TrackedBracket[] {
  const [stored, setStored] = useState<StoredBracket[]>([]);

  // Load from localStorage on mount (client-only)
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredBracket[];
        queueMicrotask(() => {
          if (!cancelled) setStored(parsed);
        });
      }
    } catch {
      // ignore parse errors
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge new survivors into stored brackets when survivors change
  useEffect(() => {
    if (!survivors || survivors.length === 0) return;
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      setStored((prev) => {
      const existingIndices = new Set(prev.map((b) => b.index));

      const newBrackets: StoredBracket[] = survivors
        .filter((b) => !existingIndices.has(b.index))
        .map((b) => ({
          index: b.index,
          picks: b.picks
            .filter((p) => p.round <= S16_ROUND_MAX)
            .map((p) => ({
              game_index: p.game_index,
              round: p.round,
              team1: p.team1,
              team2: p.team2,
              pick: p.pick,
            })),
          championPick: b.championPick,
          championshipGame: b.championshipGame,
          likelihood: b.likelihood,
        }));

      // Update likelihood for existing brackets from live data
      const survivorMap = new Map(survivors.map((s) => [s.index, s]));
      const updated = prev.map((b) => {
        const live = survivorMap.get(b.index);
        return live ? { ...b, likelihood: live.likelihood } : b;
      });

      if (newBrackets.length === 0) return updated;

      const merged = [...updated, ...newBrackets];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore quota errors
      }
      return merged;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [survivors]);

  // Compute survival state from current results
  const completedResults = results.filter((r) => r.winner);
  const winnersByGame = new Map(completedResults.map((r) => [r.game_index, r.winner as string]));
  const completionTimeByGame = new Map(completedResults.map((r) => [r.game_index, r.updated_at]));

  const colors = assignColors(stored);

  return stored.map((bracket) => {
    const picksMap = new Map(bracket.picks.map((p) => [p.game_index, p]));

    // Find the chronologically first game where this bracket's pick was wrong.
    // Use updated_at from results for ordering; fall back to game_index if unavailable.
    let eliminatedAtGame: number | null = null;
    let eliminatedAtTime: string | null = null;
    for (const pick of bracket.picks) {
      const winner = winnersByGame.get(pick.game_index);
      if (!winner || winner === pick.pick) continue;
      const t = completionTimeByGame.get(pick.game_index) ?? null;
      if (
        eliminatedAtGame === null ||
        (t && eliminatedAtTime && t < eliminatedAtTime) ||
        (t && !eliminatedAtTime) ||
        (!t && !eliminatedAtTime && pick.game_index < eliminatedAtGame)
      ) {
        eliminatedAtGame = pick.game_index;
        eliminatedAtTime = t;
      }
    }

    const [team1, team2] = bracket.championshipGame;
    const opponent = team1 === bracket.championPick ? team2 : team1;

    return {
      index: bracket.index,
      label: getBracketLabel(bracket),
      championPick: bracket.championPick,
      opponent,
      color: colors.get(bracket.index) ?? "#6B7280",
      likelihood: bracket.likelihood,
      picks: picksMap,
      eliminatedAtGame,
    };
  });
}
