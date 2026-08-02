import { test, expect } from "@playwright/test";

/**
 * Route guards. The dev session is the active ORG; a role-gated brand route must
 * block it — RequireRole renders a 403 page (by design) instead of the dashboard.
 */
test("org session is blocked from the brand dashboard (403)", async ({ page }) => {
  await page.goto("/brand/dashboard");
  // The brand dashboard must NOT render…
  await expect(page.getByRole("heading", { name: /brand dashboard/i })).toHaveCount(0);
  // …and the 403 guard page is shown instead.
  await expect(page.getByRole("heading", { name: "403" })).toBeVisible();
  await expect(page.getByText(/don't have access/i)).toBeVisible();
});
