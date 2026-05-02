/**
 * Top-level routes: `SiteLayout` for marketing shell; `/waitlist` standalone.
 * Demo-protected routes use `DemoOnly` and declare which persona (`requiredDemoView`) may view them
 * so a Brand demo session cannot accidentally land on Org pages and vice versa.
 */
import type { ReactElement } from "react";
import { Routes, Route } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import DemoOnly from "./components/routing/DemoOnly";
import HomePage from "./pages/home/HomePage";
import RegisterPage from "./pages/register/RegisterPage";
import CampaignsPage from "./pages/campaigns/CampaignsPage";
import CampaignDetailPage from "./pages/campaigns/CampaignDetailPage";
import BrandDashboardPage from "./pages/brand/BrandDashboardPage";
import PostCampaignPage from "./pages/brand/PostCampaignPage";
import Waitlist from "./pages/waitlist/waitlist";

export default function AppRoot(): ReactElement {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route
          path="register"
          element={
            <DemoOnly requiredDemoView="org">
              <RegisterPage />
            </DemoOnly>
          }
        />
        <Route
          path="campaigns"
          element={
            <DemoOnly requiredDemoView="org">
              <CampaignsPage />
            </DemoOnly>
          }
        />
        <Route
          path="campaigns/:campaignId"
          element={
            <DemoOnly requiredDemoView="org">
              <CampaignDetailPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand"
          element={
            <DemoOnly requiredDemoView="brand">
              <BrandDashboardPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand/campaigns/new"
          element={
            <DemoOnly requiredDemoView="brand">
              <PostCampaignPage />
            </DemoOnly>
          }
        />
      </Route>
      <Route path="waitlist" element={<Waitlist />} />
    </Routes>
  );
}
