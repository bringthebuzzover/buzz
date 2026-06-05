/**
 * /onboarding/verify-email — stub placeholder (Stage 7).
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function VerifyEmailPage() {
  const { user } = useAuth();
  if (!user || user.status !== "pending_email_verification") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Verify Your <span className="text-buzz-coral">Email</span>
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Check your inbox for a verification link. Onboarding continues in Stage 7.
      </p>
    </div>
  );
}
