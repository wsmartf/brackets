/**
 * Benchmark computeDerivedStats at various survivor counts.
 *
 * Usage:
 *   npx tsx scripts/bench-derived-stats.ts
 *
 * Tests synthetic survivor indices (random bracket indices) at 100k, 1M, and 10M counts.
 * The reconstruction cost dominates — this tells you if the 10M threshold is viable.
 */

import { reconstructBracket, getInitialOrder } from "../lib/tournament";
import { mulberry32 } from "../lib/prng";

// Inline the core of computeDerivedStats to benchmark it without DB setup
function computeDerivedStats(
  survivorIndices: Array<{ index: number; championIndex: number }>
): void {
  const initialOrder = getInitialOrder();
  const teamIndex = new Map<string, number>(initialOrder.map((name, i) => [name, i]));
  const NUM_ROUNDS = 7;
  const roundCounts: number[][] = Array.from({ length: initialOrder.length }, () =>
    new Array<number>(NUM_ROUNDS).fill(0)
  );
  const gamePicks: Array<[number, number]> = Array.from({ length: 63 }, () => [0, 0]);

  for (const { index } of survivorIndices) {
    const picks = reconstructBracket(index);
    for (const pick of picks) {
      const roundIndex = Math.round(Math.log2(64 / pick.round));
      const team1Idx = teamIndex.get(pick.team1) ?? -1;
      const team2Idx = teamIndex.get(pick.team2) ?? -1;
      const pickedTeam1 = pick.pick === pick.team1;

      gamePicks[pick.game_index][pickedTeam1 ? 0 : 1]++;

      if (team1Idx >= 0) roundCounts[team1Idx][roundIndex]++;
      if (team2Idx >= 0) roundCounts[team2Idx][roundIndex]++;

      if (pick.game_index === 62) {
        const champIdx = pickedTeam1 ? team1Idx : team2Idx;
        if (champIdx >= 0) roundCounts[champIdx][6]++;
      }
    }
  }

  // Consume results so JIT can't elide the loop
  let checksum = 0;
  for (const row of roundCounts) for (const v of row) checksum += v;
  for (const [a, b] of gamePicks) checksum += a + b;
  process.stdout.write(`  checksum=${checksum}\n`);
}

function generateSyntheticIndices(
  count: number,
  seed = 42
): Array<{ index: number; championIndex: number }> {
  const rng = mulberry32(seed);
  const result: Array<{ index: number; championIndex: number }> = [];
  for (let i = 0; i < count; i++) {
    // Random bracket index in [0, 1B)
    const index = Math.floor(rng() * 1_000_000_000);
    result.push({ index, championIndex: Math.floor(rng() * 64) });
  }
  return result;
}

async function bench(label: string, count: number): Promise<number> {
  process.stdout.write(`\n${label} (n=${count.toLocaleString()}):\n`);
  const indices = generateSyntheticIndices(count);

  const start = performance.now();
  computeDerivedStats(indices);
  const elapsed = performance.now() - start;

  const perBracket = elapsed / count;
  process.stdout.write(`  elapsed=${elapsed.toFixed(1)}ms  per-bracket=${perBracket.toFixed(4)}ms\n`);
  return elapsed;
}

async function main() {
  process.stdout.write("Benchmarking computeDerivedStats (Map-based, after fix)\n");
  process.stdout.write("=".repeat(55) + "\n");

  // Warm up JIT
  process.stdout.write("\nWarm-up (10k):\n");
  const warmup = generateSyntheticIndices(10_000);
  computeDerivedStats(warmup);

  await bench("100k survivors", 100_000);
  await bench("1M survivors", 1_000_000);
  await bench("10M survivors", 10_000_000);

  process.stdout.write("\nDone.\n");
}

void main();
