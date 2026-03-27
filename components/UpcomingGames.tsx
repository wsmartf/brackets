import type { EliminationImpact } from "@/components/GameFeed";
import type { GameResult, SurvivorBracket } from "@/hooks/useHomepageData";
import type { FutureKillerRow } from "@/lib/future-killers";

interface UpcomingGamesProps {
  futureKillers: FutureKillerRow[];
  survivors: SurvivorBracket[];
  results: GameResult[];
  now: number;
  latestGame: GameResult | null;
  latestGameImpact: EliminationImpact | null;
  futureKillersNote: string | null;
  futureKillersIsFallback: boolean;
}

type GameStatus = "scheduled" | "likely-live" | "completed";

const ROUND_LABELS: Record<number, string> = {
  64: "Round of 64",
  32: "Round of 32",
  16: "Sweet 16",
  8: "Elite Eight",
  4: "Final Four",
  2: "Championship",
};

function formatRound(round: number): string {
  return ROUND_LABELS[round] ?? `Round ${round}`;
}

function formatScheduledLabel(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function classifyGame(row: FutureKillerRow, survivors: SurvivorBracket[]) {
  const team1Brackets: number[] = [];
  const team2Brackets: number[] = [];

  for (const bracket of survivors) {
    const pick = bracket.picks.find((candidate) => candidate.game_index === row.gameIndex);
    if (!pick) {
      continue;
    }

    if (pick.pick === row.team1) {
      team1Brackets.push(bracket.index);
    } else if (pick.pick === row.team2) {
      team2Brackets.push(bracket.index);
    }
  }

  const isSharedFate = team1Brackets.length === 0 || team2Brackets.length === 0;
  const sharedPick = isSharedFate
    ? team1Brackets.length > 0
      ? row.team1
      : team2Brackets.length > 0
        ? row.team2
        : null
    : null;

  return { isSharedFate, sharedPick, team1Brackets, team2Brackets };
}

function getGameStatus(
  row: FutureKillerRow,
  results: GameResult[],
  now: number
): GameStatus {
  const result = results.find(
    (candidate) => candidate.game_index === row.gameIndex && candidate.winner != null
  );
  if (result) {
    return "completed";
  }

  if (!row.scheduledAt) {
    return "scheduled";
  }

  const scheduledMs = new Date(row.scheduledAt).getTime();
  if (!Number.isFinite(scheduledMs)) {
    return "scheduled";
  }

  const elapsed = now - scheduledMs;
  if (elapsed > 0 && elapsed < 3 * 60 * 60 * 1000) {
    return "likely-live";
  }

  return "scheduled";
}

function getLatestResultSummary(
  latestGame: GameResult | null,
  latestGameImpact: EliminationImpact | null,
  fallbackRemaining: number
): { title: string; detail: string } | null {
  if (!latestGame?.winner) {
    return null;
  }

  const loser = latestGame.winner === latestGame.team1 ? latestGame.team2 : latestGame.team1;
  const eliminated = latestGameImpact?.eliminated ?? 0;
  const remainingAfter = latestGameImpact?.remainingAfter ?? fallbackRemaining;

  return {
    title: `Latest: ${latestGame.winner} over ${loser} · ${formatRound(latestGame.round)}`,
    detail:
      eliminated > 0
        ? `${eliminated.toLocaleString()} bracket${eliminated === 1 ? "" : "s"} eliminated — ${remainingAfter.toLocaleString()} remain`
        : `All ${remainingAfter.toLocaleString()} survived`,
  };
}

export default function UpcomingGames({
  futureKillers,
  survivors,
  results,
  now,
  latestGame,
  latestGameImpact,
  futureKillersNote,
  futureKillersIsFallback,
}: UpcomingGamesProps) {
  const latestSummary = getLatestResultSummary(
    latestGame,
    latestGameImpact,
    survivors.length
  );

  const games = futureKillers
    .map((row) => ({
      row,
      classification: classifyGame(row, survivors),
      status: getGameStatus(row, results, now),
    }))
    .filter(({ status }) => status !== "completed")
    .sort((a, b) => {
      const statusWeight = (status: GameStatus) => (status === "likely-live" ? 0 : 1);
      const weightDiff = statusWeight(a.status) - statusWeight(b.status);
      if (weightDiff !== 0) {
        return weightDiff;
      }

      const aTime = a.row.scheduledAt ? new Date(a.row.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.row.scheduledAt ? new Date(b.row.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.row.gameIndex - b.row.gameIndex;
    });

  const hasLiveGame = games.some((game) => game.status === "likely-live");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-3">
      <p className="text-xs uppercase tracking-[0.15em] text-white/40">
        {hasLiveGame ? "Games Today" : "Upcoming Games"}
      </p>

      {latestSummary && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-medium text-white">{latestSummary.title}</p>
          <p className="mt-1 text-sm text-white/55">{latestSummary.detail}</p>
        </div>
      )}

      {games.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/50">
          {futureKillersNote ?? "No games scheduled yet."}
        </div>
      ) : (
        <>
          {futureKillersNote && (
            <p className={`text-xs ${futureKillersIsFallback ? "text-amber-300/80" : "text-white/35"}`}>
              {futureKillersNote}
            </p>
          )}

          {games.map(({ row, classification, status }) => {
            const scheduledLabel = formatScheduledLabel(row.scheduledAt);

            return (
              <div
                key={`${row.gameIndex}-${row.espnEventId ?? "derived"}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white">
                      {status === "likely-live" && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs font-medium uppercase tracking-[0.15em] text-red-400">
                            In Progress
                          </span>
                        </span>
                      )}
                      <span className="font-medium">{row.team1}</span>
                      <span className="text-white/25">vs</span>
                      <span className="font-medium">{row.team2}</span>
                      <span className="text-white/35">·</span>
                      <span className="text-white/55">{formatRound(row.round)}</span>
                      {scheduledLabel && (
                        <>
                          <span className="text-white/35">·</span>
                          <span className="text-white/55">{scheduledLabel}</span>
                        </>
                      )}
                    </div>

                    {status === "likely-live" && scheduledLabel && (
                      <p className="mt-1 text-xs text-red-300/80">
                        Started {scheduledLabel}
                      </p>
                    )}
                  </div>

                  <p className="text-sm font-medium tabular-nums text-amber-200/85">
                    {row.guaranteedKills.toLocaleString()} guaranteed kills
                  </p>
                </div>

                <div className="mt-3 text-sm">
                  {classification.isSharedFate && classification.sharedPick ? (
                    <>
                      <p className="font-medium text-white">
                        All {survivors.length} need {classification.sharedPick}
                      </p>
                      <p className="mt-1 text-white/55">
                        If {classification.sharedPick} loses, it&apos;s over.
                      </p>
                    </>
                  ) : (
                    <p className="text-white/60">
                      {classification.team1Brackets.length} of {survivors.length} need {row.team1}
                      <span className="text-white/25"> · </span>
                      {classification.team2Brackets.length} of {survivors.length} need {row.team2}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
