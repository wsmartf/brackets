/**
 * Smoke tests — verify the app loads and core APIs return expected shapes.
 *
 * These tests are intentionally state-agnostic: they pass whether the
 * tournament is not yet started, in progress, or complete.
 *
 * Run with: make test-ui
 * Requires dev server (playwright starts one automatically, or `make dev`).
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// API shape tests (fast — no full page render needed)
// ---------------------------------------------------------------------------

test.describe("GET /api/stats", () => {
  test("returns valid JSON with expected fields", async ({ request }) => {
    const response = await request.get("/api/stats");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(typeof data.remaining).toBe("number");
    expect(typeof data.totalBrackets).toBe("number");
    expect(data.totalBrackets).toBeGreaterThan(0);
    expect(data.remaining).toBeGreaterThanOrEqual(0);
    expect(data.remaining).toBeLessThanOrEqual(data.totalBrackets as number);
    expect(typeof data.gamesCompleted).toBe("number");
    expect(typeof data.championshipProbs).toBe("object");
  });
});

test.describe("GET /api/bracket/[id]", () => {
  test("bracket 0 returns 63 picks", async ({ request }) => {
    const response = await request.get("/api/bracket/0");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(data.id).toBe(0);
    expect(Array.isArray(data.picks)).toBe(true);
    expect((data.picks as unknown[]).length).toBe(63);
    expect(typeof data.alive).toBe("boolean");
    expect(typeof data.summary).toBe("object");
  });

  test("bracket 999999999 (max) returns 63 picks", async ({ request }) => {
    const response = await request.get("/api/bracket/999999999");
    expect(response.ok()).toBe(true);
    const data = await response.json() as Record<string, unknown>;
    expect((data.picks as unknown[]).length).toBe(63);
  });

  test("invalid bracket id returns 400", async ({ request }) => {
    const response = await request.get("/api/bracket/not-a-number");
    expect(response.status()).toBe(400);
  });

  test("bracket picks have expected structure", async ({ request }) => {
    const response = await request.get("/api/bracket/42");
    const data = await response.json() as { picks: Array<Record<string, unknown>> };
    const pick = data.picks[0];
    expect(typeof pick.game_index).toBe("number");
    expect(typeof pick.round).toBe("number");
    expect(typeof pick.team1).toBe("string");
    expect(typeof pick.team2).toBe("string");
    expect(typeof pick.pick).toBe("string");
    expect([pick.team1, pick.team2]).toContain(pick.pick);
  });
});

test.describe("GET /api/survivors", () => {
  test("returns valid JSON with expected shape", async ({ request }) => {
    const response = await request.get("/api/survivors?limit=5");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(Array.isArray(data.indices)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThanOrEqual(0);
    const indices = data.indices as unknown[];
    expect(indices.length).toBeLessThanOrEqual(5);
    if (indices.length > 0) {
      expect(typeof indices[0]).toBe("number");
    }
  });

  test("valid champion filter returns valid JSON", async ({ request }) => {
    const statsResponse = await request.get("/api/stats");
    expect(statsResponse.ok()).toBe(true);

    const stats = await statsResponse.json() as {
      championshipProbs?: Record<string, number>;
    };
    const champion =
      Object.entries(stats.championshipProbs ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "Duke";

    const response = await request.get(
      `/api/survivors?champion=${encodeURIComponent(champion)}&limit=3`
    );
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(Array.isArray(data.indices)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect((data.indices as unknown[]).length).toBeLessThanOrEqual(3);
    if ((data.total as number) > 0) {
      expect((data.indices as unknown[]).length).toBeGreaterThan(0);
    }
  });

  test("unknown champion returns 400", async ({ request }) => {
    const response = await request.get("/api/survivors?champion=NotATeam");
    expect(response.status()).toBe(400);
  });
});

test.describe("GET /api/survivors?detail=full", () => {
  test("returns brackets array with enriched shape when total <= 50", async ({ request }) => {
    const statsResponse = await request.get("/api/stats");
    const stats = await statsResponse.json() as { remaining: number };
    test.skip(stats.remaining > 50, "detail=full falls back to index-only when total > 50");

    const response = await request.get("/api/survivors?detail=full");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(Array.isArray(data.brackets)).toBe(true);
    expect(typeof data.total).toBe("number");

    const brackets = data.brackets as Array<Record<string, unknown>>;
    if (brackets.length > 0) {
      const b = brackets[0];
      expect(typeof b.index).toBe("number");
      expect(Array.isArray(b.picks)).toBe(true);
      expect((b.picks as unknown[]).length).toBe(63);
      expect(typeof b.alive).toBe("boolean");
      expect(typeof b.likelihood).toBe("number");
      expect(b.likelihood).toBeGreaterThanOrEqual(0);
      expect(typeof b.championPick).toBe("string");
      expect(Array.isArray(b.championshipGame)).toBe(true);
      expect((b.championshipGame as unknown[]).length).toBe(2);
      expect(Array.isArray(b.finalFour)).toBe(true);
    }
  });

  test("falls back to index-only response when total > 50", async ({ request }) => {
    const statsResponse = await request.get("/api/stats");
    const stats = await statsResponse.json() as { remaining: number };
    test.skip(stats.remaining <= 50, "detail=full returns brackets array when total <= 50");

    const response = await request.get("/api/survivors?detail=full");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(Array.isArray(data.indices)).toBe(true);
    expect(typeof data.total).toBe("number");
  });
});

test.describe("GET /api/future-killers", () => {
  test("returns valid JSON with expected shape", async ({ request }) => {
    const response = await request.get("/api/future-killers");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(Array.isArray(data.rows)).toBe(true);
    expect(["espn", "derived"]).toContain(data.source as string);
    expect(typeof data.isFallback).toBe("boolean");

    const rows = data.rows as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      expect(typeof rows[0].gameIndex).toBe("number");
      expect(typeof rows[0].team1).toBe("string");
      expect(typeof rows[0].team2).toBe("string");
      expect(typeof rows[0].guaranteedKills).toBe("number");
    }
  });
});

test.describe("GET /api/final-n-insights", () => {
  test("returns valid JSON with expected shape", async ({ request }) => {
    const response = await request.get("/api/final-n-insights");
    expect(response.ok()).toBe(true);

    const data = await response.json() as Record<string, unknown>;
    expect(data.bestCaseAfter === null || typeof data.bestCaseAfter === "object").toBe(true);
    expect(Array.isArray(data.milestones)).toBe(true);

    const milestones = data.milestones as Array<Record<string, unknown>>;
    if (milestones.length > 0) {
      expect(typeof milestones[0].id).toBe("string");
      expect(typeof milestones[0].label).toBe("string");
      expect(typeof milestones[0].probability).toBe("number");
    }
  });
});

// ---------------------------------------------------------------------------
// Page load smoke tests
// ---------------------------------------------------------------------------

test.describe("dashboard", () => {
  test("home page loads without errors", async ({ page }) => {
    await page.goto("/");
    // No error page
    await expect(page).not.toHaveTitle(/Error/i);
    // Something renders
    await expect(page.locator("body")).not.toBeEmpty();

     const myTeamButton = page.getByRole("button", { name: "My Team" });
     if ((await myTeamButton.count()) > 0) {
       await expect(page.getByLabel("Team")).toBeVisible();

       await page.getByRole("button", { name: "Future Killers" }).click();
       await expect(
         page.getByText(
           /Next scheduled games that are guaranteed to eliminate surviving brackets\.|No upcoming scheduled tournament games with known participants yet\.|Live schedule unavailable\. Showing known future matchups instead\.|Could not load upcoming games right now\./
         )
       ).toBeVisible();
     }
  });

  test("Final N homepage renders when remaining <= 20", async ({ page, request }) => {
    const stats = await request.get("/api/stats").then((r) => r.json()) as { remaining: number };
    test.skip(stats.remaining > 20, "Not in Final N mode — standard homepage active");

    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByText(/THE FINAL \d+/)).toBeVisible();
    await expect(page.getByText("Every survivor, side by side")).toBeVisible();
    await expect(page.getByText("Remaining Games")).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear" }).first()).toBeVisible();
  });

  test("Standard homepage renders when remaining > 20", async ({ page, request }) => {
    const stats = await request.get("/api/stats").then((r) => r.json()) as { remaining: number };
    test.skip(stats.remaining <= 20, "In Final N mode — standard homepage not active");

    await page.goto("/");
    await expect(page.locator("body")).not.toBeEmpty();
    // Standard mode has the AnalysisCardSwitcher; Final N mode does not
    await expect(page.locator("text=THE FINAL")).not.toBeVisible();
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page).not.toHaveTitle(/Error/i);
  });
});

test.describe("bracket viewer", () => {
  test("/bracket/0 loads", async ({ page }) => {
    await page.goto("/bracket/0");
    await expect(page).not.toHaveTitle(/Error/i);
    await expect(page.locator("body")).not.toBeEmpty();
  });
});
