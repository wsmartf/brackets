/**
 * ESPN API integration for fetching live tournament scores.
 *
 * Uses the free, unauthenticated ESPN scoreboard API:
 * https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard
 *
 * This endpoint returns JSON with game status, team names, seeds, and scores.
 * No API key required. Poll respectfully (every 60s max during games).
 *
 * IMPLEMENTATION NOTES:
 * - ESPN team names may not exactly match our tournament-2026.json names.
 *   A name mapping/fuzzy matching step may be needed.
 * - The API returns ALL college basketball games for a date, not just tournament games.
 *   Filter by checking for seed information or tournament indicator fields.
 * - Games have status: STATUS_SCHEDULED, STATUS_IN_PROGRESS, STATUS_FINAL
 * - Only process STATUS_FINAL games for result updates.
 */

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
 * Extract completed game results from an ESPN scoreboard response.
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
    if (!comp?.competitors || comp.competitors.length !== 2) continue;

    const [teamA, teamB] = comp.competitors;

    results.push({
      team1: teamA.team.displayName,
      team2: teamB.team.displayName,
      winner: teamA.winner
        ? teamA.team.displayName
        : teamB.team.displayName,
      score1: parseInt(teamA.score, 10),
      score2: parseInt(teamB.score, 10),
      // Extract seed if available (for filtering tournament games)
      seed1: teamA.curatedRank?.current ?? null,
      seed2: teamB.curatedRank?.current ?? null,
    });
  }

  return results;
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
  competitors?: ESPNCompetitor[];
}

interface ESPNCompetitor {
  team: { displayName: string; abbreviation: string };
  score: string;
  winner: boolean;
  curatedRank?: { current: number };
}

export interface ESPNGameResult {
  team1: string;
  team2: string;
  winner: string;
  score1: number;
  score2: number;
  seed1: number | null;
  seed2: number | null;
}
