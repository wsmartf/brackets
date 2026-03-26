import { NextResponse } from "next/server";
import { buildFinalNInsights } from "@/lib/final-n-insights";

export const dynamic = "force-dynamic";

export async function GET() {
  const insights = await buildFinalNInsights();
  return NextResponse.json(insights ?? { bestCaseAfter: null, milestones: [] });
}
