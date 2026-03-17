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
  const tournament = loadTournament();
  const order: string[] = [];

  for (const region of tournament.regions) {
    const regionTeams = tournament.teams.filter((t) => t.region === region);
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
 * Build the full probability table for all 63 games.
 *
 * IMPORTANT: For rounds after Round of 64, the matchup depends on who advanced.
 * Since each bracket has different outcomes, we can't pre-compute later-round
 * probabilities statically.
 *
 * SIMPLIFICATION FOR V1: Use a flat 63-probability array where later-round
 * probabilities are set to 0.5 (coin flip). This is "wrong" in that later-round
 * matchup probabilities should depend on who advanced, but:
 * - It's much simpler to implement
 * - The PRNG still produces deterministic brackets
 * - The brackets are still "reasonable" (weighted in round 1, random after)
 * - We can improve this in V2 by doing per-bracket dynamic probability computation
 *
 * BETTER APPROACH (implement if time allows): For each bracket, after determining
 * round N winners, compute round N+1 probabilities dynamically before generating
 * round N+1 outcomes. This requires the PRNG calls to be ordered round-by-round
 * (which they already are by the canonical game ordering).
 *
 * @returns Array of 63 probabilities. probabilities[i] = P(team1 wins game i),
 *          where team1 is the first team in canonical order for that game.
 */
export function buildProbabilityTable(): number[] {
  const tournament = loadTournament();
  const initialOrder = getInitialOrder();
  const probs: number[] = new Array(63);

  // Round of 64: games 0-31 (32 games)
  // Teams are in pairs: initialOrder[0] vs [1], [2] vs [3], etc.
  for (let i = 0; i < 32; i++) {
    const team1Name = initialOrder[i * 2];
    const team2Name = initialOrder[i * 2 + 1];
    const team1 = tournament.teams.find((t) => t.name === team1Name)!;
    const team2 = tournament.teams.find((t) => t.name === team2Name)!;
    probs[i] = computeProbability(team1.netRating, team2.netRating);
  }

  // Later rounds: set to 0.5 for V1 simplification
  // TODO: Implement dynamic probability computation per-bracket for V2
  for (let i = 32; i < 63; i++) {
    probs[i] = 0.5;
  }

  return probs;
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
  results: { game_index: number; team1: string; team2: string; winner: string | null }[],
  initialOrder: string[]
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
