/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Export current DB game results as a named scenario fixture for local dev testing.
 *
 * Usage:
 *   NAME=final-5 node --require tsx/cjs scripts/dev/export-scenario.cjs
 *   make export-scenario NAME=final-5
 *
 * Reads completed game results from MARCH_MADNESS_DB_PATH (or ./march-madness.db).
 * Writes to scripts/dev/fixtures/${NAME}.json.
 *
 * Run this while your prod DB is in place, then replay the scenario any time with:
 *   make dev-scenario SCENARIO=final-5
 */

const { writeFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const name = process.env.NAME?.trim();
if (!name) {
  console.error("NAME is required.");
  console.error("  NAME=final-5 node --require tsx/cjs scripts/dev/export-scenario.cjs");
  process.exitCode = 1;
  process.exit();
}

const { initDb, getResults } = require("../../lib/db.ts");

initDb();
const allResults = getResults();
const completed = allResults.filter((r) => r.winner !== null);

const fixture = {
  name,
  description: `Exported ${new Date().toISOString()} — ${completed.length} completed game results`,
  results: completed.map((r) => ({
    game_index: r.game_index,
    round: r.round,
    team1: r.team1,
    team2: r.team2,
    winner: r.winner,
  })),
};

const outDir = join(__dirname, "fixtures");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${name}.json`);
writeFileSync(outPath, JSON.stringify(fixture, null, 2) + "\n");

console.log(
  JSON.stringify(
    {
      ok: true,
      name,
      path: outPath,
      completedResults: completed.length,
    },
    null,
    2
  )
);
