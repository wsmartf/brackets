/**
 * Analysis orchestrator.
 *
 * Spawns worker threads to iterate through the bracket space in parallel,
 * then aggregates results and writes stats to SQLite.
 *
 * Usage:
 *   const stats = await runAnalysis();
 *   // stats = { remaining: 847291, totalBrackets: 1000000000, ... }
 */

import { Worker } from "worker_threads";
import { join } from "path";
import { cpus } from "os";
import {
  buildMatchupProbabilityTable,
  getInitialOrder,
  computeBitmasks,
  reconstructBracket,
} from "./tournament";
import {
  createSnapshot,
  getResults,
  getSurvivorCount,
  getStats,
  initDb,
  replaceSurvivingIndices,
  setStats,
} from "./db";
import { syncFinalDisplayCohort } from "./final-display-cohort";

// ============================================================
// Constants
// ============================================================

function getEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const NUM_BRACKETS = getEnvInt("ANALYZE_NUM_BRACKETS", 1_000_000_000);
const NUM_WORKERS = getEnvInt("ANALYZE_NUM_WORKERS", Math.max(1, cpus().length - 1));
const SURVIVOR_INDEX_THRESHOLD = getEnvInt("ANALYZE_INDEX_THRESHOLD", 1_000_000);

// ============================================================
// Types
// ============================================================

/**
 * Round-by-round survivor counts per team.
 * roundSurvivorCounts[teamName][roundIndex] = number of surviving brackets
 * with that team reaching that round or further.
 * roundIndex: 0=R64, 1=R32, 2=S16, 3=E8, 4=F4, 5=Championship game, 6=Champion
 */
export type RoundSurvivorCounts = Record<string, number[]>;

/**
 * Per-game pick distribution across surviving brackets.
 * gamePickCounts[gameIndex] = [team1Count, team2Count]
 */
export type GamePickCounts = Record<number, [number, number]>;

export interface AnalysisResult {
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  /** Timestamp of when analysis completed */
  analyzedAt: string;
  /** Round-by-round survivor counts per team. Only present when indices are stored. */
  roundSurvivorCounts?: RoundSurvivorCounts;
  /** Per-game pick distribution. Only present when indices are stored. */
  gamePickCounts?: GamePickCounts;
  /** Whether surviving bracket indices are stored in the DB. */
  indicesStored?: boolean;
}

export interface RunAnalysisOptions {
  newGameIndices?: number[];
}

// ============================================================
// Main Analysis Function
// ============================================================

/**
 * Reconstruct all surviving brackets and compute round-by-round survivor
 * counts and per-game pick distributions.
 */
export function computeDerivedStats(
  survivorIndices: Array<{ index: number; championIndex: number }>
): { roundSurvivorCounts: RoundSurvivorCounts; gamePickCounts: GamePickCounts } {
  const initialOrder = getInitialOrder();
  const teamIndex = new Map<string, number>(initialOrder.map((name, i) => [name, i]));
  // 7 rounds: R64(0), R32(1), S16(2), E8(3), F4(4), Championship(5), Champion(6)
  const NUM_ROUNDS = 7;
  const roundCounts: number[][] = Array.from({ length: initialOrder.length }, () =>
    new Array<number>(NUM_ROUNDS).fill(0)
  );
  const gamePicks: Array<[number, number]> = Array.from({ length: 63 }, () => [0, 0]);

  for (const { index } of survivorIndices) {
    const picks = reconstructBracket(index);
    for (const pick of picks) {
      // Round number from the bracket encoding: 64, 32, 16, 8, 4, 2
      // Map to roundIndex: 64→0, 32→1, 16→2, 8→3, 4→4, 2→5; champion = 6
      const roundIndex = Math.round(Math.log2(64 / pick.round));
      const team1Idx = teamIndex.get(pick.team1) ?? -1;
      const team2Idx = teamIndex.get(pick.team2) ?? -1;
      const pickedTeam1 = pick.pick === pick.team1;

      // Track pick counts for this game
      gamePicks[pick.game_index][pickedTeam1 ? 0 : 1]++;

      // Count participation in this round for both teams
      if (team1Idx >= 0) roundCounts[team1Idx][roundIndex]++;
      if (team2Idx >= 0) roundCounts[team2Idx][roundIndex]++;

      // Winner of the championship game is the champion (roundIndex 6)
      if (pick.game_index === 62) {
        const champIdx = pickedTeam1 ? team1Idx : team2Idx;
        if (champIdx >= 0) roundCounts[champIdx][6]++;
      }
    }
  }

  const roundSurvivorCounts: RoundSurvivorCounts = {};
  for (let i = 0; i < initialOrder.length; i++) {
    const team = initialOrder[i];
    if (roundCounts[i].some((c) => c > 0)) {
      roundSurvivorCounts[team] = roundCounts[i];
    }
  }

  const gamePickCounts: GamePickCounts = {};
  for (let g = 0; g < gamePicks.length; g++) {
    if (gamePicks[g][0] > 0 || gamePicks[g][1] > 0) {
      gamePickCounts[g] = gamePicks[g];
    }
  }

  return { roundSurvivorCounts, gamePickCounts };
}

/**
 * Run a full analysis: iterate through all brackets, filter against known
 * results, count remaining, and cache stats in SQLite.
 *
 * This spawns NUM_WORKERS worker threads, each processing a slice of the
 * bracket index space. Results are aggregated and written to the stats table.
 *
 * @returns Promise<AnalysisResult> with the aggregated stats
 */
