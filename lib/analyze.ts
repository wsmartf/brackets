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
import { buildProbabilityTable, getInitialOrder, computeBitmasks } from "./tournament";
import { getResults, initDb, setStats } from "./db";

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

// ============================================================
// Types
// ============================================================

export interface AnalysisResult {
  remaining: number;
  totalBrackets: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  /** Timestamp of when analysis completed */
  analyzedAt: string;
}

// ============================================================
// Main Analysis Function
// ============================================================

/**
 * Run a full analysis: iterate through all brackets, filter against known
 * results, count remaining, and cache stats in SQLite.
 *
 * This spawns NUM_WORKERS worker threads, each processing a slice of the
 * bracket index space. Results are aggregated and written to the stats table.
 *
 * @returns Promise<AnalysisResult> with the aggregated stats
 */
export async function runAnalysis(): Promise<AnalysisResult> {
  initDb();
  const initialOrder = getInitialOrder();
  const probabilities = buildProbabilityTable();
  const results = getResults();

  // Compute bitmasks from known results
  const { maskLo, maskHi, valueLo, valueHi } = computeBitmasks(results);

  const gamesCompleted = results.filter((r) => r.winner).length;

  // If no games played yet, all brackets are valid — skip the expensive computation
  if (gamesCompleted === 0) {
    const stats: AnalysisResult = {
      remaining: NUM_BRACKETS,
      totalBrackets: NUM_BRACKETS,
      gamesCompleted: 0,
      championshipProbs: {},
      analyzedAt: new Date().toISOString(),
    };
    setStats("analysis", JSON.stringify(stats));
    return stats;
  }

  // Split work across workers
  const chunkSize = Math.ceil(NUM_BRACKETS / NUM_WORKERS);
  const workerPromises: Promise<{ remaining: number; championCounts: number[] }>[] = [];

  // Worker path resolution for Next.js:
  //
  // PROBLEM: Next.js compiles TypeScript, so we can't just point a Worker at worker.ts.
  // The Worker constructor needs a path to a plain .js file at runtime.
  //
  // RECOMMENDED SOLUTION: Use tsx to run the worker with TypeScript support:
  //   new Worker(workerPath, { execArgv: ['--import', 'tsx/esm'] })
  // This requires: npm install -D tsx
  //
  // ALTERNATIVE: Pre-compile worker.ts to worker.js with tsc:
  //   Add to package.json scripts: "build:worker": "tsc lib/worker.ts --outDir lib --module commonjs"
  //   Then use: join(process.cwd(), "lib", "worker.js")
  //
  // ALTERNATIVE 2: Use the __filename trick in production:
  //   When Next.js builds, it compiles everything to .next/server/
  //   The worker.ts will be at .next/server/app/api/.../worker.js (unpredictable path)
  //   This makes it hard to reference. Pre-compiling is cleaner.
  //
  // FOR NOW: Install tsx (npm install -D tsx) and use the execArgv approach.
  // This works in both dev (next dev) and production (next start).
  const workerPath = join(process.cwd(), "lib", "worker.ts");

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
          probabilities,
          maskLo,
          maskHi,
          valueLo,
          valueHi,
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

  for (const wr of workerResults) {
    totalRemaining += wr.remaining;
    for (let i = 0; i < championCounts.length; i++) {
      championCounts[i] += wr.championCounts[i] ?? 0;
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

  const stats: AnalysisResult = {
    remaining: totalRemaining,
    totalBrackets: NUM_BRACKETS,
    gamesCompleted,
    championshipProbs,
    analyzedAt: new Date().toISOString(),
  };

  // Cache in SQLite
  setStats("analysis", JSON.stringify(stats));

  return stats;
}
