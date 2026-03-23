import { mapEspnTeamName, type ESPNScheduledGame } from "./espn";
import { buildCurrentGameDefinitions } from "./tournament";

export interface FutureKillerRow {
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  team1Count: number;
  team2Count: number;
  guaranteedKills: number;
  scheduledAt: string | null;
  espnEventId: string | null;
}

export type GamePickCounts = Record<number, [number, number]>;

interface GameResultLike {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
}

const PLACEHOLDER_PREFIX = "Winner of Game";

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

function buildRow(
  game: { game_index: number; round: number; team1: string; team2: string },
  counts: [number, number] | undefined,
  scheduledAt: string | null,
  espnEventId: string | null
): FutureKillerRow {
  const team1Count = counts?.[0] ?? 0;
  const team2Count = counts?.[1] ?? 0;

  return {
    gameIndex: game.game_index,
    round: game.round,
    team1: game.team1,
    team2: game.team2,
    team1Count,
    team2Count,
    guaranteedKills: Math.min(team1Count, team2Count),
    scheduledAt,
    espnEventId,
  };
}

function matchupKey(team1: string, team2: string): string {
  return [team1, team2].sort((a, b) => a.localeCompare(b)).join("::");
}

export function buildDerivedFutureKillerRows(
  results: GameResultLike[],
  gamePickCounts?: GamePickCounts
): FutureKillerRow[] {
  if (!gamePickCounts) {
    return [];
  }

  const resultByGame = new Map(results.map((result) => [result.game_index, result]));

  return buildCurrentGameDefinitions(results)
    .filter((game) => isKnownUpcomingGame(game, resultByGame))
    .map((game) => buildRow(game, gamePickCounts[game.game_index], null, null))
    .sort((a, b) => {
      if (b.guaranteedKills !== a.guaranteedKills) {
        return b.guaranteedKills - a.guaranteedKills;
      }

      return a.gameIndex - b.gameIndex;
    });
}

export function buildScheduledFutureKillerRows(
  results: GameResultLike[],
  gamePickCounts: GamePickCounts | undefined,
  scheduledGames: ESPNScheduledGame[],
  limit = 5
): FutureKillerRow[] {
  if (!gamePickCounts) {
    return [];
  }

  const resultByGame = new Map(results.map((result) => [result.game_index, result]));
  const localUpcomingGames = buildCurrentGameDefinitions(results).filter((game) =>
    isKnownUpcomingGame(game, resultByGame)
  );

  const candidateNames = localUpcomingGames.flatMap((game) => [game.team1, game.team2]);
  const localGameByMatchup = new Map(
    localUpcomingGames.map((game) => [matchupKey(game.team1, game.team2), game])
  );

  const rows: FutureKillerRow[] = [];
  const seenGames = new Set<number>();

  for (const scheduledGame of scheduledGames) {
    const team1 = mapEspnTeamName(scheduledGame.team1, { candidateNames });
    const team2 = mapEspnTeamName(scheduledGame.team2, { candidateNames });

    if (!team1 || !team2 || team1 === team2) {
      continue;
    }

    const game = localGameByMatchup.get(matchupKey(team1, team2));
    if (!game || seenGames.has(game.game_index)) {
      continue;
    }

    seenGames.add(game.game_index);
    rows.push(
      buildRow(game, gamePickCounts[game.game_index], scheduledGame.eventDate, scheduledGame.eventId)
    );

    if (rows.length >= limit) {
      break;
    }
  }

  return rows;
}
