import { addAuditLog, enqueueResultEvent, getResults, setResult } from "./db";
import {
  buildCurrentGameDefinitions,
  Team,
  resetTournamentCaches,
} from "./tournament";

interface PlayInSlot {
  placeholder: string;
  roundOf64GameIndex: number;
  roundOf64Team1: string;
  candidates: Team[];
}

const PLAY_IN_SLOTS: PlayInSlot[] = [
  {
    placeholder: "UMBC",
    roundOf64GameIndex: 16,
    roundOf64Team1: "Michigan",
    candidates: [
      {
        name: "UMBC",
        seed: 16,
        region: "Midwest",
        kenpomRank: 185,
        netRating: -1.67,
        offenseRating: 108.8,
        defenseRating: 110.8,
        adjTempo: 66.3,
        scheduleNetRating: -14.48,
      },
      {
        name: "Howard",
        seed: 16,
        region: "Midwest",
        kenpomRank: 207,
        netRating: -2.92,
        offenseRating: 104.1,
        defenseRating: 107.0,
        adjTempo: 69.1,
        scheduleNetRating: -14.04,
      },
    ],
  },
  {
    placeholder: "Texas",
    roundOf64GameIndex: 12,
    roundOf64Team1: "BYU",
    candidates: [
      {
        name: "Texas",
        seed: 11,
        region: "West",
        kenpomRank: 37,
        netRating: 19.03,
        offenseRating: 125.0,
        defenseRating: 105.9,
        adjTempo: 66.9,
        scheduleNetRating: 13.72,
      },
      {
        name: "NC State",
        seed: 11,
        region: "West",
        kenpomRank: 34,
        netRating: 19.62,
        offenseRating: 124.1,
        defenseRating: 104.4,
        adjTempo: 69.1,
        scheduleNetRating: 11.99,
      },
    ],
  },
  {
    placeholder: "Prairie View A&M",
    roundOf64GameIndex: 24,
    roundOf64Team1: "Florida",
    candidates: [
      {
        name: "Prairie View A&M",
        seed: 16,
        region: "South",
        kenpomRank: 288,
        netRating: -10.69,
        offenseRating: 101.2,
        defenseRating: 111.9,
        adjTempo: 71.0,
        scheduleNetRating: -9.56,
      },
      {
        name: "Lehigh",
        seed: 16,
        region: "South",
        kenpomRank: 284,
        netRating: -10.41,
        offenseRating: 102.7,
        defenseRating: 113.1,
        adjTempo: 66.9,
        scheduleNetRating: -8.65,
      },
    ],
  },
  {
    placeholder: "SMU",
    roundOf64GameIndex: 20,
    roundOf64Team1: "Tennessee",
    candidates: [
      {
        name: "SMU",
        seed: 11,
        region: "Midwest",
        kenpomRank: 42,
        netRating: 18.09,
        offenseRating: 122.9,
        defenseRating: 104.8,
        adjTempo: 68.6,
        scheduleNetRating: 11.16,
      },
      {
        name: "Miami OH",
        seed: 11,
        region: "Midwest",
        kenpomRank: 93,
        netRating: 8.24,
        offenseRating: 116.8,
        defenseRating: 108.5,
        adjTempo: 70.0,
        scheduleNetRating: -5.37,
      },
    ],
  },
];

const DEFAULT_SCOREBOARD_BASE_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";

/**
 * Fetch the ESPN scoreboard for a given date.
 *
 * @param date - Date string in YYYYMMDD format (e.g., "20260319")
 * @returns Parsed ESPN scoreboard response
 *
 * ESPN response structure (simplified):
 * {
 *   events: [{
 *     id: string,
 *     name: "Duke Blue Devils at Vermont Catamounts",
 *     status: { type: { name: "STATUS_FINAL" } },
 *     competitions: [{
 *       competitors: [
 *         { team: { displayName: "Duke Blue Devils", abbreviation: "DUKE" },
 *           score: "78", winner: true, curatedRank: { current: 1 },
 *           // seed may be in a different location for tournament games
 *         },
 *         { team: { displayName: "Vermont Catamounts", abbreviation: "UVM" },
 *           score: "54", winner: false,
 *         }
 *       ]
 *     }]
 *   }]
 * }
 */
