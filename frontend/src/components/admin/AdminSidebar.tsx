/**
 * Admin panel navigation.
 *
 * Pen `Admin / Sidebar`: 248px rail, wordmark plus a yellow "admin" pill,
 * yellow-wash active item, yellow-wash count badges, and a quiet sign-out.
 * On small screens it collapses into a drawer; the badge total stays on the
 * trigger so "something needs me" survives the collapse.
 */
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  AtSign,
  Building2,
  Component,
  Inbox,
  LayoutDashboard,
  Package,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminOverview } from "../../api/hooks/useAdminHooks";
import { cn } from "../../theme/cn";
import { focusRingClass } from "../../theme/controls";
import { Logo } from "../ui/BrandMark";
import { adminNavItemClass } from "../ui/navItem";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Overview queue keys whose counts roll up into this item's badge. */
  badgeKeys?: readonly string[];
};

const NAV: readonly NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  {
    to: "/admin/orgs",
    label: "Organizations",
    icon: Users,
    badgeKeys: ["orgs_pending_approval", "orgs_ig_bind_mismatch"],
  },
  {
    to: "/admin/brands",
    label: "Brands",
    icon: Building2,
    badgeKeys: ["brands_pending_review"],
  },
  { to: "/admin/requests", label: "Requests", icon: Inbox },
  {
    to: "/admin/ig-changes",
    label: "IG changes",
    icon: AtSign,
    badgeKeys: ["orgs_ig_change_pending", "brands_ig_change_pending"],
  },
  {
    to: "/admin/drops",
    label: "Drops",
    icon: Package,
    badgeKeys: ["drops_ready_to_advance"],
  },
  { to: "/admin/health", label: "Health", icon: Activity },
];

export function AdminWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Logo className="h-6 w-auto" />
      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-on-accent">
        admin
      </span>
    </div>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "rounded-full bg-accent-wash px-2 py-0.5 text-xs font-medium text-accent",
        className,
      )}
    >
      {count}
    </span>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const overview = useAdminOverview();
  const counts = new Map(
    (overview.data?.queues ?? []).map((queue) => [queue.key, queue.count]),
  );

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const badge = (item.badgeKeys ?? []).reduce(
          (total, key) => total + (counts.get(key) ?? 0),
          0,
        );
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            onClick={onNavigate}
            className={({ isActive }) => adminNavItemClass(isActive)}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  aria-hidden
                  className={isActive ? "text-primary" : "text-quiet"}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    isActive && "text-accent",
                  )}
                >
                  {item.label}
                </span>
                <CountBadge count={badge} className="ml-auto" />
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}

function SignedInAs() {
  const { logout } = useAuth();
  return (
    <div className="flex flex-col gap-2 border-t border-line px-3 pt-4">
      <p className="truncate text-xs text-quiet">Signed in as admin</p>
      <button
        type="button"
        data-testid="admin-sign-out"
        onClick={() => void logout()}
        className={cn(
          "self-start text-sm text-primary hover:text-accent",
          focusRingClass,
        )}
      >
        Sign out
      </button>
    </div>
  );
}

export default function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const overview = useAdminOverview();
  const total = (overview.data?.queues ?? []).reduce(
    (sum, queue) => sum + queue.count,
    0,
  );

  return (
    <>
      <div className="flex items-center gap-3 border-b border-line bg-page px-6 py-3 sm:px-8 lg:hidden">
        <button
          type="button"
          data-testid="admin-nav-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className={cn(
            "inline-flex items-center rounded-full border border-line px-3 py-1.5 text-xs text-primary",
            focusRingClass,
          )}
        >
          Menu
          <CountBadge count={total} className="ml-2" />
        </button>
        <AdminWordmark />
      </div>

      {open && (
        <div className="border-b border-line bg-page px-6 py-4 sm:px-8 lg:hidden">
          <NavItems key={location.pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-4 border-t border-line pt-4">
            <NavLink
              to="/admin/ui-kit"
              onClick={() => setOpen(false)}
              className={({ isActive }) => adminNavItemClass(isActive)}
            >
              <Component size={16} aria-hidden className="text-quiet" />
              <span className="min-w-0 flex-1 truncate">UI kit</span>
            </NavLink>
          </div>
          <div className="mt-4">
            <SignedInAs />
          </div>
        </div>
      )}

      <aside className="hidden w-[248px] shrink-0 flex-col gap-8 border-r border-line bg-page px-4 py-8 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
        <div className="flex min-h-0 flex-1 flex-col gap-8">
          <AdminWordmark className="px-3" />
          <NavItems />
          <div className="flex flex-col gap-2 border-t border-line px-3 pt-4">
            <p className="text-xs text-quiet">Development only</p>
            <NavLink
              to="/admin/ui-kit"
              className={({ isActive }) => adminNavItemClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <Component
                    size={16}
                    aria-hidden
                    className={isActive ? "text-primary" : "text-quiet"}
                  />
                  <span className={cn("min-w-0 flex-1 truncate", isActive && "text-accent")}>
                    UI kit
                  </span>
                </>
              )}
            </NavLink>
          </div>
          <div className="flex-1" />
        </div>
        <SignedInAs />
      </aside>
    </>
  );
}
