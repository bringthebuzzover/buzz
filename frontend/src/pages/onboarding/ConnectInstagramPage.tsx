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
import instagramIcon from "../../assets/insta-icon.png";
import AuthShell from "../../components/site/AuthShell";
import { Button, ErrorBanner, LinkButton } from "../../components/forms/controls";
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
        setSearchParams({}, { replace: true });
        setRedeemState({ kind: "idle" });
      } catch (err) {
        setRedeemState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "This connect link is invalid or expired. Ask Buzz to resend it.",
        });
      }
    })();
  }, [token, redeem, acceptSession, setSearchParams]);

  if (status === "idle" || status === "authenticating" || redeemState.kind === "redeeming") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm font-medium text-buzz-inkMuted">
          {redeemState.kind === "redeeming"
            ? "Opening your connect session…"
            : "Loading..."}
        </p>
      </div>
    );
  }

  if (redeemState.kind === "error") {
    return (
      <AuthShell align="center" className="text-center">
        <h1 className={cn(TEXT.h1, "mb-4 text-buzz-danger")}>
          Connect Link Failed
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          {redeemState.message}
        </p>
        <LinkButton to="/login">Org login</LinkButton>
      </AuthShell>
    );
  }

  if (!user || user.status !== "pending_instagram") {
    return <Navigate to={pathForUser(user)} replace />;
  }

  const onConnect = async () => {
    setConnectError(null);
    try {
      const { authorizeUrl } = await bindStart.mutateAsync();
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
    <AuthShell align="center" className="items-center text-center">
      <h1 className={cn(TEXT.h1, "mb-4 text-buzz-ink")}>
        Connect <span className="text-buzz-coral">Instagram</span>
      </h1>
      <p className="mb-4 text-sm font-medium text-buzz-inkMuted">
        Connect the organization&apos;s Instagram{" "}
        <span className="font-semibold text-buzz-ink">Business or Creator</span>{" "}
        account — not a personal member profile. This binds your Buzz account to
        that Instagram identity.
      </p>
      <p className="mb-8 text-sm font-medium text-buzz-inkMuted">
        First accept Buzz&apos;s Instagram Tester invite at{" "}
        <a
          href="https://www.instagram.com/accounts/manage_access/"
          target="_blank"
          rel="noreferrer"
          className="font-bold text-buzz-coral hover:underline"
        >
          Instagram manage access
        </a>
        , then continue below.
      </p>

      <Button
        type="button"
        variant="outline"
        size="hero"
        onClick={() => void onConnect()}
        disabled={bindStart.isPending}
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {bindStart.isPending ? "Starting…" : "Connect with Instagram"}
      </Button>

      {connectError && (
        <div className="mt-4 w-full">
          <ErrorBanner>{connectError}</ErrorBanner>
        </div>
      )}
    </AuthShell>
  );
}
