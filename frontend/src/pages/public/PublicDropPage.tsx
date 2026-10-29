/**
 * Public `/d/:dropId` — same-page signup or Apply (PRODUCT §6.3.4).
 *
 * No PortalGuard: pending orgs must open the brand link. Form mode follows
 * `useAuth()`. Notify Me stays feed-only.
 */
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  useDropDetail,
  usePatchDropIntent,
  type DropDetail,
} from "../../api/hooks/useDropHooks";
import { ApiError } from "../../api/errors";
import { getDropFeedStatus } from "../../utils/dropStatus";
import { useWallClockNow } from "../../utils/wallClock";
import { allowlistedOAuthNext, publicDropPath } from "../../utils/oauthNext";
import OrgApplyForm, {
  goToVerifyEmailWait,
} from "../../components/org/OrgApplyForm";
import DropApplyForm from "../../components/org/DropApplyForm";
import SessionRestorePanel from "../../components/routing/SessionRestorePanel";
import StatusHero, { HomeLoginActions } from "../../components/site/StatusHero";
import { Chip } from "../../components/ui/Chip";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import {
  Button,
  ErrorBanner,
  SuccessBanner,
  TextArea,
} from "../../components/forms/controls";
import { PAD, STACK, SURFACE, TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

function dropNotAvailable(error: unknown): boolean {
  return error instanceof ApiError && error.code === "DROP_NOT_OPEN";
}

export default function PublicDropPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const { status, user, login } = useAuth();
  const drop = useDropDetail(dropId);
  const now = useWallClockNow();
  const navigate = useNavigate();

  if (drop.isLoading || status === "authenticating" || status === "idle") {
    return (
      <div className="bg-page px-4 py-16 text-primary">
        <QueryStatePanel isPending isError={false} label="this drop" />
      </div>
    );
  }

  if (dropNotAvailable(drop.error)) {
    return (
      <div className="bg-page">
        <StatusHero title="Drop unavailable" action={<HomeLoginActions />}>
          This drop isn&apos;t available.
        </StatusHero>
      </div>
    );
  }

  if (drop.isError || !drop.data || !dropId) {
    return (
      <div className="bg-page px-4 py-16 text-primary">
        <QueryStatePanel isPending={false} isError label="this drop" />
      </div>
    );
  }

  const data = drop.data;
  const feedStatus = getDropFeedStatus(data, data.acceptedCount, now);
  const loginHref = `/login?next=${encodeURIComponent(publicDropPath(dropId))}`;
  const nextPath = allowlistedOAuthNext(publicDropPath(dropId));

  if (status === "restore_failed") {
    return (
      <div className="bg-page text-primary">
        <PublicDropLayout drop={data} feedStatus={feedStatus}>
          <SessionRestorePanel embedded />
        </PublicDropLayout>
      </div>
    );
  }

  const anonymous = status === "error";
  const orgUser = status === "authenticated" && user?.portalRole === "org";
  const activeOrg = orgUser && user.status === "active";
  const pendingOrg =
    orgUser &&
    user.status !== "active" &&
    user.status !== "denied" &&
    user.status !== "erased";

  return (
    <div className="bg-page text-primary">
      <PublicDropLayout drop={data} feedStatus={feedStatus}>
      {status === "needs_instagram_reconnect" ? (
        <>
          <StatePanel>
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

      {anonymous && feedStatus === "open" ? (
        <div className={cn(SURFACE.card, PAD.card, "flex flex-col gap-5")}>
          <div className="flex flex-col gap-2">
            <h2 className={TEXT.h3}>Request to join BUZZ and apply</h2>
            <p className={cn(TEXT.body, "text-muted")}>
              Same application as joining Buzz. We&apos;ll submit this drop when
              your organization is approved and connected — you&apos;re not applied yet.
            </p>
          </div>
          <OrgApplyForm
            dropId={dropId}
            paired
            className="space-y-4"
            submitLabel="Request to join Buzz and apply"
            loginHref={loginHref}
            onSuccess={(result, eduEmail) => {
              goToVerifyEmailWait(navigate, result, eduEmail, {
                dropIntent: true,
              });
            }}
          />
        </div>
      ) : null}

      {anonymous && feedStatus !== "open" ? (
        <p className="text-sm text-muted">
          Already on Buzz?{" "}
          <Link to={loginHref} className={cn("text-accent", focusRingClass)}>
            Organization login
          </Link>
        </p>
      ) : null}
      </PublicDropLayout>
    </div>
  );
}

function PublicDropHero({
  drop,
  feedStatus,
}: {
  drop: DropDetail;
  feedStatus: "upcoming" | "open" | "closed";
}) {
  const remaining = Math.max(0, drop.capacityTotal - drop.acceptedCount);
  const spots =
    feedStatus === "upcoming"
      ? "Opens soon"
      : feedStatus === "open"
        ? drop.acceptedCount === 0
          ? `Up to ${drop.capacityTotal} spots`
          : `${remaining} of ${drop.capacityTotal} spots remaining`
        : "Closed";

  const tone =
    feedStatus === "upcoming" ? "Upcoming" : feedStatus === "open" ? "Open" : "Closed";

  return (
    <div className="relative aspect-square overflow-hidden rounded-buzzBoard bg-buzz-greyMedia">
      <RemoteImage
        src={drop.image}
        label={drop.brandName}
        alt=""
        fallback="blank"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-page via-page/25 to-page/30" />
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 p-8">
        <Chip accent>{tone}</Chip>
        <span className="ml-auto text-sm text-primary">{spots}</span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-8">
        <p className="text-sm font-medium text-muted">{drop.brandName}</p>
        <p className="text-[36px] font-medium leading-none text-primary md:text-buzzTitle">
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
  const remaining = Math.max(0, drop.capacityTotal - drop.acceptedCount);
  const spots =
    feedStatus === "upcoming"
      ? "Opens soon"
      : feedStatus === "open"
        ? drop.acceptedCount === 0
          ? `Up to ${drop.capacityTotal} spots`
          : `${remaining} of ${drop.capacityTotal} spots remaining`
        : "Closed";
  const tone =
    feedStatus === "upcoming" ? "Upcoming" : feedStatus === "open" ? "Open" : "Closed";

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

  if (feedStatus !== "open") return null;

  if (alreadyApplied) {
    return (
      <Button type="button" fullWidth disabled data-testid="apply-button">
        Already applied
      </Button>
    );
  }

  if (applying) {
    return (
      <DropApplyForm
        dropId={dropId}
        onCancel={() => setApplying(false)}
        onSuccess={() => setApplying(false)}
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
  const connectHref = `/onboarding/connect-instagram?next=${encodeURIComponent(publicDropPath(dropId))}`;

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
        value={pitch}
        onChange={(e) => setPitch(e.target.value)}
        rows={4}
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
