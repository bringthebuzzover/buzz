/**
 * Top-level routes: `SiteLayout` for marketing shell; `/waitlist` standalone.
 *
 * Stage 6 (strangler): when USE_API is true, portal routes use the real auth guards
 * (RequireAuth → RequireRole → RequireStatus). When false, the demo DemoOnly guards
 * are unchanged.
 */
import type { ReactElement } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import DemoOnly from "./components/routing/DemoOnly";
import RequireAuth from "./components/routing/RequireAuth";
import RequireRole from "./components/routing/RequireRole";
import RequireStatus from "./components/routing/RequireStatus";
import HomePage from "./pages/home/HomePage";
import OrgDropFeedPage from "./pages/org/OrgDropFeedPage";
import OrgMyCampaignsPage from "./pages/org/OrgMyCampaignsPage";
import OrgCampaignDetailPage from "./pages/org/OrgCampaignDetailPage";
import BrandAggregateDashboardPage from "./pages/brand/BrandAggregateDashboardPage";
import BrandDropDetailPage from "./pages/brand/BrandDropDetailPage";
import BrandRequestDropPage from "./pages/brand/BrandRequestDropPage";
import LoginPage from "./pages/auth/LoginPage";
import InstagramCallbackPage from "./pages/auth/InstagramCallbackPage";
import BrandSetupPage from "./pages/auth/BrandSetupPage";
import BrandLoginPage from "./pages/auth/BrandLoginPage";
import BrandApplyPage from "./pages/auth/BrandApplyPage";
import OrgProfilePage from "./pages/onboarding/OrgProfilePage";
import VerifyEmailPage from "./pages/onboarding/VerifyEmailPage";
import PendingApprovalPage from "./pages/onboarding/PendingApprovalPage";
import DeniedPage from "./pages/onboarding/DeniedPage";
import Waitlist from "./pages/waitlist/waitlist";
import { USE_API } from "./config/featureFlags";

/** Composite guard: wraps children in the real auth stack for a given portal role. */
function PortalGuard({
  children,
  role,
}: {
  children: ReactElement;
  role: "org" | "brand";
}) {
  if (!USE_API) {
    return <DemoOnly requiredDemoView={role}>{children}</DemoOnly>;
  }
  // Order per architecture §5.4: Auth → Status → Role. Status gating takes
  // precedence so an org mid-onboarding is sent to finish onboarding before a
  // role mismatch is surfaced.
  return (
    <RequireAuth>
      <RequireStatus>
        <RequireRole role={role}>{children}</RequireRole>
      </RequireStatus>
    </RequireAuth>
  );
}

export default function AppRoot(): ReactElement {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />

        {/* Public auth pages (API path only) */}
        <Route path="login" element={<LoginPage />} />
        <Route path="auth/instagram/callback" element={<InstagramCallbackPage />} />
        <Route path="brand/login" element={<BrandLoginPage />} />
        <Route path="brand/setup" element={<BrandSetupPage />} />
        <Route path="brand/apply" element={<BrandApplyPage />} />

        {/* Onboarding pages (API path only) */}
        <Route path="onboarding/profile" element={<OrgProfilePage />} />
        <Route path="onboarding/verify-email" element={<VerifyEmailPage />} />
        <Route path="onboarding/pending-approval" element={<PendingApprovalPage />} />
        <Route path="onboarding/denied" element={<DeniedPage />} />

        {/* Org portal */}
        <Route
          path="org/browse"
          element={
            <PortalGuard role="org">
              <OrgDropFeedPage />
            </PortalGuard>
          }
        />
        <Route
          path="org/campaigns"
          element={
            <PortalGuard role="org">
              <OrgMyCampaignsPage />
            </PortalGuard>
          }
        />
        <Route
          path="org/campaigns/:campaignId"
          element={
            <PortalGuard role="org">
              <OrgCampaignDetailPage />
            </PortalGuard>
          }
        />

        {/* Brand portal */}
        <Route
          path="brand/dashboard"
          element={
            <PortalGuard role="brand">
              <BrandAggregateDashboardPage />
            </PortalGuard>
          }
        />
        <Route
          path="brand/drops/:dropId"
          element={
            <PortalGuard role="brand">
              <BrandDropDetailPage />
            </PortalGuard>
          }
        />
        <Route
          path="brand/requests/new"
          element={
            <PortalGuard role="brand">
              <BrandRequestDropPage />
            </PortalGuard>
          }
        />

        {/* Legacy redirects */}
        <Route
          path="campaigns"
          element={
            <PortalGuard role="org">
              <Navigate to="/org/browse" replace />
            </PortalGuard>
          }
        />
        <Route
          path="campaigns/:campaignId"
          element={
            <PortalGuard role="org">
              <Navigate to="/org/browse" replace />
            </PortalGuard>
          }
        />
        <Route
          path="register"
          element={
            <PortalGuard role="org">
              <Navigate to="/org/browse" replace />
            </PortalGuard>
          }
        />
        <Route
          path="brand"
          element={
            <PortalGuard role="brand">
              <Navigate to="/brand/dashboard" replace />
            </PortalGuard>
          }
        />
        <Route
          path="brand/campaigns/new"
          element={
            <PortalGuard role="brand">
              <Navigate to="/brand/requests/new" replace />
            </PortalGuard>
          }
        />
        <Route path="waitlist" element={<Waitlist />} />
      </Route>
    </Routes>
  );
}
