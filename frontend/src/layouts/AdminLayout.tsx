/**
 * Admin shell: sidebar + content `<Outlet />`, with none of the marketing chrome.
 *
 * Deliberately does not render `ImpersonationBanner`. An admin inside an
 * impersonation session is looking at a *portal* page under `SiteLayout`, which
 * carries the banner; showing it here would imply the admin panel itself can be
 * viewed as someone else.
 */
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import AdminSidebar, { AdminWordmark } from "../components/admin/AdminSidebar";
import { focusRingClass } from "../theme/controls";
import { cn } from "../theme/cn";

const AdminChromeContext = createContext<(bare: boolean) => void>(() => {});

/**
 * Admin 404 asks for the slim header (no sidebar). The app uses BrowserRouter,
 * so this is a layout flag the page sets, not a data-router handle.
 */
export function useAdminBareChrome() {
  const setBare = useContext(AdminChromeContext);
  useLayoutEffect(() => {
    setBare(true);
    return () => setBare(false);
  }, [setBare]);
}

export default function AdminLayout() {
  const [bare, setBare] = useState(false);

  return (
    <AdminChromeContext.Provider value={setBare}>
      <div className={cn("min-h-screen bg-page", bare ? "flex flex-col" : "lg:flex")}>
        {bare ? (
          <header className="flex h-16 items-center gap-5 border-b border-line px-6 sm:px-12">
            <AdminWordmark />
            <span className="flex-1" />
            <Link
              to="/"
              className={cn(
                "inline-flex items-center gap-2 text-sm text-muted hover:text-primary",
                focusRingClass,
              )}
            >
              Back to bringthebuzzover.com
              <ArrowUpRight size={14} aria-hidden />
            </Link>
          </header>
        ) : (
          <AdminSidebar />
        )}
        <main
          className={
            bare
              ? "flex flex-1 items-center justify-center px-6 py-16"
              : "min-w-0 flex-1 px-6 pb-16 pt-8 sm:px-8 lg:px-14 lg:pb-24 lg:pt-12"
          }
        >
          <Outlet />
        </main>
      </div>
    </AdminChromeContext.Provider>
  );
}
