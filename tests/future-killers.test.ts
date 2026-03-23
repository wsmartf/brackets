import { describe, expect, test } from "vitest";
import {
  buildDerivedFutureKillerRows,
  buildScheduledFutureKillerRows,
} from "@/lib/future-killers";
import type { ESPNScheduledGame } from "@/lib/espn";
import { buildCurrentGameDefinitions, buildGameDefinitions } from "@/lib/tournament";

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

describe("future killer helpers", () => {
  test("buildDerivedFutureKillerRows includes known upcoming games and sorts by guaranteed kills", () => {
    const results = makeResults();
    const currentDefinitions = buildCurrentGameDefinitions(results);
    const game4 = currentDefinitions[4];
    const game5 = currentDefinitions[5];
    const game33 = currentDefinitions[33];

    const rows = buildDerivedFutureKillerRows(results, {
      4: [75, 25],
      5: [60, 40],
      32: [80, 20],
      33: [55, 45],
    });

    expect(rows[0]).toMatchObject({
      gameIndex: 33,
      round: 32,
      team1: game33.team1,
      team2: game33.team2,
      guaranteedKills: 45,
      scheduledAt: null,
    });
    expect(rows[1]).toMatchObject({
      gameIndex: 5,
      round: 64,
      team1: game5.team1,
      team2: game5.team2,
      guaranteedKills: 40,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          gameIndex: 4,
          round: 64,
          team1: game4.team1,
          team2: game4.team2,
          guaranteedKills: 25,
        }),
        expect.objectContaining({
          gameIndex: 33,
          round: 32,
          team1: game33.team1,
          team2: game33.team2,
          guaranteedKills: 45,
        }),
      ])
    );
  });

  test("buildScheduledFutureKillerRows uses ESPN schedule ordering, skips unmatched games, and limits rows", () => {
    const results = makeResults();
    const currentDefinitions = buildCurrentGameDefinitions(results);
    const game4 = currentDefinitions[4];
    const game5 = currentDefinitions[5];
    const game33 = currentDefinitions[33];

    const scheduledGames: ESPNScheduledGame[] = [
      {
        eventId: "ev-1",
        eventDate: "2026-03-22T23:10Z",
        status: "STATUS_SCHEDULED",
        team1: game4.team1,
        team2: game4.team2,
      },
      {
        eventId: "ev-2",
        eventDate: "2026-03-23T00:10Z",
        status: "STATUS_SCHEDULED",
        team1: "TBD",
        team2: "Michigan",
      },
      {
        eventId: "ev-3",
        eventDate: "2026-03-23T01:10Z",
        status: "STATUS_SCHEDULED",
        team1: game33.team1,
        team2: game33.team2,
      },
      {
        eventId: "ev-4",
        eventDate: "2026-03-23T02:10Z",
        status: "STATUS_SCHEDULED",
        team1: game5.team1,
        team2: game5.team2,
      },
    ];

    const rows = buildScheduledFutureKillerRows(
      results,
      {
        4: [75, 25],
        5: [60, 40],
        33: [55, 45],
      },
      scheduledGames,
      2
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      gameIndex: 4,
      team1: game4.team1,
      team2: game4.team2,
      guaranteedKills: 25,
      scheduledAt: "2026-03-22T23:10Z",
      espnEventId: "ev-1",
    });
    expect(rows[1]).toMatchObject({
      gameIndex: 33,
      team1: game33.team1,
      team2: game33.team2,
      guaranteedKills: 45,
      scheduledAt: "2026-03-23T01:10Z",
      espnEventId: "ev-3",
    });
  });
});
