/**
 * POST /api/refresh
 *
 * Starts a full bracket analysis in the background. The work itself may take
 * 2-3 minutes for 1B brackets.
 *
 * Optionally fetches latest ESPN scores before running analysis.
 *
 * Query params:
 *   ?espn=false — skip ESPN fetch first (default: ESPN fetch runs)
 *
 * Response: `202 Accepted` with the current analysis status.
 *
 * This route starts the work and returns immediately. Clients should poll
 * GET /api/stats for completion and updated cached stats.
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
import { fetchAndApplyEspnResults } from "@/lib/espn";

async function runRefresh(useEspn: boolean): Promise<void> {
  try {
    let espnSummary = null;

    if (useEspn) {
      try {
        espnSummary = await fetchAndApplyEspnResults();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addAuditLog("espn_fetch_failed", { error: message });
        espnSummary = { applied: 0, skipped: 0, finalResultsSeen: 0, error: message };
      }
    }

    const stats = await runAnalysis();
    const analysisStatus = finishAnalysisRun();
    addAuditLog("refresh_succeeded", {
      triggerSource: "manual",
      espnSummary,
      remaining: stats.remaining,
      gamesCompleted: stats.gamesCompleted,
      analyzedAt: stats.analyzedAt,
      analysisStatus,
    });
  } catch (error) {
    const analysisStatus = finishAnalysisRun(error);
    addAuditLog("refresh_failed", {
      triggerSource: "manual",
      error: analysisStatus.lastError,
    });
  }
}

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

  const url = new URL(request.url);
  const useEspn = url.searchParams.get("espn") !== "false";

  void runRefresh(useEspn);

  return NextResponse.json(
    {
      ok: true,
      analysisStatus: getAnalysisStatus(),
    },
    { status: 202 }
  );
}
