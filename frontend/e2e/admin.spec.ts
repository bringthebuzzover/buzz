import { test, expect, type Page } from "@playwright/test";

/**
 * The admin panel: login, the overview's queue cards, sidebar navigation into a
 * filtered account list, and "View as" from a table row into the org portal.
 *
 * Credentials come from `upsert_test_accounts.py`, which global-setup runs after
 * the seed (dev default password).
 */

const ADMIN_EMAIL = "admin@bringthebuzzover.com";
const ADMIN_PASSWORD = "buzzdev123";
const TEST_ORG = "Buzz Test Organization";
const TEST_BRAND = "Buzz Test Brand";

async function loginAsAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.getByTestId("admin-email").fill(ADMIN_EMAIL);
  await page.getByTestId("admin-password").fill(ADMIN_PASSWORD);
  await page.getByTestId("admin-login-submit").click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** The desktop rail is hidden below `lg`, so scope nav lookups to it. */
function sidebar(page: Page) {
  return page.locator("aside");
}

test("admin lands on the overview with a card per queue", async ({ page }) => {
  await loginAsAdmin(page);

  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  // Each queue card is a deep link into its filtered list.
  await expect(page.getByTestId("queue-orgs_pending_approval")).toBeVisible();
  await expect(page.getByTestId("queue-brands_pending_review")).toBeVisible();
  await expect(page.getByTestId("queue-drops_ready_to_advance")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /warnings/i }),
  ).toBeVisible();
});

test("the session survives a reload", async ({ page }) => {
  await loginAsAdmin(page);
  await page.reload();

  // Regression guard: the refresh cookie has to re-mint an access token rather
  // than bouncing back to the login form.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("sidebar reaches every section", async ({ page }) => {
  await loginAsAdmin(page);

  await sidebar(page).getByRole("link", { name: /organizations/i }).click();
  await expect(page).toHaveURL(/\/admin\/orgs$/);
  await expect(page.getByText(TEST_ORG)).toBeVisible();

  await sidebar(page).getByRole("link", { name: /brands/i }).click();
  await expect(page).toHaveURL(/\/admin\/brands$/);
  await expect(page.getByText(TEST_BRAND)).toBeVisible();

  await sidebar(page).getByRole("link", { name: /drops/i }).click();
  await expect(page).toHaveURL(/\/admin\/drops$/);
  await expect(page.getByRole("heading", { name: "Drops" })).toBeVisible();

  await sidebar(page).getByRole("link", { name: /health/i }).click();
  await expect(page).toHaveURL(/\/admin\/health$/);
  // Pipeline freshness is inferred from domain data; this is the sharpest canary.
  await expect(page.getByTestId("signal-drop_autoclose")).toBeVisible();
});

test("queue cards deep-link into a filtered list", async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByTestId("queue-orgs_pending_approval").click();

  // Pending queues are a filter on the one table, not a separate page, so the
  // filter has to live in the URL to stay shareable.
  await expect(page).toHaveURL(/\/admin\/orgs\?status=pending_approval$/);
  await expect(
    page.getByRole("link", { name: "Awaiting approval" }),
  ).toBeVisible();
});

test("org detail opens from the list", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/orgs");
  await page.getByRole("link", { name: TEST_ORG }).click();

  await expect(page).toHaveURL(/\/admin\/orgs\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: TEST_ORG })).toBeVisible();
});

test("admin views as an org from a row and can exit", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/orgs");

  const orgRow = page.getByRole("row", { name: new RegExp(TEST_ORG) });
  await orgRow.getByRole("button", { name: /view as/i }).click();

  // Lands in the org portal with the read-only banner up.
  await expect(page).toHaveURL(/\/org\/browse$/);
  const banner = page.getByTestId("impersonation-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/viewing as/i);
  await expect(banner).toContainText(/read-only/i);

  await page.getByTestId("exit-impersonation").click();

  // Back on the panel as the admin, banner gone.
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
});

test("unauthenticated /admin redirects to the admin login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/);
});
