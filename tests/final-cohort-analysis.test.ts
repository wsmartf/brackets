import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  getSnapshots,
  getStats,
  getSurvivorCount,
  getSurvivorIndices,
  initDb,
  setFinalDisplayCohort,
  setResult,
} from "../lib/db";
import { runExactFinalCohortAnalysis } from "../lib/final-cohort-analysis";
import { reconstructBracket } from "../lib/tournament";
import { createTestDb } from "./test-helpers";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => {
  cleanup();
});

describe("runExactFinalCohortAnalysis", () => {
  test("updates stats and survivor indices exactly from the frozen cohort", async () => {
    const bracketA = reconstructBracket(0);
    const bracketB = reconstructBracket(1);
    const divergence = bracketA.find(
      (pick, index) => pick.pick !== bracketB[index]?.pick
    );

    expect(divergence).toBeDefined();
    if (!divergence) {
      throw new Error("Expected divergent brackets for exact cohort analysis test");
    }

    setFinalDisplayCohort({
      threshold: 5,
      indices: [0, 1],
      frozenAt: "2026-03-26T23:10:00.000Z",
    });

    setResult(divergence.game_index, divergence.round, divergence.team1, divergence.team2, divergence.pick, {
      source: "manual",
      manualOverride: true,
    });

    const stats = await runExactFinalCohortAnalysis({ newGameIndices: [divergence.game_index] });

    expect(stats.remaining).toBe(1);
    expect(getSurvivorCount()).toBe(1);
    expect(getSurvivorIndices({ limit: 10 })).toEqual([0]);

    const storedStats = JSON.parse(getStats("analysis") ?? "{}") as { remaining?: number };
    expect(storedStats.remaining).toBe(1);

    const snapshots = getSnapshots();
    expect(snapshots.at(-1)?.newGameIndices).toEqual([divergence.game_index]);
  });
});
