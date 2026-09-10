/**
 * Shared reset-password form (token from query string).
 */
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useResetPassword } from "../../api/hooks/usePasswordResetHooks";
import AuthShell from "../../components/site/AuthShell";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import { stripTokenFromUrl } from "../../utils/stripTokenFromUrl";

type Props = {
  portal: "brand" | "admin";
  loginPath: string;
  title: string;
};

export default function ResetPasswordPage({ portal, loginPath, title }: Props) {
  const [searchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get("token") ?? "");
  const navigate = useNavigate();
  const reset = useResetPassword(portal);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      stripTokenFromUrl();
    }
  }, [token]);

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
    <AuthShell align="center">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        {title.split(" ")[0]}{" "}
        <span className="text-buzz-coral">{title.split(" ").slice(1).join(" ") || "Password"}</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Choose a new password for your account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          type="password"
          minLength={8}
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <TextField
          type="password"
          minLength={8}
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <Button
          type="submit"
          disabled={reset.isPending}
          className="w-full"
        >
          {reset.isPending ? "Saving…" : "Reset password"}
        </Button>
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <p className="text-center text-xs text-buzz-inkMuted">
          <Link to={loginPath} className="font-bold text-buzz-coral hover:underline">
            Back to login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
