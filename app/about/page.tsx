import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About the Model | March Madness 2026",
  description:
    "How the March Madness 2026 site turns a bracket index into a deterministic set of picks and checks those picks against real results.",
};

const PIPELINE_STEPS = [
  {
    label: "1. Start with a number",
    title: "Every possible bracket begins as an index",
    body:
      "The project defines a fixed universe of 1 billion brackets. Each one is identified by a number from 0 to 999,999,999.",
    accent: "stone",
  },
  {
    label: "2. Generate a repeatable stream",
    title: "That number becomes a deterministic random sequence",
    body:
      "The index is used as the seed for a PRNG. The same number always produces the same stream of pseudo-random values.",
    accent: "amber",
  },
  {
    label: "3. Turn the stream into picks",
    title: "Each draw is compared to a game win probability",
    body:
      "For every game, the model compares one random draw to the odds for that matchup. That decides who advances.",
    accent: "sky",
  },
  {
    label: "4. Build one full bracket",
    title: "Repeat that process through all 63 games",
    body:
      "The result is one complete bracket: not stored in a database, but reconstructed on demand from the index.",
    accent: "emerald",
  },
  {
    label: "5. Check it against reality",
    title: "A bracket survives only if it still matches the real tournament",
    body:
      "Once games finish, known winners are recorded. Any generated bracket that disagrees with a completed game is eliminated.",
    accent: "rose",
  },
] as const;

const OPENING_MATCHUPS = [
  "1 vs 16",
  "8 vs 9",
  "5 vs 12",
  "4 vs 13",
  "6 vs 11",
  "3 vs 14",
  "7 vs 10",
  "2 vs 15",
];

const DEEP_DIVE_ITEMS = [
  {
    title: "How the model decides one game",
    body:
      "The model uses KenPom-style team strength via adjusted efficiency margin. For any matchup, the rating difference is converted into a win probability. Stronger teams usually get the better odds, but not certainty.",
  },
  {
    title: "Why seeds still matter",
    body:
      "Seeds are not the probability model itself. They matter because they define the bracket structure: who starts where, who meets in round one, and which future path each team can take through the field.",
  },
  {
    title: "How validation stays fast",
    body:
      "Each bracket is encoded as 63 binary outcomes. Known real results are turned into matching bitmasks, so workers can reject dead brackets with a few integer comparisons instead of expensive object-level checks.",
  },
  {
    title: "Why brackets are not stored",
    body:
      "Determinism removes the need for a giant bracket table. If index 418,275,901 always produces the same picks, the app can reconstruct that bracket whenever it needs it and only cache the aggregate results.",
  },
] as const;

function accentClasses(accent: (typeof PIPELINE_STEPS)[number]["accent"]) {
  switch (accent) {
    case "amber":
      return "border-amber-300/40 bg-amber-100/55 text-stone-900";
    case "sky":
      return "border-sky-300/40 bg-sky-100/65 text-stone-900";
    case "emerald":
      return "border-emerald-300/40 bg-emerald-100/65 text-stone-900";
    case "rose":
      return "border-rose-300/40 bg-rose-100/65 text-stone-900";
    default:
      return "border-black/10 bg-stone-100 text-stone-900";
  }
}

