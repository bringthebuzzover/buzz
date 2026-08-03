import { test, expect } from "@playwright/test";

/** Marketing site must render for logged-out visitors (the cutover kept it). */
test("home page renders the marketing shell + join section", async ({ page }) => {
  await page.goto("/");
  // Join Us CTAs for org (/login) and brand (/brand/apply). Scope to the
  // section — the same brand-apply link also lives in the footer, so a
  // global `getByRole('link')` matches twice under strict mode.
  const joinSection = page.locator("#home-join");
  await expect(joinSection.getByRole("heading", { name: /want to join/i })).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /join as student organization/i }),
  ).toBeVisible();
  await expect(
    joinSection.getByRole("link", { name: /apply as brand/i }),
  ).toBeVisible();
  // The brand wordmark / nav chrome is present.
  await expect(page.getByRole("navigation").first()).toBeVisible();
});
