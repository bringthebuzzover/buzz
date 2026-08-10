/**
 * Shared reset-password form (token from query string).
 */
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useResetPassword } from "../../api/hooks/usePasswordResetHooks";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

type Props = {
  portal: "brand" | "admin";
  loginPath: string;
  title: string;
};

export default function ResetPasswordPage({ portal, loginPath, title }: Props) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const reset = useResetPassword(portal);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Open the link from your email.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await reset.mutateAsync({ token, password });
      navigate(loginPath, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not reset password. Please request a new link.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        {title.split(" ")[0]}{" "}
        <span className="text-buzz-coral">{title.split(" ").slice(1).join(" ") || "Password"}</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Choose a new password for your account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            New password
          </label>
          <input
            type="password"
            minLength={8}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Confirm password
          </label>
          <input
            type="password"
            minLength={8}
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={reset.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {reset.isPending ? "Saving…" : "Reset password"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <p className="text-center text-xs text-buzz-inkMuted">
          <Link to={loginPath} className="font-bold text-buzz-coral hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </div>
  );
}
