/**
 * /onboarding/denied — shown when an org application is denied.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function DeniedPage() {
  const { user } = useAuth();
  if (!user || user.status !== "denied") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-coral">
        Application Denied
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        Your organization's application was not approved. Contact Buzz support if you have questions.
      </p>
    </div>
  );
}
