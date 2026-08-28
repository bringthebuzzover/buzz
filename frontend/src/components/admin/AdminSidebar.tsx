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

type NavItem = {
  to: string;
  label: string;
  /** Overview queue keys whose counts roll up into this item's badge. */
  badgeKeys?: readonly string[];
};

const NAV: readonly NavItem[] = [
  { to: "/admin", label: "Overview" },
  {
    to: "/admin/orgs",
    label: "Organizations",
    badgeKeys: ["orgs_pending_approval"],
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

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto rounded-full bg-buzz-coral px-2 py-0.5 text-xs font-bold text-buzz-paper">
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
              `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition ${
                isActive
                  ? "bg-buzz-butter text-buzz-ink"
                  : "text-buzz-inkMuted hover:bg-buzz-cream hover:text-buzz-ink"
              }`
            }
          >
            {item.label}
            <Badge count={badge} />
          </NavLink>
        );
      })}
    </nav>
  );
}

function SignedInAs() {
  const { user, logout } = useAuth();
  return (
    <div className="border-t border-buzz-lineMid pt-4">
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
      <div className="flex items-center gap-3 border-b border-buzz-lineMid bg-buzz-paper px-4 py-3 lg:hidden">
        <button
          type="button"
          data-testid="admin-nav-toggle"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-lg border-2 border-buzz-lineMid px-3 py-1.5 text-xs font-bold text-buzz-ink"
        >
          Menu
          {total > 0 && (
            <span className="ml-2 rounded-full bg-buzz-coral px-1.5 text-xs text-buzz-paper">
              {total}
            </span>
          )}
        </button>
        <span className="text-sm font-bold text-buzz-ink">
          Buzz <span className="text-buzz-coral">admin</span>
        </span>
      </div>

      {open && (
        <div className="border-b border-buzz-lineMid bg-buzz-paper px-4 py-3 lg:hidden">
          {/* `key` remounts the drawer contents on navigation so the active
              state can't go stale while it's open. */}
          <NavItems key={location.pathname} onNavigate={() => setOpen(false)} />
          <div className="mt-4">
            <SignedInAs />
          </div>
        </div>
      )}

      {/* Desktop rail. */}
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r border-buzz-lineMid bg-buzz-paper p-4 lg:flex">
        <div>
          <p className="mb-5 px-3 text-sm font-bold text-buzz-ink">
            Buzz <span className="text-buzz-coral">admin</span>
          </p>
          <NavItems />
        </div>
        <SignedInAs />
      </aside>
    </>
  );
}
