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

const MOBILE = { width: 375, height: 812 };
const DESKTOP = { width: 1440, height: 900 };

/** Radii the design system allows: buzzCheck 6px, buzzControl 8px, buzzCard 16px, buzzModal 24px, plus pills and square. */
const ALLOWED_RADII = new Set(["0px", "6px", "8px", "16px", "24px", "9999px"]);

/** Public routes: reachable with no session, so these stay fast and stable. */
const PUBLIC_ROUTES = [
  "/",
  "/for-orgs",
  "/for-brands",
  "/login",
  "/brand/login",
  "/org/apply",
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
    .getByText(/restoring your session/i)
    .waitFor({ state: "hidden", timeout: 8_000 })
    .catch(() => undefined);
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

test("centered auth pages are centered between header and footer", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoAnonymous(page, "/login");

  const shell = page.getByTestId("auth-shell");
  await expect(shell).toBeVisible();

  // Measured against the chrome, not the shell: centering inside a box that
  // itself stops short of the footer is exactly the bug this guards.
  const { above, below } = await shell.evaluate((el) => {
    const kids = Array.from(el.children).map((c) => c.getBoundingClientRect());
    const contentTop = Math.min(...kids.map((b) => b.top));
    const contentBottom = Math.max(...kids.map((b) => b.bottom));
    const header = document.querySelector("header")!.getBoundingClientRect();
    const footer = document.querySelector("footer")!.getBoundingClientRect();
    return { above: contentTop - header.bottom, below: footer.top - contentBottom };
  });

  // With `min-h-[60vh]` this gap was hundreds of pixels apart, because the
  // shell ignored the header and footer entirely.
  expect(
    Math.abs(above - below),
    `auth content is off-center: ${Math.round(above)}px above vs ${Math.round(below)}px below`,
  ).toBeLessThanOrEqual(8);
});

test("the auth shell spans the space between header and footer", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoAnonymous(page, "/login");

  const shell = await page.getByTestId("auth-shell").boundingBox();
  const header = await page.locator("header").first().boundingBox();
  const footer = await page.getByRole("contentinfo").boundingBox();
  expect(shell && header && footer).toBeTruthy();
  if (!shell || !header || !footer) return;

  // Claiming the leftover space is what makes centering meaningful.
  expect(shell.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
  expect(shell.y + shell.height).toBeLessThanOrEqual(footer.y + 1);
  expect(shell.height).toBeGreaterThan(100);
});

test("controls on one row share a height", async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await gotoAnonymous(page, "/dev/ui-kit");

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
  await gotoAnonymous(page, "/dev/ui-kit");

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
  await gotoAnonymous(page, "/dev/ui-kit");

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
  await gotoAnonymous(page, "/dev/ui-kit");

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
