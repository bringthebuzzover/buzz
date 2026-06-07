import { test, expect } from "@playwright/test";

/** Brand password login → dashboard (seed creds from scripts/seed_dev.py). */
test("brand can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await page.getByTestId("brand-login-submit").click();

  await expect(page).toHaveURL(/\/brand\/dashboard/);
  await expect(page.getByRole("heading", { name: /brand dashboard/i })).toBeVisible();
});

test("brand login rejects bad credentials", async ({ page }) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("wrong-password");
  await page.getByTestId("brand-login-submit").click();

  // Stays on the login page and shows an error; no dashboard.
  await expect(page).toHaveURL(/\/brand\/login/);
  await expect(page.getByText(/invalid|failed|incorrect/i)).toBeVisible();
});
