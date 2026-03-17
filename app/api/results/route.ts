/**
 * GET /api/results — Return all game results from SQLite
 * POST /api/results — Manually add/update a game result
 *
 * POST body: {
 *   game_index: number,
 *   round: number,
 *   team1: string,
 *   team2: string,
 *   winner: string
 * }
 */

import { NextResponse } from "next/server";
import { getResults, setResult } from "@/lib/db";

export async function GET() {
  const results = getResults();
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { game_index, round, team1, team2, winner } = body;

  if (game_index === undefined || !round || !team1 || !team2 || !winner) {
    return NextResponse.json(
      { error: "Missing required fields: game_index, round, team1, team2, winner" },
      { status: 400 }
    );
  }

  setResult(game_index, round, team1, team2, winner);
  return NextResponse.json({ success: true });
}
