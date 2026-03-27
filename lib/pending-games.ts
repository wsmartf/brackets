import {
  extractPendingTournamentGames,
  fetchScoreboard,
  getScoreboardCalendarDateKeys,
  mapEspnTeamName,
  type ESPNPendingGame,
} from "./espn";
import { buildCurrentGameDefinitions } from "./tournament";

export interface PendingGameRow {
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  phase: "live" | "upcoming" | "unknown";
  scheduledAt: string | null;
  espnEventId: string | null;
  liveDetail: string | null;
  liveSortValue: number | null;
}

interface GameResultLike {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
}

const MAX_SCOREBOARD_DAYS = 6;
const PLACEHOLDER_PREFIX = "Winner of Game";
const HALF_SECONDS = 20 * 60;

function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function matchupKey(team1: string, team2: string): string {
  return [team1, team2].sort((a, b) => a.localeCompare(b)).join("::");
}

function isKnownPendingGame(
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

export function computeLiveSortValue(game: Pick<ESPNPendingGame, "clock" | "period">): number | null {
  if (!Number.isFinite(game.clock) || !Number.isFinite(game.period)) {
    return null;
  }

  const clock = game.clock as number;
  const period = game.period as number;

  if (period <= 1) {
    return HALF_SECONDS + clock;
  }

  return clock;
}

export function sortPendingGames(rows: PendingGameRow[]): PendingGameRow[] {
  return [...rows].sort((left, right) => {
    const phaseWeight = (row: PendingGameRow) => {
      if (row.phase === "live") return 0;
      if (row.phase === "upcoming") return 1;
      return 2;
    };

    const weightDiff = phaseWeight(left) - phaseWeight(right);
    if (weightDiff !== 0) {
      return weightDiff;
    }

    if (left.phase === "live" && right.phase === "live") {
      const liveDiff = (right.liveSortValue ?? -1) - (left.liveSortValue ?? -1);
      if (liveDiff !== 0) {
        return liveDiff;
      }
    }

    if (left.phase === "upcoming" && right.phase === "upcoming") {
      const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.scheduledAt
        ? new Date(right.scheduledAt).getTime()
        : Number.POSITIVE_INFINITY;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
    }

    if (left.scheduledAt && right.scheduledAt) {
      const leftTime = new Date(left.scheduledAt).getTime();
      const rightTime = new Date(right.scheduledAt).getTime();
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }
    }

    return left.gameIndex - right.gameIndex;
  });
}

export async function fetchPendingGames(
  results: GameResultLike[]
): Promise<PendingGameRow[]> {
  const resultByGame = new Map(results.map((result) => [result.game_index, result]));
  const localPendingGames = buildCurrentGameDefinitions(results).filter((game) =>
    isKnownPendingGame(game, resultByGame)
  );

  if (localPendingGames.length === 0) {
    return [];
  }

  const candidateNames = localPendingGames.flatMap((game) => [game.team1, game.team2]);
  const localGameByMatchup = new Map(
    localPendingGames.map((game) => [matchupKey(game.team1, game.team2), game])
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

  const pendingGames = extractPendingTournamentGames(initialScoreboard);
  for (const dateKey of dateKeys.slice(1)) {
    const scoreboard = await fetchScoreboard(dateKey);
    pendingGames.push(...extractPendingTournamentGames(scoreboard));
  }

  const rows: PendingGameRow[] = [];
  const seenGames = new Set<number>();

  for (const pendingGame of pendingGames) {
    const team1 = mapEspnTeamName(pendingGame.team1, { candidateNames });
    const team2 = mapEspnTeamName(pendingGame.team2, { candidateNames });
    if (!team1 || !team2 || team1 === team2) {
      continue;
    }

    const localGame = localGameByMatchup.get(matchupKey(team1, team2));
    if (!localGame || seenGames.has(localGame.game_index)) {
      continue;
    }

    seenGames.add(localGame.game_index);
    rows.push({
      gameIndex: localGame.game_index,
      round: localGame.round,
      team1: localGame.team1,
      team2: localGame.team2,
      phase: pendingGame.state === "in" ? "live" : "upcoming",
      scheduledAt: pendingGame.eventDate,
      espnEventId: pendingGame.eventId,
      liveDetail: pendingGame.state === "in" ? pendingGame.detail : null,
      liveSortValue: pendingGame.state === "in" ? computeLiveSortValue(pendingGame) : null,
    });
  }

  for (const localGame of localPendingGames) {
    if (seenGames.has(localGame.game_index)) {
      continue;
    }

    rows.push({
      gameIndex: localGame.game_index,
      round: localGame.round,
      team1: localGame.team1,
      team2: localGame.team2,
      phase: "unknown",
      scheduledAt: null,
      espnEventId: null,
      liveDetail: null,
      liveSortValue: null,
    });
  }

  return sortPendingGames(rows);
}
