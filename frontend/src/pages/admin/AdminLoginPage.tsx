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
import { pathForUser } from "../../utils/landing";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

export default function AdminLoginPage() {
  const { status, user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const adminLogin = useAdminLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "authenticated" && user) {
    return <Navigate to={pathForUser(user)} replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await adminLogin.mutateAsync({ email: email.trim(), password });
      await refreshUser();
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
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Admin <span className="text-buzz-coral">Login</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Sign in with your Buzz admin email and password.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Email
          </label>
          <input
            type="email"
            data-testid="admin-email"
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
            data-testid="admin-password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          data-testid="admin-login-submit"
          disabled={adminLogin.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {adminLogin.isPending ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
