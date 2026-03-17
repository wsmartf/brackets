/**
 * Tournament data loading and probability computation.
 *
 * This module handles:
 * 1. Loading the static tournament data (teams, seeds, regions, KenPom ranks)
 * 2. Computing the canonical initial order of 64 teams
 * 3. Computing win probabilities for each possible matchup
 *
 * IMPORTANT: The "initial order" defines how teams map to bit positions.
 * It must be consistent everywhere — generation, filtering, and display.
 */

import { readFileSync } from "fs";
import { join } from "path";
import Database from "better-sqlite3";

// ============================================================
// Types
// ============================================================

export interface Team {
  name: string;
  seed: number;
  region: string;
  /** KenPom ordinal rank (1 = best). Kept for reference/display. */
  kenpomRank: number;
  /**
   * KenPom AdjEM (adjusted efficiency margin) — points per 100 possessions
   * above an average D1 team. Duke 2026 = 38.9, average mid-major ≈ 5-10.
   * This is what drives the win probability model.
   */
  netRating: number;
}

export interface Tournament {
  year: number;
  regions: string[];
  teams: Team[];
}

export interface GameDefinition {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
}

export interface GameResultLike {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
}

// ============================================================
// Constants
// ============================================================

/**
 * Steepness of the logistic function for win probability.
 * Uses KenPom AdjEM (net rating) directly as input.
 *
 * Calibrated against historical NCAA tournament upset rates:
 *   BETA=0.07 produces:
 *   - 1v16 (rating diff ~40): ~95% (historical: ~98.5%)
 *   - 5v12 (rating diff ~14): ~73% (historical: ~65%)
 *   - 8v9  (rating diff ~5):  ~58% (historical: ~53%)
 *   - 4v13 (rating diff ~18): ~78% (historical: ~80%)
 *
 * A single beta can't perfectly fit all matchup types. This is a reasonable
 * compromise that produces brackets with realistic upset frequency.
 * A more sophisticated model would use a lookup table per seed matchup,
 * but this is good enough for V1.
 */
const BETA = 0.07;

/**
 * Standard NCAA bracket matchup order within each region.
 * Seeds are paired: (1v16), (8v9), (5v12), (4v13), (6v11), (3v14), (7v10), (2v15)
 * This is the standard order used by the NCAA for bracket positioning.
 */
const SEED_MATCHUP_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15];

// ============================================================
// Data Loading
// ============================================================

let _cachedTournament: Tournament | null = null;
let _cachedMatchupProbabilityTable: number[] | null = null;
let _cachedInitialOrder: string[] | null = null;
const PLAY_IN_TEAM_BY_NAME: Record<string, Team> = {
  Howard: {
    name: "Howard",
    seed: 16,
    region: "Midwest",
    kenpomRank: 207,
    netRating: -3.19,
  },
  "NC State": {
    name: "NC State",
    seed: 11,
    region: "West",
    kenpomRank: 34,
    netRating: 19.6,
  },
  Lehigh: {
    name: "Lehigh",
    seed: 16,
    region: "South",
    kenpomRank: 284,
    netRating: -10.37,
  },
  "Miami OH": {
    name: "Miami OH",
    seed: 11,
    region: "Midwest",
    kenpomRank: 93,
    netRating: 8.26,
  },
};

const PLAY_IN_SLOT_ROWS = [
  { gameIndex: 12, placeholder: "Texas" },
  { gameIndex: 16, placeholder: "UMBC" },
  { gameIndex: 20, placeholder: "SMU" },
  { gameIndex: 24, placeholder: "Prairie View A&M" },
];

/**
 * Load tournament data from the JSON file.
 * Caches after first load.
 */
export function loadTournament(): Tournament {
  if (_cachedTournament) return _cachedTournament;

  const filePath = join(process.cwd(), "data", "tournament-2026.json");
  const raw = readFileSync(filePath, "utf-8");
  _cachedTournament = JSON.parse(raw) as Tournament;
  return _cachedTournament;
}

export function resetTournamentCaches(): void {
  _cachedInitialOrder = null;
  _cachedMatchupProbabilityTable = null;
}

