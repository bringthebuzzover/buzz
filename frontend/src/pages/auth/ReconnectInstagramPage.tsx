/**
 * /reconnect-instagram — public reconnect surface when an org’s Instagram
 * long-lived token is past expiry. Must not call authenticated APIs (anti-loop
 * with apiFetch hard-nav). Usable under idle / error / needs_instagram_reconnect.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  AuthArrowLink,
  AuthBackLink,
  AuthHeading,
  AuthLinkRow,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import { Button } from "../../components/forms/controls";
import { allowlistedOAuthNext } from "../../utils/oauthNext";

export default function ReconnectInstagramPage() {
  const { login, status } = useAuth();
  const [searchParams] = useSearchParams();
  const next = allowlistedOAuthNext(searchParams.get("next"));
  const [connecting, setConnecting] = useState(false);

  return (
    <AuthSplit>
      <AuthHeading kicker="Instagram" title="Reconnect Instagram">
        Your organization&apos;s Instagram connection expired. BUZZ can&apos;t
        refresh an already-expired token — reconnect with the organization&apos;s
        Instagram Business or Creator account to restore portal access.
      </AuthHeading>

      <Button
        type="button"
        size="field"
        fullWidth
        data-testid="reconnect-instagram-cta"
        loading={connecting || status === "authenticating"}
        loadingLabel="Connecting…"
        onClick={() => {
          setConnecting(true);
          login(next);
        }}
      >
        Reconnect with Instagram
      </Button>

      <div className="space-y-3">
        <AuthBackLink to="/">Back to home</AuthBackLink>
        <AuthLinkRow quiet="Are you a brand?">
          <AuthArrowLink to="/brand/login">Brand login</AuthArrowLink>
        </AuthLinkRow>
      </div>
    </AuthSplit>
  );
}
