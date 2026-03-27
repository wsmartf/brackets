/**
 * SQLite database for storing game results and cached analysis stats.
 *
 * Uses better-sqlite3 for synchronous, simple access. By default the DB file
 * lives at the project root as `march-madness.db`, but replay and rehearsal
 * runs can override it with `MARCH_MADNESS_DB_PATH`.
 *
 * Tables:
 *   results — Game results (64 rows max, one per game). Pre-populated with
 *             all 63 games (winner=NULL until result is known). game_index
 *             maps directly to bit positions in the bracket encoding.
 *
 *   stats   — Key-value store for cached analysis output (remaining count,
 *             championship probabilities, etc.)
 */

import Database from "better-sqlite3";
import { createHash } from "crypto";
import { buildGameDefinitions } from "./tournament";
import { getDatabasePath } from "./runtime-paths";

// ============================================================
// Types
// ============================================================

export interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  source: string;
  manual_override: number;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  created_at: string;
  action: string;
  details: string;
}

interface SnapshotRow {
  id: number;
  remaining: number;
  games_completed: number;
  championship_probs: string;
  game_results_hash: string;
  completed_game_indices: string;
  new_game_indices: string;
  created_at: string;
}

export interface Snapshot {
  id: number;
  remaining: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  gameResultsHash: string;
  newGameIndices: number[];
  createdAt: string;
}

export interface SnapshotInput {
  remaining: number;
  gamesCompleted: number;
  championshipProbs: Record<string, number>;
  newGameIndices?: number[];
}

interface ResultEventRow {
  id: number;
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string;
  source: string;
  espn_event_id: string | null;
  detected_at: string;
  processed_at: string | null;
}

export interface ResultEvent {
  id: number;
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  winner: string;
  source: string;
  espnEventId: string | null;
  detectedAt: string;
  processedAt: string | null;
}

export interface ResultEventInput {
  gameIndex: number;
  round: number;
  team1: string;
  team2: string;
  winner: string;
  source: string;
  espnEventId?: string | null;
}

export interface EliminationImpact {
  snapshotId: number;
  gameIndex: number;
  eliminated: number | null;
  remainingAfter: number;
  exact: boolean;
  createdAt: string;
}

export interface FinalDisplayCohort {
  threshold: number;
  indices: number[];
  frozenAt: string;
}