export async function fetchScoreboard(date: string): Promise<ESPNScoreboard> {
  const configuredBaseUrl =
    process.env.ESPN_SCOREBOARD_BASE_URL?.trim() || DEFAULT_SCOREBOARD_BASE_URL;
  const url = new URL(configuredBaseUrl);
  url.searchParams.set("dates", date);
  url.searchParams.set("groups", "100");
  url.searchParams.set("limit", "100");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API returned ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Extract completed tournament game results from an ESPN scoreboard response.
 *
 * @param scoreboard - Raw ESPN API response
 * @returns Array of { team1, team2, winner, score1, score2 } for final games
 */
export function extractResults(scoreboard: ESPNScoreboard): ESPNGameResult[] {
  const results: ESPNGameResult[] = [];

  for (const event of scoreboard.events ?? []) {
    const status = event.status?.type?.name;
    if (status !== "STATUS_FINAL") continue;

    const comp = event.competitions?.[0];
    if (comp?.type?.abbreviation !== "TRNMNT") continue;
    if (!comp?.competitors || comp.competitors.length !== 2) continue;

    const [teamA, teamB] = comp.competitors;
    const nameA = teamA.team.shortDisplayName ?? teamA.team.displayName;
    const nameB = teamB.team.shortDisplayName ?? teamB.team.displayName;
    const winner = teamA.winner ? nameA : nameB;

    results.push({
      id: event.id,
      eventDate: event.date,
      team1: nameA,
      team2: nameB,
      winner,
      score1: parseInt(teamA.score, 10),
      score2: parseInt(teamB.score, 10),
      seed1: teamA.curatedRank?.current ?? null,
      seed2: teamB.curatedRank?.current ?? null,
    });
  }

  return results;
}

const ESPN_NAME_ALIASES: Record<string, string> = {
  "miami (oh)": "Miami OH",
  "miami oh": "Miami OH",
  "miami (fl)": "Miami FL",
  "n c state": "NC State",
  "nc state": "NC State",
  "st. john's": "St. John's",
  "st. mary's": "Saint Mary's",
  "saint marys": "Saint Mary's",
  "saint mary's": "Saint Mary's",
  "prairie view": "Prairie View A&M",
  "texas a&m aggies": "Texas A&M",
  "michigan st": "Michigan State",
  "n dakota st": "North Dakota State",
  "kennesaw st": "Kennesaw State",
};

function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/['’.]/g, "").replace(/\s+/g, " ").trim();
}

function mapEspnTeamName(name: string): string | null {
  const normalized = normalizeTeamName(name);
  const alias = ESPN_NAME_ALIASES[normalized];
  if (alias) {
    return alias;
  }

  const results = getResults();
  const knownNames = new Set<string>();
  for (const result of results) {
    knownNames.add(result.team1);
    knownNames.add(result.team2);
  }

  for (const knownName of knownNames) {
    if (normalizeTeamName(knownName) === normalized) {
      return knownName;
    }
  }

  for (const slot of PLAY_IN_SLOTS) {
    for (const candidate of slot.candidates) {
      if (normalizeTeamName(candidate.name) === normalized) {
        return candidate.name;
      }
    }
  }

  return null;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}

function getRecentDateStrings(daysBack: number): string[] {
  const dates: string[] = [];
  const today = new Date();

  for (let offset = 0; offset < daysBack; offset++) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(formatDate(date));
  }

  return dates;
}

export interface EspnSyncSummary {
  queued: number;
  skipped: number;
  finalResultsSeen: number;
}

