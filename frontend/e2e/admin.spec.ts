import { test, expect, type Page } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

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
  // Controlled inputs can remount empty after a late React hydrate; assert
  // values stuck before submit so HTML5 `required` doesn't silently block POST.
  await expect(page.getByTestId("admin-email")).toHaveValue(ADMIN_EMAIL);
  await expect(page.getByTestId("admin-password")).toHaveValue(ADMIN_PASSWORD);

  const loginResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/auth/admin/login") &&
      r.request().method() === "POST",
  );
  await page.getByTestId("admin-login-submit").click();
  const resp = await loginResp;
  expect(resp.ok(), await resp.text()).toBeTruthy();
  // Cookie path is /api/auth — query under that path, not the API origin root.
  const cookies = await page.context().cookies(
    "http://localhost:8000/api/auth/refresh",
  );
  expect(
    cookies.some((c) => c.name === "buzz_refresh" && c.value.length > 0),
    `expected buzz_refresh after login; got ${JSON.stringify(cookies.map((c) => c.name))}`,
  ).toBeTruthy();

  await expect(page).toHaveURL(/\/admin$/);
  await waitForAuthSettled(page, "admin-overview");
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
  await waitForAuthSettled(page, "admin-overview");
});

test("sidebar reaches every section", async ({ page }) => {
  await loginAsAdmin(page);

  await sidebar(page).getByRole("link", { name: /organizations/i }).click();
  await expect(page).toHaveURL(/\/admin\/orgs$/);
  await expect(page.getByText(TEST_ORG)).toBeVisible();

  await sidebar(page).getByRole("link", { name: /brands/i }).click();
  await expect(page).toHaveURL(/\/admin\/brands$/);
  await expect(page.getByText(TEST_BRAND)).toBeVisible();

  await sidebar(page).getByRole("link", { name: /requests/i }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  await expect(page.getByRole("heading", { name: /drop requests/i })).toBeVisible();

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
  // SPA nav keeps the in-memory access token; cold goto is covered by reload.
  await sidebar(page).getByRole("link", { name: /organizations/i }).click();
  await expect(page).toHaveURL(/\/admin\/orgs$/);
  await expect(page.getByRole("heading", { name: /admin login/i })).toHaveCount(0);
  const orgRow = page.getByRole("row", { name: new RegExp(TEST_ORG) });
  await expect(orgRow).toBeVisible();
  await orgRow.getByRole("link", { name: TEST_ORG }).click();

  await expect(page).toHaveURL(/\/admin\/orgs\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: TEST_ORG })).toBeVisible();
});

test("admin views as an org from a row and can exit", async ({ page }) => {
  await loginAsAdmin(page);
  await sidebar(page).getByRole("link", { name: /organizations/i }).click();
  await expect(page).toHaveURL(/\/admin\/orgs$/);
  await expect(page.getByRole("heading", { name: /admin login/i })).toHaveCount(0);

  const orgRow = page.getByRole("row", { name: new RegExp(TEST_ORG) });
  await orgRow.getByRole("button", { name: /view as/i }).click();

  // Lands in the org portal with the read-only banner up.
  await expect(page).toHaveURL(/\/org\/browse$/);
  await waitForAuthSettled(page, "org");
  const banner = page.getByTestId("impersonation-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText(/viewing as/i);
  await expect(banner).toContainText(/read-only/i);

  // Same-tab hard reload remints View as from the sessionStorage latch.
  await page.reload();
  await expect(page).toHaveURL(/\/org\/browse$/);
  await waitForAuthSettled(page, "org");
  await expect(page.getByTestId("impersonation-banner")).toBeVisible();
  await expect(page.getByTestId("impersonation-banner")).toContainText(/viewing as/i);

  await page.getByTestId("exit-impersonation").click();

  // Soft SPA exit restores admin without a document navigation.
  await waitForAuthSettled(page, "admin-overview");
  await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);

  // Latch cleared on Exit — portal URL must not remint View as.
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "admin-overview");
  await expect(page.getByTestId("impersonation-banner")).toHaveCount(0);
});

test("unauthenticated /admin redirects to the admin login", async ({ page }) => {
  await page.goto("/admin");
  await waitForAuthSettled(page);
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test("admin saves a draft from a ticket and publishes it", async ({ page }) => {
  await loginAsAdmin(page);
  await sidebar(page).getByRole("link", { name: /requests/i }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  await expect(page.getByText("E2E Drop Request")).toBeVisible();
  await page
    .getByRole("row", { name: /E2E Drop Request/ })
    .getByRole("link", { name: /^open$/i })
    .click();
  await expect(page).toHaveURL(/\/admin\/requests\/[0-9a-f-]+$/);

  await page.getByTestId("draft-title").fill("E2E Published Drop");
  await page.getByTestId("draft-description").fill("Admin-minted campaign for E2E.");
  await page.getByTestId("draft-image").fill("https://example.test/e2e-hero.png");
  await page.getByTestId("draft-location").fill("E2E Campus");
  await expect(page.getByTestId("save-draft")).toBeEnabled();

  const saveResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/admin/brands/") &&
      r.url().includes("/drops") &&
      r.request().method() === "POST",
  );
  await page.getByTestId("save-draft").click();
  const saved = await saveResp;
  expect(saved.ok(), await saved.text()).toBeTruthy();

  await expect(page.getByTestId("publish-drop")).toBeEnabled();
  const publishResp = page.waitForResponse(
    (r) =>
      r.url().includes("/publish") && r.request().method() === "POST",
  );
  await page.getByTestId("publish-drop").click();
  const published = await publishResp;
  expect(published.ok(), await published.text()).toBeTruthy();
  await expect(page.getByText(/^Published\b/).first()).toBeVisible();

  const savedJson = (await saved.json()) as { data?: { id?: string } };
  const dropId = savedJson.data?.id;
  expect(dropId, "save-draft should return a drop id").toBeTruthy();
  await page.goto(`/admin/drops/${dropId}?tab=config`);
  await expect(page.getByTestId("tab-config")).toBeVisible();
  await expect(page.getByTestId("save-drop-config")).toBeVisible();
  const titleField = page.getByLabel(/^title$/i).first();
  await titleField.fill("E2E Config Title");
  const patchResp = page.waitForResponse(
    (r) =>
      r.url().includes(`/api/admin/drops/${dropId}`) &&
      r.request().method() === "PATCH",
  );
  await page.getByTestId("save-drop-config").click();
  const patched = await patchResp;
  expect(patched.ok(), await patched.text()).toBeTruthy();
  await page.reload();
  await expect(page.getByTestId("save-drop-config")).toBeVisible();
  await expect(page.getByLabel(/^title$/i).first()).toHaveValue("E2E Config Title");
});
