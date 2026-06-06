/**
 * /onboarding/pending-approval — waiting screen for orgs awaiting admin review.
 *
 * Polls the current user every 15s so that once an admin approves (status →
 * active) or denies (→ denied) the account, the route guard forwards the user
 * automatically without a manual refresh.
 */
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const POLL_INTERVAL_MS = 15_000;

export default function PendingApprovalPage() {
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    if (!user || user.status !== "pending_approval") return;
    const id = window.setInterval(() => {
      void refreshUser();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [user, refreshUser]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.status !== "pending_approval") {
    // Poll resolved: send the org to the right place rather than the public
    // landing. Active → their portal; denied → the denial page.
    if (user.status === "active") {
      return <Navigate to="/org/browse" replace />;
    }
    if (user.status === "denied") {
      return <Navigate to="/onboarding/denied" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Awaiting <span className="text-buzz-coral">Approval</span>
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Your organization is under review. You'll get access automatically once
        a Buzz admin approves your account — no need to refresh.
      </p>
    </div>
  );
}
