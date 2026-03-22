import { defineConfig, devices } from "@playwright/test";

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const playwrightHost = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://${playwrightHost}:${playwrightPort}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts", // avoid picking up vitest *.test.ts files
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Start dev server automatically if not already running.
  // Agents: run `make dev` in a separate terminal for faster iteration,
  // then `make test-ui` will reuse the already-running server.
  webServer: {
    command: `npm run dev -- --hostname ${playwrightHost} --port ${playwrightPort}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
