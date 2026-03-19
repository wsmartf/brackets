#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_DB_PATH="${REPO_ROOT}/march-madness.db"
DB_PATH_VALUE="${DB_PATH:-${MARCH_MADNESS_DB_PATH:-$DEFAULT_DB_PATH}}"

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/db.sh summary

Environment:
  DB_PATH             Optional explicit database path
  MARCH_MADNESS_DB_PATH  Optional fallback database path
EOF
}

summary_command() {
  cd "$REPO_ROOT"
  DB_PATH="$DB_PATH_VALUE" node - <<'EOF'
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  throw new Error("DB_PATH is required");
}

const db = new Database(dbPath, { readonly: true });

function readStats(key) {
  const row = db.prepare("SELECT value FROM stats WHERE key = ?").get(key);
  if (!row) return null;

  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

const completedResults = db
  .prepare("SELECT COUNT(*) AS count FROM results WHERE winner IS NOT NULL")
  .get().count;
const pendingEvents = db
  .prepare("SELECT COUNT(*) AS count FROM result_events WHERE processed_at IS NULL")
  .get().count;
const latestSnapshot = db
  .prepare(
    `SELECT id, remaining, games_completed, new_game_indices, created_at
     FROM snapshots
     ORDER BY created_at DESC, id DESC
     LIMIT 1`
  )
  .get();
const latestAudit = db
  .prepare(
    `SELECT id, action, created_at
     FROM audit_log
     ORDER BY id DESC
     LIMIT 3`
  )
  .all();

const analysis = readStats("analysis") || {};
const analysisStatus = readStats("analysis_status") || {};

console.log(`db_path: ${dbPath}`);
console.log(`completed_results: ${completedResults}`);
console.log(`pending_result_events: ${pendingEvents}`);
console.log(`analysis_analyzed_at: ${analysis.analyzedAt ?? "null"}`);
console.log(`analysis_remaining: ${analysis.remaining ?? "null"}`);
console.log(`analysis_games_completed: ${analysis.gamesCompleted ?? "null"}`);
console.log(`analysis_running: ${analysisStatus.isRunning === true ? "yes" : "no"}`);
console.log(`analysis_started_at: ${analysisStatus.lastStartedAt ?? "null"}`);
console.log(`analysis_finished_at: ${analysisStatus.lastFinishedAt ?? "null"}`);
console.log(`analysis_error: ${analysisStatus.lastError ?? "null"}`);

if (latestSnapshot) {
  console.log(`latest_snapshot_id: ${latestSnapshot.id}`);
  console.log(`latest_snapshot_created_at: ${latestSnapshot.created_at}`);
  console.log(`latest_snapshot_remaining: ${latestSnapshot.remaining}`);
  console.log(`latest_snapshot_games_completed: ${latestSnapshot.games_completed}`);
  console.log(`latest_snapshot_new_game_indices: ${latestSnapshot.new_game_indices}`);
} else {
  console.log("latest_snapshot_id: null");
}

if (latestAudit.length === 0) {
  console.log("recent_audit: none");
} else {
  console.log("recent_audit:");
  for (const entry of latestAudit) {
    console.log(`  #${entry.id} ${entry.created_at} ${entry.action}`);
  }
}
EOF
}

command="${1:-summary}"
case "$command" in
  summary)
    summary_command
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac
