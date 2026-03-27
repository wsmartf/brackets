import { afterEach, describe, expect, test, vi } from "vitest";
import { buildGameDefinitions, buildCurrentGameDefinitions } from "@/lib/tournament";
import {
  computeLiveSortValue,
  fetchPendingGames,
  sortPendingGames,
  type PendingGameRow,
} from "@/lib/pending-games";
import type { ESPNScoreboard } from "@/lib/espn";

function makeResults() {
  const definitions = buildGameDefinitions();
  const results = definitions.map((game) => ({
    ...game,
    winner: null as string | null,
    updated_at: "",
  }));

  results[0].winner = results[0].team1;
  results[1].winner = results[1].team1;
  results[2].winner = results[2].team1;
  results[3].winner = results[3].team1;

  return results;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("computeLiveSortValue", () => {
  test("treats first-half games as having more time remaining than second-half games", () => {
    expect(computeLiveSortValue({ clock: 501, period: 1 })).toBe(1701);
    expect(computeLiveSortValue({ clock: 1000, period: 2 })).toBe(1000);
    expect(computeLiveSortValue({ clock: null, period: 1 })).toBeNull();
  });
});

describe("sortPendingGames", () => {
  test("orders live before upcoming before unknown", () => {
    const rows: PendingGameRow[] = [
      {
        gameIndex: 40,
        round: 32,
        team1: "C",
        team2: "D",
        phase: "unknown",
        scheduledAt: null,
        espnEventId: null,
        liveDetail: null,
        liveSortValue: null,
      },
      {
        gameIndex: 30,
        round: 16,
        team1: "A",
        team2: "B",
        phase: "upcoming",
        scheduledAt: "2026-03-27T01:45:00Z",
        espnEventId: "ev-upcoming",
        liveDetail: null,
        liveSortValue: null,
      },
      {
        gameIndex: 20,
        round: 16,
        team1: "E",
        team2: "F",
        phase: "live",
        scheduledAt: "2026-03-26T23:10:00Z",
        espnEventId: "ev-live-late",
        liveDetail: "8:21 - 1st",
        liveSortValue: 1701,
      },
      {
        gameIndex: 10,
        round: 16,
        team1: "G",
        team2: "H",
        phase: "live",
        scheduledAt: "2026-03-26T23:30:00Z",
        espnEventId: "ev-live-early",
        liveDetail: "18:00 - 2nd",
        liveSortValue: 1080,
      },
    ];

    expect(sortPendingGames(rows).map((row) => row.gameIndex)).toEqual([20, 10, 30, 40]);
  });
});

describe("fetchPendingGames", () => {
  test("maps live and upcoming games, then appends unresolved local games as unknown", async () => {
    const results = makeResults();
    const currentDefinitions = buildCurrentGameDefinitions(results);
    const liveGame = currentDefinitions[33];
    const upcomingGame = currentDefinitions[4];
    const unknownGame = currentDefinitions[5];

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
                    displayName: liveGame.team1,
                    shortDisplayName: liveGame.team1,
                    abbreviation: "A",
                  },
                  score: "21",
                  winner: false,
                },
                {
                  team: {
                    displayName: liveGame.team2,
                    shortDisplayName: liveGame.team2,
                    abbreviation: "B",
                  },
                  score: "18",
                  winner: false,
                },
              ],
            },
          ],
        },
        {
          id: "ev-upcoming",
          date: "2026-03-27T01:45Z",
          name: "Upcoming Game",
          status: { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              startDate: "2026-03-27T01:45Z",
              competitors: [
                {
                  team: {
                    displayName: upcomingGame.team1,
                    shortDisplayName: upcomingGame.team1,
                    abbreviation: "C",
                  },
                  score: "0",
                  winner: false,
                },
                {
                  team: {
                    displayName: upcomingGame.team2,
                    shortDisplayName: upcomingGame.team2,
                    abbreviation: "D",
                  },
                  score: "0",
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

    const pendingGames = await fetchPendingGames(results);

    expect(pendingGames.slice(0, 3).map((game) => [game.gameIndex, game.phase])).toEqual([
      [liveGame.game_index, "live"],
      [upcomingGame.game_index, "upcoming"],
      [unknownGame.game_index, "unknown"],
    ]);
    expect(pendingGames.some((game) => game.gameIndex === 32 && game.phase === "unknown")).toBe(true);
    expect(pendingGames[0]).toMatchObject({
      gameIndex: liveGame.game_index,
      liveDetail: "8:21 - 1st",
      liveSortValue: 1701,
      scheduledAt: "2026-03-26T23:10Z",
    });
    expect(pendingGames[1]).toMatchObject({
      gameIndex: upcomingGame.game_index,
      scheduledAt: "2026-03-27T01:45Z",
    });
    expect(pendingGames[2]).toMatchObject({
      gameIndex: unknownGame.game_index,
      scheduledAt: null,
      phase: "unknown",
    });
  });
});
