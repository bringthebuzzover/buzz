/**
 * Default marketing shell: `SiteChromeProvider`, `SiteHeader`, animated `<Outlet />`, `SiteFooter`.
 */
import { Outlet } from "react-router-dom";
import { SiteChromeProvider } from "../contexts/SiteChromeContext";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import ImpersonationBanner from "../components/site/ImpersonationBanner";

export default function SiteLayout() {
  return (
    <SiteChromeProvider>
      <div className="min-h-screen bg-buzz-cream selection:bg-buzz-butter selection:text-buzz-coral">
        <ImpersonationBanner />
        <SiteHeader />
        <main className="min-h-[60vh]">
          <div className="animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100">
            <Outlet />
          </div>
        </main>
        <SiteFooter />
      </div>
    </SiteChromeProvider>
  );
}
