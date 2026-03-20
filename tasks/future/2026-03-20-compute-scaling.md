## Goal
Scale bracket analysis to 100 billion brackets and reduce per-game analysis latency.

## Why
- Current 1B bracket space is fast enough for a single Mac, but 100B would expand the statistical power of the experiment significantly.
- At 100B brackets, the current single-machine JS worker approach would take ~5 minutes per game update. That needs to come down to seconds.

## Background: What We Learned

### Current architecture
- `lib/analyze.ts` spawns N-1 worker threads (one per CPU core), each handling a contiguous slice of the index space.
- `lib/worker.mts` processes one bracket at a time: run mulberry32 63 times, build the bracket round-by-round, check against a 63-bit bitmask.
- Early-exit on the lower 32 bits (line 92) avoids computing upper bits for brackets that already failed.
- Already embarrassingly parallel — no coordination between workers until final count merge.

### Scaling to 100B: compute vs storage

**Pure parallel recompute** is the right approach at 100B. Key numbers:
- ~300M brackets/sec per CPU core in the hot loop
- 100B / 300M = ~333 core-seconds
- 64 cores (4 machines × 16 cores): ~5 seconds per game update
- 100 cloud cores: sub-1 second

**Storing raw brackets** (100B × 8 bytes = 800 GB) is not worth it:
- Sequential read of 800 GB at 2 GB/s = 7 minutes — slower than compute
- Adds enormous write complexity upfront with no throughput win

**Storing surviving indices** (shrinking list after each game):
- Only justified if you need to enumerate specific surviving brackets (e.g. "show me which ones are still alive")
- For count-only: pure recompute wins — no storage overhead, no I/O bottleneck
- Survivor list shrinks fast: after 32 Round 1 games (65% avg favorite wins), ~0.002% survive = ~2M indices = 16 MB. Trivial.

## Optimization Opportunities

### 1. WASM hot loop (highest impact)
The JS JIT has overhead from float division (`/ 4294967296`), GC pressure, and type inference. A C/WASM port of the inner loop (mulberry32 + round simulation + bitmask check) would be 3–5x faster with zero architectural changes — same worker thread model, same message protocol, just replace the JS inner loop with a WASM call.

### 2. WASM SIMD batch generation (highest ceiling)
Process 4–8 brackets in parallel using WASM SIMD (128-bit lanes = 4× 32-bit ops). Each lane holds a different bracket's PRNG state. The round-simulation loop (currentRound/nextRound) is sequential *per bracket* but independent *across brackets*, so lanes never interact. After batch generation, filter with bitwise AND across the batch.

Realistic gain: 4–8x over plain WASM, 12–40x over current JS.

### 3. Multi-machine distribution
The index space partitions trivially — no shared state, no coordination until final count merge. Each machine gets a range `[start, end)` and returns `{ remaining, championCounts }`. A coordinator (the Next.js server or a lightweight orchestrator) fans out work and aggregates. Cloud VMs or a small cluster of Mac Minis would work.

### 4. Batch filter (minor, already partially addressed)
Generating brackets into a typed array (`Uint32Array`) and then running the bitmask filter as a separate vectorizable loop is more cache-friendly than the current interleaved generate+check. The early-exit on `lo` (already implemented) is the main win here; full batching adds modest benefit.

## Recommended Path

1. **Now (1B)**: current JS worker approach is fast enough. No action needed.
2. **If scaling to 10B**: WASM hot loop alone probably sufficient. Single machine, same architecture.
3. **If scaling to 100B**: WASM SIMD + multi-machine distribution. Target <10s per game update on modest cloud burst.

## Constraints
- mulberry32 must remain bit-for-bit identical — any WASM port must produce the same bracket for the same seed as the current JS implementation.
- The worker message protocol (`startIndex`, `endIndex`, `matchupProbabilities`, `maskLo/Hi`, `valueLo/Hi`) is a good interface to preserve — WASM replaces the inner loop, not the worker architecture.
- Do not increase operational complexity for 1B — only pursue this if actually scaling up.

## Affected Files
- `lib/worker.mts` — inner loop replacement target
- `lib/analyze.ts` — orchestrator, would need multi-machine fan-out if distributing
- `lib/prng.ts` — reference implementation to match in WASM
- `wasm/` — new directory for any WASM module

## Current Status
- Not started. Documented after design discussion 2026-03-20.
