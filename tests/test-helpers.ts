/**
 * Utilities for isolated test DB setup/teardown.
 *
 * Each call creates a fresh temp SQLite file and points the module singletons
 * at it via MARCH_MADNESS_DB_PATH. Returns a cleanup function that closes the
 * connection, clears singletons, and deletes the temp file.
 *
 * Usage:
 *   let cleanup: () => void
 *   beforeEach(() => { cleanup = createTestDb() })
 *   afterEach(() => cleanup())
 */

import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { closeDb } from "../lib/db";
import { resetTournamentCaches } from "../lib/tournament";

export function createTestDb(): () => void {
  closeDb();
  resetTournamentCaches();

  const dir = mkdtempSync(join(tmpdir(), "brackets-test-"));
  const dbPath = join(dir, "test.db");
  process.env.MARCH_MADNESS_DB_PATH = dbPath;

  return function cleanup() {
    closeDb();
    resetTournamentCaches();
    delete process.env.MARCH_MADNESS_DB_PATH;
    rmSync(dir, { recursive: true, force: true });
  };
}
