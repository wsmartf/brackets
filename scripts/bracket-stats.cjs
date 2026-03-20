/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bracket stats orchestrator.
 *
 * Scans all 1B deterministic brackets (or BRACKET_STATS_NUM_BRACKETS env var)
 * in parallel across NUM_WORKERS (default: cpus-1) worker threads.
 *
 * Produces data/bracket-stats.json with:
 *   - perTeam: round advancement rates for all 64 teams
 *   - pickCounts: team2-pick counts for all 63 game slots
 *   - r1UpsetHistogram: distribution of R1 upset counts
 */

const { Worker } = require("worker_threads");
const { join } = require("path");
const { cpus } = require("os");
const { writeFileSync } = require("fs");
const {
  buildMatchupProbabilityTable,
  getInitialOrder,
  loadTournament,
} = require("../lib/tournament.ts");

// ============================================================
// Constants
// ============================================================

const DEFAULT_NUM_BRACKETS = 1_000_000_000;
const ROUND_NAMES = ["R64", "R32", "S16", "E8", "F4", "Champion"];

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const numBrackets = parsePositiveInt(
    process.env.BRACKET_STATS_NUM_BRACKETS,
    DEFAULT_NUM_BRACKETS
  );
  const numWorkers = parsePositiveInt(
    process.env.BRACKET_STATS_NUM_WORKERS,
    Math.max(1, cpus().length - 1)
  );

  const startedAt = new Date().toISOString();
  const t0 = process.hrtime.bigint();

  console.error(
    `bracket-stats: ${numBrackets.toLocaleString()} brackets across ${numWorkers} workers`
  );

  // Load tournament data
  const matchupProbabilities = buildMatchupProbabilityTable();
  const initialOrder = getInitialOrder();
  const tournament = loadTournament();

  // Build team metadata map: name → { seed, region }
  const teamMeta = new Map();
  for (const team of tournament.teams) {
    teamMeta.set(team.name, { seed: team.seed, region: team.region });
  }

  // Compute isTeam2UpsetR1[32]:
  // In canonical order, pairs are (1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15) repeated 4x.
  // team1 is always the lower seed number (favored), team2 always the higher seed number (underdog).
  // So team2 winning is always an upset (higher seed number wins).
  // isTeam2UpsetR1[i] = true for all 32 games.
  const isTeam2UpsetR1 = new Array(32).fill(true);

  // Split work across workers
  const chunkSize = Math.ceil(numBrackets / numWorkers);
  const workerPath = join(__dirname, "bracket-stats-worker.cjs");

  const workerPromises = [];
  for (let w = 0; w < numWorkers; w++) {
    const startIndex = w * chunkSize;
    const endIndex = Math.min(startIndex + chunkSize, numBrackets);
    if (startIndex >= endIndex) continue;

    workerPromises.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(workerPath);

        worker.postMessage({
          startIndex,
          endIndex,
          matchupProbabilities,
          isTeam2UpsetR1,
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

  const workerResults = await Promise.all(workerPromises);

  // Aggregate results
  const teamRoundCounts = new Int32Array(64 * 6);
  const pickCounts = new Int32Array(63);
  const r1UpsetHistogram = new Int32Array(33);

  for (const wr of workerResults) {
    for (let i = 0; i < teamRoundCounts.length; i++) teamRoundCounts[i] += wr.teamRoundCounts[i];
    for (let i = 0; i < pickCounts.length; i++) pickCounts[i] += wr.pickCounts[i];
    for (let i = 0; i < r1UpsetHistogram.length; i++) r1UpsetHistogram[i] += wr.r1UpsetHistogram[i];
  }

  const durationSeconds = Number(process.hrtime.bigint() - t0) / 1e9;

  // Build output: perTeam
  const perTeam = {};
  for (let teamIdx = 0; teamIdx < 64; teamIdx++) {
    const teamName = initialOrder[teamIdx];
    const meta = teamMeta.get(teamName) ?? { seed: 0, region: "Unknown" };
    const roundCounts = {};
    for (let r = 0; r < 6; r++) {
      roundCounts[ROUND_NAMES[r]] = teamRoundCounts[teamIdx * 6 + r];
    }
    perTeam[teamName] = {
      seed: meta.seed,
      region: meta.region,
      roundCounts,
    };
  }

  // Build output: pickCounts
  // Game slots: 0-31 in lo, 32-62 in hi
  // Reconstruct team names for each game slot using canonical bracket structure
  const gameSlotTeams = buildGameSlotTeams(initialOrder);
  const pickCountsOut = {};
  for (let slot = 0; slot < 63; slot++) {
    const { team1, team2 } = gameSlotTeams[slot];
    pickCountsOut[slot] = {
      team1,
      team2,
      team2Picks: pickCounts[slot],
    };
  }

  // Build output: r1UpsetHistogram
  const r1UpsetHistogramOut = {};
  for (let i = 0; i <= 32; i++) {
    r1UpsetHistogramOut[i] = r1UpsetHistogram[i];
  }

  const output = {
    generatedAt: new Date().toISOString(),
    startedAt,
    totalBrackets: numBrackets,
    durationSeconds: Number(durationSeconds.toFixed(2)),
    perTeam,
    pickCounts: pickCountsOut,
    r1UpsetHistogram: r1UpsetHistogramOut,
  };

  const outPath = join(process.cwd(), "data", "bracket-stats.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.error(`bracket-stats: wrote ${outPath} (${durationSeconds.toFixed(1)}s)`);
  console.error(`bracket-stats: done — ${numBrackets.toLocaleString()} brackets processed`);
}

/**
 * Build the team1/team2 names for all 63 game slots using the same
 * round-by-round bracket structure as buildGameDefinitionsFromParticipants.
 */
function buildGameSlotTeams(initialOrder) {
  const slots = [];
  let participants = initialOrder.slice();
  let gameIndex = 0;

  while (participants.length > 1) {
    const next = [];
    for (let i = 0; i < participants.length; i += 2) {
      slots.push({ team1: participants[i], team2: participants[i + 1] });
      next.push(`Winner of Game ${gameIndex}`);
      gameIndex++;
    }
    participants = next;
  }

  return slots;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
