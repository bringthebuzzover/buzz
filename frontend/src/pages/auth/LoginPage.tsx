/**
 * /login — Instagram OAuth entry point. Public page.
 */
import { useAuth } from "../../contexts/AuthContext";
import { Navigate, useSearchParams } from "react-router-dom";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import { pathForUser } from "../../utils/landing";
import { allowlistedOAuthNext } from "../../utils/oauthNext";
import {
  AuthArrowLink,
  AuthHeading,
  AuthLinkRow,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import AuthPending from "../../components/auth/AuthPending";
import { Button } from "../../components/forms/controls";

export default function LoginPage() {
  const { status, user, login } = useAuth();
  const [searchParams] = useSearchParams();
  const next = allowlistedOAuthNext(searchParams.get("next"));

  if (status === "idle" || status === "authenticating") {
    return <AuthPending />;
  }

  if (status === "authenticated") {
    return <Navigate to={next ?? pathForUser(user)} replace />;
  }

  if (status === "needs_instagram_reconnect") {
    const reconnect = next
      ? `/reconnect-instagram?next=${encodeURIComponent(next)}`
      : "/reconnect-instagram";
    return <Navigate to={reconnect} replace />;
  }

  if (status === "restore_failed") {
    return (
      <AuthSplit>
        <SessionRestorePanel embedded />
      </AuthSplit>
    );
  }

  return (
    <AuthSplit>
      <AuthHeading kicker="Organizations" title="Join or sign in to BUZZ">
        Returning organizations sign in with the organization&apos;s Instagram
        Business or Creator account (not a personal member account).
      </AuthHeading>

      <Button
        type="button"
        size="field"
        fullWidth
        onClick={() => login(next)}
      >
        Continue with Instagram
      </Button>

      <div className="space-y-3">
        <AuthLinkRow quiet="New organization?">
          <AuthArrowLink to="/org/apply">Apply here.</AuthArrowLink>
        </AuthLinkRow>
        <p>
          <AuthArrowLink to="/for-orgs">See how it works</AuthArrowLink>
        </p>
        <AuthLinkRow quiet="Are you a brand?">
          <AuthArrowLink to="/brand/login">Brand login</AuthArrowLink>
        </AuthLinkRow>
      </div>
    </AuthSplit>
  );
}
