import { NextResponse } from "next/server";
import { getResults } from "@/lib/db";
import { getBracketSurvivalState, reconstructBracket } from "@/lib/tournament";

export const dynamic = "force-dynamic";

function parseBracketId(rawId: string): number | null {
  if (!/^\d{1,10}$/.test(rawId)) {
    return null;
  }

  const id = Number.parseInt(rawId, 10);
  if (!Number.isInteger(id) || id < 0 || id > 999_999_999) {
    return null;
  }

  return id;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const id = parseBracketId(rawId);

  if (id === null) {
    return NextResponse.json(
      { error: "Bracket id must be an integer between 0 and 999999999" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const picks = reconstructBracket(id);
  const survivalState = getBracketSurvivalState(picks, getResults());

  return NextResponse.json(
    {
      id,
      picks: survivalState.picks,
      alive: survivalState.alive,
      summary: survivalState.summary,
      eliminated_by: survivalState.eliminated_by,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
