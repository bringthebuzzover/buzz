import { test, expect } from "@playwright/test";

/** Brand password login → dashboard (seed creds from scripts/seed_dev.py). */
test("brand can log in and reach the dashboard", async ({ page }) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await expect(page.getByTestId("brand-email")).toHaveValue(
    "partnerships@acme.coffee",
  );
  await expect(page.getByTestId("brand-password")).toHaveValue("buzzdev123");

  const loginResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/auth/brand/login") &&
      r.request().method() === "POST",
  );
  await page.getByTestId("brand-login-submit").click();
  const resp = await loginResp;
  expect(resp.ok(), await resp.text()).toBeTruthy();

  await expect(page).toHaveURL(/\/brand\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
});

test("brand dashboard compare-drops fits 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await expect(page.getByTestId("brand-email")).toHaveValue(
    "partnerships@acme.coffee",
  );
  await expect(page.getByTestId("brand-password")).toHaveValue("buzzdev123");

  const loginResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/auth/brand/login") &&
      r.request().method() === "POST",
  );
  await page.getByTestId("brand-login-submit").click();
  const resp = await loginResp;
  expect(resp.ok(), await resp.text()).toBeTruthy();

  await expect(page).toHaveURL(/\/brand\/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, `dashboard overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(
    1,
  );
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

test("brand plan campaign creates a ticket receipt, not a drop", async ({
  page,
}) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await page.getByTestId("brand-login-submit").click();
  await expect(page).toHaveURL(/\/brand\/dashboard/);

  await page.getByTestId("plan-campaign").click();
  await expect(page).toHaveURL(/\/brand\/requests\/new/);

  await page.locator("#message").fill("E2E plan campaign ticket");
  await page.locator("#product").fill("Cold brew cans");
  await page.locator("#notes").fill("Optional notes for the rep");

  const createResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/brands/me/drop-requests") &&
      r.request().method() === "POST",
  );
  await page.getByTestId("submit-drop-request").click();
  const resp = await createResp;
  expect(resp.ok(), await resp.text()).toBeTruthy();

  await expect(page).toHaveURL(/\/brand\/dashboard/);
  await expect(page).not.toHaveURL(/\/brand\/drops\//);
  await expect(page.getByTestId("ticket-submitted-toast")).toBeVisible();
  await expect(page.getByTestId("drop-request-row").first()).toContainText("Received");
  await expect(page.getByText("E2E plan campaign ticket")).toBeVisible();
});

test("brand settings shows name, locked email, and the handle request", async ({
  page,
}) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await page.getByTestId("brand-login-submit").click();
  await expect(page).toHaveURL(/\/brand\/dashboard/);

  await page.getByRole("link", { name: "Setup" }).click();
  await expect(page).toHaveURL(/\/brand\/settings/);
  await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();
  await expect(page.getByTestId("brand-email-locked")).toHaveText(
    "Contact BUZZ to change",
  );
  await expect(page.getByTestId("brand-email-locked")).toHaveAttribute(
    "href",
    /^mailto:/,
  );
  await expect(page.getByTestId("brand-email")).toHaveText(
    "partnerships@acme.coffee",
  );
  const name = page.getByTestId("brand-name");
  await expect(name).toHaveValue("Acme Coffee");
  await name.fill("Acme Coffee");
  const saveResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/brands/me") &&
      r.request().method() === "PATCH" &&
      !r.url().includes("ig-change"),
  );
  await page.getByTestId("brand-name-save").click();
  const saved = await saveResp;
  expect(saved.ok(), await saved.text()).toBeTruthy();
  await expect(page.getByTestId("brand-name-saved")).toBeVisible();

  const requestChange = page.getByTestId("brand-ig-change-open");
  if (await requestChange.isVisible()) {
    await requestChange.click();
    await expect(page.getByTestId("brand-ig-requested")).toBeVisible();
    await expect(page.getByTestId("brand-ig-reason")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
  } else {
    await expect(page.getByTestId("brand-ig-pending")).toHaveText(
      "Pending admin approval",
    );
  }
});

test("GET /logout signs out like the header button", async ({ page }) => {
  await page.goto("/brand/login");
  await page.getByTestId("brand-email").fill("partnerships@acme.coffee");
  await page.getByTestId("brand-password").fill("buzzdev123");
  await page.getByTestId("brand-login-submit").click();
  await expect(page).toHaveURL(/\/brand\/dashboard/);

  const logoutResp = page.waitForResponse(
    (r) =>
      r.url().includes("/api/auth/logout") &&
      r.request().method() === "POST" &&
      r.ok(),
  );
  await page.goto("/logout");
  await logoutResp;

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
});
