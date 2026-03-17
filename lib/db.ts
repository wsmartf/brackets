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

// ============================================================
// Types
// ============================================================

export interface GameResult {
  game_index: number;
  round: number;
  team1: string;
  team2: string;
  winner: string | null;
  updated_at: string;
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
    initDb(_db);
  }
  return _db;
}

function initDb(db: Database.Database): void {
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
  `);
}

// ============================================================
// Results CRUD
// ============================================================

/**
 * Get all game results, ordered by game_index.
 */
export function getResults(): GameResult[] {
  const db = getDb();
  return db.prepare("SELECT * FROM results ORDER BY game_index").all() as GameResult[];
}

/**
 * Get results that have a winner (completed games only).
 */
export function getCompletedResults(): GameResult[] {
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
  winner: string | null
): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO results (game_index, round, team1, team2, winner, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(game_index) DO UPDATE SET
       winner = excluded.winner,
       updated_at = excluded.updated_at`
  ).run(gameIndex, round, team1, team2, winner);
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
    `INSERT OR IGNORE INTO results (game_index, round, team1, team2)
     VALUES (?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    for (const g of games) {
      insert.run(g.game_index, g.round, g.team1, g.team2);
    }
  });
  tx();
}

// ============================================================
// Stats CRUD
// ============================================================

/**
 * Get a cached stat by key. Returns null if not found.
 */
export function getStats(key: string): string | null {
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
  const db = getDb();
  db.prepare(
    `INSERT INTO stats (key, value, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`
  ).run(key, value);
}
