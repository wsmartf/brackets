/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, rmSync } = require("node:fs");

const databasePath =
  process.env.MARCH_MADNESS_DB_PATH?.trim() || "/tmp/brackets-future-killers.db";

process.env.MARCH_MADNESS_DB_PATH = databasePath;
if (!process.env.ANALYZE_NUM_BRACKETS) {
  process.env.ANALYZE_NUM_BRACKETS = "10000";
}
if (!process.env.ANALYZE_NUM_WORKERS) {
  process.env.ANALYZE_NUM_WORKERS = "2";
}

for (const suffix of ["", "-wal", "-shm"]) {
  const path = `${databasePath}${suffix}`;
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

const { closeDb, initDb, setResult } = require("../../lib/db.ts");
const { runAnalysis } = require("../../lib/analyze.ts");
const { resetTournamentCaches } = require("../../lib/tournament.ts");

async function main() {
  initDb();

  const seededResults = [
    [0, 64, "Duke", "Siena", "Duke"],
    [1, 64, "Ohio State", "TCU", "Ohio State"],
    [2, 64, "St. John's", "Northern Iowa", "St. John's"],
    [3, 64, "Kansas", "Cal Baptist", "Kansas"],
    [4, 64, "Louisville", "South Florida", "Louisville"],
    [5, 64, "Michigan State", "North Dakota State", "Michigan State"],
  ];

  for (const [gameIndex, round, team1, team2, winner] of seededResults) {
    setResult(gameIndex, round, team1, team2, winner, {
      source: "seed",
      manualOverride: false,
    });
  }

  resetTournamentCaches();
  const stats = await runAnalysis();
  closeDb();

  console.log(
    JSON.stringify(
      {
        ok: true,
        databasePath,
        seededGames: seededResults.length,
        remaining: stats.remaining,
        totalBrackets: stats.totalBrackets,
        gamesCompleted: stats.gamesCompleted,
        analyzedAt: stats.analyzedAt,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
