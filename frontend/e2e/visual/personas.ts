/**
 * Browser sessions for the visual atlas and the geometry suite. The login flows
 * mirror the correctness specs (`admin.spec.ts`, `brand.spec.ts`) so the shots
 * land on the same seeded fixture CI already asserts against.
 *
 * Org needs no form: in `ENVIRONMENT=development` the SPA bootstrap calls
 * `POST /api/auth/dev-login`, so the seeded active org is signed in on load.
 */
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { waitForAuthSettled } from "../authSettled";

export type Persona = "public" | "org" | "brand" | "admin";

const ADMIN_EMAIL = "admin@bringthebuzzover.com";
const BRAND_EMAIL = "partnerships@acme.coffee";
const DEV_PASSWORD = "buzzdev123";

export type PersonaSession = {
  context: BrowserContext;
  page: Page;
};

/** Sign in (if the persona needs it) and return a reusable context + page. */
export async function openPersona(
  browser: Browser,
  persona: Persona,
): Promise<PersonaSession> {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Bounded so a broken login surfaces as one failed persona, not a run that
  // silently eats its whole timeout budget before the first shot.
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(20_000);

  switch (persona) {
    case "public":
      // In development the SPA bootstrap auto-mints a seeded org session on any
      // route that is neither an auth route nor public marketing (see
      // `onAuthRoute` / `onPublicMarketingRoute` in AuthContext.tsx). That
      // cookie then leaks into every later navigation in this context, so
      // `/login` would redirect to `/org/browse`. Off-dev the endpoint 404s —
      // mirror that here so public shots are genuinely anonymous.
      await context.route("**/api/auth/dev-login", (route) =>
        route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ data: null, error: { code: "NOT_FOUND" } }),
        }),
      );
      break;
    case "org":
      await page.goto("/org/browse");
      await waitForAuthSettled(page, "org");
      break;
    case "brand":
      await page.goto("/brand/login");
      await page.getByTestId("brand-email").fill(BRAND_EMAIL);
      await page.getByTestId("brand-password").fill(DEV_PASSWORD);
      await expect(page.getByTestId("brand-email")).toHaveValue(BRAND_EMAIL);
      await page.getByTestId("brand-login-submit").click();
      await expect(page).toHaveURL(/\/brand\/dashboard/);
      break;
    case "admin":
      await page.goto("/admin/login");
      await page.getByTestId("admin-email").fill(ADMIN_EMAIL);
      await page.getByTestId("admin-password").fill(DEV_PASSWORD);
      await expect(page.getByTestId("admin-email")).toHaveValue(ADMIN_EMAIL);
      await expect(page.getByTestId("admin-password")).toHaveValue(DEV_PASSWORD);
      await page.getByTestId("admin-login-submit").click();
      await expect(page).toHaveURL(/\/admin$/);
      await waitForAuthSettled(page, "admin-overview");
      break;
  }

  return { context, page };
}

/**
 * Resolve a `:param` route to an id that exists in the seed by reading the
 * first detail link off its list page. Hardcoded ids would rot every reseed.
 *
 * The wait matters: list rows arrive from React Query after first paint, so
 * counting links immediately always returns zero.
 */
export async function discoverId(
  page: Page,
  listRoute: string,
  hrefPrefix: string,
): Promise<string | undefined> {
  await page.goto(listRoute, { waitUntil: "domcontentloaded", timeout: 20_000 });
  const link = page.locator(`a[href^="${hrefPrefix}"]`).first();
  try {
    await link.waitFor({ state: "attached", timeout: 15_000 });
  } catch {
    return undefined;
  }
  const href = await link.getAttribute("href");
  if (!href) return undefined;
  return href.slice(hrefPrefix.length).split(/[?#/]/)[0] || undefined;
}
