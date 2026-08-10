import { test, expect } from "@playwright/test";

/**
 * Home Join Us CTAs: orgs go to /login (Instagram entry) and brands go to
 * /brand/apply. Home skips auto-dev-login so click-through stays anonymous.
 */

test("home join buttons route to /login and /brand/apply", async ({ page }) => {
  await page.goto("/");

  const section = page.locator("#home-join");
  await expect(
    section.getByRole("heading", { name: /want to join/i }),
  ).toBeVisible();

  await expect(
    section.getByRole("link", { name: /apply as brand/i }),
  ).toHaveAttribute("href", "/brand/apply");
  await expect(
    section.getByRole("link", { name: /join as student organization/i }),
  ).toHaveAttribute("href", "/login");

  await section.getByRole("link", { name: /apply as brand/i }).click();
  await expect(page).toHaveURL(/\/brand\/apply$/);

  await page.goto("/");
  await page
    .locator("#home-join")
    .getByRole("link", { name: /join as student organization/i })
    .click();
  await expect(page).toHaveURL(/\/login$/);
});
