/**
 * /onboarding/pending-approval — waiting screen for orgs awaiting admin review.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function PendingApprovalPage() {
  const { user } = useAuth();
  if (!user || user.status !== "pending_approval") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Awaiting <span className="text-buzz-coral">Approval</span>
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Your organization is under review. You'll get access once a Buzz admin approves your account.
      </p>
    </div>
  );
}
