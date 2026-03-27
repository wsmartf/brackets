import {
  buildCurrentGameDefinitions,
  buildMatchupProbabilityTable,
  getBracketSurvivalState,
  getInitialOrder,
  reconstructBracket,
} from "./tournament";
import { getResults, getSurvivorCount, getSurvivorIndices } from "./db";
import { fetchPendingGames, type PendingGameRow } from "./pending-games";

interface GameResultLike {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
}

interface SurvivorPatternBracket {
  index: number;
  picks: Array<{
    game_index: number;
    round: number;
    team1: string;
    team2: string;
    pick: string;
    result: "alive" | "dead" | "pending";
  }>;
}

export interface FinalNInsightMilestone {
  id: string;
  label: string;
  probability: number;
}

export interface FinalNInsights {
  bestCaseAfter: {
    label: string;
    remaining: number;
  } | null;
  milestones: FinalNInsightMilestone[];
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function buildPatternKey(
  picks: SurvivorPatternBracket["picks"],
  gameIndices: number[]
): string {
  return gameIndices
    .map((gameIndex) => `${gameIndex}:${picks.find((pick) => pick.game_index === gameIndex)?.pick ?? ""}`)
    .join("|");
}

function computeBestCaseSurvivorCount(
  brackets: SurvivorPatternBracket[],
  gameIndices: number[]
): number {
  if (gameIndices.length === 0 || brackets.length === 0) {
    return brackets.length;
  }

  const counts = new Map<string, number>();
  for (const bracket of brackets) {
    const key = buildPatternKey(bracket.picks, gameIndices);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Math.max(...counts.values());
}

function computePatternProbability(
  picks: SurvivorPatternBracket["picks"],
  gameIndices: number[],
  baseResults: GameResultLike[],
  probabilityTable: number[],
  teamNameToIndex: Map<string, number>
): number {
  const simulatedResults = baseResults.map((result) => ({ ...result }));
  let probability = 1;

  for (const gameIndex of [...gameIndices].sort((a, b) => a - b)) {
    const definitions = buildCurrentGameDefinitions(simulatedResults);
    const game = definitions.find((candidate) => candidate.game_index === gameIndex);
    const pick = picks.find((candidate) => candidate.game_index === gameIndex);

    if (!game || !pick || (pick.pick !== game.team1 && pick.pick !== game.team2)) {
      return 0;
    }

    const winnerIndex = teamNameToIndex.get(pick.pick);
    const opponent = pick.pick === game.team1 ? game.team2 : game.team1;
    const opponentIndex = teamNameToIndex.get(opponent);

    if (winnerIndex == null || opponentIndex == null) {
      return 0;
    }

    probability *= probabilityTable[winnerIndex * 64 + opponentIndex];
    simulatedResults.push({
      game_index: game.game_index,
      round: game.round,
      team1: game.team1,
      team2: game.team2,
      winner: pick.pick,
    });
  }

  return probability;
}

function computeMilestoneProbability(
  brackets: SurvivorPatternBracket[],
  gameIndices: number[],
  baseResults: GameResultLike[],
  probabilityTable: number[],
  teamNameToIndex: Map<string, number>
): number {
  if (brackets.length === 0) {
    return 0;
  }

  if (gameIndices.length === 0) {
    return 1;
  }

  const seen = new Set<string>();
  let totalProbability = 0;

  for (const bracket of brackets) {
    const key = buildPatternKey(bracket.picks, gameIndices);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    totalProbability += computePatternProbability(
      bracket.picks,
      gameIndices,
      baseResults,
      probabilityTable,
      teamNameToIndex
    );
  }

  return totalProbability;
}

export function buildFinalNInsightsFromPendingGames(
  pendingGames: PendingGameRow[]
): FinalNInsights | null {
  const total = getSurvivorCount();
  if (total === 0 || total > 20) {
    return null;
  }

  const results = getResults();
  const indices = getSurvivorIndices({ limit: total, offset: 0 });
  const brackets: SurvivorPatternBracket[] = indices.map((index) => {
    const bracket = reconstructBracket(index);
    const survivalState = getBracketSurvivalState(bracket, results);
    return {
      index,
      picks: survivalState.picks,
    };
  });

  const pendingGameIndices = Array.from(
    new Set(
      brackets.flatMap((bracket) =>
        bracket.picks.filter((pick) => pick.result === "pending").map((pick) => pick.game_index)
      )
    )
  ).sort((a, b) => a - b);

  // All pending games before the Final Four (rounds > 4: S16, E8)
  const preF4Pending = Array.from(
    new Set(
      brackets.flatMap((bracket) =>
        bracket.picks
          .filter((pick) => pick.result === "pending" && pick.round > 4)
          .map((pick) => pick.game_index)
      )
    )
  ).sort((a, b) => a - b);

  const probabilityTable = buildMatchupProbabilityTable();
  const initialOrder = getInitialOrder();
  const teamNameToIndex = new Map(initialOrder.map((name, index) => [name, index]));

  const milestones: FinalNInsightMilestone[] = [];
  let bestCaseAfter: FinalNInsights["bestCaseAfter"] = null;

  const scheduledPendingGames = pendingGames.filter((game) => game.scheduledAt);
  const nextScheduledAt = scheduledPendingGames[0]?.scheduledAt ?? null;
  if (nextScheduledAt) {
    const nextLabel = formatDateLabel(nextScheduledAt);
    const nextDateGameIndices = Array.from(
      new Set(
        scheduledPendingGames
          .filter((game) => game.scheduledAt && formatDateLabel(game.scheduledAt) === nextLabel)
          .map((game) => game.gameIndex)
      )
    ).sort((a, b) => a - b);

    if (nextDateGameIndices.length > 0) {
      bestCaseAfter = {
        label: nextLabel,
        remaining: computeBestCaseSurvivorCount(brackets, nextDateGameIndices),
      };

      milestones.push({
        id: "next-date",
        label: `Chance at least one perfect bracket remains after ${nextLabel}`,
        probability: computeMilestoneProbability(
          brackets,
          nextDateGameIndices,
          results,
          probabilityTable,
          teamNameToIndex
        ),
      });
    }
  }

  milestones.push({
    id: "final-four",
    label: "Chance at least one perfect bracket reaches the Final Four",
    probability: computeMilestoneProbability(
      brackets,
      preF4Pending,
      results,
      probabilityTable,
      teamNameToIndex
    ),
  });

  milestones.push({
    id: "championship",
    label: "Chance a perfect bracket survives through the championship",
    probability: computeMilestoneProbability(
      brackets,
      pendingGameIndices,
      results,
      probabilityTable,
      teamNameToIndex
    ),
  });

  return {
    bestCaseAfter,
    milestones,
  };
}

export async function buildFinalNInsights(): Promise<FinalNInsights | null> {
  const total = getSurvivorCount();
  if (total === 0 || total > 20) {
    return null;
  }

  try {
    const pendingGames = await fetchPendingGames(getResults());
    return buildFinalNInsightsFromPendingGames(pendingGames);
  } catch (error) {
    console.error("Failed to build Final N insights:", error);
    return buildFinalNInsightsFromPendingGames([]);
  }
}

export const __testExports = {
  buildPatternKey,
  computeBestCaseSurvivorCount,
  computePatternProbability,
  computeMilestoneProbability,
};
