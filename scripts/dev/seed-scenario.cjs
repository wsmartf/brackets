/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Seed a fresh dev DB from a named scenario fixture and run full analysis.
 *
 * Usage:
 *   SCENARIO=final-5 node --require tsx/cjs scripts/dev/seed-scenario.cjs
 *   make dev-scenario SCENARIO=final-5
 *
 * Reads scripts/dev/fixtures/${SCENARIO}.json.
 * Writes a fresh DB to /tmp/brackets-${SCENARIO}.db (overwriting any stale copy).
 * Prints the DB path on success so you can pass it to make dev.
 *
 * Full workflow:
 *   make dev-scenario SCENARIO=final-5
 *   # or manually:
 *   SCENARIO=final-5 node --require tsx/cjs scripts/dev/seed-scenario.cjs
 *   MARCH_MADNESS_DB_PATH=/tmp/brackets-final-5.db make dev
 */

const { existsSync, readFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { cpus } = require("node:os");

const scenarioName = process.env.SCENARIO?.trim();
if (!scenarioName) {
  console.error("SCENARIO is required.");
  console.error("  SCENARIO=final-5 node --require tsx/cjs scripts/dev/seed-scenario.cjs");
  console.error("  make dev-scenario SCENARIO=final-5");
  process.exitCode = 1;
  process.exit();
}

const fixturePath = resolve(join(__dirname, "fixtures", `${scenarioName}.json`));
if (!existsSync(fixturePath)) {
  console.error(`Fixture not found: ${fixturePath}`);
  console.error(
    "Create it first: NAME=" +
      scenarioName +
      " node --require tsx/cjs scripts/dev/export-scenario.cjs"
  );
  console.error("  (Run with your prod DB in MARCH_MADNESS_DB_PATH or in ./march-madness.db)");
  process.exitCode = 1;
  process.exit();
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf-8"));

const dbPath =
  process.env.MARCH_MADNESS_DB_PATH?.trim() || `/tmp/brackets-${scenarioName}.db`;
process.env.MARCH_MADNESS_DB_PATH = dbPath;

if (!process.env.ANALYZE_NUM_BRACKETS) {
  process.env.ANALYZE_NUM_BRACKETS = "1000000000";
}
if (!process.env.ANALYZE_NUM_WORKERS) {
  process.env.ANALYZE_NUM_WORKERS = String(Math.max(1, cpus().length - 1));
}

// Delete any stale DB files before seeding
for (const suffix of ["", "-wal", "-shm"]) {
  const path = `${dbPath}${suffix}`;
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

const { closeDb, initDb, setResult } = require("../../lib/db.ts");
const { runAnalysis } = require("../../lib/analyze.ts");
const { resetTournamentCaches } = require("../../lib/tournament.ts");

async function main() {
  initDb();

  for (const r of fixture.results) {
    setResult(r.game_index, r.round, r.team1, r.team2, r.winner, {
      source: "seed",
      manualOverride: false,
    });
  }

  resetTournamentCaches();
  console.error(
    `Seeded ${fixture.results.length} results. Running analysis (this may take ~30s)...`
  );
  const stats = await runAnalysis();
  closeDb();

  console.log(
    JSON.stringify(
      {
        ok: true,
        scenario: scenarioName,
        dbPath,
        seededResults: fixture.results.length,
        remaining: stats.remaining,
        totalBrackets: stats.totalBrackets,
        gamesCompleted: stats.gamesCompleted,
        analyzedAt: stats.analyzedAt,
      },
      null,
      2
    )
  );

  console.error("\nTo start dev server with this scenario:");
  console.error(`  MARCH_MADNESS_DB_PATH=${dbPath} make dev`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
