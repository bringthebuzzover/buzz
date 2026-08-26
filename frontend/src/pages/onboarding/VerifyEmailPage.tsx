/**
 * /onboarding/verify-email — .edu verification (Stage 7, Phase 3).
 *
 * Modes:
 *  - With `?token=…`: Confirm button POSTs verify (no auto-consume). Onboarding
 *    success may mint a session (access_token + user) for apply-first orgs.
 *  - Authenticated waiting (pending_email_verification): resend + change email.
 *  - Public waiting (after /org/apply, no session): Junk copy + resend-public.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type AuthUser } from "../../contexts/AuthContext";
import {
  useChangeEduEmail,
  usePublicResendVerification,
  useResendVerification,
  useVerifyEmail,
} from "../../api/hooks/useOnboardingHooks";
import { authUserFromWire, setAccessToken } from "../../api/auth";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";
import { stripTokenFromUrl } from "../../utils/stripTokenFromUrl";
import type { components } from "../../api/generated/schema";

type UserWire = components["schemas"]["UserResponse"];

const VERIFY_EMAIL_SENT_KEY = "buzz.verifyEmailSent";
const VERIFY_EDU_EMAIL_KEY = "buzz.verifyEduEmail";

const JUNK_HINT =
  "Campus inboxes often put first-time Buzz mail in Junk.";

function readEmailSentFlag(locationState: unknown): boolean {
  const fromState =
    locationState &&
    typeof locationState === "object" &&
    "emailSent" in locationState
      ? (locationState as { emailSent?: boolean }).emailSent
      : undefined;
  if (typeof fromState === "boolean") {
    return fromState;
  }
  return sessionStorage.getItem(VERIFY_EMAIL_SENT_KEY) !== "0";
}

function readEduEmail(locationState: unknown): string {
  const fromState =
    locationState &&
    typeof locationState === "object" &&
    "eduEmail" in locationState
      ? (locationState as { eduEmail?: string }).eduEmail
      : undefined;
  if (typeof fromState === "string" && fromState.trim()) {
    return fromState.trim().toLowerCase();
  }
  return (sessionStorage.getItem(VERIFY_EDU_EMAIL_KEY) ?? "").trim().toLowerCase();
}

function markEmailSent(ok: boolean) {
  sessionStorage.setItem(VERIFY_EMAIL_SENT_KEY, ok ? "1" : "0");
}

function markEduEmail(email: string) {
  sessionStorage.setItem(VERIFY_EDU_EMAIL_KEY, email.trim().toLowerCase());
}

export default function VerifyEmailPage() {
  const { status, user } = useAuth();
  const [searchParams] = useSearchParams();
  // Keep token in state across refresh-before-click; do not strip on mount.
  const [token] = useState(() => searchParams.get("token"));

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

  if (user?.status === "pending_email_verification") {
    return <AwaitVerification />;
  }

  if (!user) {
    return <PublicAwaitVerification />;
  }

  return <Navigate to={pathForUser(user)} replace />;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "success"; user: AuthUser | null }
  | { kind: "error"; message: string };

function VerifyWithToken({ token }: { token: string }) {
  const { acceptSession, refreshUser } = useAuth();
  const navigate = useNavigate();
  const verify = useVerifyEmail();
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const inFlightRef = useRef(false);

  const finishSuccess = async (sessionUser: AuthUser | null) => {
    stripTokenFromUrl();
    setState({ kind: "success", user: sessionUser });
  };

  const onConfirm = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setState({ kind: "verifying" });
    try {
      const result = await verify.mutateAsync(token);
      // CamelModel wire may expose accessToken; tolerate snake_case too.
      const access =
        (result as { accessToken?: string | null; access_token?: string | null })
          .accessToken ??
        (result as { access_token?: string | null }).access_token ??
        null;
      const wireUser = result.user as UserWire | null | undefined;

      if (access && wireUser && typeof wireUser === "object" && "id" in wireUser) {
        const next = authUserFromWire(wireUser);
        acceptSession(next, access);
        await finishSuccess(next);
        return;
      }

      if (access) {
        setAccessToken(access);
      }
      const me = await refreshUser();
      await finishSuccess(me);
    } catch (err) {
      // Re-clicking an already-used link is success, not failure: the email is
      // verified. Show the success screen (refreshUser decides where Continue
      // goes).
      if (err instanceof ApiError && err.code === "EMAIL_ALREADY_VERIFIED") {
        const me = await refreshUser();
        await finishSuccess(me);
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
  };

  if (state.kind === "idle") {
    return (
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
          Verify Your <span className="text-buzz-coral">Email</span>
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          Confirm this is you to finish verifying your school email.
        </p>
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={verify.isPending}
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-60"
        >
          Verify email
        </button>
      </div>
    );
  }

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
          type="button"
          onClick={() => navigate("/onboarding/verify-email", { replace: true })}
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper shadow-md transition hover:bg-buzz-coralDark"
        >
          Request a new link
        </button>
      </div>
    );
  }

  // success — first-time verify → pending_approval; pending-swap keeps status
  // (active → portal, pending_approval → wait screen). Unauthenticated link
  // open without session mint: user null → login Continue.
  const successCopy =
    state.user?.status === "active"
      ? "Your school email is updated. You can continue using the org portal."
      : state.user?.status === "pending_approval"
        ? "Your school email is confirmed. Your account is awaiting admin approval."
        : "Thanks! Your account is now pending admin approval. We'll let you in as soon as a Buzz admin reviews it.";
  const continueTo = state.user ? pathForUser(state.user) : "/login";

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Email <span className="text-buzz-coral">Verified</span>
      </h1>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">{successCopy}</p>
      <button
        type="button"
        onClick={() => navigate(continueTo, { replace: true })}
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
  const location = useLocation();
  const resend = useResendVerification();
  const changeEmail = useChangeEduEmail();
  const [emailSent, setEmailSent] = useState(() =>
    readEmailSentFlag(location.state),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    emailSent
      ? null
      : "We could not send the verification email. Use Resend below to try again.",
  );
  const [showChange, setShowChange] = useState(false);
  const [newEmail, setNewEmail] = useState("");

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
      markEmailSent(true);
      setEmailSent(true);
      setNotice("Verification email re-sent. Check your inbox.");
    } catch (err) {
      markEmailSent(false);
      setEmailSent(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not re-send the email. Please try again later.",
      );
    }
  };

  const onChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);
    try {
      const result = await changeEmail.mutateAsync(newEmail.trim());
      await refreshUser();
      setShowChange(false);
      markEmailSent(true);
      setEmailSent(true);
      setNotice(`Verification email sent to ${result.emailSentTo}.`);
    } catch (err) {
      markEmailSent(false);
      setEmailSent(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not update your email. Please try again.",
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold text-buzz-ink">
        Verify Your <span className="text-buzz-coral">Email</span>
      </h1>
      <p className="mb-2 text-sm font-medium text-buzz-inkMuted">
        {emailSent
          ? "We sent a verification link to your school email. Click it to continue."
          : "Your profile is saved, but we could not send the verification email yet. Use Resend below when you are ready."}
      </p>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">{JUNK_HINT}</p>

      {notice && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => void onResend()}
        disabled={resend.isPending}
        className="rounded-lg border-2 border-buzz-coral px-6 py-3 text-sm font-bold text-buzz-coral transition enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resend.isPending ? "Sending…" : "Resend email"}
      </button>

      <div className="mt-6">
        {!showChange ? (
          <button
            type="button"
            onClick={() => setShowChange(true)}
            className="text-sm font-medium text-buzz-inkMuted underline-offset-2 hover:underline"
          >
            Wrong email? Change it
          </button>
        ) : (
          <form onSubmit={onChangeEmail} className="space-y-3 text-left">
            <label className="block text-sm font-medium text-buzz-ink">
              School email
              <input
                type="email"
                required
                value={newEmail}
                onChange={(ev) => setNewEmail(ev.target.value)}
                className="mt-1 w-full rounded-lg border border-buzz-ink/15 bg-buzz-paper px-3 py-2 text-sm"
                placeholder="you@university.edu"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={changeEmail.isPending}
                className="rounded-lg bg-buzz-coral px-4 py-2 text-sm font-bold text-buzz-paper disabled:opacity-60"
              >
                {changeEmail.isPending ? "Updating…" : "Update & resend"}
              </button>
              <button
                type="button"
                onClick={() => setShowChange(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-buzz-inkMuted"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

/** Post-apply waiting screen when the applicant has no session yet. */
function PublicAwaitVerification() {
  const location = useLocation();
  const publicResend = usePublicResendVerification();
  const [emailSent, setEmailSent] = useState(() =>
    readEmailSentFlag(location.state),
  );
  const [eduEmail, setEduEmail] = useState(() => readEduEmail(location.state));
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    emailSent
      ? null
      : "We could not send the verification email. Enter your school email below to try again.",
  );

  const onResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setError(null);
    const trimmed = eduEmail.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter the school email you used on your application.");
      return;
    }
    try {
      await publicResend.mutateAsync(trimmed);
      markEduEmail(trimmed);
      markEmailSent(true);
      setEmailSent(true);
      setNotice("Verification email re-sent. Check your inbox (and Junk).");
    } catch (err) {
      markEmailSent(false);
      setEmailSent(false);
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
      <p className="mb-2 text-sm font-medium text-buzz-inkMuted">
        {emailSent
          ? "We sent a verification link to your school email. Click it to continue."
          : "Enter your school email below to send or resend the verification link."}
      </p>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">{JUNK_HINT}</p>

      {notice && (
        <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm font-medium text-green-700">
          {notice}
        </p>
      )}

      <form onSubmit={(e) => void onResend(e)} className="space-y-3 text-left">
        <label className="block text-sm font-medium text-buzz-ink">
          School email
          <input
            type="email"
            required
            value={eduEmail}
            onChange={(ev) => setEduEmail(ev.target.value)}
            className="mt-1 w-full rounded-lg border border-buzz-ink/15 bg-buzz-paper px-3 py-2 text-sm"
            placeholder="you@university.edu"
          />
        </label>
        <button
          type="submit"
          disabled={publicResend.isPending}
          className="w-full rounded-lg border-2 border-buzz-coral px-6 py-3 text-sm font-bold text-buzz-coral transition enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
        >
          {publicResend.isPending ? "Sending…" : "Resend email"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
