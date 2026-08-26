/**
 * Wait until RequireAuth is done showing “Restoring your session…” then
 * optionally until persona chrome is up. Do not assert Overview / 403 /
 * My Campaigns while bootstrap is still in flight
 * (auth.ci-session-restore-flake).
 */
import { expect, type Page } from "@playwright/test";

const RESTORING = /restoring your session/i;
const ORG_SETTLE_MS = 10_000;

export type AuthSettledAs = "org" | "admin-overview" | "anonymous";

export async function waitForAuthSettled(
  page: Page,
  settled: AuthSettledAs = "anonymous",
): Promise<void> {
  await expect(page.getByText(RESTORING)).toHaveCount(0);

  if (settled === "org") {
    // failHard → /login must not burn the full expect timeout waiting for
    // Org Portal that never appears (auth.ci-session-restore-flake).
    const portal = expect(page.getByText("Org Portal")).toBeVisible({
      timeout: ORG_SETTLE_MS,
    });
    const guestLogin = page
      .waitForURL(/\/login(\?|$)/, { timeout: ORG_SETTLE_MS })
      .then(() => {
        throw new Error(
          "bootstrap fell back to /login (see auth.ci-session-restore-flake)",
        );
      });
    await Promise.race([portal, guestLogin]);
    return;
  }

  if (settled === "admin-overview") {
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("heading", { name: /admin login/i }),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  }
}
