/* eslint-disable @typescript-eslint/no-require-imports */
const { buildMatchupProbabilityTable, getInitialOrder } = require("../../lib/tournament.ts");

const DEFAULT_NUM_BRACKETS = 10_000_000;
const PROGRESS_EVERY = 1_000_000;

function parsePositiveInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatPercent(numerator, denominator) {
  if (denominator === 0) return "0.000000%";
  return `${((numerator / denominator) * 100).toFixed(6)}%`;
}

function getMemoryMb() {
  return Number((process.memoryUsage().rss / (1024 * 1024)).toFixed(1));
}

function generatePackedBracket(index, matchupProbabilities) {
  let state = index | 0;
  let lo = 0;
  let hi = 0;
  const currentRound = new Uint8Array(64);
  const nextRound = new Uint8Array(64);
  let currentSize = 64;
  let nextSize = 0;

  for (let i = 0; i < 64; i++) {
    currentRound[i] = i;
  }

  for (let i = 0; i < 32; i++) {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const team1 = currentRound[i * 2];
    const team2 = currentRound[i * 2 + 1];
    const probability = matchupProbabilities[team1 * 64 + team2];

    if (rand >= probability) {
      lo |= 1 << i;
      nextRound[nextSize++] = team2;
    } else {
      nextRound[nextSize++] = team1;
    }
  }

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
    const probability = matchupProbabilities[team1 * 64 + team2];

    if (rand >= probability) {
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

  return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
}

async function main() {
  const numBrackets = parsePositiveInt(process.env.COLLISION_NUM_BRACKETS, DEFAULT_NUM_BRACKETS);
  const matchupProbabilities = buildMatchupProbabilityTable();
  const initialOrder = getInitialOrder();
  const packedBrackets = new BigUint64Array(numBrackets);
  const startedAt = new Date().toISOString();
  const generationStart = process.hrtime.bigint();

  console.error(
    `Generating ${numBrackets.toLocaleString()} brackets across ${initialOrder.length} teams...`
  );

  for (let index = 0; index < numBrackets; index++) {
    packedBrackets[index] = generatePackedBracket(index, matchupProbabilities);

    if ((index + 1) % PROGRESS_EVERY === 0 || index + 1 === numBrackets) {
      console.error(
        `Generated ${(index + 1).toLocaleString()} / ${numBrackets.toLocaleString()} ` +
          `(rss ${getMemoryMb()} MB)`
      );
    }
  }

  const generationSeconds = Number(process.hrtime.bigint() - generationStart) / 1e9;
  const sortStart = process.hrtime.bigint();
  console.error(`Sorting ${numBrackets.toLocaleString()} packed brackets...`);
  packedBrackets.sort();
  const sortSeconds = Number(process.hrtime.bigint() - sortStart) / 1e9;

  const sweepStart = process.hrtime.bigint();
  let uniqueCount = 0;
  let duplicateSeeds = 0;
  let collidingBracketCount = 0;
  let maxMultiplicity = 0;
  const topCollisionGroups = [];

  for (let i = 0; i < packedBrackets.length; ) {
    let runLength = 1;
    while (i + runLength < packedBrackets.length && packedBrackets[i + runLength] === packedBrackets[i]) {
      runLength++;
    }

    uniqueCount++;
    if (runLength > 1) {
      duplicateSeeds += runLength - 1;
      collidingBracketCount++;
      if (runLength > maxMultiplicity) {
        maxMultiplicity = runLength;
      }

      topCollisionGroups.push({
        bracketHex: `0x${packedBrackets[i].toString(16).padStart(16, "0")}`,
        count: runLength,
      });
      topCollisionGroups.sort((a, b) => b.count - a.count);
      if (topCollisionGroups.length > 10) {
        topCollisionGroups.length = 10;
      }
    }

    i += runLength;
  }

  const sweepSeconds = Number(process.hrtime.bigint() - sweepStart) / 1e9;
  const totalSeconds = generationSeconds + sortSeconds + sweepSeconds;
  const result = {
    sampleSize: numBrackets,
    startedAt,
    finishedAt: new Date().toISOString(),
    generationSeconds: Number(generationSeconds.toFixed(3)),
    sortSeconds: Number(sortSeconds.toFixed(3)),
    sweepSeconds: Number(sweepSeconds.toFixed(3)),
    totalSeconds: Number(totalSeconds.toFixed(3)),
    rssMb: getMemoryMb(),
    uniqueBrackets: uniqueCount,
    duplicateSeeds,
    collidingBracketCount,
    uniqueFraction: Number((uniqueCount / numBrackets).toFixed(8)),
    duplicateSeedRate: formatPercent(duplicateSeeds, numBrackets),
    collidedBracketRate: formatPercent(collidingBracketCount, uniqueCount),
    maxMultiplicity,
    topCollisionGroups,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
