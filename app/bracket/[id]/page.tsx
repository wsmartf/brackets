import BracketViewer from "@/components/BracketViewer";
import { getResults } from "@/lib/db";
import { getBracketSurvivalState, reconstructBracket } from "@/lib/tournament";

function parseBracketId(rawId: string): number | null {
  if (!/^\d{1,10}$/.test(rawId)) {
    return null;
  }

  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id < 0 || id > 999_999_999) {
    return null;
  }

  return id;
}

export const dynamic = "force-dynamic";

export default async function BracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseBracketId(rawId);

  if (id === null) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#efe8db_100%)] text-stone-950">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
          <div className="w-full rounded-[2rem] border border-black/8 bg-white/82 px-6 py-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <p className="text-xs uppercase tracking-[0.24em] text-stone-500">
              Live Bracket Status
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-950">
              Invalid bracket ID
            </h1>
            <p className="mt-4 text-base leading-7 text-stone-700">
              Use a bracket number between 0 and 999,999,999.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const picks = reconstructBracket(id);
  const survivalState = getBracketSurvivalState(picks, getResults());

  return (
    <BracketViewer
      id={id}
      picks={survivalState.picks}
      alive={survivalState.alive}
      summary={survivalState.summary}
      eliminatedBy={survivalState.eliminated_by}
    />
  );
}
