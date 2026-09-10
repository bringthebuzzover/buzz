/**
 * /admin/login — admin email + password login.
 *
 * Admins have no Instagram identity and no invite flow, so this is their only
 * session entry point outside local dev.
 */
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useAdminLogin } from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import AuthShell from "../../components/site/AuthShell";
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
    return <SessionRestorePanel />;
  }

  // Wait for AuthProvider bootstrap before mounting controlled inputs — a
  // status flip mid-fill remounts empty fields and can block HTML5 submit
  // (E2E fill→click race; same window is rare but real for humans).
  if (status === "idle" || status === "authenticating") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
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
    <AuthShell align="center">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Admin <span className="text-buzz-coral">Login</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Sign in with your Buzz admin email and password.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          type="email"
          label="Email"
          data-testid="admin-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          type="password"
          label="Password"
          data-testid="admin-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button
          type="submit"
          data-testid="admin-login-submit"
          disabled={adminLogin.isPending}
          className="w-full"
        >
          {adminLogin.isPending ? "Signing in…" : "Sign in"}
        </Button>

        <p className="text-center text-xs text-buzz-inkMuted">
          <Link
            to="/admin/forgot-password"
            className="font-bold text-buzz-coral hover:underline"
          >
            Forgot password?
          </Link>
        </p>

        {error && <ErrorBanner>{error}</ErrorBanner>}
      </form>
    </AuthShell>
  );
}
