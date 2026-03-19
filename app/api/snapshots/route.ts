import { NextResponse } from "next/server";
import { getEliminationImpact, getSnapshots } from "@/lib/db";

export async function GET() {
  return NextResponse.json({
    snapshots: getSnapshots(),
    eliminationImpact: getEliminationImpact(),
  });
}
