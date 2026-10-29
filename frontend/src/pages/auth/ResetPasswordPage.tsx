/**
 * Shared reset-password form (token from query string).
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useResetPassword } from "../../api/hooks/usePasswordResetHooks";
import {
  AuthBackLink,
  AuthCenter,
  AuthHeading,
  AuthSplit,
} from "../../components/auth/AuthFrame";
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
  kicker: string;
  frame: "aside" | "admin";
};

export default function ResetPasswordPage({
  portal,
  loginPath,
  title,
  kicker,
  frame,
}: Props) {
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

  const body = (
    <>
      <AuthHeading kicker={kicker} title={title}>
        Choose a new password for your account.
      </AuthHeading>

      <form onSubmit={onSubmit} className="space-y-6">
        <TextField
          type="password"
          minLength={8}
          label="New password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <TextField
          type="password"
          minLength={8}
          label="Confirm password"
          placeholder="Repeat the password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <Button type="submit" size="field" disabled={reset.isPending} fullWidth>
          Reset password
        </Button>
        <AuthBackLink to={loginPath}>Back to login</AuthBackLink>
      </form>
    </>
  );

  if (frame === "admin") {
    return <AuthCenter>{body}</AuthCenter>;
  }
  return <AuthSplit>{body}</AuthSplit>;
}
