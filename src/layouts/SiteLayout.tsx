/**
 * Default marketing shell: `SiteChromeProvider`, `SiteHeader`, animated `<Outlet />`, `SiteFooter`.
 */
import { Outlet } from "react-router-dom";
import { SiteChromeProvider } from "../contexts/SiteChromeContext";
import { useAccessGate } from "../contexts/AccessGateContext";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";

function DemoModeOutlet() {
  const { isDemoActive } = useAccessGate();
  return (
    <div
      key={isDemoActive ? "demo" : "public"}
      className="animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100"
    >
      <Outlet />
    </div>
  );
}

export default function SiteLayout() {
  return (
    <SiteChromeProvider>
      <div className="min-h-screen bg-buzz-cream selection:bg-buzz-butter selection:text-buzz-coral">
        <SiteHeader />
        <main className="min-h-[60vh]">
          <DemoModeOutlet />
        </main>
        <SiteFooter />
      </div>
    </SiteChromeProvider>
  );
}
