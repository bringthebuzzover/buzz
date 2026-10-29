/**
 * /brand/setup — brand account password setup (Stage 7).
 *
 * Reached from the invite email (`?token=…`) sent when an admin approves a
 * brand. Sets the password, activates the account, then forwards to the brand
 * portal with a live session.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useBrandSetPassword } from "../../api/hooks/useOnboardingHooks";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../api/client";
import { AuthHeading, AuthSplit } from "../../components/auth/AuthFrame";
import AuthPending from "../../components/auth/AuthPending";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import type { PortalRole } from "../../types/auth";
import { pathForUser } from "../../utils/landing";
import { stripTokenFromUrl } from "../../utils/stripTokenFromUrl";

export default function BrandSetupPage() {
  const [searchParams] = useSearchParams();
  // Capture once so stripping the query does not Navigate away.
  const [token] = useState(() => searchParams.get("token"));
  const navigate = useNavigate();
  const { acceptSession, status, user } = useAuth();
  const setPassword = useBrandSetPassword();

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      stripTokenFromUrl();
    }
  }, [token]);

  // Wait for bootstrap. Redirecting on the first paint races View-as resume
  // and used to dump an admin on the public home.
  if (status === "idle" || status === "authenticating") {
    return <AuthPending />;
  }

  if (status === "authenticated" && user && (!token || user.impersonatedBy)) {
    // No invite in hand: send the session where it belongs. View-as must not
    // submit this form either. A signed-in invitee (or an admin opening a
    // real invite link) keeps the form — the token stays in state.
    if (user.impersonatedBy) {
      return (
        <Navigate
          to={user.portalRole === "brand" ? "/brand/dashboard" : pathForUser(user)}
          replace
        />
      );
    }
    if (user.portalRole === "brand") {
      return <Navigate to="/brand/dashboard" replace />;
    }
    if (user.portalRole === "admin") {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to={pathForUser(user)} replace />;
  }

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      const data = await setPassword.mutateAsync({ token, password });
      // Same atomic install as brand login — no setAccessToken→refreshUser gap.
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
        err instanceof ApiError
          ? err.message
          : "Could not set your password. The invite link may have expired.",
      );
    }
  };

  return (
    <AuthSplit>
      <AuthHeading kicker="Brand" title="Set Up Your Brand Account">
        Choose a password to finish activating your account.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <TextField
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          placeholder="Choose a password"
          hint="At least 8 characters"
          required
          autoComplete="new-password"
        />

        <TextField
          type="password"
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat the password"
          required
          autoComplete="new-password"
        />

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          size="field"
          loading={setPassword.isPending}
          loadingLabel="Saving…"
          fullWidth
        >
          Activate account
        </Button>
      </form>
    </AuthSplit>
  );
}
