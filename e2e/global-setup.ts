import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Reset the local DB to a deterministic fixture before the E2E run: apply
 * migrations (so a fresh DB has tables — the seed TRUNCATEs), then the dev seed
 * plus one guaranteed-open, unapplied drop (so the apply journey has a target).
 * Requires local Postgres + backend deps (`poetry install`).
 */
export default async function globalSetup() {
  const backend = path.resolve(__dirname, "..", "backend");
  const env = { ...process.env, ENVIRONMENT: "development" };
  try {
    // Migrations first — seed_e2e TRUNCATEs, which errors on a tableless DB.
    // eslint-disable-next-line no-console
    console.log("[e2e] applying migrations (alembic upgrade head)…");
    execSync("poetry run alembic upgrade head", { cwd: backend, stdio: "inherit", env });
    // eslint-disable-next-line no-console
    console.log("[e2e] seeding database (seed_e2e.py)…");
    execSync("poetry run python scripts/seed_e2e.py", { cwd: backend, stdio: "inherit", env });
  } catch (err) {
    throw new Error(
      "[e2e] DB setup failed — is local Postgres running and `poetry install` done in backend/? " +
        `(${(err as Error).message})`,
    );
  }
}
