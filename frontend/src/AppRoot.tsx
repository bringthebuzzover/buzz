/**
 * Top-level routes: `SiteLayout` for the marketing shell, `AdminLayout` for the
 * admin panel; portal routes use the real auth guards (RequireAuth →
 * RequireStatus → RequireRole, architecture §5.4).
 */
import type { ReactElement } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import type { PortalRole } from "./types/auth";
import SiteLayout from "./layouts/SiteLayout";
import AdminLayout from "./layouts/AdminLayout";
import RequireAuth from "./components/routing/RequireAuth";
import RequireRole from "./components/routing/RequireRole";
import RequireStatus from "./components/routing/RequireStatus";
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
import BrandSetupPage from "./pages/auth/BrandSetupPage";
import BrandLoginPage from "./pages/auth/BrandLoginPage";
import BrandApplyPage from "./pages/auth/BrandApplyPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import OrgProfilePage from "./pages/onboarding/OrgProfilePage";
import VerifyEmailPage from "./pages/onboarding/VerifyEmailPage";
import PendingApprovalPage from "./pages/onboarding/PendingApprovalPage";
import DeniedPage from "./pages/onboarding/DeniedPage";
import PrivacyPolicyPage from "./pages/legal/PrivacyPolicyPage";
import TermsPage from "./pages/legal/TermsPage";
import DataDeletionPage from "./pages/legal/DataDeletionPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage";
import AdminOrgsPage from "./pages/admin/AdminOrgsPage";
import AdminOrgDetailPage from "./pages/admin/AdminOrgDetailPage";
import AdminBrandsPage from "./pages/admin/AdminBrandsPage";
import AdminBrandDetailPage from "./pages/admin/AdminBrandDetailPage";
import AdminDropsPage from "./pages/admin/AdminDropsPage";
import AdminDropDetailPage from "./pages/admin/AdminDropDetailPage";
import AdminHealthPage from "./pages/admin/AdminHealthPage";

/** Composite guard: wraps children in the real auth stack for a given portal role. */
function PortalGuard({
  children,
  role,
}: {
  children: ReactElement;
  role: PortalRole;
}) {
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

/** Forward a legacy `/campaigns/:id` deep link to the real campaign detail
 * route, preserving the id (don't drop it onto the generic feed). */
function LegacyCampaignRedirect(): ReactElement {
  const { campaignId } = useParams<{ campaignId: string }>();
  return (
    <Navigate
      to={campaignId ? `/org/campaigns/${campaignId}` : "/org/campaigns"}
      replace
    />
  );
}

export default function AppRoot(): ReactElement {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />

        {/* Public auth pages. */}
        <Route path="login" element={<LoginPage />} />
        <Route
          path="auth/instagram/callback"
          element={<InstagramCallbackPage />}
        />
        <Route path="brand/login" element={<BrandLoginPage />} />
        <Route
          path="brand/forgot-password"
          element={
            <ForgotPasswordPage
              portal="brand"
              loginPath="/brand/login"
              title="Forgot password"
            />
          }
        />
        <Route
          path="brand/reset-password"
          element={
            <ResetPasswordPage
              portal="brand"
              loginPath="/brand/login"
              title="Reset password"
            />
          }
        />
        <Route path="brand/setup" element={<BrandSetupPage />} />
        <Route path="brand/apply" element={<BrandApplyPage />} />

        {/* Onboarding pages. These require an authenticated session
            (architecture §6.4) — RequireAuth standardizes the redirect to
            /login; each page still self-routes on its specific status.
            verify-email is intentionally public: the email link is opened in a
            fresh tab/browser with no session and carries its own ?token. */}
        <Route
          path="onboarding/profile"
          element={
            <RequireAuth>
              <OrgProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="onboarding/verify-email"
          element={<VerifyEmailPage />}
        />
        <Route
          path="onboarding/pending-approval"
          element={
            <RequireAuth>
              <PendingApprovalPage />
            </RequireAuth>
          }
        />
        <Route
          path="onboarding/denied"
          element={
            <RequireAuth>
              <DeniedPage />
            </RequireAuth>
          }
        />

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
          path="org/profile"
          element={
            <PortalGuard role="org">
              <OrgPortalProfilePage />
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
              <LegacyCampaignRedirect />
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
        {/* Admin login is public (admins have no Instagram identity, so this is
            their only session entry point off-dev) and keeps the marketing
            chrome; the panel itself lives outside this layout. */}
        <Route path="admin/login" element={<AdminLoginPage />} />
        <Route
          path="admin/forgot-password"
          element={
            <ForgotPasswordPage
              portal="admin"
              loginPath="/admin/login"
              title="Forgot password"
            />
          }
        />
        <Route
          path="admin/reset-password"
          element={
            <ResetPasswordPage
              portal="admin"
              loginPath="/admin/login"
              title="Reset password"
            />
          }
        />

        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="data-deletion" element={<DataDeletionPage />} />
      </Route>

      {/* Admin panel — its own shell, so no marketing header/footer. */}
      <Route
        path="admin"
        element={
          <PortalGuard role="admin">
            <AdminLayout />
          </PortalGuard>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="orgs" element={<AdminOrgsPage />} />
        <Route path="orgs/:userId" element={<AdminOrgDetailPage />} />
        <Route path="brands" element={<AdminBrandsPage />} />
        <Route path="brands/:brandId" element={<AdminBrandDetailPage />} />
        <Route path="drops" element={<AdminDropsPage />} />
        <Route path="drops/:dropId" element={<AdminDropDetailPage />} />
        <Route path="health" element={<AdminHealthPage />} />
      </Route>
    </Routes>
  );
}
