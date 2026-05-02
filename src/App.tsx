/**
 * Top-level route table: marketing pages nest under `SiteLayout` (header/footer + contact chrome);
 * `/waitlist` is standalone without that chrome.
 */
import { Routes, Route } from "react-router-dom";
import SiteLayout from "./layouts/SiteLayout";
import HomePage from "./pages/home/HomePage";
import RegisterPage from "./pages/register/RegisterPage";
import CampaignsPage from "./pages/campaigns/CampaignsPage";
import CampaignDetailPage from "./pages/campaigns/CampaignDetailPage";
import BrandDashboardPage from "./pages/brand/BrandDashboardPage";
import PostCampaignPage from "./pages/brand/PostCampaignPage";
import Waitlist from "./pages/waitlist/waitlist";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
        <Route path="brand" element={<BrandDashboardPage />} />
        <Route path="brand/campaigns/new" element={<PostCampaignPage />} />
      </Route>
      <Route path="waitlist" element={<Waitlist />} />
    </Routes>
  );
}
