import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config — visual/layout regression net for the Redial panel.
 *
 * These tests drive the REAL composed panel on the test-app `/demo` page (with
 * real Tailwind + all three surfaces) and assert the geometric sweep in
 * tests/visual/sweep.ts. See docs/adr/0002-visual-tests-in-browser-mode.md.
 *
 * Local dev on macOS: binary-authorization (Santa) kills a Playwright-spawned
 * Chromium, so run inside an Orbstack/Docker Linux sandbox against the
 * host dev server — see tests/visual/README.md. In that mode the dev server is
 * external, so pass PW_NO_SERVER=1 and BASE_URL=http://host.docker.internal:3000.
 *
 * CI (Linux): omit PW_NO_SERVER and Playwright starts the dev server itself.
 */
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const NO_SERVER = !!process.env.PW_NO_SERVER;

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
      },
    },
  ],
  ...(NO_SERVER
    ? {}
    : {
        webServer: {
          command: "npm --prefix test-app run dev",
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
