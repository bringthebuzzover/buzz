/**
 * Top-level routes: `SiteLayout` for marketing shell; `/waitlist` standalone.
 * Register, campaigns, and brand routes are wrapped in `DemoOnly` (passcode / session required).
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
            <DemoOnly>
              <RegisterPage />
            </DemoOnly>
          }
        />
        <Route
          path="campaigns"
          element={
            <DemoOnly>
              <CampaignsPage />
            </DemoOnly>
          }
        />
        <Route
          path="campaigns/:campaignId"
          element={
            <DemoOnly>
              <CampaignDetailPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand"
          element={
            <DemoOnly>
              <BrandDashboardPage />
            </DemoOnly>
          }
        />
        <Route
          path="brand/campaigns/new"
          element={
            <DemoOnly>
              <PostCampaignPage />
            </DemoOnly>
          }
        />
      </Route>
      <Route path="waitlist" element={<Waitlist />} />
    </Routes>
  );
}
