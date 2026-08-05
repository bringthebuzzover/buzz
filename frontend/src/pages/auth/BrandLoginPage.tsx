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
import { pathForUser } from "../../utils/landing";
import type { PortalRole } from "../../types/auth";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

type LoginResult = {
  access_token: string;
  user: {
    id: string;
    portal_role: string;
    status: string;
    instagram_username?: string | null;
  };
};

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

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const data = (await brandLogin.mutateAsync({
        email: email.trim(),
        password,
      })) as LoginResult;
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
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Brand <span className="text-buzz-coral">Login</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Sign in with your brand account email and password.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Email
          </label>
          <input
            type="email"
            data-testid="brand-email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Password
          </label>
          <input
            type="password"
            data-testid="brand-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          data-testid="brand-login-submit"
          disabled={brandLogin.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {brandLogin.isPending ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-xs text-buzz-inkMuted">
          <Link
            to="/brand/forgot-password"
            className="font-bold text-buzz-coral hover:underline"
          >
            Forgot password?
          </Link>
        </p>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {selfRegistration ? (
          <p className="text-center text-xs text-buzz-inkMuted">
            New to Buzz?{" "}
            <Link to="/brand/apply" className="font-bold text-buzz-coral hover:underline">
              Apply as a brand
            </Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}
