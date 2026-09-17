/**
 * /auth/instagram/callback — exchanges the OAuth `code` + `state` query params
 * for a JWT session via POST /api/auth/instagram/callback.
 *
 * On success: stores access token, sets user, redirects to portal landing.
 * On failure: shows error message with retry link.
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { setAccessToken, clearInstagramReconnectLatch } from "../../api/auth";
import { API_BASE_URL } from "../../api/config";
import {
  INSTAGRAM_CALLBACK_MISSING,
  INSTAGRAM_CALLBACK_OFFLINE,
  instagramCallbackFailureCopy,
  type InstagramCallbackCopy,
} from "../../utils/instagramCallbackCopy";
import AuthShell from "../../components/site/AuthShell";
import { LinkButton } from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { allowlistedOAuthNext } from "../../utils/oauthNext";

type CallbackState =
  | { kind: "exchanging" }
  | ({ kind: "error" } & InstagramCallbackCopy);

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
      setState({ kind: "error", ...INSTAGRAM_CALLBACK_MISSING });
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
          const errCode = body?.error?.code as string | undefined;
          // Denied orgs must reach the denial screen even without a session.
          if (errCode === "ACCOUNT_DENIED") {
            window.location.href = "/onboarding/denied";
            return;
          }
          setState({
            kind: "error",
            ...instagramCallbackFailureCopy(
              errCode,
              typeof body?.error?.message === "string"
                ? body.error.message
                : undefined,
            ),
          });
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
        const next = allowlistedOAuthNext(
          typeof body.data?.next === "string" ? body.data.next : null,
        );
        window.location.href = next ?? "/org/browse";
      } catch {
        setState({ kind: "error", ...INSTAGRAM_CALLBACK_OFFLINE });
      }
    };
    void exchange();
  }, [searchParams]);

  if (state.kind === "exchanging") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">
          Completing login...
        </p>
      </div>
    );
  }

  return (
    <AuthShell align="center" className="items-center text-center">
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-danger")}>
        {state.title}
      </h1>
      <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
        {state.body}
      </p>
      {state.applyRequired ? (
        <LinkButton to="/org/apply">
          Apply as a student organization
        </LinkButton>
      ) : (
        <LinkButton to="/login">Try Again</LinkButton>
      )}
    </AuthShell>
  );
}
