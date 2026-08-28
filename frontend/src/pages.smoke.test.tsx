/**
 * Generic page-render smoke test.
 *
 * Renders every top-level page component once, in the API provider tree, and
 * asserts it doesn't throw during render. This is the cheap, low-maintenance
 * guard for the "white-screen" class (a hook used without its provider, a bad
 * import, a render-time crash): it only fails when a page *actually* crashes, so
 * it survives heavy UI churn without edits.
 *
 * Maintenance contract: when you add a page, add one line to PAGES below.
 *
 * Uses `react-dom/server`'s `renderToString` (no extra deps). Effects don't run
 * under SSR, so no network calls fire; pages settle into their loading/redirect
 * states (queries are disabled until `status === "authenticated"`).
 */

import type { ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";

import HomePage from "./pages/home/HomePage";
import OrgDropFeedPage from "./pages/org/OrgDropFeedPage";
import OrgMyCampaignsPage from "./pages/org/OrgMyCampaignsPage";
import OrgCampaignDetailPage from "./pages/org/OrgCampaignDetailPage";
import OrgPortalProfilePage from "./pages/org/OrgPortalProfilePage";
import BrandAggregateDashboardPage from "./pages/brand/BrandAggregateDashboardPage";
import BrandDropDetailPage from "./pages/brand/BrandDropDetailPage";
import BrandRequestDropPage from "./pages/brand/BrandRequestDropPage";
import LoginPage from "./pages/auth/LoginPage";
import InstagramCallbackPage from "./pages/auth/InstagramCallbackPage";
import ReconnectInstagramPage from "./pages/auth/ReconnectInstagramPage";
import BrandLoginPage from "./pages/auth/BrandLoginPage";
import BrandSetupPage from "./pages/auth/BrandSetupPage";
import BrandApplyPage from "./pages/auth/BrandApplyPage";
import OrgProfilePage from "./pages/onboarding/OrgProfilePage";
import VerifyEmailPage from "./pages/onboarding/VerifyEmailPage";
import PendingApprovalPage from "./pages/onboarding/PendingApprovalPage";
import DeniedPage from "./pages/onboarding/DeniedPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminOrgsPage from "./pages/admin/AdminOrgsPage";
import AdminOrgDetailPage from "./pages/admin/AdminOrgDetailPage";
import AdminBrandsPage from "./pages/admin/AdminBrandsPage";
import AdminBrandDetailPage from "./pages/admin/AdminBrandDetailPage";
import AdminDropsPage from "./pages/admin/AdminDropsPage";
import AdminDropDetailPage from "./pages/admin/AdminDropDetailPage";
import AdminDropRequestsPage from "./pages/admin/AdminDropRequestsPage";
import AdminDropRequestDetailPage from "./pages/admin/AdminDropRequestDetailPage";
import AdminHealthPage from "./pages/admin/AdminHealthPage";

const PAGES: ReadonlyArray<[string, ComponentType]> = [
  ["HomePage", HomePage],
  ["OrgDropFeedPage", OrgDropFeedPage],
  ["OrgMyCampaignsPage", OrgMyCampaignsPage],
  ["OrgCampaignDetailPage", OrgCampaignDetailPage],
  ["OrgPortalProfilePage", OrgPortalProfilePage],
  ["BrandAggregateDashboardPage", BrandAggregateDashboardPage],
  ["BrandDropDetailPage", BrandDropDetailPage],
  ["BrandRequestDropPage", BrandRequestDropPage],
  ["LoginPage", LoginPage],
  ["ReconnectInstagramPage", ReconnectInstagramPage],
  ["InstagramCallbackPage", InstagramCallbackPage],
  ["BrandLoginPage", BrandLoginPage],
  ["BrandSetupPage", BrandSetupPage],
  ["BrandApplyPage", BrandApplyPage],
  ["OrgProfilePage", OrgProfilePage],
  ["VerifyEmailPage", VerifyEmailPage],
  ["PendingApprovalPage", PendingApprovalPage],
  ["DeniedPage", DeniedPage],
  ["AdminLoginPage", AdminLoginPage],
  ["AdminOverviewPage", AdminOverviewPage],
  ["AdminOrgsPage", AdminOrgsPage],
  ["AdminOrgDetailPage", AdminOrgDetailPage],
  ["AdminBrandsPage", AdminBrandsPage],
  ["AdminBrandDetailPage", AdminBrandDetailPage],
  ["AdminDropsPage", AdminDropsPage],
  ["AdminDropDetailPage", AdminDropDetailPage],
  ["AdminDropRequestsPage", AdminDropRequestsPage],
  ["AdminDropRequestDetailPage", AdminDropRequestDetailPage],
  ["AdminHealthPage", AdminHealthPage],
];

describe("page render smoke (API tree)", () => {
  it.each(PAGES)("%s renders without throwing", (_name, Page) => {
    const queryClient = new QueryClient();
    const render = () =>
      renderToString(
        <MemoryRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Page />
            </AuthProvider>
          </QueryClientProvider>
        </MemoryRouter>,
      );
    expect(render).not.toThrow();
  });
});
