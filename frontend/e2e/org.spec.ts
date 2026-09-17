import { test, expect, type Locator, type Page } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

/**
 * Org journeys. In dev the app auto-dev-logins as the seeded active org on
 * bootstrap (no Instagram needed), so navigating to a portal route lands a real
 * authenticated session.
 */

test("org drop feed renders cards", async ({ page }) => {
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await expect(page.getByRole("heading", { name: /browse/i })).toBeVisible();
  // Seed has 4 drops + the E2E open drop.
  await expect(page.getByTestId("drop-card").first()).toBeVisible();
  expect(await page.getByTestId("drop-card").count()).toBeGreaterThan(0);
});

test("org can apply to an open drop", async ({ page }) => {
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  // The deterministic open, unapplied drop seeded by seed_e2e.
  const card = page
    .getByTestId("drop-card")
    .filter({ hasText: "E2E Open Drop" });
  await expect(card).toBeVisible();

  await card.getByTestId("apply-button").click();
  // Inline apply form appears.
  const applyForm = page.getByRole("heading", { name: /apply to drop/i });
  await expect(applyForm).toBeVisible();
  await page.getByPlaceholder(/optional pitch/i).fill("E2E pitch");
  await page.getByTestId("apply-submit").click();

  // Success is proven by the form CLOSING (it stays open on any error) AND the
  // card's button flipping to the already-applied state — not by the always-
  // present "Browse" header.
  await expect(applyForm).toHaveCount(0);
  await expect(
    page.getByTestId("drop-card").filter({ hasText: "E2E Open Drop" }).getByTestId("apply-button"),
  ).toHaveText(/already applied/i);
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
    "nav control must not intersect the centered logo",
  ).toBe(false);
}

test("org desktop nav does not overlap the logo at 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  const header = page.locator("header");
  await expect(header.getByRole("button", { name: /open menu/i })).toBeHidden();

  const campaigns = header.getByRole("link", { name: "My Campaigns" });
  const profile = header.getByRole("link", { name: "Profile" });
  await expect(campaigns).toBeVisible();
  await expect(profile).toBeVisible();
  await assertNoOverlapWithLogo(page, campaigns);
  await assertNoOverlapWithLogo(page, profile);
  await assertNoOverlapWithLogo(
    page,
    header.getByRole("link", { name: "Browse Campaigns" }),
  );
  await assertNoOverlapWithLogo(page, header.getByRole("link", { name: "Home" }));
  await assertNoOverlapWithLogo(
    page,
    header.getByRole("button", { name: "Contact" }),
  );

  await campaigns.click();
  await expect(page).toHaveURL(/\/org\/campaigns$/);
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
  await expect(panel.getByRole("link", { name: "My Campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Profile" })).toBeVisible();
  await panel.getByRole("link", { name: "My Campaigns" }).click();
  await expect(page).toHaveURL(/\/org\/campaigns$/);
});

test("org phone chrome lists portal links in the menu", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 720 });
  await page.goto("/org/browse");
  await waitForAuthSettled(page, "org");
  await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible();
  await page.getByRole("button", { name: /open menu/i }).click();
  const panel = page.locator("#mobile-nav-menu");
  await expect(panel.getByRole("link", { name: "My Campaigns" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Profile" })).toBeVisible();
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
