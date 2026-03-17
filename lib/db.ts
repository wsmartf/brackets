/**
 * SQLite database for storing game results and cached analysis stats.
 *
 * Uses better-sqlite3 for synchronous, simple access. The DB file lives
 * at the project root as `march-madness.db`.
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
import { join } from "path";
import { buildGameDefinitions } from "./tournament";

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

// ============================================================
// Database Singleton
// ============================================================

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbPath = join(process.cwd(), "march-madness.db");
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
  `);

  ensureColumn(db, "results", "source", "TEXT NOT NULL DEFAULT 'seed'");
  ensureColumn(db, "results", "manual_override", "INTEGER NOT NULL DEFAULT 0");
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
