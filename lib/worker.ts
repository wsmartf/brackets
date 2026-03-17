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
    const championCounts = new Array<number>(64).fill(0);
    const currentRound = new Uint8Array(64);
    const nextRound = new Uint8Array(64);

    const targetLo = valueLo & maskLo;
    const targetHi = valueHi & maskHi;

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

      // Generate Round of 64 bits while tracking advancing teams.
      for (let i = 0; i < 32; i++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        const team1 = currentRound[i * 2];
        const team2 = currentRound[i * 2 + 1];

        if (rand >= probabilities[i]) {
          lo |= 1 << i;
          nextRound[nextSize++] = team2;
        } else {
          nextRound[nextSize++] = team1;
        }
      }

      // Quick reject on lower 32 bits before computing upper bits
      if ((lo & maskLo) !== targetLo) continue;

      for (let i = 0; i < nextSize; i++) {
        currentRound[i] = nextRound[i];
      }
      currentSize = nextSize;
      nextSize = 0;

      for (let gameIndex = 32; gameIndex < 63; gameIndex++) {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        const pairIndex = nextSize * 2;
        const team1 = currentRound[pairIndex];
        const team2 = currentRound[pairIndex + 1];

        if (rand >= probabilities[gameIndex]) {
          hi |= 1 << (gameIndex - 32);
          nextRound[nextSize++] = team2;
        } else {
          nextRound[nextSize++] = team1;
        }

        if (nextSize * 2 === currentSize) {
          for (let i = 0; i < nextSize; i++) {
            currentRound[i] = nextRound[i];
          }
          currentSize = nextSize;
          nextSize = 0;
        }
      }

      if ((hi & maskHi) !== targetHi) continue;

      remaining++;
      championCounts[currentRound[0]]++;
    }

    parentPort!.postMessage({ remaining, championCounts });
  });
}
