/**
 * /onboarding/verify-email — .edu verification (Stage 7, Phase 3).
 *
 * Two modes:
 *  - With `?token=…` (the link from the email): auto-verify, then refresh the
 *    user so the guard forwards to /onboarding/pending-approval.
 *  - Without a token: the "check your inbox" waiting screen, with a Resend
 *    button (rate-limited server-side).
 *
 * The token path is allowed to render even when the user is not in
 * pending_email_verification (they may click the link from a fresh tab); the
 * waiting screen still requires that status.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useResendVerification,
  useVerifyEmail,
} from "../../api/hooks/useOnboardingHooks";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";

export default function VerifyEmailPage() {
  const { status, user } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  if (token) {
    return <VerifyWithToken token={token} />;
  }

  // This page is public (not behind RequireAuth) so the email link works in a
  // fresh tab. That means on reload we must wait for the auth bootstrap before
  // deciding — otherwise the redirect fires while user is still null.
  if (status === "idle" || status === "authenticating") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">Loading...</p>
      </div>
    );
  }

  if (!user || user.status !== "pending_email_verification") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  return <AwaitVerification />;
}

type VerifyState =
  | { kind: "verifying" }
  | { kind: "success"; authenticated: boolean }
  | { kind: "error"; message: string };

function VerifyWithToken({ token }: { token: string }) {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const verify = useVerifyEmail();
  const [state, setState] = useState<VerifyState>({ kind: "verifying" });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        await verify.mutateAsync(token);
        // The link is often opened in a fresh tab/browser with no session, so
        // refreshUser() may return null. Show a self-contained success screen
        // either way rather than auto-navigating to a guarded page (which would
        // bounce an unauthenticated visitor to "/").
        const me = await refreshUser();
        setState({ kind: "success", authenticated: !!me });
      } catch (err) {
        // Re-clicking an already-used link is success, not failure: the email is
        // verified. Show the success screen (refreshUser decides where Continue
        // goes).
        if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
          const me = await refreshUser();
          setState({ kind: "success", authenticated: !!me });
          return;
        }
        setState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Could not verify your email. The link may have expired.",
        });
      }
    })();
  }, [token, verify, refreshUser]);

  if (state.kind === "verifying") {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
          Verifying Your <span className="text-buzz-coral">Email</span>…
        </h1>
        <p className="text-sm font-medium text-buzz-inkMuted">
          One moment while we confirm your address.
        </p>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-coral">
          Verification Failed
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          {state.message}
        </p>
        <button
          onClick={() => navigate("/onboarding/verify-email", { replace: true })}
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
        >
          Request a new link
        </button>
      </div>
    );
  }

  // success
  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Email <span className="text-buzz-coral">Verified</span>
      </h1>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
        Thanks! Your account is now pending admin approval. We'll let you in as
        soon as a Buzz admin reviews it.
      </p>
      <button
        onClick={() =>
          navigate(
            state.authenticated ? "/onboarding/pending-approval" : "/login",
            { replace: true },
          )
        }
        className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
      >
        Continue
      </button>
    </div>
  );
}

const POLL_INTERVAL_MS = 15_000;

function AwaitVerification() {
  const { refreshUser } = useAuth();
  const resend = useResendVerification();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Poll so a verify completed in another tab/device advances this waiting tab
  // automatically (the parent redirects once status leaves
  // pending_email_verification), mirroring PendingApprovalPage.
  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshUser();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshUser]);

  const onResend = async () => {
    setNotice(null);
    setError(null);
    try {
      await resend.mutateAsync();
      setNotice("Verification email re-sent. Check your inbox.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not re-send the email. Please try again later.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Verify Your <span className="text-buzz-coral">Email</span>
      </h1>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
        We sent a verification link to your school email. Click it to continue.
      </p>

      {notice && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      <button
        onClick={onResend}
        disabled={resend.isPending}
        className="rounded-lg border-2 border-buzz-coral px-6 py-3 text-sm font-bold text-buzz-coral transition enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resend.isPending ? "Sending…" : "Resend email"}
      </button>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
