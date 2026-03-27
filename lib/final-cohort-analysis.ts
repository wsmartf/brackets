import {
  createSnapshot,
  getFinalDisplayCohort,
  getResults,
  replaceSurvivingIndices,
  setStats,
} from "./db";
import {
  NUM_BRACKETS,
  computeDerivedStats,
  type AnalysisResult,
} from "./analyze";
import { getInitialOrder, getBracketSurvivalState, reconstructBracket } from "./tournament";

export async function runExactFinalCohortAnalysis(options: {
  newGameIndices?: number[];
} = {}): Promise<AnalysisResult> {
  const cohort = getFinalDisplayCohort();
  if (!cohort || cohort.indices.length === 0) {
    throw new Error("Exact Final Cohort analysis requires a frozen display cohort");
  }

  const results = getResults();
  const initialOrder = getInitialOrder();
  const teamToIndex = new Map(initialOrder.map((team, index) => [team, index]));
  const aliveEntries: Array<{ index: number; championIndex: number }> = [];

  for (const index of cohort.indices) {
    const picks = reconstructBracket(index);
    const survivalState = getBracketSurvivalState(picks, results);
    if (!survivalState.alive) {
      continue;
    }

    const championPick = survivalState.picks[62]?.pick ?? "";
    const championIndex = teamToIndex.get(championPick);
    if (championIndex == null) {
      continue;
    }

    aliveEntries.push({ index, championIndex });
  }

  replaceSurvivingIndices(aliveEntries);

  const derived = computeDerivedStats(aliveEntries);
  const championshipProbs: Record<string, number> = {};
  const remaining = aliveEntries.length;

  if (remaining > 0) {
    const championCounts = new Map<number, number>();
    for (const entry of aliveEntries) {
      championCounts.set(entry.championIndex, (championCounts.get(entry.championIndex) ?? 0) + 1);
    }

    for (const [championIndex, count] of championCounts.entries()) {
      championshipProbs[initialOrder[championIndex]] = count / remaining;
    }
  }

  const stats: AnalysisResult = {
    remaining,
    totalBrackets: NUM_BRACKETS,
    gamesCompleted: results.filter((result) => result.winner).length,
    championshipProbs,
    analyzedAt: new Date().toISOString(),
    roundSurvivorCounts: derived.roundSurvivorCounts,
    gamePickCounts: derived.gamePickCounts,
    indicesStored: true,
  };

  setStats("analysis", JSON.stringify(stats));
  createSnapshot({
    remaining: stats.remaining,
    gamesCompleted: stats.gamesCompleted,
    championshipProbs: stats.championshipProbs,
    newGameIndices: options.newGameIndices,
  });

  return stats;
}
