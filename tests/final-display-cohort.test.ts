import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  clearFinalDisplayCohort,
  getFinalDisplayCohort,
  initDb,
} from "../lib/db";
import {
  resolveFinalDisplayIndices,
  syncFinalDisplayCohort,
  syncFinalDisplayCohortFromCurrentSurvivors,
} from "../lib/final-display-cohort";
import { createTestDb } from "./test-helpers";
import { replaceSurvivingIndices } from "../lib/db";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => {
  cleanup();
});

describe("final display cohort", () => {
  test("freezes the first cohort when remaining reaches the threshold", () => {
    const cohort = syncFinalDisplayCohort(5, [42, 7, 18], {
      frozenAt: "2026-03-26T23:10:00.000Z",
    });

    expect(cohort).toEqual({
      threshold: 5,
      indices: [7, 18, 42],
      frozenAt: "2026-03-26T23:10:00.000Z",
    });
    expect(getFinalDisplayCohort()).toEqual(cohort);
  });

  test("keeps the frozen cohort when remaining falls again later", () => {
    syncFinalDisplayCohort(5, [1, 2, 3, 4, 5], {
      frozenAt: "2026-03-26T23:10:00.000Z",
    });

    const cohort = syncFinalDisplayCohort(3, [1, 2, 3], {
      frozenAt: "2026-03-27T02:05:00.000Z",
    });

    expect(cohort).toEqual({
      threshold: 5,
      indices: [1, 2, 3, 4, 5],
      frozenAt: "2026-03-26T23:10:00.000Z",
    });
  });

  test("clears the frozen cohort when remaining rises above the threshold", () => {
    syncFinalDisplayCohort(5, [1, 2, 3, 4, 5]);

    const cohort = syncFinalDisplayCohort(6, [1, 2, 3, 4, 5, 6]);

    expect(cohort).toBeNull();
    expect(getFinalDisplayCohort()).toBeNull();
  });

  test("resolves display indices from the frozen cohort when in final five mode", () => {
    syncFinalDisplayCohort(5, [5, 6, 7, 8, 9]);

    expect(resolveFinalDisplayIndices(4, [5, 6, 7, 8])).toEqual([5, 6, 7, 8, 9]);
  });

  test("falls back to current survivors when no frozen cohort exists", () => {
    clearFinalDisplayCohort();

    expect(resolveFinalDisplayIndices(4, [11, 12, 13])).toEqual([11, 12, 13]);
    expect(resolveFinalDisplayIndices(8, [21, 22])).toEqual([21, 22]);
  });

  test("can freeze from the current survivor table before the next analysis run", () => {
    replaceSurvivingIndices([
      { index: 11, championIndex: 1 },
      { index: 22, championIndex: 2 },
      { index: 33, championIndex: 3 },
      { index: 44, championIndex: 4 },
      { index: 55, championIndex: 5 },
    ]);

    const cohort = syncFinalDisplayCohortFromCurrentSurvivors();

    expect(cohort?.indices).toEqual([11, 22, 33, 44, 55]);
    expect(getFinalDisplayCohort()?.indices).toEqual([11, 22, 33, 44, 55]);
  });
});
