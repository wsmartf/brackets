/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Worker for bracket-stats.cjs.
 *
 * Receives a range of bracket indices and accumulates:
 *   - teamRoundCounts[64][6]: how many brackets each team won each round
 *   - pickCounts[63]: how many brackets picked team2 in each game slot
 *   - r1UpsetHistogram[33]: distribution of R1 upset counts per bracket
 *
 * Message protocol:
 *   Main → Worker: {
 *     startIndex: number,
 *     endIndex: number,
 *     matchupProbabilities: number[],  // flat 64×64
 *     isTeam2UpsetR1: boolean[],        // length 32
 *   }
 *   Worker → Main: {
 *     teamRoundCounts: Int32Array,      // 64*6 = 384 values
 *     pickCounts: Int32Array,           // 63 values
 *     r1UpsetHistogram: Int32Array,     // 33 values
 *   }
 */

const { parentPort } = require("worker_threads");

if (parentPort) {
  parentPort.on("message", (msg) => {
    const { startIndex, endIndex, matchupProbabilities, isTeam2UpsetR1 } = msg;

    const teamRoundCounts = new Int32Array(64 * 6);
    const pickCounts = new Int32Array(63);
    const r1UpsetHistogram = new Int32Array(33);

    const currentRound = new Uint8Array(64);
    const nextRound = new Uint8Array(64);

    for (let index = startIndex; index < endIndex; index++) {
      // --- Inline mulberry32 PRNG ---
      let state = index | 0;
      let lo = 0;
      let hi = 0;
      let currentSize = 64;
      let nextSize = 0;

      for (let i = 0; i < 64; i++) {
        currentRound[i] = i;
      }

      // Round 0 (R64): 32 games, bits packed into lo
      let r1Upsets = 0;
      for (let i = 0; i < 32; i++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        const team1 = currentRound[i * 2];
        const team2 = currentRound[i * 2 + 1];
        const probability = matchupProbabilities[team1 * 64 + team2];

        let winner;
        if (rand >= probability) {
          lo |= 1 << i;
          nextRound[nextSize++] = team2;
          winner = team2;
          // team2 winning is always an upset (higher seed number)
          if (isTeam2UpsetR1[i]) r1Upsets++;
        } else {
          nextRound[nextSize++] = team1;
          winner = team1;
          // team1 winning when it's NOT supposed to be the favorite is also upset
          // but per the plan: team2 always has higher seed number, so only team2 win = upset
        }
        // Round 0 = index 0 in teamRoundCounts
        teamRoundCounts[winner * 6 + 0]++;
      }

      r1UpsetHistogram[r1Upsets]++;

      for (let i = 0; i < nextSize; i++) {
        currentRound[i] = nextRound[i];
      }
      currentSize = nextSize;
      nextSize = 0;

      // Rounds 1-5 (R32, S16, E8, F4, Championship): games 32-62, bits in hi
      for (let gameIndex = 32; gameIndex < 63; gameIndex++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        const pairIndex = nextSize * 2;
        const team1 = currentRound[pairIndex];
        const team2 = currentRound[pairIndex + 1];
        const probability = matchupProbabilities[team1 * 64 + team2];

        let winner;
        if (rand >= probability) {
          hi |= 1 << (gameIndex - 32);
          nextRound[nextSize++] = team2;
          winner = team2;
        } else {
          nextRound[nextSize++] = team1;
          winner = team1;
        }

        // Determine which round index (1-5) this game belongs to:
        // gameIndex 32-47 → R32 (round 1), 48-55 → S16 (round 2),
        // 56-59 → E8 (round 3), 60-61 → F4 (round 4), 62 → Championship (round 5)
        let roundIdx;
        if (gameIndex < 48) roundIdx = 1;
        else if (gameIndex < 56) roundIdx = 2;
        else if (gameIndex < 60) roundIdx = 3;
        else if (gameIndex < 62) roundIdx = 4;
        else roundIdx = 5;

        teamRoundCounts[winner * 6 + roundIdx]++;

        if (nextSize * 2 === currentSize) {
          for (let i = 0; i < nextSize; i++) {
            currentRound[i] = nextRound[i];
          }
          currentSize = nextSize;
          nextSize = 0;
        }
      }

      // Accumulate pickCounts from lo (bits 0-31) and hi (bits 0-30 = games 32-62)
      for (let i = 0; i < 32; i++) {
        if (lo & (1 << i)) pickCounts[i]++;
      }
      for (let i = 0; i < 31; i++) {
        if (hi & (1 << i)) pickCounts[32 + i]++;
      }
    }

    parentPort.postMessage(
      {
        teamRoundCounts,
        pickCounts,
        r1UpsetHistogram,
      },
      [teamRoundCounts.buffer, pickCounts.buffer, r1UpsetHistogram.buffer]
    );
  });
}
