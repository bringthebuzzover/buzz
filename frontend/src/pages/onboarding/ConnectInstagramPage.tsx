/**
 * /onboarding/connect-instagram — bind Instagram after admin Approve
 * (LAUNCH.md Phase A / PRODUCT §6.1). Status: pending_instagram.
 *
 * Approval email carries ?token= for one-shot session mint when the org has no
 * live cookie; then they start bind OAuth via bind-start.
 */
import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useInstagramBindStart,
  useRedeemOrgConnect,
} from "../../api/hooks/useOnboardingHooks";
import { authUserFromWire } from "../../api/auth";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";
import { allowlistedOAuthNext } from "../../utils/oauthNext";
import AuthPending from "../../components/auth/AuthPending";
import StatusHero from "../../components/site/StatusHero";
import { Button, ErrorBanner, LinkButton } from "../../components/forms/controls";
import { focusRingClass } from "../../theme/controls";
import { MOTION } from "../../theme/motion";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import type { components } from "../../api/generated/schema";

type UserWire = components["schemas"]["UserResponse"];

type RedeemState =
  | { kind: "idle" }
  | { kind: "redeeming" }
  | { kind: "error"; message: string };

export default function ConnectInstagramPage() {
  const { status, user, acceptSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get("token"));
  const next = allowlistedOAuthNext(searchParams.get("next"));
  const redeem = useRedeemOrgConnect();
  const bindStart = useInstagramBindStart();
  const [redeemState, setRedeemState] = useState<RedeemState>(() =>
    token ? { kind: "redeeming" } : { kind: "idle" },
  );
  const [connectError, setConnectError] = useState<string | null>(null);
  const redeemedRef = useRef(false);

  useEffect(() => {
    if (!token || redeemedRef.current) return;
    redeemedRef.current = true;
    void (async () => {
      try {
        const data = await redeem.mutateAsync(token);
        acceptSession(authUserFromWire(data.user as UserWire), data.access_token);
        setSearchParams(next ? { next } : {}, { replace: true });
        setRedeemState({ kind: "idle" });
      } catch (err) {
        setRedeemState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "This connect link is invalid or expired. Ask BUZZ to resend it.",
        });
      }
    })();
  }, [token, redeem, acceptSession, setSearchParams, next]);

  if (status === "idle" || status === "authenticating" || redeemState.kind === "redeeming") {
    return (
      <AuthPending
        label={
          redeemState.kind === "redeeming"
            ? "Opening your connect session…"
            : "Loading…"
        }
      />
    );
  }

  if (redeemState.kind === "error") {
    return (
      <StatusHero
        title="Connect Link Failed"
        action={
          <LinkButton to="/login" size="field">
            Organization login
          </LinkButton>
        }
      >
        {redeemState.message}
      </StatusHero>
    );
  }

  if (!user || user.status !== "pending_instagram") {
    if (user?.status === "active" && next) {
      return <Navigate to={next} replace />;
    }
    return <Navigate to={pathForUser(user)} replace />;
  }

  const onConnect = async () => {
    setConnectError(null);
    try {
      const { authorizeUrl } = await bindStart.mutateAsync(next);
      window.location.href = authorizeUrl;
    } catch (err) {
      setConnectError(
        err instanceof ApiError
          ? err.message
          : "Could not start Instagram connect. Please try again.",
      );
    }
  };

  return (
    <div
      className={cn(
        "mx-auto flex min-h-[560px] w-full max-w-[720px] flex-col items-center justify-center px-6 py-16 text-center",
        MOTION.publicEnter,
      )}
    >
      <div className="flex w-full max-w-[520px] flex-col items-center gap-6">
        <h1 className={cn(TEXT.title, "text-primary")}>Connect Instagram</h1>
        <p className="text-base leading-relaxed text-muted">
          Connect the organization&apos;s Instagram{" "}
          <span className="font-medium text-primary">Business or Creator</span>{" "}
          account — not a personal member profile. This binds your BUZZ account to
          that Instagram identity.
        </p>
        <p className="text-base leading-relaxed text-muted">
          First accept BUZZ&apos;s Instagram Tester invite at{" "}
          <a
            href="https://www.instagram.com/accounts/manage_access/"
            target="_blank"
            rel="noreferrer"
            className={cn("font-medium text-accent underline", focusRingClass)}
          >
            Instagram manage access
          </a>
          , then continue below.
        </p>
        <Button
          type="button"
          size="field"
          onClick={() => void onConnect()}
          disabled={bindStart.isPending}
        >
          {bindStart.isPending ? "Starting…" : "Connect with Instagram"}
        </Button>
        {connectError ? (
          <div className="w-full text-left">
            <ErrorBanner>{connectError}</ErrorBanner>
          </div>
        ) : null}
      </div>
    </div>
  );
}
