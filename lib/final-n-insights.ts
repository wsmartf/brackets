import {
  extractScheduledTournamentGames,
  fetchScoreboard,
  getScoreboardCalendarDateKeys,
  mapEspnTeamName,
} from "./espn";
import {
  buildCurrentGameDefinitions,
  buildMatchupProbabilityTable,
  getBracketSurvivalState,
  getInitialOrder,
  reconstructBracket,
} from "./tournament";
import { getResults, getSurvivorCount, getSurvivorIndices } from "./db";

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

const MAX_SCOREBOARD_DAYS = 6;
const PLACEHOLDER_PREFIX = "Winner of Game";

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function matchupKey(team1: string, team2: string): string {
  return [team1, team2].sort((a, b) => a.localeCompare(b)).join("::");
}

function isKnownUpcomingGame(
  game: { game_index: number; team1: string; team2: string },
  resultByGame: Map<number, GameResultLike>
): boolean {
  const result = resultByGame.get(game.game_index);
  return (
    result?.winner == null &&
    !game.team1.startsWith(PLACEHOLDER_PREFIX) &&
    !game.team2.startsWith(PLACEHOLDER_PREFIX)
  );
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

async function fetchMappedUpcomingSchedule(
  results: GameResultLike[]
): Promise<Array<{ gameIndex: number; scheduledAt: string }>> {
  const formatLocalDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}${month}${day}`;
  };

  const resultByGame = new Map(results.map((result) => [result.game_index, result]));
  const localUpcomingGames = buildCurrentGameDefinitions(results).filter((game) =>
    isKnownUpcomingGame(game, resultByGame)
  );
  const candidateNames = localUpcomingGames.flatMap((game) => [game.team1, game.team2]);
  const localGameByMatchup = new Map(
    localUpcomingGames.map((game) => [matchupKey(game.team1, game.team2), game])
  );

  const todayKey = formatLocalDateKey(new Date());
  const initialScoreboard = await fetchScoreboard(todayKey);
  const calendarKeys = getScoreboardCalendarDateKeys(initialScoreboard)
    .filter((dateKey) => dateKey >= todayKey)
    .filter((dateKey, index, values) => values.indexOf(dateKey) === index);
  const dateKeys = [todayKey, ...calendarKeys.filter((dateKey) => dateKey !== todayKey)].slice(
    0,
    MAX_SCOREBOARD_DAYS
  );

  const scheduledGames = extractScheduledTournamentGames(initialScoreboard);
  for (const dateKey of dateKeys.slice(1)) {
    const scoreboard = await fetchScoreboard(dateKey);
    scheduledGames.push(...extractScheduledTournamentGames(scoreboard));
  }

  const seen = new Set<number>();
  const mapped: Array<{ gameIndex: number; scheduledAt: string }> = [];

  for (const scheduledGame of scheduledGames) {
    const team1 = mapEspnTeamName(scheduledGame.team1, { candidateNames });
    const team2 = mapEspnTeamName(scheduledGame.team2, { candidateNames });
    if (!team1 || !team2 || team1 === team2) {
      continue;
    }

    const localGame = localGameByMatchup.get(matchupKey(team1, team2));
    if (!localGame || seen.has(localGame.game_index)) {
      continue;
    }

    seen.add(localGame.game_index);
    mapped.push({
      gameIndex: localGame.game_index,
      scheduledAt: scheduledGame.eventDate,
    });
  }

  return mapped.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export async function buildFinalNInsights(): Promise<FinalNInsights | null> {
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

  try {
    const scheduledGames = await fetchMappedUpcomingSchedule(results);
    const nextScheduledAt = scheduledGames[0]?.scheduledAt ?? null;
    if (nextScheduledAt) {
      const nextLabel = formatDateLabel(nextScheduledAt);
      const nextDateGameIndices = scheduledGames
        .filter((game) => formatDateLabel(game.scheduledAt) === nextLabel)
        .map((game) => game.gameIndex)
        .sort((a, b) => a - b);

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
  } catch (error) {
    console.error("Failed to build next-date Final N insights:", error);
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

export const __testExports = {
  buildPatternKey,
  computeBestCaseSurvivorCount,
  computePatternProbability,
  computeMilestoneProbability,
};
