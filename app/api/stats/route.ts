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

export async function GET() {
  const raw = getStats("analysis");

  if (!raw) {
    return NextResponse.json({
      remaining: NUM_BRACKETS,
      totalBrackets: NUM_BRACKETS,
      gamesCompleted: 0,
      analyzedAt: null,
    });
  }

  return NextResponse.json(JSON.parse(raw));
}
