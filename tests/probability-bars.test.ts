import { describe, expect, test } from "vitest";
import {
  getInitialVisibleTeamCount,
  getNextVisibleTeamCount,
} from "@/components/ProbabilityBars";

describe("ProbabilityBars visibility helpers", () => {
  test("shows every team when the list is shorter than the default window", () => {
    expect(getInitialVisibleTeamCount(7)).toBe(7);
  });

  test("caps the initial view at the configured window", () => {
    expect(getInitialVisibleTeamCount(20)).toBe(12);
    expect(getInitialVisibleTeamCount(20, 5)).toBe(5);
  });

  test("reveals more teams in chunks without exceeding the total", () => {
    expect(getNextVisibleTeamCount(20, 12)).toBe(20);
    expect(getNextVisibleTeamCount(29, 12)).toBe(24);
    expect(getNextVisibleTeamCount(29, 24)).toBe(29);
  });
});
