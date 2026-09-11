/**
 * Config for the screenshot atlas under `e2e/visual/`. Separate from
 * `playwright.config.ts` so `npm run e2e` stays the fast correctness gate and
 * the atlas never blocks CI on pixels. The deterministic layout assertions live
 * in `e2e/layout.spec.ts` and do run in CI.
 *
 * Reuses the same servers and seeded fixture as the correctness suite.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/visual",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 20 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "cd ../backend && ENVIRONMENT=development RATE_LIMIT_ENABLED=false GOOGLE_ADDRESS_API_KEY= poetry run uvicorn app.main:app --port 8000 --log-level warning",
      url: "http://localhost:8000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "REACT_APP_API_URL=http://localhost:8000 BROWSER=none npm start",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
