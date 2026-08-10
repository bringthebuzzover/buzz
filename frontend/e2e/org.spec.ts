import { test, expect } from "@playwright/test";

/**
 * Org journeys. In dev the app auto-dev-logins as the seeded active org on
 * bootstrap (no Instagram needed), so navigating to a portal route lands a real
 * authenticated session.
 */

test("org drop feed renders cards", async ({ page }) => {
  await page.goto("/org/browse");
  await expect(page.getByRole("heading", { name: /browse/i })).toBeVisible();
  // Seed has 4 drops + the E2E open drop.
  await expect(page.getByTestId("drop-card").first()).toBeVisible();
  expect(await page.getByTestId("drop-card").count()).toBeGreaterThan(0);
});

test("org can apply to an open drop", async ({ page }) => {
  await page.goto("/org/browse");
  // The deterministic open, unapplied drop seeded by seed_e2e.
  const card = page
    .getByTestId("drop-card")
    .filter({ hasText: "E2E Open Drop" });
  await expect(card).toBeVisible();

  await card.getByTestId("apply-button").click();
  // Inline apply form appears.
  const applyForm = page.getByRole("heading", { name: /apply to drop/i });
  await expect(applyForm).toBeVisible();
  await page.getByPlaceholder(/optional pitch/i).fill("E2E pitch");
  await page.getByTestId("apply-submit").click();

  // Success is proven by the form CLOSING (it stays open on any error) AND the
  // card's button flipping to the already-applied state — not by the always-
  // present "Browse" header.
  await expect(applyForm).toHaveCount(0);
  await expect(
    page.getByTestId("drop-card").filter({ hasText: "E2E Open Drop" }).getByTestId("apply-button"),
  ).toHaveText(/already applied/i);
});