// ============================================================
// Database Singleton
// ============================================================

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = getDatabasePath();
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL"); // Better concurrent read performance
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      game_index INTEGER PRIMARY KEY,
      round INTEGER NOT NULL,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      winner TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS stats (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      remaining INTEGER NOT NULL,
      games_completed INTEGER NOT NULL,
      championship_probs TEXT NOT NULL,
      game_results_hash TEXT NOT NULL,
      completed_game_indices TEXT NOT NULL DEFAULT '[]',
      new_game_indices TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS result_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_index INTEGER NOT NULL,
      round INTEGER NOT NULL,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      winner TEXT NOT NULL,
      source TEXT NOT NULL,
      espn_event_id TEXT,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed_at TEXT
    );

    DROP INDEX IF EXISTS idx_result_events_game_winner;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_result_events_pending_game_winner
    ON result_events (game_index, winner)
    WHERE processed_at IS NULL;

    CREATE TABLE IF NOT EXISTS surviving_indices (
      idx INTEGER NOT NULL,
      champion_index INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_surviving_champion
    ON surviving_indices (champion_index);
  `);

  ensureColumn(db, "results", "source", "TEXT NOT NULL DEFAULT 'seed'");
  ensureColumn(db, "results", "manual_override", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "snapshots", "completed_game_indices", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "snapshots", "new_game_indices", "TEXT NOT NULL DEFAULT '[]'");
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string
): void {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
  }
}

export function initDb(): void {
  getDb();
  ensureResultsSeeded();
}

/**
 * Close the database connection and reset the singleton.
 * Used in tests to ensure each test starts with a clean DB.
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ============================================================
// Results CRUD
// ============================================================

/**
 * Get all game results, ordered by game_index.
 */
export function getResults(): GameResult[] {
  initDb();
  const db = getDb();
  return db.prepare("SELECT * FROM results ORDER BY game_index").all() as GameResult[];
}

/**
 * Get results that have a winner (completed games only).
 */
export function getCompletedResults(): GameResult[] {
  initDb();
  const db = getDb();
  return db
    .prepare("SELECT * FROM results WHERE winner IS NOT NULL ORDER BY game_index")
    .all() as GameResult[];
}

/**
 * Insert or update a game result.
 */
export function setResult(
  gameIndex: number,
  round: number,
  team1: string,
  team2: string,
  winner: string | null,
  options: { source?: string; manualOverride?: boolean } = {}
): void {
  initDb();
  const db = getDb();
  const source = options.source ?? "manual";
  const manualOverride = (options.manualOverride ?? false) ? 1 : 0;
  db.prepare(
    `INSERT INTO results (game_index, round, team1, team2, winner, source, manual_override, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(game_index) DO UPDATE SET
       round = excluded.round,
       team1 = excluded.team1,
       team2 = excluded.team2,
       winner = excluded.winner,
       source = excluded.source,
       manual_override = excluded.manual_override,
       updated_at = excluded.updated_at`
  ).run(gameIndex, round, team1, team2, winner, source, manualOverride);
}

export function getResult(gameIndex: number): GameResult | null {
  initDb();
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM results WHERE game_index = ?").get(gameIndex) as
      | GameResult
      | undefined) ?? null
  );
}

/**
 * Seed the results table with all 63 games (no winners yet).
 * Call this once after loading tournament data to pre-populate the games.
 *
 * @param games - Array of { game_index, round, team1, team2 }
 */
export function seedResults(
  games: { game_index: number; round: number; team1: string; team2: string }[]
): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO results (game_index, round, team1, team2, source, manual_override)
     VALUES (?, ?, ?, ?, 'seed', 0)`
  );

  const tx = db.transaction(() => {
    for (const g of games) {
      insert.run(g.game_index, g.round, g.team1, g.team2);
    }
  });
  tx();
}

export function ensureResultsSeeded(): void {
  const db = getDb();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM results")
    .get() as { count: number };

  if (row.count > 0) {
    return;
  }

  seedResults(buildGameDefinitions());
}

// ============================================================
// Stats CRUD
// ============================================================

/**
 * Get a cached stat by key. Returns null if not found.
 */
