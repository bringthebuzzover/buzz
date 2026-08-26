/**
 * /auth/instagram/callback — exchanges the OAuth `code` + `state` query params
 * for a JWT session via POST /api/auth/instagram/callback.
 *
 * On success: stores access token, sets user, redirects to portal landing.
 * On failure: shows error message with retry link.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { setAccessToken, clearInstagramReconnectLatch } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";

type CallbackState =
  | { kind: "exchanging" }
  | { kind: "error"; message: string; applyRequired?: boolean };

export default function InstagramCallbackPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>({ kind: "exchanging" });
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get("code");
    const st = searchParams.get("state");

    if (!code || !st) {
      setState({
        kind: "error",
        message: "Missing code or state parameter. Please try logging in again.",
      });
      return;
    }

    const exchange = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/auth/instagram/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code, state: st }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          const code = body?.error?.code as string | undefined;
          // Denied orgs must reach the denial screen even without a session.
          if (code === "ACCOUNT_DENIED") {
            window.location.href = "/onboarding/denied";
            return;
          }
          if (code === "ORG_APPLY_REQUIRED") {
            setState({
              kind: "error",
              message:
                "Buzz doesn't create accounts from Instagram login anymore. Apply as a student organization first, then connect Instagram after approval.",
              applyRequired: true,
            });
            return;
          }
          const msg =
            body?.error?.message ?? `Instagram login failed (${resp.status}).`;
          setState({ kind: "error", message: msg });
          return;
        }
        const body = await resp.json();
        // Backend TokenResponse serializes snake_case (access_token); accept
        // camelCase too in case the contract is camelized later.
        const token = body.data?.access_token ?? body.data?.accessToken;
        if (token) {
          setAccessToken(token);
        }
        clearInstagramReconnectLatch();
        // Land on the org portal, not the public home: a full reload re-runs the
        // AuthProvider bootstrap, and the guard chain (RequireAuth → RequireStatus
        // → RequireRole) forwards a pending org to the right onboarding step and
        // an active org to the feed — a status-aware landing per architecture §3.4.
        window.location.href = "/org/browse";
      } catch {
        setState({
          kind: "error",
          message: "Could not reach the server. Please try again.",
        });
      }
    };
    void exchange();
  }, [searchParams]);

  if (state.kind === "exchanging") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">
          Completing login...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="mb-4 text-2xl font-black text-buzz-coral">
        Login Failed
      </h1>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
        {state.message}
      </p>
      {state.applyRequired ? (
        <Link
          to="/org/apply"
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
        >
          Apply as a student organization
        </Link>
      ) : (
        <Link
          to="/login"
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
        >
          Try Again
        </Link>
      )}
    </div>
  );
}
