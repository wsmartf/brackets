import { describe, expect, test } from "vitest";
import { buildPathBrackets } from "../lib/path-brackets";
import type { SurvivorBracketSummary } from "../lib/survivor-brackets";

describe("buildPathBrackets", () => {
  test("keeps only Sweet 16 and later picks for the path chart", () => {
    const bracket: SurvivorBracketSummary = {
      index: 7,
      alive: true,
      likelihood: 0.25,
      championPick: "Duke",
      championshipGame: ["Duke", "Houston"],
      finalFour: ["Duke", "Alabama", "Houston", "Purdue"],
      eliminatedBy: null,
      picks: [
        { game_index: 0, round: 64, team1: "A", team2: "B", pick: "A", result: "alive" },
        { game_index: 32, round: 32, team1: "A", team2: "C", pick: "A", result: "pending" },
        { game_index: 48, round: 16, team1: "A", team2: "D", pick: "A", result: "pending" },
        { game_index: 56, round: 8, team1: "A", team2: "E", pick: "A", result: "pending" },
        { game_index: 60, round: 4, team1: "A", team2: "F", pick: "A", result: "pending" },
        { game_index: 62, round: 2, team1: "A", team2: "G", pick: "A", result: "pending" },
      ],
    };

    const pathBracket = buildPathBrackets([bracket])[0];

    expect([...pathBracket.picks.keys()]).toEqual([48, 56, 60, 62]);
  });
});
