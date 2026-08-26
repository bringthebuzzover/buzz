/**
 * Wait until RequireAuth is done showing “Restoring your session…” then
 * optionally until persona chrome is up. Do not assert Overview / 403 /
 * My Campaigns while bootstrap is still in flight
 * (auth.ci-session-restore-flake).
 */
import { expect, type Page } from "@playwright/test";

const RESTORING = /restoring your session/i;

export type AuthSettledAs = "org" | "admin-overview" | "anonymous";

export async function waitForAuthSettled(
  page: Page,
  settled: AuthSettledAs = "anonymous",
): Promise<void> {
  await expect(page.getByText(RESTORING)).toHaveCount(0);

  if (settled === "org") {
    await expect(page.getByText("Org Portal")).toBeVisible();
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
