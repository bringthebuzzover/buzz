/**
 * Admin shell: sidebar + content `<Outlet />`, with none of the marketing chrome.
 *
 * Deliberately does not render `ImpersonationBanner`. An admin inside an
 * impersonation session is looking at a *portal* page under `SiteLayout`, which
 * carries the banner; showing it here would imply the admin panel itself can be
 * viewed as someone else.
 */
import { Outlet } from "react-router-dom";
import AdminSidebar from "../components/admin/AdminSidebar";

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-buzz-neutralWash lg:flex">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-5 py-6 sm:px-8">
        <Outlet />
      </main>
    </div>
  );
}
