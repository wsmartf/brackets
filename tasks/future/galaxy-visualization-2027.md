# Vision: Galaxy / Multiverse Visualization (2027)

## The idea
Represent the bracket space as a navigable universe where clusters of similar brackets form visible structures — bright cores for likely outcomes, dim halos for longshots. As real games finish, entire regions are destroyed in real time.

See the full brainstorm in project notes for the detailed concept (probability lensing, black holes of impossibility, orbital paths, etc.).

## Why not now
The 3D galaxy visualization is a trap if built too early:
- Requires dimensionality reduction (t-SNE/UMAP) on a billion points
- Hard to make both interactive and legible
- Users stare at blobs; the metaphor breaks down when it has to be honest
- Need real user behavior data first to know what questions people actually ask

## Why it could be great in 2027
- We'll have a full year of historical data (2026 snapshots, team paths, elimination events)
- We'll know from actual usage what "team mode" and "collapse narrative" questions users ask
- A 2D cluster view (not full 3D) of bracket families by champion / Final Four / upset pattern is buildable and legible
- The "shatter animation" version (showing probability collapse from 100% → 0.004% as you specify more games) is achievable this year as a simpler precursor

## The pieces to build toward it (2026 foundations)
- Snapshot infrastructure with per-game elimination impact ✓ (task 01-02)
- Team survival paths ✓ (task 09)
- Per-bracket reconstruction API ✓ (task 03)
- "Shatter animation" on About page showing sparsity concept (simple precursor, achievable in 2026)

## The right 2026 analogue
Not a galaxy — but "team mode": click a team, see all surviving bracket families that include them winning, their most probable path, their leverage game. Same insight (bracket space has structure), much more buildable.

## Strongest concepts from the brainstorm (worth revisiting in 2027)
1. **Galaxy cluster view** — clusters by champion/Final Four, zoom to see paths
2. **Shatter animation** — "requiring Duke title: 23% → requiring every game: 0.004%"
3. **Leverage radar** — upcoming games ranked by how much bracket mass they control
4. **Observer mode** — place your bracket in the universe, see where it lives
5. **Extinction events** — elimination as visible destruction, "what just died"

## One thing worth doing this year
A simple text/bar version of the "shatter animation" on the About page:

> Start with 1,000,000,000 brackets.
> Require Duke wins title: ~230,000,000 remain.
> Require Duke's most likely Final Four path: ~47,000,000 remain.
> Require every specific Elite Eight result: ~8,000,000 remain.
> Require the exact most probable bracket: ~40,000 remain.
> Require one specific full bracket: 1 remains.

That single sequence makes the whole project's purpose visceral. Build this on the About page.