export function getStats(key: string): string | null {
  initDb();
  const db = getDb();
  const row = db.prepare("SELECT value FROM stats WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

/**
 * Set a cached stat (upsert).
 */
export function setStats(key: string, value: string): void {
  initDb();
  const db = getDb();
  db.prepare(
    `INSERT INTO stats (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(key, value);
}

export function deleteStat(key: string): void {
  initDb();
  const db = getDb();
  db.prepare("DELETE FROM stats WHERE key = ?").run(key);
}

const FINAL_DISPLAY_COHORT_KEY = "final_display_cohort";

export function getFinalDisplayCohort(): FinalDisplayCohort | null {
  const raw = getStats(FINAL_DISPLAY_COHORT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<FinalDisplayCohort>;
    if (
      typeof parsed.threshold !== "number" ||
      !Array.isArray(parsed.indices) ||
      parsed.indices.some((value) => !Number.isInteger(value)) ||
      typeof parsed.frozenAt !== "string"
    ) {
      return null;
    }

    return {
      threshold: parsed.threshold,
      indices: parsed.indices,
      frozenAt: parsed.frozenAt,
    };
  } catch {
    return null;
  }
}

export function setFinalDisplayCohort(input: FinalDisplayCohort): void {
  setStats(FINAL_DISPLAY_COHORT_KEY, JSON.stringify(input));
}

export function clearFinalDisplayCohort(): void {
  deleteStat(FINAL_DISPLAY_COHORT_KEY);
}

export function addAuditLog(action: string, details: Record<string, unknown>): void {
  initDb();
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_log (action, details, created_at)
     VALUES (?, ?, datetime('now'))`
  ).run(action, JSON.stringify(details));
}

export function listAuditLog(limit = 50): AuditLogEntry[] {
  initDb();
  const db = getDb();
  return db
    .prepare(
      `SELECT id, action, details, created_at
       FROM audit_log
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as AuditLogEntry[];
}

function buildGameResultsHash(results: GameResult[]): string {
  const completedResults = results
    .filter((result) => result.winner !== null)
    .map((result) => ({
      game_index: result.game_index,
      winner: result.winner,
    }));

  return createHash("sha256").update(JSON.stringify(completedResults)).digest("hex");
}

function parseChampionshipProbs(raw: string): Record<string, number> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, number] => {
        const [, value] = entry;
        return typeof value === "number";
      })
    );
  } catch {
    return {};
  }
}

function parseIntegerArray(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((value): value is number => Number.isInteger(value))
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function normalizeGameIndices(gameIndices: number[]): number[] {
  return [...new Set(gameIndices.filter((value) => Number.isInteger(value)))].sort(
    (a, b) => a - b
  );
}

export function createSnapshot(input: SnapshotInput): boolean {
  initDb();
  const db = getDb();
  const results = getResults();
  const completedGameIndices = normalizeGameIndices(
    results.filter((result) => result.winner !== null).map((result) => result.game_index)
  );
  const completedGameIndexSet = new Set(completedGameIndices);
  const gameResultsHash = buildGameResultsHash(results);
  const latestSnapshot = db
    .prepare(
      `SELECT game_results_hash, completed_game_indices
       FROM snapshots
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get() as { game_results_hash: string; completed_game_indices: string } | undefined;

  if (latestSnapshot?.game_results_hash === gameResultsHash) {
    return false;
  }

  const previousCompletedGameIndices = parseIntegerArray(
    latestSnapshot?.completed_game_indices ?? "[]"
  );
  const previousCompletedGameIndexSet = new Set(previousCompletedGameIndices);
  const inferredNewGameIndices = completedGameIndices.filter(
    (gameIndex) => !previousCompletedGameIndexSet.has(gameIndex)
  );
  const newGameIndices = normalizeGameIndices(
    (input.newGameIndices ?? inferredNewGameIndices).filter((gameIndex) =>
      completedGameIndexSet.has(gameIndex)
    )
  );

  db.prepare(
    `INSERT INTO snapshots (
      remaining,
      games_completed,
      championship_probs,
      game_results_hash,
      completed_game_indices,
      new_game_indices,
      created_at
    )
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    input.remaining,
    input.gamesCompleted,
    JSON.stringify(input.championshipProbs),
    gameResultsHash,
    JSON.stringify(completedGameIndices),
    JSON.stringify(newGameIndices)
  );

  return true;
}

export function hasCurrentResultsSnapshot(): boolean {
  initDb();
  const db = getDb();
  const latestSnapshot = db
    .prepare(
      `SELECT game_results_hash
       FROM snapshots
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    )
    .get() as { game_results_hash: string } | undefined;

  if (!latestSnapshot) {
    return false;
  }

  return latestSnapshot.game_results_hash === buildGameResultsHash(getResults());
}

export function getSnapshots(): Snapshot[] {
  initDb();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         remaining,
         games_completed,
         championship_probs,
         game_results_hash,
         completed_game_indices,
         new_game_indices,
         created_at
       FROM snapshots
       ORDER BY created_at ASC, id ASC`
    )
    .all() as SnapshotRow[];

  return rows.map((row) => ({
    id: row.id,
    remaining: row.remaining,
    gamesCompleted: row.games_completed,
    championshipProbs: parseChampionshipProbs(row.championship_probs),
    gameResultsHash: row.game_results_hash,
    newGameIndices: parseIntegerArray(row.new_game_indices),
    createdAt: row.created_at,
  }));
}

function mapResultEvent(row: ResultEventRow): ResultEvent {
  return {
    id: row.id,
    gameIndex: row.game_index,
    round: row.round,
    team1: row.team1,
    team2: row.team2,
    winner: row.winner,
    source: row.source,
    espnEventId: row.espn_event_id,
    detectedAt: row.detected_at,
    processedAt: row.processed_at,
  };
}

export function enqueueResultEvent(input: ResultEventInput): boolean {
  initDb();
  const db = getDb();
  const result = db.prepare(
    `INSERT OR IGNORE INTO result_events (
      game_index,
      round,
      team1,
      team2,
      winner,
      source,
      espn_event_id,
      detected_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    input.gameIndex,
    input.round,
    input.team1,
    input.team2,
    input.winner,
    input.source,
    input.espnEventId ?? null
  );

  return result.changes > 0;
}

export function getPendingResultEvents(): ResultEvent[] {
  initDb();
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT
         id,
         game_index,
         round,
         team1,
         team2,
         winner,
         source,
         espn_event_id,
         detected_at,
         processed_at
       FROM result_events
       WHERE processed_at IS NULL
       ORDER BY detected_at ASC, id ASC`
    )
    .all() as ResultEventRow[];

  return rows.map(mapResultEvent);
}

export function markResultEventProcessed(id: number): void {
  initDb();
  const db = getDb();
  db.prepare(
    `UPDATE result_events
     SET processed_at = datetime('now')
     WHERE id = ?`
  ).run(id);
}

// ============================================================
// Surviving Indices
// ============================================================

/**
 * Atomically replace all surviving indices.
 * Single transaction: delete all + bulk insert.
 */
export function replaceSurvivingIndices(
  indices: Array<{ index: number; championIndex: number }>
): void {
  initDb();
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM surviving_indices").run();
    const insert = db.prepare(
      "INSERT INTO surviving_indices (idx, champion_index) VALUES (?, ?)"
    );
    // Batch in chunks to avoid SQLite variable limits
    for (const { index, championIndex } of indices) {
      insert.run(index, championIndex);
    }
  });
  tx();
}

/**
 * Get surviving bracket indices, optionally filtered by champion team index.
 */
export function getSurvivorIndices(options: {
  championIndex?: number;
  limit?: number;
  offset?: number;
} = {}): number[] {
  initDb();
  const db = getDb();
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  if (options.championIndex !== undefined) {
    const rows = db
      .prepare(
        "SELECT idx FROM surviving_indices WHERE champion_index = ? ORDER BY idx ASC LIMIT ? OFFSET ?"
      )
      .all(options.championIndex, limit, offset) as Array<{ idx: number }>;
    return rows.map((r) => r.idx);
  }

  const rows = db
    .prepare("SELECT idx FROM surviving_indices ORDER BY idx ASC LIMIT ? OFFSET ?")
    .all(limit, offset) as Array<{ idx: number }>;
  return rows.map((r) => r.idx);
}

/**
 * Count surviving indices, optionally filtered by champion team index.
 */
export function getSurvivorCount(championIndex?: number): number {
  initDb();
  const db = getDb();

  if (championIndex !== undefined) {
    const row = db
      .prepare(
        "SELECT COUNT(*) as count FROM surviving_indices WHERE champion_index = ?"
      )
      .get(championIndex) as { count: number };
    return row.count;
  }

  const row = db
    .prepare("SELECT COUNT(*) as count FROM surviving_indices")
    .get() as { count: number };
  return row.count;
}

export function getEliminationImpact(): EliminationImpact[] {
  const snapshots = getSnapshots();
  const impacts: EliminationImpact[] = [];

  for (let index = 0; index < snapshots.length; index++) {
    const snapshot = snapshots[index];
    if (snapshot.newGameIndices.length === 0) {
      continue;
    }

    const previousSnapshot = index > 0 ? snapshots[index - 1] : null;
    const exact = snapshot.newGameIndices.length === 1 && previousSnapshot !== null;
    const eliminated = exact ? previousSnapshot.remaining - snapshot.remaining : null;

    for (const gameIndex of snapshot.newGameIndices) {
      impacts.push({
        snapshotId: snapshot.id,
        gameIndex,
        eliminated,
        remainingAfter: snapshot.remaining,
        exact,
        createdAt: snapshot.createdAt,
      });
    }
  }

  return impacts;
}
