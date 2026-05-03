/**
 * Top-level routes: `SiteLayout` for marketing shell; `/waitlist` standalone.
 * Demo-protected routes use `DemoOnly` and declare which persona (`requiredDemoView`) may view them
 * so a Brand demo session cannot accidentally land on Org pages and vice versa.
 *
 * Route IA mirrors PRODUCT.md §6.1 — `/org/*` is the student-org portal,
 * `/brand/*` is the brand portal. Legacy routes redirect to the new IA so old
 * bookmarks and deep links still resolve.
 */
import type { ReactElement } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import DemoOnly from "./components/routing/DemoOnly";
import HomePage from "./pages/home/HomePage";
import OrgDropFeedPage from "./pages/org/OrgDropFeedPage";
import OrgMyCampaignsPage from "./pages/org/OrgMyCampaignsPage";
import OrgCampaignDetailPage from "./pages/org/OrgCampaignDetailPage";
import BrandAggregateDashboardPage from "./pages/brand/BrandAggregateDashboardPage";
import BrandDropDetailPage from "./pages/brand/BrandDropDetailPage";
import BrandRequestDropPage from "./pages/brand/BrandRequestDropPage";
import Waitlist from "./pages/waitlist/waitlist";

export default function AppRoot(): ReactElement {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />

        {/* Org portal */}
        <Route
          path="org/drops"
          element={
            <DemoOnly requiredDemoView="org">
              <OrgDropFeedPage />
            </DemoOnly>
          }
        />
        <Route
          path="org/campaigns"
          element={
            <DemoOnly requiredDemoView="org">
              <OrgMyCampaignsPage />
            </DemoOnly>
          }
        />
        <Route
          path="org/campaigns/:campaignId"
          element={
            <DemoOnly requiredDemoView="org">
              <OrgCampaignDetailPage />
            </DemoOnly>
          }
        />

        {/* Brand portal */}
        <Route
          path="brand/dashboard"
          element={
            <DemoOnly requiredDemoView="brand">
              <BrandAggregateDashboardPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand/drops/:dropId"
          element={
            <DemoOnly requiredDemoView="brand">
              <BrandDropDetailPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand/requests/new"
          element={
            <DemoOnly requiredDemoView="brand">
              <BrandRequestDropPage />
            </DemoOnly>
          }
        />

        {/* Legacy redirects — keep `DemoOnly` so persona enforcement still applies. */}
        <Route
          path="campaigns"
          element={
            <DemoOnly requiredDemoView="org">
              <Navigate to="/org/drops" replace />
            </DemoOnly>
          }
        />
        <Route
          path="campaigns/:campaignId"
          element={
            <DemoOnly requiredDemoView="org">
              <Navigate to="/org/drops" replace />
            </DemoOnly>
          }
        />
        <Route
          path="register"
          element={
            <DemoOnly requiredDemoView="org">
              <Navigate to="/org/drops" replace />
            </DemoOnly>
          }
        />
        <Route
          path="brand"
          element={
            <DemoOnly requiredDemoView="brand">
              <Navigate to="/brand/dashboard" replace />
            </DemoOnly>
          }
        />
        <Route
          path="brand/campaigns/new"
          element={
            <DemoOnly requiredDemoView="brand">
              <Navigate to="/brand/requests/new" replace />
            </DemoOnly>
          }
        />
        <Route path="waitlist" element={<Waitlist />} />
      </Route>
    </Routes>
  );
}
