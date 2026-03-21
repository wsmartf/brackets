import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "./test-helpers";
import {
  initDb,
  getResults,
  getCompletedResults,
  getResult,
  setResult,
  createSnapshot,
  getSnapshots,
  hasCurrentResultsSnapshot,
  enqueueResultEvent,
  getPendingResultEvents,
  markResultEventProcessed,
  getEliminationImpact,
  addAuditLog,
  listAuditLog,
} from "../lib/db";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

describe("initDb / seeding", () => {
  test("initializes with all 63 games, no winners", () => {
    const results = getResults();
    expect(results).toHaveLength(63);
    expect(results.every((r) => r.winner === null)).toBe(true);
  });

  test("game indices run 0-62", () => {
    const results = getResults();
    results.forEach((r, i) => expect(r.game_index).toBe(i));
  });

  test("round of 64 games have round=64", () => {
    const results = getResults();
    const r64 = results.filter((r) => r.round === 64);
    expect(r64).toHaveLength(32);
  });

  test("initDb is idempotent (double-call doesn't duplicate)", () => {
    initDb();
    initDb();
    expect(getResults()).toHaveLength(63);
  });
});

// ---------------------------------------------------------------------------
// setResult / getResult
// ---------------------------------------------------------------------------

describe("setResult / getResult", () => {
  test("round-trips a winner", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    const r = getResult(0);
    expect(r?.winner).toBe("Duke");
    expect(r?.team1).toBe("Duke");
    expect(r?.team2).toBe("Howard");
    expect(r?.round).toBe(64);
  });

  test("updating a result replaces the winner", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    setResult(0, 64, "Duke", "Howard", "Howard");
    expect(getResult(0)?.winner).toBe("Howard");
  });

  test("setting winner to null clears it", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    setResult(0, 64, "Duke", "Howard", null);
    expect(getResult(0)?.winner).toBeNull();
  });

  test("getResult returns null for non-existent game", () => {
    expect(getResult(999)).toBeNull();
  });

  test("records source and manual_override", () => {
    setResult(5, 64, "Kansas", "Wagner", "Kansas", { source: "espn", manualOverride: true });
    const r = getResult(5);
    expect(r?.source).toBe("espn");
    expect(r?.manual_override).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getCompletedResults
// ---------------------------------------------------------------------------

describe("getCompletedResults", () => {
  test("returns empty when no games played", () => {
    expect(getCompletedResults()).toHaveLength(0);
  });

  test("returns only games with a winner", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    setResult(1, 64, "UNC", "Yale", "UNC");
    expect(getCompletedResults()).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

describe("createSnapshot / getSnapshots", () => {
  test("creates a snapshot and retrieves it", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    const created = createSnapshot({
      remaining: 500_000_000,
      gamesCompleted: 1,
      championshipProbs: { Duke: 0.3, UNC: 0.1 },
    });
    expect(created).toBe(true);

    const snapshots = getSnapshots();
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].remaining).toBe(500_000_000);
    expect(snapshots[0].gamesCompleted).toBe(1);
    expect(snapshots[0].championshipProbs["Duke"]).toBeCloseTo(0.3);
  });

  test("returns false when game results have not changed since last snapshot", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {} });
    const second = createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {} });
    expect(second).toBe(false);
  });

  test("returns true after results change", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {} });
    setResult(1, 64, "UNC", "Yale", "UNC"); // new result
    const second = createSnapshot({ remaining: 400_000_000, gamesCompleted: 2, championshipProbs: {} });
    expect(second).toBe(true);
    expect(getSnapshots()).toHaveLength(2);
  });

  test("newGameIndices reflects which game was just completed", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {}, newGameIndices: [0] });
    const snapshots = getSnapshots();
    expect(snapshots[0].newGameIndices).toEqual([0]);
  });
});

describe("hasCurrentResultsSnapshot", () => {
  test("returns false when no snapshots exist", () => {
    expect(hasCurrentResultsSnapshot()).toBe(false);
  });

  test("returns true right after creating a snapshot", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {} });
    expect(hasCurrentResultsSnapshot()).toBe(true);
  });

  test("returns false after results change", () => {
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({ remaining: 500_000_000, gamesCompleted: 1, championshipProbs: {} });
    setResult(1, 64, "UNC", "Yale", "UNC");
    expect(hasCurrentResultsSnapshot()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Result events
// ---------------------------------------------------------------------------

describe("result events", () => {
  const baseEvent = {
    gameIndex: 5,
    round: 64,
    team1: "Kansas",
    team2: "Wagner",
    winner: "Kansas",
    source: "espn" as const,
  };

  test("enqueue, retrieve, mark processed", () => {
    expect(enqueueResultEvent(baseEvent)).toBe(true);

    const pending = getPendingResultEvents();
    expect(pending).toHaveLength(1);
    expect(pending[0].winner).toBe("Kansas");
    expect(pending[0].processedAt).toBeNull();

    markResultEventProcessed(pending[0].id);
    expect(getPendingResultEvents()).toHaveLength(0);
  });

  test("duplicate pending event is deduplicated", () => {
    enqueueResultEvent(baseEvent);
    const second = enqueueResultEvent(baseEvent);
    expect(second).toBe(false);
    expect(getPendingResultEvents()).toHaveLength(1);
  });

  test("same game with different winner is a separate event", () => {
    enqueueResultEvent(baseEvent);
    const different = enqueueResultEvent({ ...baseEvent, winner: "Wagner" });
    expect(different).toBe(true);
    expect(getPendingResultEvents()).toHaveLength(2);
  });

  test("stores espnEventId", () => {
    enqueueResultEvent({ ...baseEvent, espnEventId: "abc123" });
    const pending = getPendingResultEvents();
    expect(pending[0].espnEventId).toBe("abc123");
  });
});

// ---------------------------------------------------------------------------
// getEliminationImpact
// ---------------------------------------------------------------------------

describe("getEliminationImpact", () => {
  test("returns empty when no snapshots exist", () => {
    expect(getEliminationImpact()).toHaveLength(0);
  });

  test("computes exact elimination count for a single new game", () => {
    // First snapshot: baseline
    createSnapshot({ remaining: 1_000_000_000, gamesCompleted: 0, championshipProbs: {} });

    // One game played, new snapshot
    setResult(0, 64, "Duke", "Howard", "Duke");
    createSnapshot({
      remaining: 500_000_000,
      gamesCompleted: 1,
      championshipProbs: {},
      newGameIndices: [0],
    });

    const impacts = getEliminationImpact();
    expect(impacts).toHaveLength(1);
    expect(impacts[0].gameIndex).toBe(0);
    expect(impacts[0].eliminated).toBe(500_000_000); // 1B - 500M
    expect(impacts[0].exact).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

describe("audit log", () => {
  test("records entries and retrieves them in reverse order", () => {
    addAuditLog("action_a", { detail: 1 });
    addAuditLog("action_b", { detail: 2 });
    const entries = listAuditLog(10);
    expect(entries[0].action).toBe("action_b"); // most recent first
    expect(entries[1].action).toBe("action_a");
  });

  test("respects limit", () => {
    for (let i = 0; i < 10; i++) addAuditLog("action", { i });
    expect(listAuditLog(3)).toHaveLength(3);
  });
});
