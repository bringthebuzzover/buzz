/**
 * Default marketing shell: `SiteChromeProvider`, `SiteHeader`, animated `<Outlet />`, `SiteFooter`.
 */
import { Outlet, useLocation } from "react-router-dom";
import { SiteChromeProvider } from "../contexts/SiteChromeContext";
import SiteHeader from "../components/site/SiteHeader";
import SiteFooter from "../components/site/SiteFooter";
import ImpersonationBanner from "../components/site/ImpersonationBanner";
import AuthAdminHeader from "../components/auth/AuthAdminHeader";
import { isAdminAuthPath, isBareAuthPath } from "../components/auth/authPaths";

export default function SiteLayout() {
  const { pathname } = useLocation();
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
        {bare ? null : <SiteFooter />}
      </div>
    </SiteChromeProvider>
  );
}
