/**
 * Public `/d/:dropId` — Instagram-first signup or Apply (PRODUCT §6.3.4).
 *
 * No PortalGuard: pending orgs must open the brand link. Entry mode follows
 * `useAuth()`. Notify Me stays feed-only.
 */
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useDropDetail,
  usePatchDropIntent,
  type DropDetail,
} from "../../api/hooks/useDropHooks";
import { ApiError } from "../../api/errors";
import { closedChipLabel, getDropFeedStatus, isDropFull } from "../../utils/dropStatus";
import { allowlistedOAuthNext, publicDropPath } from "../../utils/oauthNext";
import { pathForUser } from "../../utils/landing";
import { DROP_PITCH_MAX_LENGTH, readDropPitch, saveDropPitch } from "../../utils/dropSignup";
import DropApplyForm from "../../components/org/DropApplyForm";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import StatusHero, { HomeLoginActions } from "../../components/site/StatusHero";
import { Chip } from "../../components/ui/Chip";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import {
  Button,
  ErrorBanner,
  LinkButton,
  SuccessBanner,
  TextArea,
} from "../../components/forms/controls";
import { PAD, STACK, SURFACE, TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import { MOTION } from "../../theme/motion";

function dropNotAvailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === "DROP_NOT_OPEN";
}

export default function PublicDropPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const { status, user, login } = useAuth();
  const drop = useDropDetail(dropId);

  if (drop.isLoading || status === "authenticating" || status === "idle") {
    return (
      <div className="px-4 py-16 text-primary">
        <QueryStatePanel isPending isError={false} label="this drop" />
      </div>
    );
  }

  if (dropNotAvailable(drop.error)) {
    return (
      <div>
        <StatusHero title="Drop unavailable" action={<HomeLoginActions />}>
          This drop isn&apos;t available.
        </StatusHero>
      </div>
    );
  }

  if (drop.isError || !drop.data || !dropId) {
    return (
      <div className="px-4 py-16 text-primary">
        <QueryStatePanel isPending={false} isError label="this drop" />
      </div>
    );
  }

  const data = drop.data;
  const feedStatus = getDropFeedStatus(data.stage, isDropFull(data, data.acceptedCount));
  const loginHref = `/login?next=${encodeURIComponent(publicDropPath(dropId))}`;
  const nextPath = allowlistedOAuthNext(publicDropPath(dropId));

  if (status === "restore_failed") {
    return (
      <div className="text-primary">
        <PublicDropLayout drop={data} feedStatus={feedStatus}>
          <SessionRestorePanel embedded />
        </PublicDropLayout>
      </div>
    );
  }

  const anonymous = status === "error";
  const orgUser = status === "authenticated" && user?.portalRole === "org";
  const reconnectRequired = orgUser && user.instagramReconnectRequired;
  const activeOrg = orgUser && user.status === "active" && !reconnectRequired;
  const pendingOrg =
    orgUser &&
    user.status !== "pending_org_profile" &&
    user.status !== "active" &&
    user.status !== "denied" &&
    user.status !== "erased";

  return (
    <div className="text-primary">
      <PublicDropLayout drop={data} feedStatus={feedStatus}>
      {status === "needs_instagram_reconnect" ? (
        <>
          <StatePanel className="mb-4">
            Reconnect Instagram to apply from your organization account.
          </StatePanel>
          <div className="mb-6 flex justify-center">
            <Button type="button" variant="outline" onClick={() => login(nextPath)}>
              Reconnect
            </Button>
          </div>
        </>
      ) : null}

      {feedStatus !== "open" ? (
        <p className={cn(TEXT.body, "mb-6 text-center text-muted")}>
          {feedStatus === "upcoming"
            ? "Applications aren't open yet."
            : "Applications are closed."}
        </p>
      ) : null}

      {reconnectRequired ? (
        <>
          <StatePanel className="mb-4">
            Reconnect Instagram to apply from your organization account.
          </StatePanel>
          <div className="mb-6 flex justify-center">
            <LinkButton to={pathForUser(user, nextPath)}>Connect Instagram</LinkButton>
          </div>
        </>
      ) : null}

      {activeOrg ? (
        <ActiveOrgActions
          dropId={dropId}
          feedStatus={feedStatus}
          alreadyApplied={data.alreadyApplied}
        />
      ) : null}

      {pendingOrg ? (
        <PendingOrgActions dropId={dropId} drop={data} />
      ) : null}

      {status === "authenticated" && user?.portalRole !== "org" && feedStatus === "open" ? (
        <p className={cn(TEXT.body, "mb-6 text-center text-muted")}>
          Sign in as a student organization to apply.
        </p>
      ) : null}

      {(anonymous || (orgUser && user.status === "pending_org_profile")) && feedStatus === "open" ? (
        <DropSignupEntry key={dropId} nextPath={nextPath!} />
      ) : null}

      {anonymous && feedStatus !== "open" ? (
        <p className="text-sm text-muted">
          Already on Buzz?{" "}
          <Link to={loginHref} className={cn("text-accent hover:underline hover:text-buzz-yellowHover inline-block", MOTION.press, focusRingClass)}>
            Organization login
          </Link>
        </p>
      ) : null}
      </PublicDropLayout>
    </div>
  );
}

