/**
 * /login — Instagram OAuth entry point. Public page.
 */
import { useAuth } from "../../contexts/AuthContext";
import { Link, Navigate } from "react-router-dom";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import instagramIcon from "../../assets/insta-icon.png";
import { pathForUser } from "../../utils/landing";
import AuthShell from "../../components/site/AuthShell";
import { Button } from "../../components/forms/controls";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function LoginPage() {
  const { status, user, login } = useAuth();

  if (status === "authenticated") {
    // Status-aware landing: an active org → feed, mid-onboarding org → their
    // onboarding step, brand → dashboard (matches the OAuth-callback target).
    return <Navigate to={pathForUser(user)} replace />;
  }

  if (status === "needs_instagram_reconnect") {
    return <Navigate to="/reconnect-instagram" replace />;
  }

  if (status === "restore_failed") {
    return <SessionRestorePanel />;
  }

  return (
    <AuthShell align="center" className="items-center text-center">
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink")}>
        Join or sign in to <span className="text-buzz-coral">Buzz</span>
      </h1>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        Returning organizations sign in with the organization&apos;s Instagram
        Business or Creator account (not a personal member account).
      </p>

      <Button
        type="button"
        variant="outline"
        size="hero"
        onClick={login}
        disabled={status === "authenticating"}
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {status === "authenticating"
          ? "Logging in..."
          : "Continue with Instagram"}
      </Button>

      <div className={cn("mt-8", STACK.default, "text-sm font-medium text-buzz-inkMuted")}>
        <p>
          New org?{" "}
          <Link to="/org/apply" className="font-semibold text-buzz-coral hover:underline">
            Apply here.
          </Link>
        </p>
        <p>
          <Link to="/for-orgs" className="font-semibold text-buzz-coral hover:underline">
            See how it works
          </Link>
        </p>
        <p>
          Are you a brand?{" "}
          <Link to="/brand/login" className="font-semibold text-buzz-coral hover:underline">
            Brand login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
