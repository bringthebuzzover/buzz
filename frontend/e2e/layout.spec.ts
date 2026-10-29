/**
 * Layout geometry gate.
 *
 * The screenshot atlas tells a human whether the UI looks right; these tests
 * make the mechanical half of that judgement enforceable. Everything here is
 * measured from the live DOM (`boundingBox`, `getComputedStyle`), so it fails
 * on a number rather than on taste — which is what lets the revamp's layout
 * fixes stay fixed.
 *
 * Runs in the normal suite (`npm run e2e`); the heavy atlas does not.
 */
import { test, expect, type Page } from "@playwright/test";
import { waitForAuthSettled } from "./authSettled";

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

/** Radii the design system allows. Pen: check 5, control/media 8, field 10, board/modal 16, phone 32, plus the previous 6/24 and pills. */
const ALLOWED_RADII = new Set(["0px", "5px", "6px", "8px", "10px", "16px", "24px", "32px", "9999px"]);

/** Public routes: reachable with no session, so these stay fast and stable. */
const PUBLIC_ROUTES = [
  "/",
  "/for-orgs",
  "/for-brands",
  "/login",
  "/brand/login",
  "/org/apply",
  "/d/00000000-0000-0000-0000-000000000063",
  "/brand/apply",
  "/privacy",
  "/terms",
  "/no-such-page",
];

async function gotoAnonymous(page: Page, route: string) {
  // Development auto-mints a seeded org session on non-auth routes, which
  // would redirect `/login` to the portal. Off-dev the endpoint 404s.
  await page.route("**/api/auth/dev-login", (r) =>
    r.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ data: null, error: { code: "NOT_FOUND" } }),
    }),
  );
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page
    .getByTestId("auth-pending")
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => undefined);
}

async function gotoUiKit(page: Page) {
  await page.goto("/admin/login");
  await page.getByTestId("admin-email").fill("admin@bringthebuzzover.com");
  await page.getByTestId("admin-password").fill("buzzdev123");
  await expect(page.getByTestId("admin-email")).toHaveValue(
    "admin@bringthebuzzover.com",
  );
  await expect(page.getByTestId("admin-password")).toHaveValue("buzzdev123");
  await page.getByTestId("admin-login-submit").click();
  await waitForAuthSettled(page, "admin-overview");
  await page.goto("/admin/ui-kit");
  await expect(page.getByRole("heading", { name: "UI kit" })).toBeVisible();
}

test.describe("no horizontal overflow", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} fits 375px`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await gotoAnonymous(page, route);
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      // 1px of rounding is tolerable; a real overflow is tens of pixels.
      expect(overflow, `${route} overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(1);
    });
  }
});

test("org login is a photo split without the marketing header or footer", async ({
  page,
}) => {
  await page.setViewportSize(DESKTOP);
  await gotoAnonymous(page, "/login");

  await expect(page.getByTestId("auth-aside")).toBeVisible();
  await expect(page.getByTestId("auth-form")).toBeVisible();
  await expect(page.locator("header")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /join or sign in to buzz/i }),
  ).toBeVisible();
});

test("admin login uses the minimal auth header", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoAnonymous(page, "/admin/login");

  const header = page.locator("header");
  await expect(header).toBeVisible();
  await expect(header.getByText("admin", { exact: true })).toBeVisible();
  await expect(
    header.getByRole("link", { name: /back to bringthebuzzover\.com/i }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /join us/i })).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  await expect(page.getByTestId("auth-form")).toBeVisible();
});

test("controls on one row share a height", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoUiKit(page);

  const field = await page.locator("#k-inline").boundingBox();
  const button = await page.getByRole("button", { name: "Save" }).boundingBox();
  expect(field && button).toBeTruthy();
  if (!field || !button) return;

  expect(
    Math.abs(field.height - button.height),
    `compact field is ${field.height}px but the button beside it is ${button.height}px`,
  ).toBeLessThanOrEqual(1);
});

test("every corner radius comes from a token", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoUiKit(page);

  const strays = await page.evaluate((allowed) => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll("main *"))) {
      const radius = getComputedStyle(el).borderTopLeftRadius;
      if (radius !== "0px" && !allowed.includes(radius)) {
        out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().slice(0, 60)} -> ${radius}`);
      }
    }
    return out.slice(0, 20);
  }, Array.from(ALLOWED_RADII));

  expect(strays, `off-token radii: ${strays.join(" | ")}`).toHaveLength(0);
});

test("the checkbox is drawn by us, not the OS", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoUiKit(page);

  const box = page.locator('input[type="checkbox"]').first();
  const appearance = await box.evaluate(
    (el) => getComputedStyle(el).appearance || getComputedStyle(el).webkitAppearance,
  );
  // A native checkbox reports `auto`/`checkbox` and ignores our border colour.
  expect(appearance).toBe("none");

  const size = await box.boundingBox();
  expect(size?.width).toBeGreaterThanOrEqual(18);
  expect(size?.height).toBeGreaterThanOrEqual(18);
});

test("the modal traps focus, closes on Escape, and locks the page", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoUiKit(page);

  await page.getByRole("button", { name: "Open modal" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Scroll lock: the page behind must not move while the dialog is open.
  const lockedOverflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
  expect(lockedOverflow).toBe("hidden");

  // Focus must be inside the dialog, not left on the trigger.
  const focusInside = await page.evaluate(() => {
    const active = document.activeElement;
    const dlg = document.querySelector('[role="dialog"]');
    return !!(active && dlg && dlg.contains(active));
  });
  expect(focusInside).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