function getTournamentTeams(): Team[] {
  const tournament = loadTournament();
  const overrides = readPlayInRowOverrides();

  return tournament.teams.map((team) => overrides[team.name] ?? team);
}

// ============================================================
// Initial Order
// ============================================================

/**
 * Get the canonical initial order of 64 teams.
 *
 * Order is: for each region (in tournament.regions order),
 * list teams in seed matchup order (1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15).
 *
 * This produces 64 teams where consecutive pairs are first-round opponents:
 *   [0] vs [1] = 1-seed vs 16-seed in region 1
 *   [2] vs [3] = 8-seed vs 9-seed in region 1
 *   ...
 *   [16] vs [17] = 1-seed vs 16-seed in region 2
 *   ...etc
 *
 * @returns Array of 64 team names in canonical order
 */
export function getInitialOrder(): string[] {
  if (_cachedInitialOrder) {
    return _cachedInitialOrder;
  }

  const tournament = loadTournament();
  const teams = getTournamentTeams();
  const order: string[] = [];

  for (const region of tournament.regions) {
    const regionTeams = teams.filter((t) => t.region === region);
    for (const seed of SEED_MATCHUP_ORDER) {
      const team = regionTeams.find((t) => t.seed === seed);
      if (!team) {
        throw new Error(`Missing seed ${seed} in region ${region}`);
      }
      order.push(team.name);
    }
  }

  if (order.length !== 64) {
    throw new Error(`Expected 64 teams, got ${order.length}`);
  }
  _cachedInitialOrder = order;
  return order;
}

// ============================================================
// Win Probability
// ============================================================

/**
 * Compute win probability for team A vs team B using KenPom AdjEM.
 * Higher netRating = better team. Uses logistic function on rating difference.
 *
 * @param netRatingA - KenPom AdjEM of team A (e.g. 38.9 for Duke)
 * @param netRatingB - KenPom AdjEM of team B
 * @returns Probability that team A wins (0 to 1)
 */
export function computeProbability(netRatingA: number, netRatingB: number): number {
  const diff = netRatingA - netRatingB;
  return 1 / (1 + Math.exp(-BETA * diff));
}

/**
 * Build a full `64 x 64` probability table keyed by initial-order team index.
 *
 * table[a * 64 + b] = P(team a beats team b)
 *
 * This lets the worker dynamically evaluate later-round matchups without
 * recomputing logistic probabilities in the hot loop.
 */
export function buildMatchupProbabilityTable(): number[] {
  if (_cachedMatchupProbabilityTable) {
    return _cachedMatchupProbabilityTable;
  }

  const initialOrder = getInitialOrder();
  const teamsByName = new Map(getTournamentTeams().map((team) => [team.name, team]));
  const table = new Array<number>(64 * 64).fill(0.5);

  for (let a = 0; a < initialOrder.length; a++) {
    const teamA = teamsByName.get(initialOrder[a]);
    if (!teamA) {
      throw new Error(`Missing tournament team: ${initialOrder[a]}`);
    }

    for (let b = 0; b < initialOrder.length; b++) {
      if (a === b) {
        continue;
      }

      const teamB = teamsByName.get(initialOrder[b]);
      if (!teamB) {
        throw new Error(`Missing tournament team: ${initialOrder[b]}`);
      }

      table[a * 64 + b] = computeProbability(teamA.netRating, teamB.netRating);
    }
  }

  _cachedMatchupProbabilityTable = table;
  return table;
}

function readPlayInRowOverrides(): Record<string, Team> {
  const dbPath = join(process.cwd(), "march-madness.db");

  try {
    const db = new Database(dbPath, { readonly: true });
    const rows = db
      .prepare(
        `SELECT game_index, team2
         FROM results
         WHERE game_index IN (12, 16, 20, 24)`
      )
      .all() as Array<{ game_index: number; team2: string }>;
    db.close();

    const overrides: Record<string, Team> = {};

    for (const slot of PLAY_IN_SLOT_ROWS) {
      const row = rows.find((candidate) => candidate.game_index === slot.gameIndex);
      if (!row || row.team2 === slot.placeholder) {
        continue;
      }

      const replacement = PLAY_IN_TEAM_BY_NAME[row.team2];
      if (replacement) {
        overrides[slot.placeholder] = replacement;
      }
    }

    return overrides;
  } catch {
    return {};
  }
}

