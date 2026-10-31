/**
 * Brand forgot-password form.
 */
import { useState } from "react";
import { ApiError } from "../../api/client";
import { useForgotPassword } from "../../api/hooks/usePasswordResetHooks";
import {
  AuthBackLink,
  AuthHeading,
  AuthSplit,
} from "../../components/auth/AuthFrame";
import {
  Button,
  ErrorBanner,
  SuccessBanner,
  TextField,
} from "../../components/forms/controls";

type Props = {
  loginPath: string;
  title: string;
  kicker: string;
};

export default function ForgotPasswordPage({
  loginPath,
  title,
  kicker,
}: Props) {
  const forgot = useForgotPassword();
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

  const body = (
    <>
      <AuthHeading kicker={kicker} title={title}>
        Enter your account email and we&apos;ll send a reset link if it matches
        an account.
      </AuthHeading>

      {done ? (
        <div className="space-y-6">
          <SuccessBanner>
            If an account exists for that email, a reset link is on its way.
          </SuccessBanner>
          <AuthBackLink to={loginPath}>Back to login</AuthBackLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <TextField
            type="email"
            label="Email"
            placeholder="e.g. you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />
          {error && <ErrorBanner>{error}</ErrorBanner>}
          <Button
            type="submit"
            size="field"
            loading={forgot.isPending}
            loadingLabel="Sending…"
            fullWidth
          >
            Send reset link
          </Button>
          <AuthBackLink to={loginPath}>Back to login</AuthBackLink>
        </form>
      )}
    </>
  );

  return <AuthSplit>{body}</AuthSplit>;
}