export async function fetchAndQueueEspnResults(daysBack = 4): Promise<EspnSyncSummary> {
  const dateStrings = getRecentDateStrings(daysBack);
  const scoreboards = await Promise.all(dateStrings.map((date) => fetchScoreboard(date)));
  const dedupedResults = new Map<string, ESPNGameResult>();

  for (const scoreboard of scoreboards) {
    for (const result of extractResults(scoreboard)) {
      dedupedResults.set(result.id, result);
    }
  }

  const sortedResults = [...dedupedResults.values()].sort((left, right) => {
    if (left.eventDate !== right.eventDate) {
      return left.eventDate.localeCompare(right.eventDate);
    }

    return left.id.localeCompare(right.id);
  });

  let results = getResults();
  let gameDefinitions = buildCurrentGameDefinitions(results);
  let queued = 0;
  let skipped = 0;

  for (const espnResult of sortedResults) {
    const team1 = mapEspnTeamName(espnResult.team1);
    const team2 = mapEspnTeamName(espnResult.team2);
    const winner = mapEspnTeamName(espnResult.winner);

    if (!team1 || !team2 || !winner) {
      skipped++;
      addAuditLog("espn_result_skipped", {
        reason: "team_mapping_failed",
        espnResult,
      });
      continue;
    }

    const playInHandling = applyPlayInWinnerIfNeeded(team1, team2, winner);
    results = getResults();
    gameDefinitions = buildCurrentGameDefinitions(results);

    if (playInHandling.handled) {
      continue;
    }

    const matchingGame = gameDefinitions.find(
      (game) =>
        (game.team1 === team1 && game.team2 === team2) ||
        (game.team1 === team2 && game.team2 === team1)
    );

    if (!matchingGame) {
      skipped++;
      addAuditLog("espn_result_skipped", {
        reason: "no_matching_game",
        team1,
        team2,
        winner,
        espnResultId: espnResult.id,
      });
      continue;
    }

    const currentResult = results.find((result) => result.game_index === matchingGame.game_index);
    if (!currentResult) {
      skipped++;
      continue;
    }

    if (currentResult.manual_override) {
      skipped++;
      addAuditLog("espn_result_skipped", {
        reason: "manual_override",
        gameIndex: matchingGame.game_index,
        team1: matchingGame.team1,
        team2: matchingGame.team2,
        winner,
      });
      continue;
    }

    if (winner !== matchingGame.team1 && winner !== matchingGame.team2) {
      skipped++;
      addAuditLog("espn_result_skipped", {
        reason: "winner_not_in_matchup",
        gameIndex: matchingGame.game_index,
        team1: matchingGame.team1,
        team2: matchingGame.team2,
        winner,
      });
      continue;
    }

    if (
      currentResult.winner === winner &&
      currentResult.team1 === matchingGame.team1 &&
      currentResult.team2 === matchingGame.team2
    ) {
      continue;
    }

    const wasQueued = enqueueResultEvent({
      gameIndex: matchingGame.game_index,
      round: matchingGame.round,
      team1: matchingGame.team1,
      team2: matchingGame.team2,
      winner,
      source: "espn",
      espnEventId: espnResult.id,
    });
    if (wasQueued) {
      addAuditLog("espn_result_queued", {
        gameIndex: matchingGame.game_index,
        round: matchingGame.round,
        team1: matchingGame.team1,
        team2: matchingGame.team2,
        winner,
        espnResultId: espnResult.id,
        score1: espnResult.score1,
        score2: espnResult.score2,
      });
      queued++;
    }

    results = getResults();
    gameDefinitions = buildCurrentGameDefinitions(results);
  }

  return {
    queued,
    skipped,
    finalResultsSeen: dedupedResults.size,
  };
}

function applyPlayInWinnerIfNeeded(
  team1: string,
  team2: string,
  winner: string
): { handled: boolean } {
  const slot = PLAY_IN_SLOTS.find((candidateSlot) => {
    const candidateNames = new Set(candidateSlot.candidates.map((candidate) => candidate.name));
    return candidateNames.has(team1) && candidateNames.has(team2);
  });

  if (!slot) {
    return { handled: false };
  }

  const winningTeam = slot.candidates.find((candidate) => candidate.name === winner);
  if (!winningTeam) {
    return { handled: false };
  }

  if (winner === slot.placeholder) {
    return { handled: true };
  }

  const currentRoundOf64Result = getResults().find(
    (result) => result.game_index === slot.roundOf64GameIndex
  );

  if (
    currentRoundOf64Result?.round === 64 &&
    currentRoundOf64Result.team1 === slot.roundOf64Team1 &&
    currentRoundOf64Result.team2 === winningTeam.name &&
    currentRoundOf64Result.source === "play_in" &&
    currentRoundOf64Result.manual_override === 0
  ) {
    return { handled: true };
  }

  addAuditLog("play_in_result_seen", {
    placeholder: slot.placeholder,
    team1,
    team2,
    winner,
  });

  setResult(slot.roundOf64GameIndex, 64, slot.roundOf64Team1, winningTeam.name, null, {
    source: "play_in",
    manualOverride: false,
  });
  resetTournamentCaches();
  addAuditLog("play_in_override_applied", {
    placeholder: slot.placeholder,
    replacement: winningTeam.name,
    roundOf64GameIndex: slot.roundOf64GameIndex,
  });

  return { handled: true };
}

// ============================================================
// Types (minimal, just what we need from ESPN's response)
// ============================================================

export interface ESPNScoreboard {
  events?: ESPNEvent[];
}

interface ESPNEvent {
  id: string;
  date: string;
  name: string;
  status?: { type?: { name: string } };
  competitions?: ESPNCompetition[];
}

interface ESPNCompetition {
  type?: { abbreviation?: string };
  competitors?: ESPNCompetitor[];
}

interface ESPNCompetitor {
  team: { displayName: string; shortDisplayName?: string; abbreviation: string };
  score: string;
  winner: boolean;
  curatedRank?: { current: number };
}

export interface ESPNGameResult {
  id: string;
  eventDate: string;
  team1: string;
  team2: string;
  winner: string;
  score1: number;
  score2: number;
  seed1: number | null;
  seed2: number | null;
}
