import { test, expect } from "@playwright/test";

/** Marketing site must render for logged-out visitors (the cutover kept it). */
test("home page renders the marketing shell + waitlist", async ({ page }) => {
  await page.goto("/");
  // Lead-gen waitlist section survives the demo→prod cutover.
  await expect(page.getByRole("heading", { name: /join the waitlist/i })).toBeVisible();
  // The brand wordmark / nav chrome is present.
  await expect(page.getByRole("navigation").first()).toBeVisible();
});
