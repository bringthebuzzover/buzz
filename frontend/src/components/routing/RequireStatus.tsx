/**
 * RequireStatus — redirects org users to the correct onboarding page based on
 * their account status. Brands and admins pass through (a non-active brand is a
 * rare server-side edge case the backend 403s, and each brand page degrades to a
 * friendly error rather than a broken view — routing it elsewhere here would
 * loop against the login page's `pathForUser` redirect).
 *
 * Nested inside RequireAuth and above RequireRole (architecture §5.4).
 */
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { pathForUser } from "../../utils/landing";

export default function RequireStatus({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return null;

  // Any non-active org is redirected to where it belongs (onboarding step or the
  // denied page) via the shared mapping — one source of truth shared
  // with the login page and the onboarding pages. Active orgs, brands, and
  // admins fall through to the portal.
  if (user.portalRole === "org" && user.status !== "active") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  return <>{children}</>;
}
