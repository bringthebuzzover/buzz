/**
 * /brand/setup — brand account password setup (Stage 7).
 *
 * Reached from the invite email (`?token=…`) sent when an admin approves a
 * brand. Sets the password, activates the account, then forwards to the brand
 * portal with a live session.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useBrandSetPassword } from "../../api/hooks/useOnboardingHooks";
import { useAuth } from "../../contexts/AuthContext";
import { ApiError } from "../../api/client";
import AuthShell from "../../components/site/AuthShell";
import {
  Button,
  ErrorBanner,
  TextField,
} from "../../components/forms/controls";
import type { PortalRole } from "../../types/auth";
import { stripTokenFromUrl } from "../../utils/stripTokenFromUrl";

export default function BrandSetupPage() {
  const [searchParams] = useSearchParams();
  // Capture once so stripping the query does not Navigate away.
  const [token] = useState(() => searchParams.get("token"));
  const navigate = useNavigate();
  const { acceptSession } = useAuth();
  const setPassword = useBrandSetPassword();

  const [password, setPasswordValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      stripTokenFromUrl();
    }
  }, [token]);

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
      const data = await setPassword.mutateAsync({ token, password });
      // Same atomic install as brand login — no setAccessToken→refreshUser gap.
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
        err instanceof ApiError
          ? err.message
          : "Could not set your password. The invite link may have expired.",
      );
    }
  };

  return (
    <AuthShell align="center">
      <h1 className="mb-2 text-center text-3xl font-bold text-buzz-ink">
        Set Up Your <span className="text-buzz-coral">Brand Account</span>
      </h1>
      <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
        Choose a password to finish activating your account.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <TextField
          type="password"
          label="Password"
          value={password}
          onChange={(e) => setPasswordValue(e.target.value)}
          placeholder="At least 8 characters"
          required
        />

        <TextField
          type="password"
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        {error && <ErrorBanner>{error}</ErrorBanner>}

        <Button
          type="submit"
          disabled={setPassword.isPending}
          fullWidth
        >
          {setPassword.isPending ? "Saving…" : "Activate account"}
        </Button>
      </form>
    </AuthShell>
  );
}
