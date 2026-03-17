/**
 * POST /api/refresh
 *
 * Triggers a full bracket analysis. This may take 2-3 minutes for 1B brackets.
 *
 * Optionally fetches latest ESPN scores before running analysis.
 *
 * Query params:
 *   ?espn=true  — fetch ESPN scores first (default: false)
 *
 * Response: the updated AnalysisResult stats object.
 *
 * NOTE: This is a long-running request. In production, you may want to:
 * - Return immediately with a 202 Accepted and poll for completion
 * - Use server-sent events to stream progress
 * - Or just let the client wait (simplest for now)
 */

import { NextResponse } from "next/server";
import { runAnalysis } from "@/lib/analyze";

export async function POST() {
  // TODO: Optionally fetch ESPN scores first
  // const url = new URL(request.url);
  // if (url.searchParams.get("espn") === "true") {
  //   await fetchAndUpdateESPNResults();
  // }

  const stats = await runAnalysis();
  return NextResponse.json(stats);
}
