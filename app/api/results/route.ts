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
import { buildCurrentGameDefinitions, resetTournamentCaches } from "@/lib/tournament";

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
  const { game_index, round, team1, team2, winner, force } = body;
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

  // Validate that team1/team2 match the expected matchup for this game_index.
  // Pass force: true to bypass this check for genuine admin overrides.
  if (!force) {
    const gameDefs = buildCurrentGameDefinitions(getResults());
    const expectedGame = gameDefs.find((g) => g.game_index === game_index);
    if (!expectedGame) {
      return NextResponse.json(
        { error: `game_index ${game_index} is not a valid game (must be 0–62)` },
        { status: 400 }
      );
    }
    const isPlaceholder = (t: string) => t.startsWith("Winner of Game");
    if (!isPlaceholder(expectedGame.team1) && !isPlaceholder(expectedGame.team2)) {
      const submitted = new Set([team1, team2]);
      const expected = new Set([expectedGame.team1, expectedGame.team2]);
      const mismatch = ![...submitted].every((t) => expected.has(t));
      if (mismatch) {
        return NextResponse.json(
          {
            error: `team1/team2 don't match the expected matchup for game_index ${game_index}`,
            expected: { team1: expectedGame.team1, team2: expectedGame.team2 },
            hint: "Pass force: true to override this check",
          },
          { status: 409 }
        );
      }
    }
  }

  setResult(game_index, round, team1, team2, winner, {
    source: "manual",
    manualOverride: winner !== null,
  });
  resetTournamentCaches();
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
