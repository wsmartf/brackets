import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "./test-helpers";
import {
  initDb,
  replaceSurvivingIndices,
  getSurvivorIndices,
  getSurvivorCount,
} from "../lib/db";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => cleanup());

describe("replaceSurvivingIndices", () => {
  test("inserts indices and count matches", () => {
    const data = [
      { index: 42, championIndex: 0 },
      { index: 100, championIndex: 1 },
      { index: 999, championIndex: 0 },
    ];
    replaceSurvivingIndices(data);
    expect(getSurvivorCount()).toBe(3);
  });

  test("replaces previous indices atomically", () => {
    replaceSurvivingIndices([
      { index: 1, championIndex: 0 },
      { index: 2, championIndex: 0 },
    ]);
    replaceSurvivingIndices([{ index: 99, championIndex: 3 }]);
    expect(getSurvivorCount()).toBe(1);
    expect(getSurvivorIndices()).toEqual([99]);
  });

  test("empty replace clears all rows", () => {
    replaceSurvivingIndices([{ index: 7, championIndex: 2 }]);
    replaceSurvivingIndices([]);
    expect(getSurvivorCount()).toBe(0);
  });
});

describe("getSurvivorIndices", () => {
  beforeEach(() => {
    replaceSurvivingIndices([
      { index: 10, championIndex: 0 },
      { index: 20, championIndex: 1 },
      { index: 30, championIndex: 0 },
      { index: 40, championIndex: 2 },
    ]);
  });

  test("returns all indices without filter (up to limit)", () => {
    const indices = getSurvivorIndices({ limit: 100 });
    expect(indices).toHaveLength(4);
    expect(indices).toContain(10);
    expect(indices).toContain(40);
  });

  test("filters by championIndex", () => {
    const indices = getSurvivorIndices({ championIndex: 0, limit: 100 });
    expect(indices).toEqual([10, 30]);
  });

  test("returns empty array for unknown championIndex", () => {
    const indices = getSurvivorIndices({ championIndex: 63, limit: 100 });
    expect(indices).toHaveLength(0);
  });

  test("respects limit", () => {
    const indices = getSurvivorIndices({ limit: 2 });
    expect(indices).toEqual([10, 20]);
  });

  test("supports offset pagination in sorted order", () => {
    const indices = getSurvivorIndices({ limit: 2, offset: 1 });
    expect(indices).toEqual([20, 30]);
  });
});

describe("getSurvivorCount", () => {
  beforeEach(() => {
    replaceSurvivingIndices([
      { index: 1, championIndex: 5 },
      { index: 2, championIndex: 5 },
      { index: 3, championIndex: 7 },
    ]);
  });

  test("total count without filter", () => {
    expect(getSurvivorCount()).toBe(3);
  });

  test("count filtered by championIndex", () => {
    expect(getSurvivorCount(5)).toBe(2);
    expect(getSurvivorCount(7)).toBe(1);
    expect(getSurvivorCount(0)).toBe(0);
  });
});
