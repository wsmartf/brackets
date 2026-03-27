import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  enqueueResultEvent,
  getFinalDisplayCohort,
  getPendingResultEvents,
  getResult,
  getSnapshots,
  getSurvivorCount,
  initDb,
  listAuditLog,
  replaceSurvivingIndices,
  setResult,
  setStats,
} from "../lib/db";
import { buildFinalNState } from "../lib/final-n-state";
import { executeRefreshWorkflow } from "../lib/refresh";
import { getInitialOrder, reconstructBracket } from "../lib/tournament";
import { createTestDb } from "./test-helpers";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function buildSurvivorEntries(indices: number[]) {
  const teamToIndex = new Map(getInitialOrder().map((team, index) => [team, index]));

  return indices.map((index) => {
    const championPick = reconstructBracket(index)[62]?.pick ?? "";
    const championIndex = teamToIndex.get(championPick);
    if (championIndex == null) {
      throw new Error(`Missing champion index for bracket ${index}`);
    }
    return { index, championIndex };
  });
}

function findFiveToTwoScenario() {
  for (let start = 0; start < 200; start++) {
    const cohortIndices = [start, start + 1, start + 2, start + 3, start + 4];
    const brackets = cohortIndices.map((index) => reconstructBracket(index));

    for (let gameIndex = 0; gameIndex < 63; gameIndex++) {
      const grouped = new Map<
        string,
        { indices: number[]; round: number; team1: string; team2: string }
      >();

      brackets.forEach((picks, bracketPosition) => {
        const pick = picks[gameIndex];
        const existing = grouped.get(pick.pick);
        if (existing) {
          existing.indices.push(cohortIndices[bracketPosition]);
          return;
        }

        grouped.set(pick.pick, {
          indices: [cohortIndices[bracketPosition]],
          round: pick.round,
          team1: pick.team1,
          team2: pick.team2,
        });
      });

      if (grouped.size !== 2) {
        continue;
      }

      for (const [winner, group] of grouped.entries()) {
        if (group.indices.length === 2) {
          return {
            cohortIndices,
            gameIndex,
            round: group.round,
            team1: group.team1,
            team2: group.team2,
            winner,
            survivingIndices: [...group.indices].sort((left, right) => left - right),
          };
        }
      }
    }
  }

  throw new Error("Could not find a 5-to-2 bracket scenario in the sampled range");
}

function stubEmptyEspnScoreboard() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        leagues: [{ calendar: ["2026-03-26T07:00Z", "2026-03-27T07:00Z"] }],
        events: [],
      }),
    }))
  );
}

describe("executeRefreshWorkflow", () => {
  test("freezes the final five before a manual result and keeps five display brackets after exact refresh", async () => {
    const scenario = findFiveToTwoScenario();

    replaceSurvivingIndices(buildSurvivorEntries(scenario.cohortIndices));
    setStats("analysis", JSON.stringify({ remaining: scenario.cohortIndices.length }));

    setResult(scenario.gameIndex, scenario.round, scenario.team1, scenario.team2, scenario.winner, {
      source: "manual",
      manualOverride: true,
    });

    const workflow = await executeRefreshWorkflow();

    expect(workflow.usedExactFinalCohort).toBe(true);
    expect(workflow.processedResultEvents).toBe(0);
    expect(workflow.stats.remaining).toBe(2);
    expect(getSurvivorCount()).toBe(2);
    expect(getFinalDisplayCohort()?.indices).toEqual(scenario.cohortIndices);

    stubEmptyEspnScoreboard();
    const state = await buildFinalNState();

    expect(state.survivors.map((bracket) => bracket.index)).toEqual(scenario.survivingIndices);
    expect(state.displayBrackets).toHaveLength(5);
    expect(state.displayBrackets.filter((bracket) => bracket.alive)).toHaveLength(2);
    expect(state.displayBrackets.filter((bracket) => !bracket.alive)).toHaveLength(3);
  });

  test("processes queued result events through the same exact final-five workflow", async () => {
    const scenario = findFiveToTwoScenario();

    replaceSurvivingIndices(buildSurvivorEntries(scenario.cohortIndices));
    setStats("analysis", JSON.stringify({ remaining: scenario.cohortIndices.length }));

    enqueueResultEvent({
      gameIndex: scenario.gameIndex,
      round: scenario.round,
      team1: scenario.team1,
      team2: scenario.team2,
      winner: scenario.winner,
      source: "espn",
      espnEventId: "ev-final-five",
    });

    const workflow = await executeRefreshWorkflow();

    expect(workflow.usedExactFinalCohort).toBe(true);
    expect(workflow.processedResultEvents).toBe(1);
    expect(workflow.stats.remaining).toBe(2);
    expect(getSurvivorCount()).toBe(2);
    expect(getPendingResultEvents()).toHaveLength(0);
    expect(getResult(scenario.gameIndex)?.winner).toBe(scenario.winner);
    expect(getFinalDisplayCohort()?.indices).toEqual(scenario.cohortIndices);
    expect(getSnapshots().at(-1)?.newGameIndices).toEqual([scenario.gameIndex]);
    expect(listAuditLog().some((entry) => entry.action === "result_event_processed")).toBe(true);

    stubEmptyEspnScoreboard();
    const state = await buildFinalNState();

    expect(state.displayBrackets).toHaveLength(5);
    expect(state.survivors.map((bracket) => bracket.index)).toEqual(scenario.survivingIndices);
  });
});
