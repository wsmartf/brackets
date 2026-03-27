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
 * Responses:
 *   `200 OK` if no new results were found and cached analysis is already current
 *   `202 Accepted` with the current analysis status when analysis work starts
 *
 * When analysis work starts, clients should poll GET /api/stats for completion
 * and updated cached stats.
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
  hasCurrentResultsSnapshot,
  getPendingResultEvents,
  markResultEventProcessed,
  setResult,
} from "@/lib/db";
import { fetchAndQueueEspnResults } from "@/lib/espn";
import { syncFinalDisplayCohortFromCurrentSurvivors } from "@/lib/final-display-cohort";
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

async function runRefresh(espnSummary: {
  queued: number;
  skipped: number;
  finalResultsSeen: number;
  blockingIssues: Array<{
    reason: "team_mapping_failed" | "no_matching_game" | "winner_not_in_matchup";
    espnResultId: string;
    team1: string;
    team2: string;
    winner: string;
  }>;
  error?: string;
} | null): Promise<void> {
  try {
    let lastStats: Awaited<ReturnType<typeof runAnalysis>> | null = null;
    let processedResultEvents = 0;

    // Freeze the canonical Final Five cohort before applying any new results.
    // This preserves the pre-elimination roster across 5 -> N transitions.
    syncFinalDisplayCohortFromCurrentSurvivors();

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

  if (getAnalysisStatus().isRunning) {
    return NextResponse.json(
      {
        error: "Analysis is already running",
        analysisStatus: getAnalysisStatus(),
      },
      { status: 409 }
    );
  }

  const url = new URL(request.url);
  const useEspn = url.searchParams.get("espn") !== "false";
  let espnSummary: {
    queued: number;
    skipped: number;
    finalResultsSeen: number;
    blockingIssues: Array<{
      reason: "team_mapping_failed" | "no_matching_game" | "winner_not_in_matchup";
      espnResultId: string;
      team1: string;
      team2: string;
      winner: string;
    }>;
    error?: string;
  } | null = null;

  if (useEspn) {
    try {
      espnSummary = await fetchAndQueueEspnResults();
      if (espnSummary.blockingIssues.length > 0) {
        espnSummary.error = "ESPN sync found finalized results that did not match canonical games";
        addAuditLog("espn_sync_failed", {
          error: espnSummary.error,
          blockingIssues: espnSummary.blockingIssues,
          queued: espnSummary.queued,
          skipped: espnSummary.skipped,
          finalResultsSeen: espnSummary.finalResultsSeen,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      addAuditLog("espn_fetch_failed", { error: message });
      espnSummary = {
        queued: 0,
        skipped: 0,
        finalResultsSeen: 0,
        blockingIssues: [],
        error: message,
      };
    }
  }

  const hasPendingResultEvents = getPendingResultEvents().length > 0;
  const needsAnalysis = hasPendingResultEvents || !hasCurrentResultsSnapshot();

  if (espnSummary?.error && !needsAnalysis) {
    return NextResponse.json(
      {
        error: espnSummary.error,
        analysisStatus: getAnalysisStatus(),
        espnSummary,
      },
      { status: 502 }
    );
  }

  if (!needsAnalysis) {
    addAuditLog("refresh_noop", {
      triggerSource: "manual",
      espnSummary,
    });

    return NextResponse.json(
      {
        ok: true,
        skipped: true,
        analysisStatus: getAnalysisStatus(),
        espnSummary,
      },
      { status: 200 }
    );
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

  addAuditLog("refresh_started", {
    triggerSource: "manual",
    espnSummary,
  });

  void runRefresh(espnSummary);

  return NextResponse.json(
    {
      ok: true,
      analysisStatus: getAnalysisStatus(),
      espnSummary,
      ...(espnSummary?.error ? { error: espnSummary.error } : {}),
    },
    { status: espnSummary?.error ? 502 : 202 }
  );
}