export async function runAnalysis(options: RunAnalysisOptions = {}): Promise<AnalysisResult> {
  initDb();
  const initialOrder = getInitialOrder();
  const matchupProbabilities = buildMatchupProbabilityTable();
  const results = getResults();

  // Compute bitmasks from known results
  const { maskLo, maskHi, valueLo, valueHi } = computeBitmasks(results);

  const gamesCompleted = results.filter((r) => r.winner).length;

  // Determine whether to collect surviving indices this run.
  // Check previous remaining count; if below threshold, collect.
  const previousRaw = getStats("analysis");
  const previousRemaining: number | null = previousRaw
    ? ((JSON.parse(previousRaw) as { remaining?: number }).remaining ?? null)
    : null;
  const collectIndices =
    previousRemaining !== null
      ? previousRemaining <= SURVIVOR_INDEX_THRESHOLD
      : NUM_BRACKETS <= SURVIVOR_INDEX_THRESHOLD;

  // If no games played yet, all brackets are valid — skip the expensive computation
  if (gamesCompleted === 0) {
    syncFinalDisplayCohort(NUM_BRACKETS, []);
    const stats: AnalysisResult = {
      remaining: NUM_BRACKETS,
      totalBrackets: NUM_BRACKETS,
      gamesCompleted: 0,
      championshipProbs: {},
      analyzedAt: new Date().toISOString(),
      indicesStored: getSurvivorCount() > 0,
    };
    setStats("analysis", JSON.stringify(stats));
    createSnapshot({
      remaining: stats.remaining,
      gamesCompleted: stats.gamesCompleted,
      championshipProbs: stats.championshipProbs,
      newGameIndices: options.newGameIndices,
    });
    return stats;
  }

  // Split work across workers
  const chunkSize = Math.ceil(NUM_BRACKETS / NUM_WORKERS);
  const workerPromises: Promise<{
    remaining: number;
    championCounts: number[];
    survivorIndices: Array<{ index: number; championIndex: number }>;
  }>[] = [];

  // Worker runs from lib/worker.mts via tsx/esm (execArgv below).
  // This works in both dev and production without a separate compile step.
  const workerPath = join(process.cwd(), "lib", "worker.mts");

  for (let w = 0; w < NUM_WORKERS; w++) {
    const startIndex = w * chunkSize;
    const endIndex = Math.min(startIndex + chunkSize, NUM_BRACKETS);
    if (startIndex >= endIndex) {
      continue;
    }

    workerPromises.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(workerPath, {
          // tsx allows running TypeScript worker files directly.
          // Install with: npm install -D tsx
          execArgv: ["--import", "tsx/esm"],
        });

        worker.postMessage({
          startIndex,
          endIndex,
          matchupProbabilities,
          maskLo,
          maskHi,
          valueLo,
          valueHi,
          collectIndices,
        });

        worker.on("message", (result) => {
          worker.terminate();
          resolve(result);
        });

        worker.on("error", (err) => {
          worker.terminate();
          reject(err);
        });
      })
    );
  }

  // Wait for all workers to finish
  const workerResults = await Promise.all(workerPromises);

  // Aggregate
  let totalRemaining = 0;
  const championCounts = new Array<number>(initialOrder.length).fill(0);
  const allSurvivorIndices: Array<{ index: number; championIndex: number }> = [];

  for (const wr of workerResults) {
    totalRemaining += wr.remaining;
    for (let i = 0; i < championCounts.length; i++) {
      championCounts[i] += wr.championCounts[i] ?? 0;
    }
    if (collectIndices && wr.survivorIndices?.length) {
      for (const entry of wr.survivorIndices) {
        allSurvivorIndices.push(entry);
      }
    }
  }

  const championshipProbs: Record<string, number> = {};
  if (totalRemaining > 0) {
    for (let i = 0; i < championCounts.length; i++) {
      const count = championCounts[i];
      if (count === 0) continue;
      championshipProbs[initialOrder[i]] = count / totalRemaining;
    }
  }

  // Store indices and compute derived stats if collected
  let roundSurvivorCounts: RoundSurvivorCounts | undefined;
  let gamePickCounts: GamePickCounts | undefined;

  if (collectIndices && allSurvivorIndices.length > 0) {
    replaceSurvivingIndices(allSurvivorIndices);
    const derived = computeDerivedStats(allSurvivorIndices);
    roundSurvivorCounts = derived.roundSurvivorCounts;
    gamePickCounts = derived.gamePickCounts;
  }

  syncFinalDisplayCohort(
    totalRemaining,
    allSurvivorIndices.map((entry) => entry.index)
  );

  const stats: AnalysisResult = {
    remaining: totalRemaining,
    totalBrackets: NUM_BRACKETS,
    gamesCompleted,
    championshipProbs,
    analyzedAt: new Date().toISOString(),
    indicesStored: collectIndices && allSurvivorIndices.length > 0,
    ...(roundSurvivorCounts !== undefined && { roundSurvivorCounts }),
    ...(gamePickCounts !== undefined && { gamePickCounts }),
  };

  // Cache in SQLite
  setStats("analysis", JSON.stringify(stats));
  createSnapshot({
    remaining: stats.remaining,
    gamesCompleted: stats.gamesCompleted,
    championshipProbs: stats.championshipProbs,
    newGameIndices: options.newGameIndices,
  });

  return stats;
}
