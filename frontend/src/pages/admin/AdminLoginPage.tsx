/**
 * /admin/login — admin email + password login.
 *
 * Admins have no Instagram identity and no invite flow, so this is their only
 * session entry point outside local dev.
 */
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminLogin } from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import {
  AuthCenter,
  AuthHeading,
} from "../../components/auth/AuthFrame";
import AuthPending from "../../components/auth/AuthPending";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import { pathForUser } from "../../utils/landing";
import type { PortalRole } from "../../types/auth";
import type { TokenResponse } from "../../api/hooks/useAdminHooks";

export default function AdminLoginPage() {
  const { status, user, acceptSession } = useAuth();
  const navigate = useNavigate();
  const adminLogin = useAdminLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated" && user) {
    return <Navigate to={pathForUser(user)} replace />;
  }

  if (status === "restore_failed") {
    return (
      <AuthCenter>
        <SessionRestorePanel embedded />
      </AuthCenter>
    );
  }

  // Wait for AuthProvider bootstrap before mounting controlled inputs — a
  // status flip mid-fill remounts empty fields and can block HTML5 submit
  // (E2E fill→click race; same window is rare but real for humans).
  if (status === "idle" || status === "authenticating") {
    return <AuthPending />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // Login returns user + access_token; acceptSession installs both atomically
      // (gen bump first) so AuthProvider bootstrap cannot clobber the session.
      const data = (await adminLogin.mutateAsync({
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
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Login failed. Please try again.",
      );
    }
  };

  return (
    <AuthCenter>
      <AuthHeading kicker="Admin" title="Login">
        Sign in with your BUZZ admin email and password.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <TextField
          type="email"
          label="Email"
          placeholder="e.g. you@company.com"
          data-testid="admin-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <TextField
          type="password"
          label="Password"
          placeholder="Your password"
          data-testid="admin-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          size="field"
          data-testid="admin-login-submit"
          loading={adminLogin.isPending}
          loadingLabel="Signing in…"
          fullWidth
        >
          Sign in
        </Button>
      </form>
    </AuthCenter>
  );
}
