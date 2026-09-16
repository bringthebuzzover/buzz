/**
 * Public `/d/:dropId` — same-page signup or Apply (PRODUCT §6.3.4).
 *
 * No PortalGuard: pending orgs must open the brand link. Form mode follows
 * `useAuth()`. Notify Me stays feed-only.
 */
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";
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
import PageShell from "../../components/site/PageShell";
import { Card } from "../../components/ui/Card";
import { Chip } from "../../components/ui/Chip";
import { QueryStatePanel, StatePanel } from "../../components/ui/StatePanel";
import {
  Button,
  ErrorBanner,
  SuccessBanner,
  TextArea,
} from "../../components/forms/controls";
import { PAD, STACK, TEXT } from "../../theme/tokens";
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

  if (status === "restore_failed") {
    return <SessionRestorePanel />;
  }

  if (drop.isLoading || status === "authenticating" || status === "idle") {
    return (
      <PageShell width="form">
        <QueryStatePanel isPending isError={false} label="this drop" />
      </PageShell>
    );
  }

  if (dropNotAvailable(drop.error)) {
    return (
      <PageShell width="form">
        <StatePanel tone="danger" title="Drop unavailable">
          This drop isn&apos;t available.
        </StatePanel>
      </PageShell>
    );
  }

  if (drop.isError || !drop.data || !dropId) {
    return (
      <PageShell width="form">
        <QueryStatePanel
          isPending={false}
          isError
          label="this drop"
        />
      </PageShell>
    );
  }

  const data = drop.data;
  const feedStatus = getDropFeedStatus(data, data.acceptedCount, now);
  const loginHref = `/login?next=${encodeURIComponent(publicDropPath(dropId))}`;
  const nextPath = allowlistedOAuthNext(publicDropPath(dropId));
  const anonymous = status === "error";
  const orgUser = status === "authenticated" && user?.portalRole === "org";
  const activeOrg = orgUser && user.status === "active";
  const pendingOrg =
    orgUser &&
    user.status !== "active" &&
    user.status !== "denied" &&
    user.status !== "erased";

  return (
    <PageShell width="form">
      <PublicDropHero drop={data} feedStatus={feedStatus} />

      {status === "needs_instagram_reconnect" ? (
        <>
          <StatePanel>
            Reconnect Instagram to apply from your org account.
          </StatePanel>
          <div className="mb-6 flex justify-center">
            <Button type="button" variant="outline" onClick={() => login(nextPath)}>
              Reconnect
            </Button>
          </div>
        </>
      ) : null}

      {feedStatus !== "open" ? (
        <p className={cn(TEXT.body, "mb-6 text-center text-buzz-inkMuted")}>
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
        <PendingOrgActions dropId={dropId} drop={data} feedStatus={feedStatus} />
      ) : null}

      {status === "authenticated" && user?.portalRole !== "org" && feedStatus === "open" ? (
        <p className={cn(TEXT.body, "mb-6 text-center text-buzz-inkMuted")}>
          Sign in as a student organization to apply.
        </p>
      ) : null}

      {anonymous && feedStatus === "open" ? (
        <>
          <h2 className={cn(TEXT.h2, "mb-2 text-center")}>
            Request to join Buzz and apply
          </h2>
          <p className={cn(TEXT.body, "mb-6 text-center text-buzz-inkMuted")}>
            Same application as joining Buzz. We&apos;ll submit this drop when
            your org is approved and connected — you&apos;re not applied yet.
          </p>
          <OrgApplyForm
            dropId={dropId}
            submitLabel="Request to join Buzz and apply"
            loginHref={loginHref}
            onSuccess={(result, eduEmail) => {
              goToVerifyEmailWait(navigate, result, eduEmail, {
                dropIntent: true,
              });
            }}
          />
        </>
      ) : null}

      {anonymous && feedStatus !== "open" ? (
        <p className="text-center text-sm font-medium text-buzz-inkMuted">
          Already on Buzz?{" "}
          <Link
            to={loginHref}
            className="font-semibold text-buzz-coral hover:underline"
          >
            Org login
          </Link>
        </p>
      ) : null}
    </PageShell>
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

  return (
    <Card kind="cardWarm" pad="none" className="mb-8 overflow-hidden">
      <div className="relative h-48 overflow-hidden border-b border-buzz-lineMid">
        <img
          src={drop.image}
          alt={drop.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <Chip accent>{drop.brandName}</Chip>
          <Chip tone={feedStatus === "open" ? "success" : "neutral"}>
            {feedStatus === "upcoming"
              ? "Upcoming"
              : feedStatus === "open"
                ? "Open"
                : "Closed"}
          </Chip>
        </div>
      </div>
      <div className={PAD.card}>
        <h1 className={cn(TEXT.h1, "mb-2 leading-tight text-buzz-coral")}>
          {drop.title}
        </h1>
        <p className={cn(TEXT.body, "mb-4 text-buzz-inkMuted")}>
          {drop.description}
        </p>
        <div className={cn(TEXT.meta, "flex flex-wrap items-center gap-4 font-semibold")}>
          <span className="flex items-center gap-1">
            <MapPin size={14} className="text-buzz-coral" />
            {drop.location}
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={14} className="text-buzz-coral" />
            {spots}
          </span>
        </div>
      </div>
    </Card>
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
  feedStatus,
}: {
  dropId: string;
  drop: DropDetail;
  feedStatus: "upcoming" | "open" | "closed";
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
          The apply window closed before your org was fully set up. Buzz still
          has this attempt — you&apos;re not an applicant.
        </StatePanel>
      ) : (
        <SuccessBanner>
          We&apos;ll submit when your org is approved and connected. You&apos;re
          not applied yet.
        </SuccessBanner>
      )}
      {feedStatus === "upcoming" && !expired ? (
        <p className={cn(TEXT.meta, "text-center")}>
          This drop is still upcoming — we&apos;ll submit when it opens and your
          account is live.
        </p>
      ) : null}
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
            className="font-semibold text-buzz-coral hover:underline"
          >
            Continue onboarding
          </Link>
        </p>
      ) : null}
    </div>
  );
}
