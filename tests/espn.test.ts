import { describe, test, expect } from "vitest";
import { extractResults, mapEspnTeamName, type ESPNScoreboard } from "../lib/espn";

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

// ---------------------------------------------------------------------------
// mapEspnTeamName — alias resolution only (no DB needed)
// The alias table returns before hitting the DB, so these tests are purely local.
// ---------------------------------------------------------------------------

describe("mapEspnTeamName (alias resolution)", () => {
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
});
