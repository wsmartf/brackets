import { addAuditLog, getResults, setResult } from "./db";
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
      },
      {
        name: "Howard",
        seed: 16,
        region: "Midwest",
        kenpomRank: 207,
        netRating: -3.19,
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
      },
      {
        name: "NC State",
        seed: 11,
        region: "West",
        kenpomRank: 34,
        netRating: 19.6,
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
      },
      {
        name: "Lehigh",
        seed: 16,
        region: "South",
        kenpomRank: 284,
        netRating: -10.37,
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
      },
      {
        name: "Miami OH",
        seed: 11,
        region: "Midwest",
        kenpomRank: 93,
        netRating: 8.26,
      },
    ],
  },
];

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
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?dates=${date}&groups=100&limit=100`;

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
  applied: number;
  skipped: number;
  finalResultsSeen: number;
}

export async function fetchAndApplyEspnResults(daysBack = 4): Promise<EspnSyncSummary> {
  const dateStrings = getRecentDateStrings(daysBack);
  const scoreboards = await Promise.all(dateStrings.map((date) => fetchScoreboard(date)));
  const dedupedResults = new Map<string, ESPNGameResult>();

  for (const scoreboard of scoreboards) {
    for (const result of extractResults(scoreboard)) {
      dedupedResults.set(result.id, result);
    }
  }

  let results = getResults();
  let gameDefinitions = buildCurrentGameDefinitions(results);
  let applied = 0;
  let skipped = 0;

  for (const espnResult of dedupedResults.values()) {
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

    applyPlayInWinnerIfNeeded(team1, team2, winner);
    results = getResults();
    gameDefinitions = buildCurrentGameDefinitions(results);

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

    setResult(matchingGame.game_index, matchingGame.round, matchingGame.team1, matchingGame.team2, winner, {
      source: "espn",
      manualOverride: false,
    });
    addAuditLog("espn_result_applied", {
      gameIndex: matchingGame.game_index,
      round: matchingGame.round,
      team1: matchingGame.team1,
      team2: matchingGame.team2,
      winner,
      espnResultId: espnResult.id,
      score1: espnResult.score1,
      score2: espnResult.score2,
    });
    applied++;

    results = getResults();
    gameDefinitions = buildCurrentGameDefinitions(results);
  }

  return {
    applied,
    skipped,
    finalResultsSeen: dedupedResults.size,
  };
}

function applyPlayInWinnerIfNeeded(team1: string, team2: string, winner: string): void {
  const slot = PLAY_IN_SLOTS.find((candidateSlot) => {
    const candidateNames = new Set(candidateSlot.candidates.map((candidate) => candidate.name));
    return candidateNames.has(team1) && candidateNames.has(team2);
  });

  if (!slot) {
    return;
  }

  const winningTeam = slot.candidates.find((candidate) => candidate.name === winner);
  if (!winningTeam) {
    return;
  }

  addAuditLog("play_in_result_seen", {
    placeholder: slot.placeholder,
    team1,
    team2,
    winner,
  });

  if (winner === slot.placeholder) {
    return;
  }

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
}

// ============================================================
// Types (minimal, just what we need from ESPN's response)
// ============================================================

export interface ESPNScoreboard {
  events?: ESPNEvent[];
}

interface ESPNEvent {
  id: string;
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
  team1: string;
  team2: string;
  winner: string;
  score1: number;
  score2: number;
  seed1: number | null;
  seed2: number | null;
}
