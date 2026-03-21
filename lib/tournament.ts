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
import v2Model from "@/data/model-v2.json";
import { mulberry32 } from "./prng";
import { getDatabasePath } from "./runtime-paths";

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
  offenseRating: number;
  defenseRating: number;
  adjTempo: number;
  scheduleNetRating: number;
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

export interface BracketPick {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  pick: string;
}

export type BracketPickResult = "alive" | "dead" | "pending";

export interface BracketPickStatus extends BracketPick {
  winner: string | null;
  result: BracketPickResult;
}

export interface BracketSummary {
  correct: number;
  wrong: number;
  pending: number;
}

export interface EliminatedByPick {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  pick: string;
  winner: string;
}

export interface BracketSurvivalState {
  picks: BracketPickStatus[];
  alive: boolean;
  summary: BracketSummary;
  eliminated_by: EliminatedByPick | null;
}

// ============================================================
// Constants
// ============================================================

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
  "Howard": {
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
  "NC State": {
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
  "Lehigh": {
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
  "Miami OH": {
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
  _cachedTournament = null;
  _cachedInitialOrder = null;
  _cachedMatchupProbabilityTable = null;
}

function getTournamentTeams(overrides: Record<string, Team>): Team[] {
  const tournament = loadTournament();
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
  const teams = getTournamentTeams(getPlayInOverrides());
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

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function standardize(feature: keyof typeof v2Model.standardization, value: number): number {
  const { mean, std } = v2Model.standardization[feature];
  return (value - mean) / std;
}

/**
 * Compute win probability for team A vs team B using the frozen V2 logistic model.
 *
 * The model was trained offline on historical NCAA tournament games using
 * matchup feature differences. Production uses the exported coefficients and
 * standardization constants directly.
 *
 * Temperature scaling (T=1.8) is applied to the linear score before the logistic
 * to reduce over-confidence when probabilities compound across tournament rounds.
 * Per-game calibration is good at T=1.0; champion distribution matches published
 * analytics forecasts (Torvik, Silver Bulletin) at T=1.8.
 */
export function computeProbability(teamA: Team, teamB: Team): number {
  const linear =
    v2Model.bias +
    v2Model.weights.netRatingDiff *
      standardize("netRatingDiff", teamA.netRating - teamB.netRating) +
    v2Model.weights.offenseRatingDiff *
      standardize("offenseRatingDiff", teamA.offenseRating - teamB.offenseRating) +
    v2Model.weights.defenseRatingDiff *
      standardize("defenseRatingDiff", teamA.defenseRating - teamB.defenseRating) +
    v2Model.weights.adjTempoDiff *
      standardize("adjTempoDiff", teamA.adjTempo - teamB.adjTempo) +
    v2Model.weights.scheduleNetRatingDiff *
      standardize(
        "scheduleNetRatingDiff",
        teamA.scheduleNetRating - teamB.scheduleNetRating
      ) +
    v2Model.weights.seedNumDiff *
      standardize("seedNumDiff", teamA.seed - teamB.seed);

  return logistic(linear / v2Model.temperature);
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
  const teamsByName = new Map(getTournamentTeams(getPlayInOverrides()).map((team) => [team.name, team]));
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

      table[a * 64 + b] = computeProbability(teamA, teamB);
    }
  }

  _cachedMatchupProbabilityTable = table;
  return table;
}

/**
 * Reconstruct a single deterministic bracket from its index.
 *
 * This replays the same round-by-round matchup path the worker uses, so
 * later-round probabilities depend on the winners already chosen earlier
 * in this specific bracket.
 */
export function reconstructBracket(index: number): BracketPick[] {
  const initialOrder = getInitialOrder();
  const matchupProbabilities = buildMatchupProbabilityTable();
  const rng = mulberry32(index);
  const picks: BracketPick[] = [];

  let currentRound = Array.from({ length: initialOrder.length }, (_, teamIndex) => teamIndex);
  let gameIndex = 0;
  let round = 64;

  while (currentRound.length > 1) {
    const nextRound: number[] = [];

    for (let i = 0; i < currentRound.length; i += 2) {
      const team1Index = currentRound[i];
      const team2Index = currentRound[i + 1];
      const team1 = initialOrder[team1Index];
      const team2 = initialOrder[team2Index];
      const probability = matchupProbabilities[team1Index * initialOrder.length + team2Index];
      const pickTeam2 = rng() >= probability;
      const winnerIndex = pickTeam2 ? team2Index : team1Index;

      picks.push({
        game_index: gameIndex,
        round,
        team1,
        team2,
        pick: initialOrder[winnerIndex],
      });

      nextRound.push(winnerIndex);
      gameIndex++;
    }

    currentRound = nextRound;
    round /= 2;
  }

  return picks;
}

export function getBracketSurvivalState(
  picks: BracketPick[],
  knownResults: GameResultLike[]
): BracketSurvivalState {
  const winnersByGame = new Map(
    knownResults
      .filter((result) => result.winner)
      .map((result) => [result.game_index, result.winner as string])
  );

  let alive = true;
  let eliminatedBy: EliminatedByPick | null = null;
  const summary: BracketSummary = { correct: 0, wrong: 0, pending: 0 };

  const annotatedPicks = picks.map((pick) => {
    const winner = winnersByGame.get(pick.game_index) ?? null;

    if (!winner) {
      summary.pending++;
      return {
        ...pick,
        winner: null,
        result: "pending" as const,
      };
    }

    if (pick.pick === winner) {
      summary.correct++;
      return {
        ...pick,
        winner,
        result: "alive" as const,
      };
    }

    summary.wrong++;
    alive = false;

    if (!eliminatedBy) {
      eliminatedBy = {
        game_index: pick.game_index,
        round: pick.round,
        team1: pick.team1,
        team2: pick.team2,
        pick: pick.pick,
        winner,
      };
    }

    return {
      ...pick,
      winner,
      result: "dead" as const,
    };
  });

  return {
    picks: annotatedPicks,
    alive,
    summary,
    eliminated_by: eliminatedBy,
  };
}

export function getPlayInOverrides(): Record<string, Team> {
  const dbPath = getDatabasePath();

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