function DropSignupEntry({ nextPath }: { nextPath: string }) {
  const { user, login } = useAuth();
  const [pitch, setPitch] = useState(() => readDropPitch(nextPath));
  const [error, setError] = useState<string | null>(null);
  const save = () => {
    try {
      saveDropPitch(nextPath, pitch);
      return true;
    } catch {
      setError("Could not save your pitch. Enable session storage and try again.");
      return false;
    }
  };
  return (
    <div className={cn(SURFACE.card, PAD.card, "flex flex-col gap-5")}>
      <h2 className={TEXT.h3}>Join BUZZ and apply</h2>
      <p className={cn(TEXT.body, "text-muted")}>
        Connect an Instagram Business or Creator account, then complete your campus profile.
        We&apos;ll submit this drop when your organization is approved. You&apos;re not applied yet.
      </p>
      <TextArea
        label="Pitch (optional)"
        data-testid="public-drop-pitch"
        placeholder="e.g. We host weekly mixers and can staff a table at the student center"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        maxLength={DROP_PITCH_MAX_LENGTH}
        rows={4}
      />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {user?.status === "pending_org_profile" ? (
        <LinkButton to={pathForUser(user, nextPath)} onClick={(e) => { if (!save()) e.preventDefault(); }}>
          Continue onboarding
        </LinkButton>
      ) : (
        <Button type="button" onClick={() => { if (save()) login(nextPath); }}>
          Continue with Instagram
        </Button>
      )}
    </div>
  );
}

/** Spots line and status chip for the hero and the facts list. */
function statusCopy(drop: DropDetail, feedStatus: "upcoming" | "open" | "closed") {
  const remaining = Math.max(0, drop.capacityTotal - drop.acceptedCount);
  if (feedStatus === "upcoming") return { spots: "Opens soon", tone: "Upcoming" };
  if (feedStatus === "open") {
    const spots =
      drop.acceptedCount === 0
        ? `Up to ${drop.capacityTotal} spots`
        : `${remaining} of ${drop.capacityTotal} spots remaining`;
    return { spots, tone: "Open" };
  }
  return { spots: "Applications closed", tone: closedChipLabel(drop.stage) };
}

