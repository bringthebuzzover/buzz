/**
 * Default marketing shell: `SiteChromeProvider`, `SiteHeader`, animated `<Outlet />`, `SiteFooter`.
 *
 * Marketing routes keep the overlay header and the mobile join dock.
 * Bare auth routes draw their own frame: admin auth gets `AuthAdminHeader`,
 * the rest show no header or footer.
 */
import { Link, Outlet, useLocation } from "react-router-dom";
import { SiteChromeProvider } from "../contexts/SiteChromeContext";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import ImpersonationBanner from "../components/site/ImpersonationBanner";
import AuthAdminHeader from "../components/auth/AuthAdminHeader";
import { isAdminAuthPath, isBareAuthPath } from "../components/auth/authPaths";
import { focusRingClass } from "../theme/controls";
import { cn } from "../theme/cn";

function isMarketingPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/for-orgs" || pathname === "/for-brands";
}

export default function SiteLayout() {
  const { pathname } = useLocation();
  const marketing = isMarketingPath(pathname);
  const bare = isBareAuthPath(pathname);

  return (
    <SiteChromeProvider>
      <div className="flex min-h-screen flex-col bg-page">
        <ImpersonationBanner />
        {bare ? (
          isAdminAuthPath(pathname) ? <AuthAdminHeader /> : null
        ) : (
          <SiteHeader />
        )}
        {/* Flex column all the way to the outlet so `AUTH_SHELL.center` can
            claim the space between header and footer with `flex-1` and center
            in it for real, instead of a guessed min-height on the page. */}
        {/* Page roots are given an explicit width because `mx-auto` sets auto
            cross-axis margins, and an auto margin cancels flex stretch — the
            page would otherwise shrink-wrap to its widest content and scroll
            sideways on a phone. `min-w-0` lets it shrink below that content. */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 flex-1 flex-col [&>*]:w-full [&>*]:min-w-0 animate-fade-in motion-reduce:animate-none motion-reduce:opacity-100">
            <Outlet />
          </div>
        </main>
        {bare ? null : marketing ? <MobileJoinDock /> : <SiteFooter />}
      </div>
    </SiteChromeProvider>
  );
}

/** Pen mobile dock: yellow org-apply pill, fixed, under 768px. */
function MobileJoinDock() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 md:hidden">
      <Link
        to="/org/apply"
        className={cn(
          "pointer-events-auto mx-auto flex h-11 max-w-md items-center justify-center rounded-full bg-accent px-5 text-sm text-on-accent shadow-buzz",
          focusRingClass,
        )}
      >
        Join as a student organization
      </Link>
    </div>
  );
}
