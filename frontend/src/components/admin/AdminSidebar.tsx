/**
 * Admin panel navigation.
 *
 * A sidebar rather than tabs because the panel's job is queue triage: the badge
 * counts are the point, and they need a persistent home that stays legible as
 * sections are added. On small screens it collapses into a drawer, with the
 * badge total moved onto the trigger so "something needs me" survives the
 * collapse.
 */
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminOverview } from "../../api/hooks/useAdminHooks";
import { cn } from "../../theme/cn";
import { BeeMark } from "../ui/BrandMark";
import { Chip } from "../ui/Chip";
import { appNavItemClass } from "../ui/navItem";

type NavItem = {
  to: string;
  label: string;
  /** Overview queue keys whose counts roll up into this item's badge. */
  badgeKeys?: readonly string[];
};

const NAV: readonly NavItem[] = [
  {
    to: "/admin",
    label: "Overview",
    badgeKeys: [
      "orgs_pending_approval",
      "orgs_ig_change_pending",
      "orgs_ig_bind_mismatch",
      "brands_pending_review",
      "drops_ready_to_advance",
    ],
  },
  {
    to: "/admin/orgs",
    label: "Organizations",
    badgeKeys: ["orgs_pending_approval", "orgs_ig_bind_mismatch"],
  },
  {
    to: "/admin/brands",
    label: "Brands",
    badgeKeys: ["brands_pending_review"],
  },
  {
    to: "/admin/requests",
    label: "Requests",
  },
  {
    to: "/admin/drops",
    label: "Drops",
    badgeKeys: ["drops_ready_to_advance"],
  },
  { to: "/admin/health", label: "Health" },
];

function AdminWordmark({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-lg font-medium text-buzz-fg", className)}>
      <BeeMark className="h-5 w-5" />
      Buzz <span className="text-buzz-yellow">admin</span>
    </p>
  );
}

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <Chip accent className={cn("px-2 py-0.5", className)}>
      {count}
    </Chip>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const overview = useAdminOverview();
  const counts = new Map(
    (overview.data?.queues ?? []).map((queue) => [queue.key, queue.count]),
  );

  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const badge = (item.badgeKeys ?? []).reduce(
          (total, key) => total + (counts.get(key) ?? 0),
          0,
        );
        return (
          <NavLink
            key={item.to}
            to={item.to}
            // Only Overview is an exact match; the others must stay highlighted
            // on their detail routes.
            end={item.to === "/admin"}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(appNavItemClass(isActive), "w-full")
            }
          >
            {item.label}
            <CountBadge count={badge} className="ml-auto" />
          </NavLink>
        );
      })}
    </nav>
  );
}

function SignedInAs() {
  const { user, logout } = useAuth();
  return (
    <div className="border-t border-buzz-lineMid px-3 pt-4">
      <p className="truncate text-xs font-medium text-buzz-inkFaint">
        Signed in as admin
      </p>
      <p className="truncate text-sm font-bold text-buzz-ink">
        {user?.instagramUsername ?? "Buzz admin"}
      </p>
      <button
        type="button"
        data-testid="admin-sign-out"
        onClick={() => void logout()}
        className="mt-2 text-xs font-bold text-buzz-coral hover:underline"
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
      {/* Mobile trigger. */}
      <div className="flex items-center gap-3 border-b border-buzz-lineMid bg-buzz-paper px-6 py-3 sm:px-8 lg:hidden">
        <button
          type="button"
          data-testid="admin-nav-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-buzzControl border-2 border-buzz-lineMid px-3 py-1.5 text-xs font-semibold text-buzz-ink"
        >
          Menu
          <CountBadge count={total} className="ml-2" />
        </button>
        <AdminWordmark />
      </div>

      {open && (
        <div className="border-b border-buzz-lineMid bg-buzz-paper px-6 py-3 sm:px-8 lg:hidden">
          {/* `key` remounts the drawer contents on navigation so the active
              state can't go stale while it's open. */}
          <NavItems key={location.pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-4">
            <SignedInAs />
          </div>
        </div>
      )}

      {/* Desktop rail. */}
      <aside className="hidden w-[248px] shrink-0 flex-col justify-between border-r border-buzz-line bg-buzz-dark p-4 lg:flex">
        <div>
          <AdminWordmark className="mb-5 px-3" />
          <NavItems />
        </div>
        <SignedInAs />
      </aside>
    </>
  );
}
