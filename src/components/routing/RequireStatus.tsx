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

export default function RequireStatus({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (!user) return null;

  if (user.portalRole === "org") {
    switch (user.status) {
      case "pending_org_profile":
        return <Navigate to="/onboarding/profile" replace />;
      case "pending_email_verification":
        return <Navigate to="/onboarding/verify-email" replace />;
      case "pending_approval":
        return <Navigate to="/onboarding/pending-approval" replace />;
      case "denied":
        return <Navigate to="/onboarding/denied" replace />;
      case "active":
        break;
      default:
        break;
    }
  }

  return <>{children}</>;
}
