import { getResults, getStats, getSurvivorCount, getSurvivorIndices } from "./db";
import { resolveFinalDisplayIndices } from "./final-display-cohort";
import { buildFinalNInsightsFromPendingGames, type FinalNInsights } from "./final-n-insights";
import { fetchPendingGames, type PendingGameRow } from "./pending-games";
import {
  buildSurvivorBracketSummaries,
  type SurvivorBracketSummary,
} from "./survivor-brackets";

interface AnalysisStatsPayload {
  remaining?: number;
}

export interface FinalNStatePayload {
  survivors: SurvivorBracketSummary[];
  displayBrackets: SurvivorBracketSummary[];
  pendingGames: PendingGameRow[];
  finalNInsights: FinalNInsights | null;
}

export async function buildFinalNState(): Promise<FinalNStatePayload> {
  const rawStats = getStats("analysis");
  const parsedStats = rawStats ? (JSON.parse(rawStats) as AnalysisStatsPayload) : {};
  const remaining = parsedStats.remaining ?? getSurvivorCount();
  const results = getResults();
  const survivorCount = getSurvivorCount();
  const survivorIndices =
    survivorCount > 0 ? getSurvivorIndices({ limit: survivorCount, offset: 0 }) : [];
  const displayIndices = resolveFinalDisplayIndices(remaining, survivorIndices);

  const survivors = buildSurvivorBracketSummaries(survivorIndices, results);
  const displayBrackets = buildSurvivorBracketSummaries(displayIndices, results);

  if (remaining > 20) {
    return {
      survivors,
      displayBrackets,
      pendingGames: [],
      finalNInsights: null,
    };
  }

  let pendingGames: PendingGameRow[] = [];
  try {
    pendingGames = await fetchPendingGames(results);
  } catch (error) {
    console.error("Failed to build pending games for Final N state:", error);
  }

  return {
    survivors,
    displayBrackets,
    pendingGames,
    finalNInsights: buildFinalNInsightsFromPendingGames(pendingGames),
  };
}
