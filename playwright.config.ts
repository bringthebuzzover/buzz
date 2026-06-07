import { defineConfig, devices } from "@playwright/test";

/**
 * Thin E2E suite (a few critical cross-stack journeys). Kept deliberately small
 * and on `data-testid` selectors to bound maintenance — see TESTING.md.
 *
 * `globalSetup` resets the DB to a deterministic fixture (the dev seed + one
 * guaranteed-open drop) before the run. `webServer` starts the backend (dev
 * mode, so dev-login works) and the frontend, reusing them if already up.
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
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command:
        "cd backend && ENVIRONMENT=development poetry run uvicorn app.main:app --port 8000 --log-level warning",
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
