/**
 * The designed-surface catalog the atlas shoots and the geometry suite asserts.
 *
 * A surface is one thing a human looks at: a route, or a distinct in-page state
 * of that route (open modal, selected tab, inline form that replaces the body).
 * `:param` routes carry a `dynamic` key resolved at runtime from the seed.
 *
 * Not covered, and deliberately so: `/auth/instagram/callback` (transient OAuth
 * bounce), `/onboarding/profile` and `/onboarding/pending-approval` (only
 * reachable mid-onboarding; the seeded org is already active, so they redirect),
 * and every `kind: redirect` alias in `AppRoot`.
 *
 * Not covered because they need credentials the seed does not mint, tracked in
 * `frontend/docs/ui-defect-map.md` as coverage holes: `/brand/setup` (redirects
 * to `/` without a valid `?token`) and `/onboarding/connect-instagram`'s connect
 * CTA (needs a `pending_instagram` session; only the bad-token state is shot).
 */
import type { Page } from "@playwright/test";
import type { Persona } from "./personas";

export type SurfaceArea =
  | "public"
  | "auth"
  | "onboarding"
  | "org"
  | "brand"
  | "admin";

/** List route + href prefix used to resolve one `:param` from seeded data. */
export type DynamicRef = "orgUserId" | "brandId" | "requestId" | "adminDropId" | "campaignId" | "brandDropId";

export type Surface = {
  /** Stable slug; becomes the screenshot file name. Never reuse across states. */
  id: string;
  /** Route with an optional `:id` placeholder filled from `dynamic`. */
  route: string;
  dynamic?: DynamicRef;
  persona: Persona;
  area: SurfaceArea;
  /** Interaction that reaches an in-page variant after load. */
  prep?: (page: Page) => Promise<void>;
};

