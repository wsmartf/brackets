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
import {
  addAuditLog,
  getPendingResultEvents,
  markResultEventProcessed,
  setResult,
} from "@/lib/db";
import { fetchAndQueueEspnResults } from "@/lib/espn";
import { resetTournamentCaches } from "@/lib/tournament";

async function processPendingResultEvents() {
  let processed = 0;
  let lastStats: Awaited<ReturnType<typeof runAnalysis>> | null = null;

  for (const event of getPendingResultEvents()) {
    setResult(event.gameIndex, event.round, event.team1, event.team2, event.winner, {
      source: event.source,
      manualOverride: false,
    });
    resetTournamentCaches();

    lastStats = await runAnalysis({ newGameIndices: [event.gameIndex] });
    markResultEventProcessed(event.id);
    addAuditLog("result_event_processed", {
      resultEventId: event.id,
      gameIndex: event.gameIndex,
      round: event.round,
      team1: event.team1,
      team2: event.team2,
      winner: event.winner,
      source: event.source,
      espnEventId: event.espnEventId,
      remaining: lastStats.remaining,
      gamesCompleted: lastStats.gamesCompleted,
      analyzedAt: lastStats.analyzedAt,
    });
    processed++;
  }

  return { processed, lastStats };
}

async function runRefresh(useEspn: boolean): Promise<void> {
  try {
    let espnSummary = null;
    let lastStats: Awaited<ReturnType<typeof runAnalysis>> | null = null;
    let processedResultEvents = 0;

    if (useEspn) {
      try {
        espnSummary = await fetchAndQueueEspnResults();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        addAuditLog("espn_fetch_failed", { error: message });
        espnSummary = { queued: 0, skipped: 0, finalResultsSeen: 0, error: message };
      }
    }

    const processingSummary = await processPendingResultEvents();
    processedResultEvents = processingSummary.processed;
    lastStats = processingSummary.lastStats;

    if (!lastStats) {
      lastStats = await runAnalysis();
    }

    const analysisStatus = finishAnalysisRun();
    addAuditLog("refresh_succeeded", {
      triggerSource: "manual",
      espnSummary,
      processedResultEvents,
      remaining: lastStats.remaining,
      gamesCompleted: lastStats.gamesCompleted,
      analyzedAt: lastStats.analyzedAt,
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
