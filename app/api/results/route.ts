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

  if (
    typeof game_index !== "number" ||
    typeof round !== "number" ||
    typeof team1 !== "string" ||
    typeof team2 !== "string" ||
    (winner !== null && typeof winner !== "string")
  ) {
    return NextResponse.json(
      { error: "Expected game_index, round, team1, team2, and winner (string or null)" },
      { status: 400 }
    );
  }

  if (winner !== null && winner !== team1 && winner !== team2) {
    return NextResponse.json(
      { error: "winner must match team1 or team2" },
      { status: 400 }
    );
  }

  setResult(game_index, round, team1, team2, winner);
  return NextResponse.json({ success: true });
}
