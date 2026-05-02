/**
 * Default marketing shell for all routes wrapped in `App`’s inner layout: `SiteChromeProvider`,
 * `SiteHeader`, scrollable `<Outlet />`, and `SiteFooter` (excludes standalone `/waitlist`).
 */
import { Outlet } from "react-router-dom";
import { SiteChromeProvider } from "../contexts/SiteChromeContext";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";

export default function SiteLayout() {
  return (
    <SiteChromeProvider>
      <div className="min-h-screen bg-buzz-cream selection:bg-buzz-butter selection:text-buzz-coral">
        <SiteHeader />
        <main className="min-h-[60vh]">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </SiteChromeProvider>
  );
}
