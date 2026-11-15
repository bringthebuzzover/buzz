/**
 * /org/apply — public Instagram-first org onboarding entry point.
 *
 * Connects the organization's Instagram Business or Creator account first, or
 * displays the personal-account recovery state when redirected with
 * `?error=personal_account`.
 */
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  AuthArrowLink,
  AuthHeading,
  AuthLinkRow,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import { Button } from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { pathForUser } from "../../utils/landing";
import { allowlistedOAuthNext, allowlistedPrefill } from "../../utils/oauthNext";

export default function OrgApplyPage() {
  const { login, user } = useAuth();
  const [searchParams] = useSearchParams();
  const next = allowlistedOAuthNext(searchParams.get("next"));
  const prefill = allowlistedPrefill(searchParams.get("prefill"));
  const isPersonalAccountError =
    searchParams.get("error") === "personal_account";
  const [connecting, setConnecting] = useState(false);

  if (user) return <Navigate to={pathForUser(user, next, prefill)} replace />;

  return (
    <AuthSplit asideStatement="Join as a student organization and work with brands on real campus campaigns.">
      {isPersonalAccountError ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-buzz-danger">
            Professional Account Required
          </p>
          <h1 className={cn(TEXT.h1, "text-primary")}>Account Type Error</h1>
          <p className={cn(TEXT.bodyLong, "text-muted")}>
            Your Instagram account is set to Personal. Switch to a free Business
            or Creator account in Instagram Settings, then retry below.
          </p>
        </div>
      ) : (
        <AuthHeading kicker="Apply as a" title="Student Organization">
          Connect your organization&apos;s Instagram to get started. BUZZ
          verifies your handle and audience metrics directly with Meta.
        </AuthHeading>
      )}

      <Button
        type="button"
        size="field"
        fullWidth
        loading={connecting}
        loadingLabel="Connecting…"
        onClick={() => {
          setConnecting(true);
          login(next, prefill);
        }}
      >
        {isPersonalAccountError
          ? "Try Again with Instagram"
          : "Continue with Instagram"}
      </Button>

      <div className="space-y-3">
        {isPersonalAccountError ? (
          <AuthLinkRow quiet="Need help?">
            <AuthArrowLink to="/for-orgs#instagram-guide">
              View Instagram guide
            </AuthArrowLink>
          </AuthLinkRow>
        ) : (
          <AuthLinkRow quiet="Already applied?">
            <AuthArrowLink to="/login">Log in with Instagram</AuthArrowLink>
          </AuthLinkRow>
        )}
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
