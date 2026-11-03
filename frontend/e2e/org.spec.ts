import { test, expect, type Locator, type Page } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/**
 * Org journeys. In dev the app auto-dev-logins as the seeded active org on
 * bootstrap (no Instagram needed), so navigating to a portal route lands a real
 * authenticated session.
 */

test("org drop feed renders a current responsive grid", async ({ page }) => {
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await expect(page.getByRole("heading", { name: /browse/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Current drops" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Closed" })).toHaveCount(0);
  // Seed has 4 drops + the E2E open drop.
  await expect(page.getByTestId("drop-card").first()).toBeVisible();
  expect(await page.getByTestId("drop-card").count()).toBeGreaterThan(0);
  const grid = page.locator('[aria-labelledby="current-drops"] .grid');
  await expect(grid).toHaveCSS("display", "grid");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  const apply = page.getByTestId("apply-button").first();
  if (await apply.count()) await expect(apply).toHaveAttribute("href", /^\/d\//);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/org\/browse$/);
});

test("org can apply to an open drop", async ({ page }) => {
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  // The deterministic open, unapplied drop seeded by seed_e2e.
  const card = page
    .getByTestId("drop-card")
    .filter({ hasText: "E2E Open Drop" });
  await expect(card).toBeVisible();

  const apply = card.getByTestId("apply-button");
  if (await apply.innerText().then((label) => /already applied/i.test(label))) {
    await page.goto("/d/00000000-0000-0000-0000-000000000063");
    await expect(page.getByTestId("apply-button")).toHaveText(/already applied/i);
    return;
  }

  await apply.click();
  await expect(page).toHaveURL(/\/d\/00000000-0000-0000-0000-000000000063$/);
  const detailApply = page.getByRole("button", { name: "Apply", exact: true });
  if (await page.getByRole("button", { name: /already applied/i }).count()) {
    return;
  }
  await detailApply.click();
  const applyForm = page.getByRole("heading", { name: /apply to drop/i });
  await expect(applyForm).toBeVisible();
  await expect(page.getByLabel("Pitch (optional)")).toBeVisible();
  await page.getByPlaceholder(/optional pitch/i).fill("E2E pitch");
  await page.getByTestId("apply-submit").click();

  // Success has explicit feedback and a link to the updated campaign list.
  await expect(applyForm).toHaveCount(0);
  await expect(page.getByText(/application submitted/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "My Campaigns", exact: true })).toHaveAttribute("href", "/org/campaigns");
});

function visibleHeaderLogo(page: Page) {
  return page.locator('[data-testid="site-header-logo"]:visible');
}

function boxesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

async function assertNoOverlapWithLogo(page: Page, target: Locator) {
  const logoBox = await visibleHeaderLogo(page).boundingBox();
  const box = await target.boundingBox();
  expect(logoBox, "header logo should be laid out").toBeTruthy();
  expect(box, "nav control should be laid out").toBeTruthy();
  expect(
    boxesOverlap(logoBox!, box!),
    "nav control must not intersect the logo",
  ).toBe(false);
}

test("org desktop nav does not overlap the logo at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: /open menu/i })).toBeHidden();

  const campaigns = header.getByRole("link", { name: "My campaigns" });
  const profile = header.getByRole("link", { name: "Profile" });
  await expect(campaigns).toBeVisible();
  await expect(profile).toBeVisible();
  await assertNoOverlapWithLogo(page, campaigns);
  await assertNoOverlapWithLogo(page, profile);
  await assertNoOverlapWithLogo(
    page,
    header.getByRole("link", { name: "Browse campaigns" }),
  );
  await expect(header.getByRole("link", { name: "Home" })).toHaveCount(0);
  await assertNoOverlapWithLogo(
    page,
    header.getByRole("button", { name: "Contact" }),
  );

  await campaigns.click();
  await expect(page).toHaveURL(/\/org\/campaigns$/);
  await visibleHeaderLogo(page).click();
  await expect(page).toHaveURL(/\/org\/browse$/);
});

test("org mid-width chrome uses the hamburger and keeps campaign links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await expect(page.getByRole("heading", { name: /browse/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  await page.getByRole("button", { name: /open menu/i }).click();

  const panel = page.locator("#mobile-nav-menu");
  await expect(panel.getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Browse campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "My campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Profile" })).toBeVisible();
  await panel.getByRole("link", { name: "My campaigns" }).click();
  await expect(page).toHaveURL(/\/org\/campaigns$/);
  await visibleHeaderLogo(page).click();
  await expect(page).toHaveURL(/\/org\/browse$/);
});

test("org phone chrome lists portal links in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  await page.getByRole("button", { name: /open menu/i }).click();
  const panel = page.locator("#mobile-nav-menu");
  await expect(panel.getByRole("link", { name: "Home" })).toHaveCount(0);
  await expect(panel.getByRole("link", { name: "Browse campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "My campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Profile" })).toBeVisible();
  await panel.getByRole("link", { name: "Profile" }).click();
  await visibleHeaderLogo(page).click();
  await expect(page).toHaveURL(/\/org\/browse$/);
});

test("org campaign detail shows per-org tracking links", async ({ page }) => {
  await page.goto("/org/campaigns");
  await waitForAuthSettled(page, "org");
  await page.getByRole("heading", { name: "Game Day Hoodies" }).click();
  await expect(page).toHaveURL(/\/org\/campaigns\//);
  const links = page.locator('[data-testid^="track-link-"]');
  await expect(links.first()).toBeVisible();
  await expect(links.first()).toHaveAttribute("href", /ups\.com|fedex\.com/);
});

test("org profile requests Instagram change via modal", async ({ page }) => {
  await page.goto("/org/profile");
  await waitForAuthSettled(page, "org");
  await expect(page.getByText("Instagram identity", { exact: true })).toBeVisible();
  await expect(page.getByText("Instagram identity (read-only)")).toHaveCount(0);
  await expect(page.getByTestId("ig-change-requested")).toHaveCount(0);
  await page.getByTestId("ig-change-open").click();
  await expect(
    page.getByRole("heading", { name: /request an instagram change/i }),
  ).toBeVisible();
  await page.getByTestId("ig-change-requested").fill("e2enewrowing");
  await page
    .getByTestId("ig-change-reason")
    .fill("Switching to the new chapter Instagram.");
  await page.getByTestId("ig-change-submit").click();
  await expect(page.getByTestId("ig-change-connect-email")).toHaveText(
    "active-org@berkeley.edu",
  );
  await page.getByTestId("ig-change-confirm").click();
  await expect(page.getByTestId("ig-change-pending")).toContainText(
    "@berkeleyrowing → @e2enewrowing",
  );
  await expect(page.getByTestId("ig-change-pending")).toContainText(/under review/i);
  await expect(page.getByTestId("ig-change-open")).toHaveCount(0);
});
