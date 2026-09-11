/**
 * /brand/login — brand email + password login (Stage 7).
 *
 * On success the login payload is handed to `acceptSession` (token + user) so
 * route guards forward to the dashboard without racing AuthProvider bootstrap.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useBrandLogin, usePublicConfig } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import AuthShell from "../../components/site/AuthShell";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
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
    return <SessionRestorePanel />;
  }

  // Wait for AuthProvider bootstrap before mounting controlled inputs — a
  // status flip mid-fill remounts empty fields and can block HTML5 submit.
  if (status === "idle" || status === "authenticating") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">
          Restoring your session…
        </p>
      </div>
    );
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
    <AuthShell align="center">
      <h1 className={cn(TEXT.h1, "mb-2 text-center text-buzz-ink")}>
        Brand <span className="text-buzz-coral">Login</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Sign in with your brand account email and password.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          type="email"
          label="Email"
          data-testid="brand-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          type="password"
          label="Password"
          data-testid="brand-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          data-testid="brand-login-submit"
          disabled={brandLogin.isPending}
          fullWidth
        >
          {brandLogin.isPending ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-sm text-buzz-inkMuted">
          <Link
            to="/brand/forgot-password"
            className="font-semibold text-buzz-coral hover:underline"
          >
            Forgot password?
          </Link>
        </p>

        {selfRegistration ? (
          <p className="text-center text-xs text-buzz-inkMuted">
            New to Buzz?{" "}
            <Link to="/brand/apply" className="font-bold text-buzz-coral hover:underline">
              Apply as a brand
            </Link>
          </p>
        ) : null}
      </form>
    </AuthShell>
  );
}
