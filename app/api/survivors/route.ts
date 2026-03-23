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
import { getSurvivorIndices, getSurvivorCount } from "@/lib/db";
import { getInitialOrder } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const championName = url.searchParams.get("champion");
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

  const indices = getSurvivorIndices({ championIndex, limit, offset });
  const total = getSurvivorCount(championIndex);

  return NextResponse.json({ indices, total });
}
