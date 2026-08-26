/**
 * /onboarding/connect-instagram — bind Instagram after admin Approve
 * (LAUNCH.md Phase A / PRODUCT §6.1). Status: pending_instagram.
 *
 * Approval email carries ?token= for one-shot session mint when the org has no
 * live cookie; then they start bind OAuth via bind-start.
 */
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useInstagramBindStart,
  useRedeemOrgConnect,
} from "../../api/hooks/useOnboardingHooks";
import { authUserFromWire } from "../../api/auth";
import { ApiError } from "../../api/client";
import { pathForUser } from "../../utils/landing";
import instagramIcon from "../../assets/insta-icon.png";
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
      <div className="flex min-h-[60vh] items-center justify-center">
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
      <div className="mx-auto max-w-md px-8 py-24 text-center">
        <h1 className="mb-4 text-3xl font-bold text-buzz-coral">
          Connect Link Failed
        </h1>
        <p className="mb-6 text-sm font-medium text-buzz-inkMuted">
          {redeemState.message}
        </p>
        <Link
          to="/login"
          className="rounded-lg bg-buzz-coral px-6 py-3 text-sm font-bold text-buzz-paper transition hover:bg-buzz-coralDark"
        >
          Org login
        </Link>
      </div>
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
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-8 py-24 text-center">
      <h1 className="mb-4 text-3xl font-black text-buzz-ink">
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

      <button
        type="button"
        onClick={() => void onConnect()}
        disabled={bindStart.isPending}
        className="flex items-center gap-3 rounded-xl border-2 border-buzz-coral bg-buzz-paper px-8 py-4 text-base font-bold text-buzz-coral shadow-sm transition hover:bg-buzz-coral hover:text-buzz-paper disabled:cursor-not-allowed disabled:opacity-60"
      >
        <img src={instagramIcon} alt="" className="h-5 w-5" />
        {bindStart.isPending ? "Starting…" : "Connect with Instagram"}
      </button>

      {connectError && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
          {connectError}
        </p>
      )}
    </div>
  );
}
