import { NextResponse } from "next/server";
import { buildFinalNState } from "@/lib/final-n-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await buildFinalNState(), {
    headers: { "Cache-Control": "no-store" },
  });
}
