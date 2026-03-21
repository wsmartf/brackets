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
