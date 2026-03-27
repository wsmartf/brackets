import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  initDb,
  replaceSurvivingIndices,
  setFinalDisplayCohort,
  setResult,
  setStats,
} from "../lib/db";
import { buildFinalNState } from "../lib/final-n-state";
import { buildCurrentGameDefinitions, reconstructBracket } from "../lib/tournament";
import { createTestDb } from "./test-helpers";
import type { ESPNScoreboard } from "../lib/espn";

let cleanup: () => void;

beforeEach(() => {
  cleanup = createTestDb();
  initDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("buildFinalNState", () => {
  test("returns the frozen display cohort and keeps live games in the next-date outlook", async () => {
    const bracketA = reconstructBracket(0);
    const bracketB = reconstructBracket(1);
    const divergence = bracketA.find(
      (pick, index) => pick.pick !== bracketB[index]?.pick
    );

    expect(divergence).toBeDefined();
    if (!divergence) {
      throw new Error("Expected divergent brackets for the test cohort");
    }

    setResult(
      divergence.game_index,
      divergence.round,
      divergence.team1,
      divergence.team2,
      divergence.pick,
      { source: "espn", manualOverride: false }
    );

    replaceSurvivingIndices([{ index: 0, championIndex: 0 }]);
    setFinalDisplayCohort({
      threshold: 5,
      indices: [0, 1],
      frozenAt: "2026-03-26T23:10:00.000Z",
    });
    setStats("analysis", JSON.stringify({ remaining: 1 }));

    const pendingGame = buildCurrentGameDefinitions(
      [divergence].map((pick) => ({
        game_index: pick.game_index,
        round: pick.round,
        team1: pick.team1,
        team2: pick.team2,
        winner: pick.pick,
      }))
    ).find((game) => game.game_index !== divergence.game_index);

    expect(pendingGame).toBeDefined();
    if (!pendingGame) {
      throw new Error("Expected a pending game for the live timeline test");
    }

    const scoreboard: ESPNScoreboard = {
      leagues: [{ calendar: ["2026-03-26T07:00Z"] }],
      events: [
        {
          id: "ev-live",
          date: "2026-03-26T23:10Z",
          name: "Live Game",
          status: {
            clock: 501,
            period: 1,
            type: {
              name: "STATUS_IN_PROGRESS",
              state: "in",
              completed: false,
              shortDetail: "8:21 - 1st",
            },
          },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              startDate: "2026-03-26T23:10Z",
              status: {
                clock: 501,
                period: 1,
                type: {
                  name: "STATUS_IN_PROGRESS",
                  state: "in",
                  completed: false,
                  shortDetail: "8:21 - 1st",
                },
              },
              competitors: [
                {
                  team: {
                    displayName: pendingGame.team1,
                    shortDisplayName: pendingGame.team1,
                    abbreviation: "A",
                  },
                  score: "21",
                  winner: false,
                },
                {
                  team: {
                    displayName: pendingGame.team2,
                    shortDisplayName: pendingGame.team2,
                    abbreviation: "B",
                  },
                  score: "18",
                  winner: false,
                },
              ],
            },
          ],
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => scoreboard,
      }))
    );

    const state = await buildFinalNState();

    expect(state.survivors.map((bracket) => bracket.index)).toEqual([0]);
    expect(state.displayBrackets.map((bracket) => [bracket.index, bracket.alive])).toEqual([
      [0, true],
      [1, false],
    ]);
    expect(state.displayBrackets[1].likelihood).toBe(0);
    expect(state.pendingGames[0]).toMatchObject({
      gameIndex: pendingGame.game_index,
      phase: "live",
      liveDetail: "8:21 - 1st",
    });
    expect(state.finalNInsights?.bestCaseAfter?.label).toBe("Thursday, March 26");
  });
});
