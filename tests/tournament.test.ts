import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { createTestDb } from "./test-helpers";
import { initDb, setResult } from "../lib/db";
import {
  computeProbability,
  computeBitmasks,
  getBracketSurvivalState,
  buildGameDefinitions,
  getInitialOrder,
  getPlayInOverrides,
  reconstructBracket,
  type Team,
  type BracketPick,
  type GameResultLike,
} from "../lib/tournament";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STRONG: Team = {
  name: "StrongTeam",
  seed: 1,
  region: "East",
  kenpomRank: 1,
  netRating: 30,
  offenseRating: 127,
  defenseRating: 97,
  adjTempo: 71,
  scheduleNetRating: 18,
};

const WEAK: Team = {
  name: "WeakTeam",
  seed: 16,
  region: "East",
  kenpomRank: 350,
  netRating: -10,
  offenseRating: 100,
  defenseRating: 110,
  adjTempo: 68,
  scheduleNetRating: -15,
};

// ---------------------------------------------------------------------------
// computeProbability
// ---------------------------------------------------------------------------

describe("computeProbability", () => {
  test("1-seed is heavily favored over 16-seed", () => {
    expect(computeProbability(STRONG, WEAK)).toBeGreaterThan(0.85);
  });

  test("16-seed is a big underdog against 1-seed", () => {
    expect(computeProbability(WEAK, STRONG)).toBeLessThan(0.15);
  });

  test("win probabilities sum to approximately 1 (within 2%)", () => {
    // Not exactly 1 due to the model's bias term (which doesn't cancel when swapping teams),
    // but should be close enough that the model is calibrated.
    const pAB = computeProbability(STRONG, WEAK);
    const pBA = computeProbability(WEAK, STRONG);
    expect(pAB + pBA).toBeGreaterThan(0.98);
    expect(pAB + pBA).toBeLessThan(1.02);
  });

  test("identical teams produce a probability near 0.5", () => {
    // The model has a non-zero bias term, so exact 0.5 is not guaranteed,
    // but it should be within a few percent.
    const p = computeProbability(STRONG, STRONG);
    expect(p).toBeGreaterThan(0.45);
    expect(p).toBeLessThan(0.55);
  });

  test("probability is in (0, 1)", () => {
    expect(computeProbability(STRONG, WEAK)).toBeGreaterThan(0);
    expect(computeProbability(STRONG, WEAK)).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// computeBitmasks
// ---------------------------------------------------------------------------

describe("computeBitmasks", () => {
  test("team2 win sets bit; team1 win leaves bit 0", () => {
    const results = [
      { game_index: 0, team1: "A", team2: "B", winner: "B" }, // team2 → bit 0 = 1
      { game_index: 1, team1: "C", team2: "D", winner: "C" }, // team1 → bit 1 = 0
    ];
    const { maskLo, valueLo } = computeBitmasks(results);
    expect(maskLo & 1).toBe(1); // game 0 in mask
    expect(maskLo & 2).toBe(2); // game 1 in mask
    expect(valueLo & 1).toBe(1); // team2 won game 0
    expect(valueLo & 2).toBe(0); // team1 won game 1
  });

  test("null winner is excluded from mask", () => {
    const results = [{ game_index: 0, team1: "A", team2: "B", winner: null }];
    const { maskLo } = computeBitmasks(results);
    expect(maskLo & 1).toBe(0); // game 0 NOT in mask
  });

  test("games 32+ go into hi word", () => {
    const results = [
      { game_index: 32, team1: "A", team2: "B", winner: "B" }, // hi bit 0
      { game_index: 33, team1: "C", team2: "D", winner: "C" }, // hi bit 1
    ];
    const { maskLo, maskHi, valueHi } = computeBitmasks(results);
    expect(maskLo).toBe(0);
    expect(maskHi & 1).toBe(1); // game 32 in hi mask
    expect(maskHi & 2).toBe(2); // game 33 in hi mask
    expect(valueHi & 1).toBe(1); // team2 won game 32
    expect(valueHi & 2).toBe(0); // team1 won game 33
  });

  test("empty results produce all-zero masks", () => {
    const { maskLo, maskHi, valueLo, valueHi } = computeBitmasks([]);
    expect(maskLo).toBe(0);
    expect(maskHi).toBe(0);
    expect(valueLo).toBe(0);
    expect(valueHi).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getBracketSurvivalState
// ---------------------------------------------------------------------------

describe("getBracketSurvivalState", () => {
  const picks: BracketPick[] = [
    { game_index: 0, round: 64, team1: "Duke", team2: "Howard", pick: "Duke" },
    { game_index: 1, round: 64, team1: "UNC", team2: "Yale", pick: "UNC" },
    { game_index: 2, round: 64, team1: "Kansas", team2: "Wagner", pick: "Kansas" },
  ];

  test("no results → all picks pending, bracket alive", () => {
    const state = getBracketSurvivalState(picks, []);
    expect(state.alive).toBe(true);
    expect(state.summary.pending).toBe(3);
    expect(state.summary.correct).toBe(0);
    expect(state.summary.wrong).toBe(0);
    expect(state.eliminated_by).toBeNull();
  });

  test("correct pick is marked alive", () => {
    const results: GameResultLike[] = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Howard", winner: "Duke" },
    ];
    const state = getBracketSurvivalState(picks, results);
    expect(state.picks[0].result).toBe("alive");
    expect(state.picks[1].result).toBe("pending");
    expect(state.summary.correct).toBe(1);
    expect(state.summary.pending).toBe(2);
    expect(state.alive).toBe(true);
  });

  test("wrong pick kills the bracket", () => {
    const results: GameResultLike[] = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Howard", winner: "Howard" },
    ];
    const state = getBracketSurvivalState(picks, results);
    expect(state.picks[0].result).toBe("dead");
    expect(state.alive).toBe(false);
    expect(state.summary.wrong).toBe(1);
  });

  test("eliminated_by captures the first wrong pick", () => {
    const results: GameResultLike[] = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Howard", winner: "Howard" },
      { game_index: 1, round: 64, team1: "UNC", team2: "Yale", winner: "Yale" },
    ];
    const state = getBracketSurvivalState(picks, results);
    expect(state.eliminated_by?.game_index).toBe(0);
    expect(state.eliminated_by?.pick).toBe("Duke");
    expect(state.eliminated_by?.winner).toBe("Howard");
  });

  test("bracket stays alive when all picks are correct", () => {
    const results: GameResultLike[] = [
      { game_index: 0, round: 64, team1: "Duke", team2: "Howard", winner: "Duke" },
      { game_index: 1, round: 64, team1: "UNC", team2: "Yale", winner: "UNC" },
      { game_index: 2, round: 64, team1: "Kansas", team2: "Wagner", winner: "Kansas" },
    ];
    const state = getBracketSurvivalState(picks, results);
    expect(state.alive).toBe(true);
    expect(state.summary.correct).toBe(3);
    expect(state.eliminated_by).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildGameDefinitions + getInitialOrder
// (these need the tournament data file — run from project root)
// ---------------------------------------------------------------------------

describe("buildGameDefinitions", () => {
  test("produces exactly 63 games", () => {
    const defs = buildGameDefinitions();
    expect(defs).toHaveLength(63);
  });

  test("first 32 games are round of 64", () => {
    const defs = buildGameDefinitions();
    const r64 = defs.filter((d) => d.round === 64);
    expect(r64).toHaveLength(32);
    expect(defs.slice(0, 32).every((d) => d.round === 64)).toBe(true);
  });

  test("game indices are 0-62, sequential", () => {
    const defs = buildGameDefinitions();
    defs.forEach((d, i) => expect(d.game_index).toBe(i));
  });

  test("championship game is index 62, round 2", () => {
    const defs = buildGameDefinitions();
    const champ = defs[62];
    expect(champ.round).toBe(2);
  });
});

describe("getInitialOrder", () => {
  test("returns exactly 64 team names", () => {
    const order = getInitialOrder();
    expect(order).toHaveLength(64);
  });

  test("all entries are non-empty strings", () => {
    const order = getInitialOrder();
    expect(order.every((n) => typeof n === "string" && n.length > 0)).toBe(true);
  });

  test("no duplicate team names", () => {
    const order = getInitialOrder();
    expect(new Set(order).size).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// reconstructBracket
// ---------------------------------------------------------------------------

describe("reconstructBracket", () => {
  test("returns exactly 63 picks", () => {
    expect(reconstructBracket(0)).toHaveLength(63);
    expect(reconstructBracket(42)).toHaveLength(63);
  });

  test("is deterministic — same index always yields same picks", () => {
    const a = reconstructBracket(12345);
    const b = reconstructBracket(12345);
    expect(a).toEqual(b);
  });

  test("different indices yield different bracket picks", () => {
    const a = reconstructBracket(0);
    const b = reconstructBracket(1);
    // Overwhelmingly likely to differ in at least one pick
    const diffs = a.filter((pick, i) => pick.pick !== b[i].pick);
    expect(diffs.length).toBeGreaterThan(0);
  });

  test("every pick is one of team1 or team2", () => {
    const picks = reconstructBracket(99);
    for (const pick of picks) {
      expect([pick.team1, pick.team2]).toContain(pick.pick);
    }
  });

  test("rounds decrease correctly (64→32→16→8→4→2)", () => {
    const picks = reconstructBracket(0);
    const rounds = [...new Set(picks.map((p) => p.round))].sort((a, b) => b - a);
    expect(rounds).toEqual([64, 32, 16, 8, 4, 2]);
  });
});

// ---------------------------------------------------------------------------
// getPlayInOverrides
// ---------------------------------------------------------------------------

describe("getPlayInOverrides", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = createTestDb();
    initDb();
  });

  afterEach(() => cleanup());

  test("returns no override when team2 matches the placeholder exactly", () => {
    // Force game 12's team2 to the placeholder "Texas" — means play-in not yet decided
    setResult(12, 64, "Texas", "Texas", null, { source: "seed" });
    const overrides = getPlayInOverrides();
    expect(overrides["Texas"]).toBeUndefined();
  });

  test("returns Howard override when Howard wins play-in at game 12 (Midwest 16-seed slot)", () => {
    // Game 12 is the Midwest 16-seed play-in slot; placeholder is "Texas".
    // Howard is a known play-in team in PLAY_IN_TEAM_BY_NAME.
    setResult(12, 64, "Texas", "Howard", "Howard", { source: "espn" });

    const overrides = getPlayInOverrides();
    expect(overrides["Texas"]).toBeDefined();
    expect(overrides["Texas"].name).toBe("Howard");
    expect(overrides["Texas"].seed).toBe(16);
    expect(overrides["Texas"].region).toBe("Midwest");
  });

  test("returns no override for unknown play-in team not in PLAY_IN_TEAM_BY_NAME", () => {
    // If some unexpected team name appears as team2, it has no entry in PLAY_IN_TEAM_BY_NAME
    setResult(12, 64, "Texas", "SomeUnknownTeam", "SomeUnknownTeam", { source: "espn" });

    const overrides = getPlayInOverrides();
    expect(overrides["Texas"]).toBeUndefined();
  });

  test("returns multiple overrides when multiple play-in results are set", () => {
    // Game 12 = Texas slot (Midwest 16-seed), Howard is a known play-in team there
    // Game 16 = UMBC slot (South 16-seed), Lehigh is a known play-in team there
    setResult(12, 64, "Texas", "Howard", "Howard", { source: "espn" });
    setResult(16, 64, "UMBC", "Lehigh", "Lehigh", { source: "espn" });

    const overrides = getPlayInOverrides();
    expect(overrides["Texas"]?.name).toBe("Howard");
    expect(overrides["UMBC"]?.name).toBe("Lehigh");
  });
});