export default function AboutPage() {
  return (
    <main className="about-shell min-h-screen text-stone-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <header className="rounded-[2rem] border border-black/8 bg-white/78 px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
                March Madness 2026
              </p>
              <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-5xl">
                Every bracket starts as a number.
              </h1>
            </div>
            <nav className="flex items-center gap-3 text-sm">
              <Link
                href="/"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-stone-700 transition hover:bg-white"
              >
                Dashboard
              </Link>
              <span className="rounded-full border border-black/8 bg-stone-950 px-4 py-2 text-white">
                About
              </span>
            </nav>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="max-w-3xl text-lg leading-8 text-stone-800">
                This site tracks a deterministic universe of{" "}
                <strong>1 billion model-generated March Madness brackets</strong>
                {" "}and shows how many still match the real tournament.
              </p>
              <p className="max-w-3xl text-base leading-7 text-stone-600">
                It is not storing 1 billion submitted brackets. Instead, it
                starts with a bracket number, turns that number into a repeatable
                sequence of decisions, builds one full bracket, and then checks
                whether that bracket is still alive.
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

        <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              The Core Story
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
              One number becomes one bracket, and reality decides whether it survives.
            </h2>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            {PIPELINE_STEPS.map((step, index) => (
              <article
                key={step.label}
                className={`relative rounded-[1.5rem] border px-4 py-5 ${accentClasses(step.accent)}`}
              >
                <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">
                  {step.label}
                </p>
                <h3 className="mt-3 text-lg font-semibold leading-6">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 opacity-85">{step.body}</p>
                {index < PIPELINE_STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className="about-pipeline-arrow hidden lg:block"
                  />
                )}
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-5 text-white">
            <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
                  One Example
                </p>
                <h3 className="mt-2 text-xl font-semibold">
                  What that pipeline looks like for one game
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

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              Why The Picks Aren&apos;t Random
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              The model uses team strength, not pure coin flips.
            </h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-stone-600 sm:text-base">
              <p>
                The game draws are random in the sense that they come from a
                repeatable random sequence, but the games themselves are not
                treated as 50/50.
              </p>
              <p>
                The app uses KenPom-style adjusted efficiency margin to estimate
                how strong each team is. Stronger teams get higher win odds.
                Upsets still happen, but they happen with the right kind of
                friction.
              </p>
              <p>
                Seeds matter too, but in a different way. Seeds determine the
                bracket shape: who starts where, which first-round matchup they
                get, and what path they would follow if they keep advancing.
              </p>
            </div>
          </article>

          <article className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
            <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
              Seed Structure
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
              Seeds tell you the bracket path.
            </h2>
            <p className="mt-4 text-sm leading-7 text-stone-600 sm:text-base">
              In each region, the opening board follows one canonical NCAA
              order: 1 vs 16, 8 vs 9, 5 vs 12, and so on. That fixed layout is
              what lets every generated bracket mean the same thing from run to
              run.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {OPENING_MATCHUPS.map((matchup) => (
                <div
                  key={matchup}
                  className="rounded-[1.25rem] border border-black/8 bg-stone-950 px-4 py-4 text-center text-white"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    Round 1
                  </p>
                  <p className="mt-2 text-xl font-semibold">{matchup}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm leading-7 text-stone-600 sm:text-base">
              The page should help people see both truths at once: seeds define
              the board, while ratings define the odds once two teams actually
              meet.
            </p>
          </article>
        </section>

        <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
          <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
            How Validation Works
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">
            The site is constantly crossing out brackets that no longer fit reality.
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

          <div className="mt-6 rounded-[1.5rem] border border-dashed border-black/12 bg-stone-100 px-5 py-5">
            <p className="text-sm leading-7 text-stone-700 sm:text-base">
              At a human level, this is the simplest description of the product:
              <strong> the model generates the universe, and reality prunes it.</strong>
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] border border-black/8 bg-white/82 px-5 py-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:px-7">
          <p className="text-xs uppercase tracking-[0.26em] text-stone-500">
            For Curious People
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            A little more detail, without turning the page into a wall of engineering notes.
          </h2>

          <div className="mt-5 space-y-3">
            {DEEP_DIVE_ITEMS.map((item) => (
              <details
                key={item.title}
                className="group rounded-[1.25rem] border border-black/8 bg-white open:bg-stone-50"
              >
                <summary className="cursor-pointer list-none px-5 py-4 text-base font-semibold text-stone-950 marker:content-none">
                  <span className="flex items-center justify-between gap-4">
                    <span>{item.title}</span>
                    <span className="text-stone-400 transition group-open:rotate-45">
                      +
                    </span>
                  </span>
                </summary>
                <div className="px-5 pb-5 text-sm leading-7 text-stone-600 sm:text-base">
                  {item.body}
                </div>
              </details>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-black/8 bg-stone-950 px-5 py-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-400">
              Short Version
            </p>
            <p className="mt-3 text-base leading-7 text-stone-200">
              Every bracket starts as a number. That number always generates the
              same picks. Those picks come from repeatable random draws filtered
              through a KenPom-based win model. Then the real tournament starts
              crossing brackets off the board.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
