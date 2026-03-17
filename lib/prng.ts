/**
 * mulberry32 — A fast, high-quality 32-bit seeded PRNG.
 *
 * CRITICAL: This must be deterministic. Given the same seed, it must always
 * produce the same sequence of numbers. Do not modify this implementation.
 *
 * The same seed must produce the same bracket on any platform (Intel Mac,
 * ARM Mac, Node.js, browser). This is guaranteed because mulberry32 uses
 * only 32-bit integer math (Math.imul + bit shifts).
 *
 * Usage:
 *   const rng = mulberry32(12345);
 *   const value = rng();  // returns float in [0, 1)
 *   const value2 = rng(); // next value in sequence
 */

export function mulberry32(seed: number): () => number {
  let state = seed | 0; // Ensure 32-bit integer
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a single bracket from an index.
 *
 * @param index - The bracket index (0 to NUM_BRACKETS-1), used as PRNG seed
 * @param probabilities - Array of 63 win probabilities. probabilities[i] is the
 *   probability that the "first" team (in canonical order) wins game i.
 *   For Round of 64, these are pre-computed from KenPom ratings.
 *   For later rounds, these depend on who advanced — but since we're generating
 *   a specific bracket, we know who advanced (from earlier bits in this bracket).
 *
 * @returns [lo, hi] — two 32-bit numbers encoding the 63-bit bracket.
 *   Bits 0-31 are in `lo`, bits 32-62 are in `hi` (bit 62 = championship).
 *   Bit N = 0 means team1 won game N, bit N = 1 means team2 won.
 */
export function generateBracketBits(
  index: number,
  probabilities: number[]
): [number, number] {
  const rng = mulberry32(index);
  let lo = 0;
  let hi = 0;

  for (let i = 0; i < 32; i++) {
    if (rng() >= probabilities[i]) {
      lo |= 1 << i;
    }
  }
  for (let i = 32; i < 63; i++) {
    if (rng() >= probabilities[i]) {
      hi |= 1 << (i - 32);
    }
  }

  return [lo, hi];
}

/**
 * Check if a bracket matches known results using bitmask comparison.
 *
 * @param bracketLo - Lower 32 bits of the bracket
 * @param bracketHi - Upper 31 bits of the bracket
 * @param maskLo - Lower 32 bits of the known-games mask (bit=1 if game result is known)
 * @param maskHi - Upper 31 bits of the known-games mask
 * @param valueLo - Lower 32 bits of the known results (bit=1 if team2 won)
 * @param valueHi - Upper 31 bits of the known results
 * @returns true if bracket matches all known results
 */
export function bracketMatchesMask(
  bracketLo: number,
  bracketHi: number,
  maskLo: number,
  maskHi: number,
  valueLo: number,
  valueHi: number
): boolean {
  return (
    (bracketLo & maskLo) === (valueLo & maskLo) &&
    (bracketHi & maskHi) === (valueHi & maskHi)
  );
}
