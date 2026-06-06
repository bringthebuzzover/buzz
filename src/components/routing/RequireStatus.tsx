/**
 * RequireStatus — redirects org users to the correct onboarding page based on
 * their account status. Brand and admin users pass through.
 *
 * Nested inside RequireAuth and above RequireRole (architecture §5.4). It only
 * acts on org users, so it doesn't depend on a role gate above it.
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { pathForUser } from "../../utils/landing";

export default function RequireStatus({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return null;

  // Any non-active org is redirected to where it belongs (onboarding step or the
  // denied/suspended page) via the shared mapping — one source of truth shared
  // with the login page and the onboarding pages. Active orgs, brands, and
  // admins fall through to the portal.
  if (user.portalRole === "org" && user.status !== "active") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  return <>{children}</>;
}
