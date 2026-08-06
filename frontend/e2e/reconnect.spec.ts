import { test, expect } from "@playwright/test";

/**
 * Public reconnect surface must render without a session and without looping
 * on authenticated API calls.
 */
test("reconnect-instagram renders CTA without auth", async ({ page }) => {
  await page.goto("/reconnect-instagram");
  await expect(
    page.getByRole("heading", { name: /reconnect/i }),
  ).toBeVisible();
  await expect(page.getByTestId("reconnect-instagram-cta")).toBeVisible();
  await expect(page).toHaveURL(/\/reconnect-instagram$/);
});
