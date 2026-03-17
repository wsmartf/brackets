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
import { addAuditLog, getResult, getResults, setResult } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";

export async function GET() {
  const results = getResults();
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) {
    return authError;
  }

  const body = await request.json();
  const { game_index, round, team1, team2, winner } = body;
  const previous = typeof game_index === "number" ? getResult(game_index) : null;

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

  setResult(game_index, round, team1, team2, winner, {
    source: "manual",
    manualOverride: winner !== null,
  });
  addAuditLog(winner === null ? "result_cleared" : "result_set", {
    gameIndex: game_index,
    round,
    team1,
    team2,
    previousWinner: previous?.winner ?? null,
    winner,
  });

  return NextResponse.json({ success: true });
}
