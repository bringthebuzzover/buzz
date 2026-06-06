/**
 * /onboarding/denied — terminal "no portal access" screen for orgs whose
 * application was denied or whose account was suspended. RequireStatus routes
 * both statuses here; the copy adapts to which one.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { pathForUser } from "../../utils/landing";

export default function DeniedPage() {
  const { user } = useAuth();
  if (!user || (user.status !== "denied" && user.status !== "suspended")) {
    return <Navigate to={pathForUser(user)} replace />;
  }

  const suspended = user.status === "suspended";

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-coral">
        {suspended ? "Account Suspended" : "Application Denied"}
      </h1>
      <p className="text-sm font-medium text-buzz-inkMuted">
        {suspended
          ? "Your organization's account has been suspended. Contact Buzz support if you have questions."
          : "Your organization's application was not approved. Contact Buzz support if you have questions."}
      </p>
    </div>
  );
}
