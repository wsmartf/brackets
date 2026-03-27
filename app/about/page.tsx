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
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">

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
                <p className="max-w-3xl text-lg leading-8 text-stone-800">
                  There are 9.2 quintillion possible ways to fill out a March Madness bracket. This site tracks one billion of them — one per integer, generated on demand — and eliminates the ones that got games wrong as the tournament plays out.
                </p>
                <p className="max-w-3xl text-base leading-7 text-stone-600">
                  Every completed game shrinks the universe. By the Elite Eight, the brackets still standing got every single result right. The question &ldquo;how many are left?&rdquo; turns out to be genuinely suspenseful.
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
                    Bracket #8, Game 1
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-stone-300">
                    Index 8 generates a stream of 63 values. The first value is <span className="font-mono text-white">0.11</span>. Game 1 is Duke vs. Siena — the model gives Duke a <span className="font-mono text-white">0.98</span> win probability. Is <span className="font-mono text-white">0.11 &lt; 0.98</span>? Yes, so this bracket has Duke winning. Repeat for all 63 games and you have a complete bracket. Index 9 gets a different stream, a different bracket.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                      Random draw
                    </p>
                    <p className="mt-2 font-mono text-2xl text-white">0.11</p>
                    <p className="mt-1 text-xs text-stone-400">from index 8, game 1</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                      Duke win prob
                    </p>
                    <p className="mt-2 font-mono text-2xl text-white">0.98</p>
                    <p className="mt-1 text-xs text-stone-400">0.11 &lt; 0.98 → Duke wins</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/12 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">
                      Result
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      Duke
                    </p>
                    <p className="mt-1 text-xs text-emerald-100/60">advances in bracket #8</p>
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
              Win probabilities built from 20 years of data.
            </h2>

            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base">
              <p>
                Each game&apos;s win probability comes from a logistic regression model trained on every NCAA tournament matchup from 2002–2025. For each game it looks at the difference in KenPom ratings between the two teams — adjusted efficiency margin, offense, defense, tempo, schedule strength — and outputs a probability. Bigger rating gap, higher probability.
              </p>
              <p>
                It was trained properly: older seasons for training, middle seasons for tuning, 2022–2025 held back entirely as a final check. On those holdout seasons it correctly picked the winner 74% of the time, and the predicted probabilities are well-calibrated — when the model says 70%, the favorite actually wins about 70% of those games.
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
              Inspired by an infinite library.
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base">
              <p>
                Borges wrote about a library containing every possible book — most of it nonsense, but somewhere in it, every true thing ever written. This is a smaller version of that idea: a space so large it&apos;s effectively infinite, but concrete enough to enumerate and watch collapse against reality in real time.
              </p>
            </div>
          </section>

        </div>
      </main>
    </>
  );
}
