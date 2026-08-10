import { defineConfig, devices } from "@playwright/test";

/**
 * Thin E2E suite (a few critical cross-stack journeys). Kept deliberately small
 * and on `data-testid` selectors to bound maintenance — see TESTING.md.
 *
 * `globalSetup` applies migrations + resets the DB to a deterministic fixture
 * (the dev seed + one guaranteed-open drop) before the run. `webServer` starts
 * the backend (ENVIRONMENT=development, so dev-login works) and the frontend.
 * `reuseExistingServer` is off in CI (always a fresh dev-mode backend); locally
 * it reuses a running server for speed — keep your local :8000 in dev mode.
 *
 * Prereqs: local Postgres running, backend deps installed (poetry), browsers
 * installed (`npx playwright install chromium`).
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // No retries: stress matrix / --repeat-each is the flake detector. Keep
  // retain-on-failure so a red run still uploads traces/screenshots/video.
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      // RATE_LIMIT_ENABLED=false: E2E alone does many admin/brand/dev-login
      // POSTs from one IP; prod keeps rate limits on.
      command:
        "cd ../backend && ENVIRONMENT=development RATE_LIMIT_ENABLED=false poetry run uvicorn app.main:app --port 8000 --log-level warning",
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
