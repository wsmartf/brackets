/**
 * GET /api/survivors
 *
 * Returns surviving bracket indices, optionally filtered by champion team name.
 *
 * Query params:
 *   champion — team name (e.g. "Duke") to filter by champion
 *   limit    — max results to return (default 50, max 500)
 *   offset   — row offset for pagination (default 0)
 *
 * Response: { indices: number[], total: number }
 *   indices — array of bracket indices (use /bracket/[index] to view)
 *   total   — total count matching the filter (may be larger than indices.length)
 */

import { NextResponse } from "next/server";
import { getResults, getSurvivorCount, getSurvivorIndices } from "@/lib/db";
import {
  computeBracketLikelihood,
  getBracketSurvivalState,
  getInitialOrder,
  reconstructBracket,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const championName = url.searchParams.get("champion");
  const detail = url.searchParams.get("detail");
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const limit = Math.min(500, Math.max(1, parseInt(limitParam ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10) || 0);

  let championIndex: number | undefined;
  if (championName) {
    const initialOrder = getInitialOrder();
    const idx = initialOrder.indexOf(championName);
    if (idx === -1) {
      return NextResponse.json(
        { error: `Unknown team: ${championName}` },
        { status: 400 }
      );
    }
    championIndex = idx;
  }

  const total = getSurvivorCount(championIndex);
  const indices = getSurvivorIndices({ championIndex, limit, offset });

  if (detail === "full" && total <= 50) {
    const results = getResults();
    const allIndices =
      total > 0 ? getSurvivorIndices({ championIndex, limit: total, offset: 0 }) : [];
    const brackets = allIndices.map((index) => {
      const bracket = reconstructBracket(index);
      const survivalState = getBracketSurvivalState(bracket, results);
      const semifinalOne = survivalState.picks[60];
      const semifinalTwo = survivalState.picks[61];
      const championship = survivalState.picks[62];

      return {
        index,
        picks: survivalState.picks,
        alive: survivalState.alive,
        likelihood: computeBracketLikelihood(survivalState.picks),
        championPick: championship?.pick ?? "",
        championshipGame: [
          championship?.team1 ?? "",
          championship?.team2 ?? "",
        ] as [string, string],
        finalFour: [
          semifinalOne?.team1 ?? "",
          semifinalOne?.team2 ?? "",
          semifinalTwo?.team1 ?? "",
          semifinalTwo?.team2 ?? "",
        ].filter(Boolean),
        eliminatedBy: survivalState.eliminated_by,
      };
    });

    return NextResponse.json({ brackets, total });
  }

  return NextResponse.json({ indices, total });
}
