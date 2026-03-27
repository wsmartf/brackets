import { runAnalysis, type AnalysisResult } from "./analyze";
import {
  addAuditLog,
  getFinalDisplayCohort,
  getPendingResultEvents,
  markResultEventProcessed,
  setResult,
} from "./db";
import { syncFinalDisplayCohortFromCurrentSurvivors } from "./final-display-cohort";
import { runExactFinalCohortAnalysis } from "./final-cohort-analysis";
import { resetTournamentCaches } from "./tournament";

export interface RefreshWorkflowResult {
  stats: AnalysisResult;
  processedResultEvents: number;
  usedExactFinalCohort: boolean;
}

async function processPendingResultEvents(): Promise<RefreshWorkflowResult> {
  let processedResultEvents = 0;
  let stats: AnalysisResult | null = null;

  for (const event of getPendingResultEvents()) {
    setResult(event.gameIndex, event.round, event.team1, event.team2, event.winner, {
      source: event.source,
      manualOverride: false,
    });
    resetTournamentCaches();

    stats = await runAnalysis({ newGameIndices: [event.gameIndex] });
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
      remaining: stats.remaining,
      gamesCompleted: stats.gamesCompleted,
      analyzedAt: stats.analyzedAt,
    });
    processedResultEvents++;
  }

  return {
    stats: stats ?? (await runAnalysis()),
    processedResultEvents,
    usedExactFinalCohort: false,
  };
}

async function processPendingResultEventsForExactFinalCohort(): Promise<RefreshWorkflowResult> {
  const pendingEvents = getPendingResultEvents();
  const newGameIndices = new Set<number>();

  for (const event of pendingEvents) {
    setResult(event.gameIndex, event.round, event.team1, event.team2, event.winner, {
      source: event.source,
      manualOverride: false,
    });
    resetTournamentCaches();
    markResultEventProcessed(event.id);
    newGameIndices.add(event.gameIndex);
  }

  const stats = await runExactFinalCohortAnalysis({
    newGameIndices: [...newGameIndices],
  });

  for (const event of pendingEvents) {
    addAuditLog("result_event_processed", {
      resultEventId: event.id,
      gameIndex: event.gameIndex,
      round: event.round,
      team1: event.team1,
      team2: event.team2,
      winner: event.winner,
      source: event.source,
      espnEventId: event.espnEventId,
      remaining: stats.remaining,
      gamesCompleted: stats.gamesCompleted,
      analyzedAt: stats.analyzedAt,
    });
  }

  return {
    stats,
    processedResultEvents: pendingEvents.length,
    usedExactFinalCohort: true,
  };
}

export async function executeRefreshWorkflow(): Promise<RefreshWorkflowResult> {
  // Freeze the canonical Final Five cohort before applying any new results.
  // This preserves the pre-elimination roster across 5 -> N transitions.
  syncFinalDisplayCohortFromCurrentSurvivors();
  const useExactFinalCohort = Boolean(getFinalDisplayCohort());

  if (useExactFinalCohort) {
    return processPendingResultEventsForExactFinalCohort();
  }

  return processPendingResultEvents();
}