/**
 * Build the canonical list of 63 tournament game slots.
 *
 * First-round games use real team names. Later rounds are seeded with stable
 * placeholder labels so the DB has all rows from the start.
 */
export function buildGameDefinitions(): GameDefinition[] {
  const initialOrder = getInitialOrder();
  return buildGameDefinitionsFromParticipants(initialOrder);
}

/**
 * Build the current game slots based on known winners.
 *
 * When prior-round winners are known, later-round placeholder labels are
 * replaced with the actual advancing team names.
 */
export function buildCurrentGameDefinitions(results: GameResultLike[]): GameDefinition[] {
  const winnersByGame = new Map(results.map((result) => [result.game_index, result.winner]));
  const initialOrder = getInitialOrder();
  const definitions = buildGameDefinitionsFromParticipants(initialOrder);

  for (const game of definitions) {
    const winner = winnersByGame.get(game.game_index);
    if (!winner) {
      continue;
    }

    const nextGameIndex = getNextGameIndex(game.game_index);
    if (nextGameIndex === null) {
      continue;
    }

    const nextGame = definitions[nextGameIndex];
    if (game.game_index % 2 === 0) {
      nextGame.team1 = winner;
    } else {
      nextGame.team2 = winner;
    }
  }

  return definitions;
}

function buildGameDefinitionsFromParticipants(initialParticipants: string[]): GameDefinition[] {
  const definitions: GameDefinition[] = [];
  const rounds = [64, 32, 16, 8, 4, 2];
  let participants = [...initialParticipants];
  let gameIndex = 0;

  for (const round of rounds) {
    const nextParticipants: string[] = [];

    for (let i = 0; i < participants.length; i += 2) {
      definitions.push({
        game_index: gameIndex,
        round,
        team1: participants[i],
        team2: participants[i + 1],
      });
      nextParticipants.push(`Winner of Game ${gameIndex}`);
      gameIndex++;
    }

    participants = nextParticipants;
  }

  return definitions;
}

function getNextGameIndex(gameIndex: number): number | null {
  if (gameIndex < 32) return 32 + Math.floor(gameIndex / 2);
  if (gameIndex < 48) return 48 + Math.floor((gameIndex - 32) / 2);
  if (gameIndex < 56) return 56 + Math.floor((gameIndex - 48) / 2);
  if (gameIndex < 60) return 60 + Math.floor((gameIndex - 56) / 2);
  if (gameIndex < 62) return 62;
  return null;
}

/**
 * Given results stored in the DB, compute the bitmask pair (mask + value)
 * for filtering brackets.
 *
 * @param results - Array of { game_index, winner } from the database.
 *   winner being team1 or team2 in canonical order determines the bit value.
 * @param initialOrder - The 64-team canonical order
 * @returns { maskLo, maskHi, valueLo, valueHi }
 */
export function computeBitmasks(
  results: { game_index: number; team1: string; team2: string; winner: string | null }[]
): { maskLo: number; maskHi: number; valueLo: number; valueHi: number } {
  let maskLo = 0,
    maskHi = 0,
    valueLo = 0,
    valueHi = 0;

  for (const r of results) {
    if (!r.winner) continue; // game not yet played

    const gi = r.game_index;
    // Determine which team is "team2" in canonical order for this game.
    // If team2 won, the bit is 1. If team1 won, the bit is 0.
    const team2Won = r.winner === r.team2 ? 1 : 0;

    if (gi < 32) {
      maskLo |= 1 << gi;
      if (team2Won) valueLo |= 1 << gi;
    } else {
      maskHi |= 1 << (gi - 32);
      if (team2Won) valueHi |= 1 << (gi - 32);
    }
  }

  return { maskLo, maskHi, valueLo, valueHi };
}
