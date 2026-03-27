import type { SurvivorBracketSummary } from "./survivor-brackets";

export interface PathBracket {
  index: number;
  championPick: string;
  opponent: string;
  color: string;
  likelihood: number;
  picks: Map<number, SurvivorBracketSummary["picks"][number]>;
  eliminatedAtGame: number | null;
}

// The Final Five path chart is intentionally scoped to Sweet 16 and later.
const PATH_ROUND_MAX = 16;

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

export function assignPathBracketColors(
  brackets: SurvivorBracketSummary[]
): Map<number, string> {
  const sorted = [...brackets].sort((a, b) => a.index - b.index);
  const championCount = new Map<string, number>();
  const result = new Map<number, string>();
  let fallbackIdx = 0;

  for (const bracket of sorted) {
    const count = championCount.get(bracket.championPick) ?? 0;
    const palette = CHAMPION_COLOR_PALETTES[bracket.championPick] ?? FALLBACK_COLORS;
    result.set(
      bracket.index,
      palette[count] ?? FALLBACK_COLORS[fallbackIdx++ % FALLBACK_COLORS.length]
    );
    championCount.set(bracket.championPick, count + 1);
  }

  return result;
}

export function buildPathBrackets(
  brackets: SurvivorBracketSummary[],
  colors = assignPathBracketColors(brackets)
): PathBracket[] {
  return brackets.map((bracket) => {
    const [team1, team2] = bracket.championshipGame;
    const opponent = team1 === bracket.championPick ? team2 : team1;

    return {
      index: bracket.index,
      championPick: bracket.championPick,
      opponent,
      color: colors.get(bracket.index) ?? "#6B7280",
      likelihood: bracket.likelihood,
      picks: new Map(
        bracket.picks
          .filter((pick) => pick.round <= PATH_ROUND_MAX)
          .map((pick) => [pick.game_index, pick])
      ),
      eliminatedAtGame: bracket.eliminatedBy?.game_index ?? null,
    };
  });
}
