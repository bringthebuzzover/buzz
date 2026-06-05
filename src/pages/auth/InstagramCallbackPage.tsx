/**
 * /auth/instagram/callback — exchanges the OAuth `code` + `state` query params
 * for a JWT session via POST /api/auth/instagram/callback.
 *
 * On success: stores access token, sets user, redirects to portal landing.
 * On failure: shows error message with retry link.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { setAccessToken } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";

type CallbackState =
  | { kind: "exchanging" }
  | { kind: "error"; message: string };

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
          const msg =
            body?.error?.message ?? `Instagram login failed (${resp.status}).`;
          setState({ kind: "error", message: msg });
          return;
        }
        const body = await resp.json();
        if (body.data?.accessToken) {
          setAccessToken(body.data.accessToken);
        }
        // Redirect to home — AuthProvider will re-fetch /me on next mount
        window.location.href = "/";
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
      <Link
        to="/login"
        className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
      >
        Try Again
      </Link>
    </div>
  );
}
