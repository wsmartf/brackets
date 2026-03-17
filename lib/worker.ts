/**
 * Worker thread for bracket analysis.
 *
 * Receives a range of bracket indices + filter parameters via parentPort.
 * For each index, generates the bracket and checks if it matches known results.
 * Counts remaining brackets and tracks championship winners.
 *
 * This file is spawned by analyze.ts using Node.js worker_threads.
 *
 * Message protocol:
 *   Main → Worker: {
 *     startIndex: number,
 *     endIndex: number,
 *     probabilities: number[],   // 63 win probabilities
 *     maskLo: number,
 *     maskHi: number,
 *     valueLo: number,
 *     valueHi: number,
 *     numTeams: number,          // 64 (for champion index mapping)
 *   }
 *
 *   Worker → Main: {
 *     remaining: number,
 *     championCounts: number[],  // length 64, counts per team index
 *   }
 */

import { parentPort } from "worker_threads";

// Inline mulberry32 for maximum performance (avoid function call overhead)
// This is identical to the version in prng.ts but inlined here.

if (parentPort) {
  parentPort.on("message", (msg) => {
    const {
      startIndex,
      endIndex,
      probabilities,
      maskLo,
      maskHi,
      valueLo,
      valueHi,
    } = msg as {
      startIndex: number;
      endIndex: number;
      probabilities: number[];
      maskLo: number;
      maskHi: number;
      valueLo: number;
      valueHi: number;
    };

    let remaining = 0;
    // Track which team (by initial_order index) wins the championship
    // Champion is determined by bit 62 (game index 62).
    // But to know WHICH team won, we need to trace the bracket path.
    // For V1 simplification: just count remaining. Championship probs
    // require decoding the winner, which is more complex.
    //
    // To determine the champion, we'd need to simulate the bracket forward
    // (tracking which team index advances through each round). This is doable
    // but adds complexity to the hot loop. For V1, we can skip championship
    // probs or compute them in a separate slower pass over matching brackets only.
    //
    // For now: just count remaining brackets.
    // TODO V2: track champions by simulating team advancement in the hot loop.

    const targetLo = valueLo & maskLo;
    const targetHi = valueHi & maskHi;

    for (let index = startIndex; index < endIndex; index++) {
      // --- Inline mulberry32 PRNG ---
      let state = index | 0;
      let lo = 0;
      let hi = 0;

      // Generate 32 bits (games 0-31, Round of 64 + part of Round of 32)
      for (let i = 0; i < 32; i++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        if (rand >= probabilities[i]) {
          lo |= 1 << i;
        }
      }

      // Quick reject on lower 32 bits before computing upper bits
      if ((lo & maskLo) !== targetLo) continue;

      // Generate 31 bits (games 32-62, remaining rounds through championship)
      for (let i = 32; i < 63; i++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        if (rand >= probabilities[i]) {
          hi |= 1 << (i - 32);
        }
      }

      if ((hi & maskHi) !== targetHi) continue;

      remaining++;
    }

    parentPort!.postMessage({ remaining });
  });
}
