import { describe, test, expect } from "vitest";
import { mulberry32, generateBracketBits, bracketMatchesMask } from "../lib/prng";

describe("mulberry32", () => {
  test("is deterministic — same seed always produces the same sequence", () => {
    const rng1 = mulberry32(42);
    const rng2 = mulberry32(42);
    for (let i = 0; i < 100; i++) {
      expect(rng1()).toBe(rng2());
    }
  });

  test("different seeds produce different sequences", () => {
    const seq = (seed: number) => Array.from({ length: 20 }, mulberry32(seed));
    expect(seq(0)).not.toEqual(seq(1));
    expect(seq(42)).not.toEqual(seq(43));
    expect(seq(0)).not.toEqual(seq(1_000_000));
  });

  test("output is always in [0, 1)", () => {
    const rng = mulberry32(99999);
    for (let i = 0; i < 2000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  // Golden test: if this fails, the PRNG changed and ALL bracket indices are now wrong.
  // Do not update these values — fix the PRNG regression instead.
  test("known output for seed 0 (golden — fail = PRNG broken)", () => {
    const rng = mulberry32(0);
    expect(rng()).toMatchSnapshot();
    expect(rng()).toMatchSnapshot();
    expect(rng()).toMatchSnapshot();
  });
});

describe("generateBracketBits", () => {
  test("is deterministic — same index always produces same [lo, hi]", () => {
    const probs = new Array(63).fill(0.5);
    expect(generateBracketBits(0, probs)).toEqual(generateBracketBits(0, probs));
    expect(generateBracketBits(42, probs)).toEqual(generateBracketBits(42, probs));
    expect(generateBracketBits(999_999_999, probs)).toEqual(
      generateBracketBits(999_999_999, probs)
    );
  });

  test("different indices produce different brackets", () => {
    const probs = new Array(63).fill(0.5);
    const [lo0, hi0] = generateBracketBits(0, probs);
    const [lo1, hi1] = generateBracketBits(1, probs);
    // The probability of two random brackets being identical is ~1/2^63
    expect([lo0, hi0]).not.toEqual([lo1, hi1]);
  });

  test("prob=1 for all games → team1 always wins → all bits 0", () => {
    // rng() is always in [0, 1), so rng() >= 1 is never true → bit never set
    const [lo, hi] = generateBracketBits(42, new Array(63).fill(1));
    expect(lo).toBe(0);
    expect(hi).toBe(0);
  });

  test("prob=0 for all games → team2 always wins → all bits set", () => {
    // rng() >= 0 is always true → every bit is set
    const [lo, hi] = generateBracketBits(42, new Array(63).fill(0));
    // 32 bits all set = -1 in JS signed 32-bit arithmetic
    expect(lo).toBe(-1);
    // 31 bits set (indices 0-30 of hi correspond to games 32-62)
    expect(hi & 0x7fffffff).toBe(0x7fffffff);
  });

  test("returns a [number, number] tuple", () => {
    const result = generateBracketBits(0, new Array(63).fill(0.5));
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe("number");
    expect(typeof result[1]).toBe("number");
  });
});

describe("bracketMatchesMask", () => {
  test("matches when bracket agrees with all masked bits", () => {
    // bits 0 and 1 in mask, bracket matches value exactly
    expect(bracketMatchesMask(0b11, 0, 0b11, 0, 0b11, 0)).toBe(true);
    expect(bracketMatchesMask(0b01, 0, 0b11, 0, 0b01, 0)).toBe(true);
  });

  test("rejects when bracket disagrees with a masked bit", () => {
    // mask has bit 0, bracket has 0 there, value expects 1
    expect(bracketMatchesMask(0b00, 0, 0b01, 0, 0b01, 0)).toBe(false);
    expect(bracketMatchesMask(0b11, 0, 0b11, 0, 0b01, 0)).toBe(false);
  });

  test("zero mask matches anything (no games decided yet)", () => {
    expect(bracketMatchesMask(0xffff, 0, 0, 0, 0, 0)).toBe(true);
    expect(bracketMatchesMask(0, 0, 0, 0, 0xffff, 0)).toBe(true);
    expect(bracketMatchesMask(-1, -1, 0, 0, 0, 0)).toBe(true);
  });

  test("checks lo and hi independently", () => {
    // hi agrees but lo doesn't
    expect(bracketMatchesMask(0, 1, 1, 1, 1, 1)).toBe(false);
    // lo agrees but hi doesn't
    expect(bracketMatchesMask(1, 0, 1, 1, 1, 1)).toBe(false);
    // both agree
    expect(bracketMatchesMask(1, 1, 1, 1, 1, 1)).toBe(true);
  });

  test("only checks bits where mask is set", () => {
    // mask=0b01: only bit 0 matters. value=0b00: bit 0 should be 0.
    // bracket has bit 1 set (irrelevant) and bit 0 clear (matches value) → true
    expect(bracketMatchesMask(0b10, 0, 0b01, 0, 0b00, 0)).toBe(true);
    // same mask/value but bracket has bit 0 set (does NOT match value=0) → false
    expect(bracketMatchesMask(0b01, 0, 0b01, 0, 0b00, 0)).toBe(false);
  });
});
