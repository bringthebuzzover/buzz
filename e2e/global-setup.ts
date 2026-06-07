import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Reset the local DB to a deterministic fixture before the E2E run: the dev seed
 * plus one guaranteed-open, unapplied drop (so the apply journey has a target).
 * Runs the backend's `scripts/seed_e2e.py` via poetry. Requires local Postgres.
 */
export default async function globalSetup() {
  const backend = path.resolve(__dirname, "..", "backend");
  // eslint-disable-next-line no-console
  console.log("[e2e] seeding database (seed_e2e.py)…");
  try {
    execSync("poetry run python scripts/seed_e2e.py", {
      cwd: backend,
      stdio: "inherit",
      env: { ...process.env, ENVIRONMENT: "development" },
    });
  } catch (err) {
    throw new Error(
      "[e2e] seed failed — is local Postgres running and `poetry install` done in backend/? " +
        `(${(err as Error).message})`,
    );
  }
}
