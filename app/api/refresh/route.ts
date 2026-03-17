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
import { requireAdmin } from "@/lib/admin";
import {
  finishAnalysisRun,
  getAnalysisStatus,
  startAnalysisRun,
} from "@/lib/analysis-status";
import { addAuditLog } from "@/lib/db";

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) {
    return authError;
  }

  if (!startAnalysisRun("manual")) {
    return NextResponse.json(
      {
        error: "Analysis is already running",
        analysisStatus: getAnalysisStatus(),
      },
      { status: 409 }
    );
  }

  addAuditLog("refresh_started", { triggerSource: "manual" });

  try {
    // TODO: Optionally fetch ESPN scores first
    // const url = new URL(request.url);
    // if (url.searchParams.get("espn") === "true") {
    //   await fetchAndUpdateESPNResults();
    // }

    const stats = await runAnalysis();
    const analysisStatus = finishAnalysisRun();
    addAuditLog("refresh_succeeded", {
      triggerSource: "manual",
      remaining: stats.remaining,
      gamesCompleted: stats.gamesCompleted,
      analyzedAt: stats.analyzedAt,
    });
    return NextResponse.json({ ...stats, analysisStatus });
  } catch (error) {
    const analysisStatus = finishAnalysisRun(error);
    addAuditLog("refresh_failed", {
      triggerSource: "manual",
      error: analysisStatus.lastError,
    });
    return NextResponse.json(
      {
        error: analysisStatus.lastError ?? "Analysis failed",
        analysisStatus,
      },
      { status: 500 }
    );
  }
}
