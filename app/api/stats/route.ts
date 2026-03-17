/**
 * GET /api/stats
 *
 * Returns cached analysis stats from SQLite.
 * If no analysis has been run yet, returns default values.
 *
 * Response: {
 *   remaining: number,
 *   totalBrackets: number,
 *   gamesCompleted: number,
 *   analyzedAt: string | null,
 * }
 */

import { NextResponse } from "next/server";
import { getStats } from "@/lib/db";
import { NUM_BRACKETS } from "@/lib/analyze";
import { getAnalysisStatus } from "@/lib/analysis-status";

export async function GET() {
  const raw = getStats("analysis");
  const analysisStatus = getAnalysisStatus();

  if (!raw) {
    return NextResponse.json({
      remaining: NUM_BRACKETS,
      totalBrackets: NUM_BRACKETS,
      gamesCompleted: 0,
      championshipProbs: {},
      analyzedAt: null,
      analysisStatus,
    });
  }

  return NextResponse.json({
    ...(JSON.parse(raw) as object),
    analysisStatus,
  });
}
