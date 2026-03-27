import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  extractPendingTournamentGames,
  extractResults,
  extractScheduledTournamentGames,
  fetchAndQueueEspnResults,
  getScoreboardCalendarDateKeys,
  mapEspnTeamName,
  type ESPNScoreboard,
} from "../lib/espn";
import { getPendingResultEvents, setResult } from "../lib/db";
import { createTestDb } from "./test-helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeFinalTournamentEvent(
  id: string,
  team1Name: string,
  team2Name: string,
  winnerName: string,
  score1 = 78,
  score2 = 54
): ESPNScoreboard["events"] {
  const team1Wins = winnerName === team1Name;
  return [
    {
      id,
      date: "2026-03-20T19:00:00Z",
      name: `${team1Name} vs ${team2Name}`,
      status: { type: { name: "STATUS_FINAL" } },
      competitions: [
        {
          type: { abbreviation: "TRNMNT" },
          competitors: [
            {
              team: {
                displayName: `${team1Name} Team`,
                shortDisplayName: team1Name,
                abbreviation: team1Name.slice(0, 4).toUpperCase(),
              },
              score: String(score1),
              winner: team1Wins,
              curatedRank: { current: 1 },
            },
            {
              team: {
                displayName: `${team2Name} Team`,
                shortDisplayName: team2Name,
                abbreviation: team2Name.slice(0, 4).toUpperCase(),
              },
              score: String(score2),
              winner: !team1Wins,
              curatedRank: { current: 16 },
            },
          ],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// extractResults
// ---------------------------------------------------------------------------

describe("extractResults", () => {
  test("extracts a final tournament game with correct winner and scores", () => {
    const scoreboard: ESPNScoreboard = {
      events: makeFinalTournamentEvent("ev1", "Duke", "Howard", "Duke", 78, 54),
    };
    const results = extractResults(scoreboard);
    expect(results).toHaveLength(1);
    expect(results[0].team1).toBe("Duke");
    expect(results[0].team2).toBe("Howard");
    expect(results[0].winner).toBe("Duke");
    expect(results[0].score1).toBe(78);
    expect(results[0].score2).toBe(54);
    expect(results[0].id).toBe("ev1");
  });

  test("correctly identifies team2 as winner", () => {
    const scoreboard: ESPNScoreboard = {
      events: makeFinalTournamentEvent("ev1", "Duke", "Howard", "Howard", 54, 78),
    };
    const results = extractResults(scoreboard);
    expect(results[0].winner).toBe("Howard");
  });

  test("ignores in-progress games", () => {
    const scoreboard: ESPNScoreboard = {
      events: [
        {
          id: "ev1",
          date: "2026-03-20T19:00:00Z",
          name: "Live Game",
          status: { type: { name: "STATUS_IN_PROGRESS" } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              competitors: [
                {
                  team: { displayName: "Team A", shortDisplayName: "A", abbreviation: "A" },
                  score: "40",
                  winner: false,
                },
                {
                  team: { displayName: "Team B", shortDisplayName: "B", abbreviation: "B" },
                  score: "38",
                  winner: false,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractResults(scoreboard)).toHaveLength(0);
  });

  test("ignores non-tournament games (type != TRNMNT)", () => {
    const scoreboard: ESPNScoreboard = {
      events: [
        {
          id: "ev1",
          date: "2026-03-20T19:00:00Z",
          name: "Regular Season Game",
          status: { type: { name: "STATUS_FINAL" } },
          competitions: [
            {
              type: { abbreviation: "STD" }, // not TRNMNT
              competitors: [
                {
                  team: { displayName: "Team A", shortDisplayName: "A", abbreviation: "A" },
                  score: "70",
                  winner: true,
                },
                {
                  team: { displayName: "Team B", shortDisplayName: "B", abbreviation: "B" },
                  score: "65",
                  winner: false,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(extractResults(scoreboard)).toHaveLength(0);
  });

  test("returns empty array for empty scoreboard", () => {
    expect(extractResults({ events: [] })).toHaveLength(0);
    expect(extractResults({})).toHaveLength(0);
  });

  test("extracts multiple games", () => {
    const scoreboard: ESPNScoreboard = {
      events: [
        ...(makeFinalTournamentEvent("ev1", "Duke", "Howard", "Duke") ?? []),
        ...(makeFinalTournamentEvent("ev2", "UNC", "Yale", "UNC") ?? []),
      ],
    };
    expect(extractResults(scoreboard)).toHaveLength(2);
  });
});

describe("extractScheduledTournamentGames", () => {
  test("extracts only scheduled tournament games in chronological order", () => {
    const scoreboard: ESPNScoreboard = {
      events: [
        {
          id: "ev-live",
          date: "2026-03-22T21:15Z",
          name: "Live Game",
          status: { type: { name: "STATUS_IN_PROGRESS", state: "in", completed: false } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              competitors: [
                {
                  team: { displayName: "Team A", shortDisplayName: "A", abbreviation: "A" },
                  score: "40",
                  winner: false,
                },
                {
                  team: { displayName: "Team B", shortDisplayName: "B", abbreviation: "B" },
                  score: "38",
                  winner: false,
                },
              ],
            },
          ],
        },
        {
          id: "ev-2",
          date: "2026-03-22T23:10Z",
          name: "Second Game",
          status: { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              startDate: "2026-03-22T23:10Z",
              competitors: [
                {
                  team: { displayName: "Team C", shortDisplayName: "C", abbreviation: "C" },
                  score: "0",
                  winner: false,
                },
                {
                  team: { displayName: "Team D", shortDisplayName: "D", abbreviation: "D" },
                  score: "0",
                  winner: false,
                },
              ],
            },
          ],
        },
        {
          id: "ev-1",
          date: "2026-03-22T22:10Z",
          name: "First Game",
          status: { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              startDate: "2026-03-22T22:10Z",
              competitors: [
                {
                  team: { displayName: "Team E", shortDisplayName: "E", abbreviation: "E" },
                  score: "0",
                  winner: false,
                },
                {
                  team: { displayName: "Team F", shortDisplayName: "F", abbreviation: "F" },
                  score: "0",
                  winner: false,
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractScheduledTournamentGames(scoreboard)).toEqual([
      {
        eventId: "ev-1",
        eventDate: "2026-03-22T22:10Z",
        status: "STATUS_SCHEDULED",
        team1: "E",
        team2: "F",
      },
      {
        eventId: "ev-2",
        eventDate: "2026-03-22T23:10Z",
        status: "STATUS_SCHEDULED",
        team1: "C",
        team2: "D",
      },
    ]);
  });
});

describe("extractPendingTournamentGames", () => {
  test("includes live and scheduled tournament games with live details", () => {
    const scoreboard: ESPNScoreboard = {
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
                  team: { displayName: "Purdue", shortDisplayName: "Purdue", abbreviation: "PUR" },
                  score: "21",
                  winner: false,
                },
                {
                  team: { displayName: "Texas", shortDisplayName: "Texas", abbreviation: "TEX" },
                  score: "18",
                  winner: false,
                },
              ],
            },
          ],
        },
        {
          id: "ev-pre",
          date: "2026-03-27T01:45Z",
          name: "Upcoming Game",
          status: { type: { name: "STATUS_SCHEDULED", state: "pre", completed: false } },
          competitions: [
            {
              type: { abbreviation: "TRNMNT" },
              startDate: "2026-03-27T01:45Z",
              competitors: [
                {
                  team: { displayName: "Arizona", shortDisplayName: "Arizona", abbreviation: "ARIZ" },
                  score: "0",
                  winner: false,
                },
                {
                  team: { displayName: "Arkansas", shortDisplayName: "Arkansas", abbreviation: "ARK" },
                  score: "0",
                  winner: false,
                },
              ],
            },
          ],
        },
      ],
    };

    expect(extractPendingTournamentGames(scoreboard)).toEqual([
      {
        eventId: "ev-live",
        eventDate: "2026-03-26T23:10Z",
        status: "STATUS_IN_PROGRESS",
        state: "in",
        team1: "Purdue",
        team2: "Texas",
        clock: 501,
        period: 1,
        detail: "8:21 - 1st",
      },
      {
        eventId: "ev-pre",
        eventDate: "2026-03-27T01:45Z",
        status: "STATUS_SCHEDULED",
        state: "pre",
        team1: "Arizona",
        team2: "Arkansas",
        clock: null,
        period: null,
        detail: null,
      },
    ]);
  });
});

describe("getScoreboardCalendarDateKeys", () => {
  test("returns sorted unique YYYYMMDD keys from the league calendar", () => {
    const scoreboard: ESPNScoreboard = {
      leagues: [
        {
          calendar: [
            "2026-03-27T07:00Z",
            "2026-03-22T07:00Z",
            "2026-03-26T07:00Z",
            "2026-03-22T07:00Z",
          ],
        },
      ],
    };

    expect(getScoreboardCalendarDateKeys(scoreboard)).toEqual([
      "20260322",
      "20260326",
      "20260327",
    ]);
  });
});

// ---------------------------------------------------------------------------
// mapEspnTeamName — alias resolution only (no DB needed)
// The alias table returns before hitting the DB, so these tests are purely local.
// ---------------------------------------------------------------------------

describe("mapEspnTeamName (alias resolution)", () => {
  test("maps CA Baptist to canonical Cal Baptist", () => {
    expect(mapEspnTeamName("CA Baptist", { candidateNames: ["Cal Baptist"] })).toBe(
      "Cal Baptist"
    );
  });

  test("maps Miami (OH) variants", () => {
    expect(mapEspnTeamName("Miami (OH)")).toBe("Miami OH");
    expect(mapEspnTeamName("miami oh")).toBe("Miami OH");
  });

  test("maps N C State / NC State", () => {
    expect(mapEspnTeamName("N C State")).toBe("NC State");
    expect(mapEspnTeamName("nc state")).toBe("NC State");
  });

  test("maps Saint Mary's variants", () => {
    // All of these normalize to "st marys" or "saint marys" before alias lookup
    expect(mapEspnTeamName("St. Mary's")).toBe("Saint Mary's");  // → "st marys"
    expect(mapEspnTeamName("Saint Mary's")).toBe("Saint Mary's"); // → "saint marys"
    expect(mapEspnTeamName("Saint Marys")).toBe("Saint Mary's");  // → "saint marys"
  });

  test("maps Prairie View", () => {
    expect(mapEspnTeamName("Prairie View")).toBe("Prairie View A&M");
  });

  test("is case-insensitive", () => {
    expect(mapEspnTeamName("LONG ISLAND")).toBe("LIU");
    expect(mapEspnTeamName("long island")).toBe("LIU");
  });

  test("strips punctuation for matching", () => {
    // "St. John's" → normalized "st johns" → alias
    expect(mapEspnTeamName("St. John's")).toBe("St. John's");
  });

  test("uses matchup context to resolve unique short names", () => {
    expect(mapEspnTeamName("Miami", { candidateNames: ["Miami FL", "Missouri"] })).toBe(
      "Miami FL"
    );
  });

  test("does not resolve ambiguous short names without context", () => {
    expect(mapEspnTeamName("Miami", { candidateNames: ["Miami FL", "Miami OH"] })).toBeNull();
  });
});

describe("fetchAndQueueEspnResults", () => {
  let cleanup: () => void;

  beforeEach(() => {
    cleanup = createTestDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  test("handles alias and contextual team-name matching across one ESPN batch", async () => {
    setResult(20, 64, "Tennessee", "Miami OH", null, {
      source: "play_in",
      manualOverride: false,
    });

    const scoreboard: ESPNScoreboard = {
      events: [
        ...(makeFinalTournamentEvent("ev1", "Kansas", "CA Baptist", "Kansas", 82, 66) ?? []),
        ...(makeFinalTournamentEvent("ev2", "Miami", "Missouri", "Miami", 71, 64) ?? []),
        ...(makeFinalTournamentEvent("ev3", "Purdue", "Queens", "Purdue", 90, 58) ?? []),
        ...(makeFinalTournamentEvent("ev4", "Purdue", "Miami", "Purdue", 76, 69) ?? []),
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => scoreboard,
      }))
    );

    const summary = await fetchAndQueueEspnResults(1);
    const pending = getPendingResultEvents();

    expect(summary.blockingIssues).toHaveLength(0);
    expect(summary.queued).toBe(4);
    expect(pending).toHaveLength(4);
    expect(
      pending.some(
        (event) =>
          event.team1 === "Kansas" &&
          event.team2 === "Cal Baptist" &&
          event.winner === "Kansas"
      )
    ).toBe(true);
    expect(
      pending.some(
        (event) =>
          ((event.team1 === "Miami FL" && event.team2 === "Missouri") ||
            (event.team1 === "Missouri" && event.team2 === "Miami FL")) &&
          event.winner === "Miami FL"
      )
    ).toBe(true);
    expect(
      pending.some(
        (event) =>
          ((event.team1 === "Purdue" && event.team2 === "Miami FL") ||
            (event.team1 === "Miami FL" && event.team2 === "Purdue")) &&
          event.winner === "Purdue"
      )
    ).toBe(true);
  });
});
