/**
 * /onboarding/profile — org profile setup page (stub for Stage 7).
 * Shown when user.status === "pending_org_profile".
 */
import { useAuth } from "../../contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function OrgProfilePage() {
  const { user } = useAuth();

  if (!user || user.status !== "pending_org_profile") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Set Up Your <span className="text-buzz-coral">Org Profile</span>
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Complete your organization profile to continue. Full onboarding is coming in Stage 7.
      </p>
    </div>
  );
}
