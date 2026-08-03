import { test, expect } from "@playwright/test";

/**
 * Admin impersonation journey: password login → console → "View as" an org →
 * red banner in the org portal → exit back to the console.
 *
 * Credentials come from `upsert_test_accounts.py`, which global-setup runs
 * after the seed (dev default password).
 */

const ADMIN_EMAIL = "admin@bringthebuzzover.com";
const ADMIN_PASSWORD = "buzzdev123";

async function loginAsAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByTestId("admin-email").fill(ADMIN_EMAIL);
  await page.getByTestId("admin-password").fill(ADMIN_PASSWORD);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("admin logs in and reaches the impersonation console", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(
    page.getByRole("heading", { name: /admin console/i }),
  ).toBeVisible();
  // The seeded org + brand accounts are listed as impersonation targets.
  await expect(page.getByText("Buzz Test Organization")).toBeVisible();
});

test("admin views as an org and can exit impersonation", async ({ page }) => {
  await loginAsAdmin(page);

  const orgRow = page.getByRole("row", { name: /Buzz Test Organization/ });
  await orgRow.getByRole("button", { name: /view as/i }).click();

  // Lands in the org portal with the impersonation banner up.
  await expect(page).toHaveURL(/\/org\/browse$/);
  const banner = page.getByTestId("impersonation-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/viewing as/i);
  await expect(banner).toContainText(/read-only/i);

  await page.getByTestId("exit-impersonation").click();

  // Back to the admin console as the admin, banner gone.
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /admin console/i }),
  ).toBeVisible();
});

test("unauthenticated /admin redirects to the admin login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
