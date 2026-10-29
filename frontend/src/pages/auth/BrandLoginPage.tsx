/**
 * /brand/login — brand email + password login (Stage 7).
 *
 * On success the login payload is handed to `acceptSession` (token + user) so
 * route guards forward to the dashboard without racing AuthProvider bootstrap.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBrandLogin, usePublicConfig } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import {
  AuthArrowLink,
  AuthHeading,
  AuthLinkRow,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import AuthPending from "../../components/auth/AuthPending";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import { pathForUser } from "../../utils/landing";
import type { PortalRole } from "../../types/auth";
import type { TokenResponse } from "../../api/hooks/useOnboardingHooks";

export default function BrandLoginPage() {
  const { status, user, acceptSession } = useAuth();
  const navigate = useNavigate();
  const brandLogin = useBrandLogin();
  const config = usePublicConfig();
  const selfRegistration = config.data?.brandSelfRegistrationEnabled === true;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Any already-authenticated user is forwarded to their own landing — an org
  // must never see the brand form and clobber its session by submitting it.
  if (status === "authenticated" && user) {
    return <Navigate to={pathForUser(user)} replace />;
  }

  if (status === "restore_failed") {
    return (
      <AuthSplit>
        <SessionRestorePanel embedded />
      </AuthSplit>
    );
  }

  // Wait for AuthProvider bootstrap before mounting controlled inputs — a
  // status flip mid-fill remounts empty fields and can block HTML5 submit.
  if (status === "idle" || status === "authenticating") {
    return <AuthPending />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = (await brandLogin.mutateAsync({
        email: email.trim(),
        password,
      })) as TokenResponse;
      acceptSession(
        {
          id: data.user.id,
          portalRole: data.user.portal_role as PortalRole,
          status: data.user.status,
          instagramUsername: data.user.instagram_username ?? undefined,
        },
        data.access_token,
      );
      navigate("/brand/dashboard", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Login failed. Please try again.",
      );
    }
  };

  return (
    <AuthSplit>
      <AuthHeading kicker="Brand" title="Login">
        Sign in with your brand account email and password.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <TextField
          type="email"
          label="Email"
          placeholder="e.g. you@company.com"
          data-testid="brand-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <TextField
          type="password"
          label="Password"
          placeholder="Your password"
          data-testid="brand-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          size="field"
          data-testid="brand-login-submit"
          loading={brandLogin.isPending}
          loadingLabel="Signing in…"
          fullWidth
        >
          Sign in
        </Button>

        <p>
          <AuthArrowLink to="/brand/forgot-password">Forgot password?</AuthArrowLink>
        </p>

        {selfRegistration ? (
          <AuthLinkRow quiet="New to BUZZ?">
            <AuthArrowLink to="/brand/apply">Apply as a brand</AuthArrowLink>
          </AuthLinkRow>
        ) : null}
      </form>
    </AuthSplit>
  );
}
