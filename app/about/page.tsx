import type { Metadata } from "next";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "About the Model | March Madness 2026",
  description:
    "How the March Madness 2026 site turns a bracket index into a deterministic set of picks and checks those picks against real results.",
};

export default function AboutPage() {
  return (
    <>
      <SiteNav activePage="about" />
      <main className="about-shell min-h-screen text-stone-950">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">

          {/* Section 1 — Header card */}
          <header className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 sm:py-6">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              March Madness 2026
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
              Every bracket starts as a number.
            </h1>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                {/* PLACEHOLDER: human writing needed */}
                <p className="max-w-3xl text-lg leading-8 text-stone-800">
                  [Write your intro here — 2-3 sentences on what this is and why it&apos;s interesting]
                </p>
                <p className="max-w-3xl text-base leading-7 text-stone-600">
                  [Continue the intro — how the site works at a high level, what a visitor will find here]
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                <div className="rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-4 text-white">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                    Universe
                  </p>
                  <p className="mt-2 text-3xl font-semibold">1,000,000,000</p>
                  <p className="mt-1 text-sm text-stone-300">
                    deterministic bracket indices
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-black/8 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                    One Bracket
                  </p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-stone-950">
                    #418,275,901
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    always generates the same picks
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-black/8 bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                    Validation
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-stone-950">
                    63
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    game outcomes checked against reality
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Section 2 — How it works */}
          <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
                How it works
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
                One number becomes one complete bracket.
              </h2>
              <p className="mt-4 text-base leading-7 text-stone-600 sm:text-lg sm:leading-8">
                Each bracket in the universe is identified by an integer. That integer seeds a
                deterministic pseudorandom number generator, which produces a repeatable stream of
                values. For each of the 63 tournament games, one draw from that stream is compared
                to the model&apos;s win probability for the matchup — and the result of that comparison
                decides who advances. The same number always produces the same bracket.
              </p>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-5 text-white">
              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                    One Example
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    What that looks like for one game
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    Imagine a generated bracket reaches a 1-seed vs 16-seed
                    first-round game. The stronger team gets very high win odds,
                    but the seeded random draw still decides whether this
                    particular bracket follows the favorite or produces the upset.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                      Random Draw
                    </p>
                    <p className="mt-2 font-mono text-2xl text-white">0.41</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                      Favorite Win Odds
                    </p>
                    <p className="mt-2 font-mono text-2xl text-white">0.95</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/12 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">
                      Result
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      Favorite
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3 — The model */}
          <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              The model
            </p>
            {/* PLACEHOLDER: human writing needed */}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              [PLACEHOLDER — e.g. &quot;A logistic regression trained on 20 years of data.&quot; — needs rewriting]
            </h2>

            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base">
              {/* PLACEHOLDER: human writing needed */}
              <p>
                [PLACEHOLDER — model details: what data was used, how win probabilities are computed, training pipeline]
              </p>
              <p>
                [PLACEHOLDER — accuracy and calibration: how well the model predicts games, any validation against historical results]
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-4 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                  Training Data
                </p>
                <p className="mt-2 text-3xl font-semibold">20 years</p>
                <p className="mt-1 text-sm text-stone-300">
                  of tournament history
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-black/8 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Features
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">KenPom data</p>
                <p className="mt-1 text-sm text-stone-600">
                  adjusted efficiency margin
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-black/8 bg-white px-5 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  Method
                </p>
                <p className="mt-2 text-2xl font-semibold text-stone-950">Logistic regression</p>
                <p className="mt-1 text-sm text-stone-600">
                  per-game win probability
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 — Validation */}
          <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              How games eliminate brackets
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              The model generates the universe. Reality prunes it.
            </h2>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <article className="rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-5 text-white">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                  1. Record Reality
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  As games finish, the real winners are saved. Those completed
                  results become the facts that every generated bracket must match.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-black/8 bg-white px-5 py-5">
                <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
                  2. Rebuild Brackets
                </p>
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  Worker threads regenerate bracket after bracket from their index
                  ranges, using the same deterministic generation process every time.
                </p>
              </article>
              <article className="rounded-[1.5rem] border border-black/8 bg-rose-50 px-5 py-5">
                <p className="text-xs uppercase tracking-[0.2em] text-rose-700/70">
                  3. Keep Or Eliminate
                </p>
                <p className="mt-3 text-sm leading-6 text-rose-950/80">
                  If a generated bracket disagrees with even one completed game,
                  it is out. If it still agrees with everything we know, it survives.
                </p>
              </article>
            </div>
          </section>

          {/* Section 5 — Why this exists */}
          <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              Why this exists
            </p>
            {/* PLACEHOLDER: human writing needed */}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              [PLACEHOLDER — your headline for why you built this]
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base">
              {/* PLACEHOLDER: human writing needed */}
              <p>
                [PLACEHOLDER — personal section: why you built this, the Library of Babel connection, what excites you about it]
              </p>
              <p>
                [PLACEHOLDER — next year plans, what you&apos;d do differently, what you learned]
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
