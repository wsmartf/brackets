import { describe, expect, test } from "vitest";
import { __testExports } from "@/lib/final-n-insights";

// Tournament-2026 team order (from getInitialOrder): Duke=0, Siena=1, Ohio State=2, TCU=3, ...
// Game 0 (R64): Duke vs Siena
// Game 1 (R64): Ohio State vs TCU
const TEAM_INDEX = new Map([
  ["Duke", 0],
  ["Siena", 1],
  ["Ohio State", 2],
  ["TCU", 3],
]);

function mockTable(entries: Array<[winner: number, opponent: number, prob: number]>): number[] {
  const table = new Array(64 * 64).fill(0);
  for (const [w, o, p] of entries) {
    table[w * 64 + o] = p;
  }
  return table;
}

describe("computePatternProbability", () => {
  test("returns probability for a single pending game", () => {
    // Duke (0) beats Siena (1) with probability 0.7
    const table = mockTable([[0, 1, 0.7]]);
    const picks = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const },
    ];
    expect(__testExports.computePatternProbability(picks, [0], [], table, TEAM_INDEX)).toBeCloseTo(0.7);
  });

  test("returns product of probabilities for two sequential pending games", () => {
    // Duke (0) over Siena (1) = 0.7; Ohio State (2) over TCU (3) = 0.4
    const table = mockTable([[0, 1, 0.7], [2, 3, 0.4]]);
    const picks = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const },
      { game_index: 1, round: 64, team1: "Ohio State", team2: "TCU", pick: "Ohio State", result: "pending" as const },
    ];
    expect(__testExports.computePatternProbability(picks, [0, 1], [], table, TEAM_INDEX)).toBeCloseTo(0.7 * 0.4);
  });

  test("returns 1.0 for empty gameIndices", () => {
    const picks = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const },
    ];
    expect(__testExports.computePatternProbability(picks, [], [], mockTable([]), TEAM_INDEX)).toBe(1);
  });

  test("returns 0 when pick is not a valid team in the game", () => {
    const table = mockTable([[0, 1, 0.7]]);
    const picks = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Unknown Team", result: "pending" as const },
    ];
    expect(__testExports.computePatternProbability(picks, [0], [], table, TEAM_INDEX)).toBe(0);
  });

  test("returns 0 when pick team is not in teamNameToIndex", () => {
    const table = mockTable([[0, 1, 0.7]]);
    const picks = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const },
    ];
    const partialIndex = new Map([["Siena", 1]]); // Duke missing
    expect(__testExports.computePatternProbability(picks, [0], [], table, partialIndex)).toBe(0);
  });
});

describe("computeMilestoneProbability", () => {
  test("returns 0 for empty brackets list", () => {
    expect(__testExports.computeMilestoneProbability([], [0], [], mockTable([]), TEAM_INDEX)).toBe(0);
  });

  test("returns 1.0 for empty gameIndices (milestone already achieved)", () => {
    const brackets = [
      { index: 1, picks: [{ game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const }] },
    ];
    expect(__testExports.computeMilestoneProbability(brackets, [], [], mockTable([]), TEAM_INDEX)).toBe(1);
  });

  test("deduplicates brackets with identical pick patterns", () => {
    // Two brackets with the same Duke pick — only count the pattern once
    const table = mockTable([[0, 1, 0.7]]);
    const pick = { game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const };
    const brackets = [
      { index: 1, picks: [pick] },
      { index: 2, picks: [pick] },
    ];
    expect(__testExports.computeMilestoneProbability(brackets, [0], [], table, TEAM_INDEX)).toBeCloseTo(0.7);
  });

  test("sums distinct mutually-exclusive patterns", () => {
    // Bracket A picks Duke (0.7), Bracket B picks Siena (0.3) — exclusive events sum to 1.0
    const table = mockTable([[0, 1, 0.7], [1, 0, 0.3]]);
    const brackets = [
      { index: 1, picks: [{ game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Duke", result: "pending" as const }] },
      { index: 2, picks: [{ game_index: 0, round: 64, team1: "Duke", team2: "Siena", pick: "Siena", result: "pending" as const }] },
    ];
    expect(__testExports.computeMilestoneProbability(brackets, [0], [], table, TEAM_INDEX)).toBeCloseTo(1.0);
  });
});

describe("final-n-insights helpers", () => {
  test("computeBestCaseSurvivorCount groups brackets by shared picks across target games", () => {
    const brackets = [
      {
        index: 1,
        picks: [
          { game_index: 48, pick: "Duke", round: 16, team1: "Duke", team2: "Michigan", result: "pending" as const },
          { game_index: 49, pick: "Houston", round: 16, team1: "Houston", team2: "Purdue", result: "pending" as const },
        ],
      },
      {
        index: 2,
        picks: [
          { game_index: 48, pick: "Duke", round: 16, team1: "Duke", team2: "Michigan", result: "pending" as const },
          { game_index: 49, pick: "Houston", round: 16, team1: "Houston", team2: "Purdue", result: "pending" as const },
        ],
      },
      {
        index: 3,
        picks: [
          { game_index: 48, pick: "Michigan", round: 16, team1: "Duke", team2: "Michigan", result: "pending" as const },
          { game_index: 49, pick: "Houston", round: 16, team1: "Houston", team2: "Purdue", result: "pending" as const },
        ],
      },
    ];

    expect(__testExports.computeBestCaseSurvivorCount(brackets, [48, 49])).toBe(2);
  });
});