export const SURFACES: Surface[] = [
  // Public marketing + legal
  { id: "home", route: "/", persona: "public", area: "public" },
  { id: "for-orgs", route: "/for-orgs", persona: "public", area: "public" },
  { id: "for-brands", route: "/for-brands", persona: "public", area: "public" },
  { id: "privacy", route: "/privacy", persona: "public", area: "public" },
  { id: "terms", route: "/terms", persona: "public", area: "public" },
  { id: "data-deletion", route: "/data-deletion", persona: "public", area: "public" },
  { id: "not-found", route: "/no-such-page", persona: "public", area: "public" },
  {
    id: "contact-modal",
    route: "/",
    persona: "public",
    area: "public",
    prep: async (page) => {
      await page.getByRole("button", { name: /contact/i }).first().click();
      await page.getByRole("heading", { name: /contact/i }).first().waitFor();
    },
  },

  // Auth
  { id: "login", route: "/login", persona: "public", area: "auth" },
  { id: "brand-login", route: "/brand/login", persona: "public", area: "auth" },
  { id: "admin-login", route: "/admin/login", persona: "public", area: "auth" },
  { id: "org-apply", route: "/org/apply", persona: "public", area: "auth" },
  { id: "brand-apply", route: "/brand/apply", persona: "public", area: "auth" },
  { id: "brand-forgot-password", route: "/brand/forgot-password", persona: "public", area: "auth" },
  { id: "admin-forgot-password", route: "/admin/forgot-password", persona: "public", area: "auth" },
  { id: "brand-reset-password", route: "/brand/reset-password", persona: "public", area: "auth" },
  { id: "admin-reset-password", route: "/admin/reset-password", persona: "public", area: "auth" },
  { id: "reconnect-instagram", route: "/reconnect-instagram", persona: "public", area: "auth" },

  // Onboarding (public entry points + their failure states)
  { id: "verify-email-wait", route: "/onboarding/verify-email", persona: "public", area: "onboarding" },
  {
    id: "verify-email-bad-token",
    route: "/onboarding/verify-email?token=atlas-not-a-real-token",
    persona: "public",
    area: "onboarding",
    // The failure branch only renders after the confirm POST fails, so the
    // token alone lands on the idle "Confirm this is you" screen.
    prep: async (page) => {
      await page.getByRole("button", { name: /verify email/i }).click();
      await page.getByText(/verification failed/i).waitFor({ timeout: 10_000 });
    },
  },
  {
    id: "connect-instagram-bad-token",
    route: "/onboarding/connect-instagram?token=atlas-not-a-real-token",
    persona: "public",
    area: "onboarding",
  },
  { id: "onboarding-denied", route: "/onboarding/denied", persona: "public", area: "onboarding" },

  // Org portal
  { id: "org-browse", route: "/org/browse", persona: "org", area: "org" },
  { id: "org-campaigns", route: "/org/campaigns", persona: "org", area: "org" },
  { id: "org-campaign-detail", route: "/org/campaigns/:id", dynamic: "campaignId", persona: "org", area: "org" },
  { id: "org-profile", route: "/org/profile", persona: "org", area: "org" },

  // Brand portal
  { id: "brand-dashboard", route: "/brand/dashboard", persona: "brand", area: "brand" },
  { id: "brand-drop-detail", route: "/brand/drops/:id", dynamic: "brandDropId", persona: "brand", area: "brand" },
  { id: "brand-request-new", route: "/brand/requests/new", persona: "brand", area: "brand" },

  // Admin panel
  { id: "admin-overview", route: "/admin", persona: "admin", area: "admin" },
  { id: "admin-orgs", route: "/admin/orgs", persona: "admin", area: "admin" },
  { id: "admin-org-detail", route: "/admin/orgs/:id", dynamic: "orgUserId", persona: "admin", area: "admin" },
  { id: "admin-brands", route: "/admin/brands", persona: "admin", area: "admin" },
  { id: "admin-brand-detail", route: "/admin/brands/:id", dynamic: "brandId", persona: "admin", area: "admin" },
  { id: "admin-requests", route: "/admin/requests", persona: "admin", area: "admin" },
  { id: "admin-request-detail", route: "/admin/requests/:id", dynamic: "requestId", persona: "admin", area: "admin" },
  { id: "admin-drops", route: "/admin/drops", persona: "admin", area: "admin" },
  {
    id: "admin-drop-detail-config",
    route: "/admin/drops/:id?tab=config",
    dynamic: "adminDropId",
    persona: "admin",
    area: "admin",
  },
  {
    id: "admin-drop-detail-applicants",
    route: "/admin/drops/:id?tab=applicants",
    dynamic: "adminDropId",
    persona: "admin",
    area: "admin",
  },
  {
    id: "admin-drop-detail-timeline",
    route: "/admin/drops/:id?tab=timeline",
    dynamic: "adminDropId",
    persona: "admin",
    area: "admin",
  },
  {
    id: "admin-drop-detail-attribution",
    route: "/admin/drops/:id?tab=attribution",
    dynamic: "adminDropId",
    persona: "admin",
    area: "admin",
  },
  { id: "admin-health", route: "/admin/health", persona: "admin", area: "admin" },
];

/** Where each `:param` comes from: a list route plus the detail href prefix. */
export const DYNAMIC_SOURCES: Record<DynamicRef, { list: string; prefix: string }> = {
  orgUserId: { list: "/admin/orgs", prefix: "/admin/orgs/" },
  brandId: { list: "/admin/brands", prefix: "/admin/brands/" },
  requestId: { list: "/admin/requests", prefix: "/admin/requests/" },
  adminDropId: { list: "/admin/drops", prefix: "/admin/drops/" },
  campaignId: { list: "/org/campaigns", prefix: "/org/campaigns/" },
  brandDropId: { list: "/brand/dashboard", prefix: "/brand/drops/" },
};

export const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

export type ViewportName = (typeof VIEWPORTS)[number]["name"];

/** Fill a `:id` placeholder, keeping any query string intact. */
export function resolveRoute(
  surface: Surface,
  ids: Partial<Record<DynamicRef, string>>,
): string | undefined {
  if (!surface.dynamic) return surface.route;
  const id = ids[surface.dynamic];
  return id ? surface.route.replace(":id", id) : undefined;
}
