import type { SurvivorBracket } from "@/hooks/useHomepageData";
import type { FutureKillerRow } from "@/lib/future-killers";
import { getTeamAccentColor } from "@/lib/team-colors";

interface SurvivalMatrixProps {
  survivors: SurvivorBracket[];
  scheduledGames: FutureKillerRow[];
}

interface MatrixColumn {
  gameIndex: number;
  round: number;
  isSharedFate: boolean;
  sharedPick: string | null;
  picks: string[];
  team1: string;
  team2: string;
  sameMatchup: boolean;
  scheduledAt: string | null;
}

const ROUND_LABELS: Record<number, string> = {
  64: "R64",
  32: "R32",
  16: "S16",
  8: "E8",
  4: "F4",
  2: "Champ",
};

function formatDay(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
}

function formatRound(round: number): string {
  return ROUND_LABELS[round] ?? `R${round}`;
}

function getBracketLabel(bracket: SurvivorBracket): string {
  const [team1, team2] = bracket.championshipGame;
  const opponent = team1 === bracket.championPick ? team2 : team1;

  if (!bracket.championPick || !opponent) {
    return `Bracket #${bracket.index.toLocaleString()}`;
  }

  return `${bracket.championPick} vs ${opponent}`;
}

function buildMatrixColumns(
  survivors: SurvivorBracket[],
  scheduledGames: FutureKillerRow[]
): MatrixColumn[] {
  const pendingGameIndices = new Set<number>();

  for (const bracket of survivors) {
    for (const pick of bracket.picks) {
      if (pick.result === "pending") {
        pendingGameIndices.add(pick.game_index);
      }
    }
  }

  const scheduledByGameIndex = new Map(
    scheduledGames.map((game) => [game.gameIndex, game])
  );

  return Array.from(pendingGameIndices)
    .sort((a, b) => a - b)
    .map((gameIndex) => {
      const picksForGame = survivors.map((bracket) =>
        bracket.picks.find((pick) => pick.game_index === gameIndex)
      );
      const firstPick = picksForGame[0];
      const picks = picksForGame.map((pick) => pick?.pick ?? "?");
      const allSamePick = picks.every((pick) => pick === picks[0]);
      const sameMatchup = picksForGame.every(
        (pick) =>
          pick?.team1 === firstPick?.team1 &&
          pick?.team2 === firstPick?.team2 &&
          pick?.round === firstPick?.round
      );
      const scheduled = scheduledByGameIndex.get(gameIndex);

      return {
        gameIndex,
        round: firstPick?.round ?? scheduled?.round ?? 0,
        isSharedFate: allSamePick,
        sharedPick: allSamePick ? picks[0] ?? null : null,
        picks,
        team1: firstPick?.team1 ?? scheduled?.team1 ?? "TBD",
        team2: firstPick?.team2 ?? scheduled?.team2 ?? "TBD",
        sameMatchup,
        scheduledAt: scheduled?.scheduledAt ?? null,
      };
    });
}

function getSharedFateSummary(columns: MatrixColumn[], survivorCount: number): string {
  const teamCounts = new Map<string, number>();

  for (const column of columns) {
    if (!column.isSharedFate || !column.sharedPick) {
      continue;
    }

    teamCounts.set(column.sharedPick, (teamCounts.get(column.sharedPick) ?? 0) + 1);
  }

  if (teamCounts.size === 0) {
    return "No shared-fate games right now.";
  }

  const summary = Array.from(teamCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([team, count]) => `${team}${count > 1 ? ` (x${count})` : ""}`)
    .join(", ");

  return `All ${survivorCount} need: ${summary}`;
}

function getColumnHeader(column: MatrixColumn): { line1: string; line2: string } {
  const day = formatDay(column.scheduledAt);
  const roundLabel = formatRound(column.round);
  const line1 = column.sameMatchup
    ? `${column.team1} vs ${column.team2}`
    : roundLabel;
  const line2 = day ? `${roundLabel} · ${day}` : roundLabel;

  return { line1, line2 };
}

function getOutcomeSummary(column: MatrixColumn): Array<[string, number]> {
  const counts = new Map<string, number>();

  for (const pick of column.picks) {
    counts.set(pick, (counts.get(pick) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export default function SurvivalMatrix({
  survivors,
  scheduledGames,
}: SurvivalMatrixProps) {
  if (survivors.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/45">
        No surviving brackets to compare.
      </div>
    );
  }

  const columns = buildMatrixColumns(survivors, scheduledGames);
  const divergenceColumns = columns.filter((column) => !column.isSharedFate);
  const sharedSummary = getSharedFateSummary(columns, survivors.length);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-xs uppercase tracking-[0.15em] text-white/40">
        Remaining Games
      </p>
      <p className="mt-2 text-sm text-white/55">{sharedSummary}</p>

      {divergenceColumns.length === 0 ? (
        <p className="mt-5 text-sm text-white/45">
          Every remaining game is shared fate across the field.
        </p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="sticky left-0 z-10 min-w-[180px] bg-[#0b1020] px-3 py-3 text-left text-xs uppercase tracking-[0.15em] text-white/35">
                  Bracket
                </th>
                {divergenceColumns.map((column) => {
                  const header = getColumnHeader(column);

                  return (
                    <th
                      key={column.gameIndex}
                      className="min-w-[150px] px-3 py-3 text-left align-bottom"
                    >
                      <div className="text-sm font-medium text-white">{header.line1}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.12em] text-white/35">
                        {header.line2}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {survivors.map((bracket, rowIndex) => (
                <tr key={bracket.index} className="border-b border-white/8 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-[#0b1020] px-3 py-3 font-medium text-white/75">
                    {getBracketLabel(bracket)}
                  </td>
                  {divergenceColumns.map((column) => (
                    <td
                      key={`${bracket.index}-${column.gameIndex}`}
                      className="px-3 py-3 font-medium"
                      style={{ color: getTeamAccentColor(column.picks[rowIndex]) }}
                    >
                      {column.picks[rowIndex]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10">
                <td className="sticky left-0 z-10 bg-[#0b1020] px-3 py-3 text-xs uppercase tracking-[0.15em] text-white/35">
                  Survival Split
                </td>
                {divergenceColumns.map((column) => (
                  <td key={`summary-${column.gameIndex}`} className="px-3 py-3">
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                      {getOutcomeSummary(column).map(([team, count]) => (
                        <span
                          key={`${column.gameIndex}-${team}`}
                          style={{ color: getTeamAccentColor(team) }}
                        >
                          {team}: {count}
                        </span>
                      ))}
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
