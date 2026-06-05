/**
 * /brand/setup — brand account password setup (Stage 7).
 *
 * Reached from the invite email (`?token=…`) sent when an admin approves a
 * brand. Sets the password, activates the account, then forwards to the brand
 * login page.
 */
import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useBrandSetPassword } from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

export default function BrandSetupPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const setPassword = useBrandSetPassword();

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    try {
      await setPassword.mutateAsync({ token, password });
      navigate("/brand/login", { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not set your password. The invite link may have expired.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-16">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Set Up Your <span className="text-buzz-coral">Brand Account</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Choose a password to finish activating your account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Password
          </label>
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
            placeholder="At least 8 characters"
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-buzz-ink">
            Confirm password
          </label>
          <input
            type="password"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={setPassword.isPending}
          className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {setPassword.isPending ? "Saving…" : "Activate account"}
        </button>
      </form>
    </div>
  );
}
