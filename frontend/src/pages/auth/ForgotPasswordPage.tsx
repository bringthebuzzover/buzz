/**
 * Shared forgot-password form for brand and admin portals.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useForgotPassword } from "../../api/hooks/usePasswordResetHooks";
import AuthShell from "../../components/site/AuthShell";
import {
  Button,
  ErrorBanner,
  SuccessBanner,
  TextField,
} from "../../components/forms/controls";

type Props = {
  portal: "brand" | "admin";
  loginPath: string;
  title: string;
};

export default function ForgotPasswordPage({ portal, loginPath, title }: Props) {
  const forgot = useForgotPassword(portal);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await forgot.mutateAsync(email.trim());
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not send reset email. Please try again.",
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
        Enter your account email and we&apos;ll send a reset link if it matches
        an account.
      </p>

      {done ? (
        <div className="space-y-4 text-center">
          <SuccessBanner>
            If an account exists for that email, a reset link is on its way.
          </SuccessBanner>
          <Link
            to={loginPath}
            className="inline-block text-sm font-semibold text-buzz-coral hover:underline"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <TextField
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Button
            type="submit"
            disabled={forgot.isPending}
            fullWidth
          >
            {forgot.isPending ? "Sending…" : "Send reset link"}
          </Button>
          <p className="text-center text-sm text-buzz-inkMuted">
            <Link to={loginPath} className="font-semibold text-buzz-coral hover:underline">
              Back to login
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