function PublicDropHero({
  drop,
  feedStatus,
}: {
  drop: DropDetail;
  feedStatus: "upcoming" | "open" | "closed";
}) {
  const { spots, tone } = statusCopy(drop, feedStatus);

  return (
    <div className="relative aspect-square overflow-hidden rounded-buzzBoard bg-buzz-greyMedia">
      <RemoteImage
        src={drop.image}
        label={drop.brandName}
        alt=""
        fallback="blank"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Top subtle vignette for chip & spots readability on light backgrounds */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 via-black/40 to-transparent"
        aria-hidden
      />
      {/* Anchored bottom vignette for guaranteed AAA text contrast on any brand packaging */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 via-45% to-transparent to-75%"
        aria-hidden
      />
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-8">
        <Chip accent>{tone}</Chip>
        <span className="ml-auto text-sm font-medium text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {spots}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-8">
        <p className="text-sm font-medium uppercase tracking-[0.05em] text-white/75 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
          {drop.brandName}
        </p>
        <p className="mt-1 text-[36px] font-medium leading-none text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] md:text-buzzTitle">
          {drop.title}
        </p>
      </div>
    </div>
  );
}

function PublicDropLayout({
  drop,
  feedStatus,
  children,
}: {
  drop: DropDetail;
  feedStatus: "upcoming" | "open" | "closed";
  children: ReactNode;
}) {
  const { spots, tone } = statusCopy(drop, feedStatus);

  return (
    <div className="mx-auto grid max-w-[1440px] items-start gap-10 px-4 py-12 md:grid-cols-2 md:gap-14 md:px-12 md:py-16">
      <PublicDropHero drop={drop} feedStatus={feedStatus} />
      <div>
        <p className="text-xs font-medium text-accent">Drop</p>
        <h1 className="mt-2 text-[28px] font-medium leading-tight md:text-buzzH2">{drop.title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted">{drop.description}</p>
        <dl className="mt-6 divide-y divide-line border-y border-line">
          <Fact label="Where" value={drop.location} />
          <Fact label="Spots" value={spots} />
          <Fact label="Status" value={tone === "Open" ? "Accepting applications" : tone} />
        </dl>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-primary">{value}</dd>
    </div>
  );
}

function ActiveOrgActions({
  dropId,
  feedStatus,
  alreadyApplied,
}: {
  dropId: string;
  feedStatus: "upcoming" | "open" | "closed";
  alreadyApplied: boolean;
}) {
  const [applying, setApplying] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (feedStatus !== "open") return null;

  if (submitted) {
    return (
      <div className={cn(STACK.default, "w-full")}>
        <SuccessBanner>Application submitted. You can follow it in My Campaigns.</SuccessBanner>
        <LinkButton to="/org/campaigns" fullWidth>
          My Campaigns
        </LinkButton>
      </div>
    );
  }

  if (alreadyApplied) {
    return (
      <div className={cn(STACK.default, "w-full")}>
        <Button type="button" fullWidth disabled data-testid="apply-button">
          Already applied
        </Button>
        <LinkButton to="/org/campaigns" fullWidth>
          My Campaigns
        </LinkButton>
      </div>
    );
  }

  if (applying) {
    return (
      <DropApplyForm
        dropId={dropId}
        onCancel={() => setApplying(false)}
        onSuccess={() => {
          setApplying(false);
          setSubmitted(true);
        }}
      />
    );
  }

  return (
    <Button
      type="button"
      fullWidth
      data-testid="apply-button"
      onClick={() => setApplying(true)}
    >
      Apply
    </Button>
  );
}

function PendingOrgActions({
  dropId,
  drop,
}: {
  dropId: string;
  drop: DropDetail;
}) {
  const patch = usePatchDropIntent(dropId);
  const [pitch, setPitch] = useState(drop.intentPitch ?? "");
  const [notice, setNotice] = useState<string | null>(null);
  const expired = drop.intentStatus === "expired";
  const { user } = useAuth();
  const connectHref = pathForUser(user, publicDropPath(dropId));

  const onSave = async () => {
    setNotice(null);
    try {
      await patch.mutateAsync(pitch.trim() || null);
      setNotice("Saved.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save pitch.");
    }
  };

  return (
    <div className={cn(STACK.default, "mb-6")}>
      {expired ? (
        <StatePanel>
          The apply window closed before your organization was fully set up. Buzz still
          has this attempt — you&apos;re not an applicant.
        </StatePanel>
      ) : (
        <SuccessBanner>
          We&apos;ll submit when your organization is approved and connected. You&apos;re
          not applied yet.
        </SuccessBanner>
      )}
      <TextArea
        data-testid="intent-pitch"
        label="Pitch (optional)"
        placeholder="e.g. We host weekly mixers and can staff a table at the student center"
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={4}
        maxLength={DROP_PITCH_MAX_LENGTH}
      />
      <Button
        type="button"
        data-testid="intent-pitch-save"
        onClick={() => void onSave()}
        disabled={patch.isPending}
      >
        {patch.isPending ? "Saving…" : "Save pitch"}
      </Button>
      {notice ? (
        notice === "Saved." ? (
          <SuccessBanner>{notice}</SuccessBanner>
        ) : (
          <ErrorBanner>{notice}</ErrorBanner>
        )
      ) : null}
      {drop.intentStatus !== "promoted" ? (
        <p className={cn(TEXT.meta, "text-center")}>
          Still finishing setup?{" "}
          <Link
            to={connectHref}
            className={cn("font-semibold text-accent hover:underline", focusRingClass)}
          >
            Continue onboarding
          </Link>
        </p>
      ) : null}
    </div>
  );
}
