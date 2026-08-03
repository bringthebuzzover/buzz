/**
 * Shared forgot-password form for brand and admin portals.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { useForgotPassword } from "../../api/hooks/usePasswordResetHooks";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

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
    <div className="mx-auto max-w-md px-8 py-16">
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
          <p className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
            If an account exists for that email, a reset link is on its way.
          </p>
          <Link
            to={loginPath}
            className="inline-block text-sm font-bold text-buzz-coral hover:underline"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-buzz-ink">
              Email
            </label>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={forgot.isPending}
            className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forgot.isPending ? "Sending…" : "Send reset link"}
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
      )}
    </div>
  );
}
