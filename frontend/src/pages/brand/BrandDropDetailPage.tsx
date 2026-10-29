/**
 * `/brand/drops/:dropId` — per-drop detail.
 *
 * Renders from the real backend (GET /api/brands/me/drops/:id).
 */
import { Navigate, useParams } from "react-router-dom";
import BrandDropTrackerStepper from "../../components/brand/BrandDropTrackerStepper";
import ApiDropOrgTable, {
  AddressPending,
} from "../../components/brand/ApiDropOrgTable";
import DropKPISummary from "../../components/brand/DropKPISummary";
import DropStageBadge from "../../components/brand/DropStageBadge";
import {
  useBrandDropDetail,
  usePatchBrandDropCreative,
  useSendDecisions,
  useSetSeatDecision,
} from "../../api/hooks/useBrandHooks";
import type { BrandDropDetail, BrandDropApplicant } from "../../api/hooks/useBrandHooks";
import { ApiError } from "../../api/errors";
import { useMemo, useState } from "react";
import { orgCategoryLabel } from "../../types/orgCategory";
import {
  SeatDecisionSelect,
  SendDecisionsBar,
  type SeatDecision,
} from "../../components/drop/SeatDecisions";
import PageShell from "../../components/site/PageShell";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, Loader } from "../../components/ui/EmptyState";
import { BackLink, PageHeader } from "../../components/ui/PageHeader";
import { StatePanel } from "../../components/ui/StatePanel";
import { Table, TBody, THead, Td, Th, Tr } from "../../components/ui/Table";
import {
  Button,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { STACK, SURFACE, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { useMdUp } from "../../hooks/useMdUp";
import CopyPublicDropUrl from "../../components/drop/CopyPublicDropUrl";

const backLink = <BackLink to="/brand/dashboard">Back to dashboard</BackLink>;

/**
 * Applicants still waiting on a sent decision. Each change saves a private
 * draft; "Send decisions" emails the orgs and locks those seats.
 */
function ApiApplicantTable({
  applicants,
  dropId,
  capacityTotal,
  totalProductUnits,
}: {
  applicants: BrandDropApplicant[];
  dropId: string;
  capacityTotal: number;
  totalProductUnits: number | null | undefined;
}) {
  const mdUp = useMdUp();
  const decide = useSetSeatDecision(dropId);
  const send = useSendDecisions(dropId);
  const showUnits = totalProductUnits != null;
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const open = useMemo(
    () => applicants.filter((a) => a.decisionSentAt == null && !a.accountErased),
    [applicants],
  );
  // Capacity counts every acceptance, sent or drafted.
  const accepted = applicants.filter((a) => a.decision === "accepted");
  const unitsTaken = accepted.reduce((s, a) => s + (a.allocatedUnits ?? 0), 0);

  const categories = useMemo(() => {
    const present = new Set<string>();
    open.forEach((a) => {
      if (a.category) present.add(a.category);
    });
    return Array.from(present).sort();
  }, [open]);

  const visible =
    categoryFilter === "all" ? open : open.filter((a) => a.category === categoryFilter);

  const setDecision = (app: BrandDropApplicant, decision: SeatDecision, units?: number) =>
    decide.mutate({
      applicationId: app.id,
      decision,
      allocatedUnits: decision === "accepted" && showUnits ? (units ?? app.allocatedUnits ?? 0) : null,
    });

  const decisionField = (app: BrandDropApplicant) => (
    <SeatDecisionSelect
      id={app.id}
      orgName={app.orgName}
      value={app.decision}
      disabled={decide.isPending}
      onChange={(next) => setDecision(app, next)}
    />
  );

  const unitsField = (
    app: BrandDropApplicant,
    props: { label?: string; className: string },
  ) => (
    <TextField
      key={`${app.id}-${app.allocatedUnits ?? 0}`}
      id={`units-${app.orgId}`}
      type="number"
      min={0}
      size="compact"
      disabled={app.decision !== "accepted" || decide.isPending}
      defaultValue={app.decision === "accepted" ? (app.allocatedUnits ?? 0) : 0}
      onBlur={(e) => {
        const units = Math.max(0, parseInt(e.target.value, 10) || 0);
        if (units !== (app.allocatedUnits ?? 0)) setDecision(app, "accepted", units);
      }}
      {...props}
    />
  );

  // Quiet paper falls just under AA on the yellow wash, so an accepted row uses muted.
  const subtle = (app: BrandDropApplicant) =>
    app.decision === "accepted" ? "text-muted" : "text-quiet";

  const shipToLine = (app: BrandDropApplicant) =>
    app.accountErased ? null : (
      <p className={cn("mt-1 text-xs", subtle(app))}>
        Ship to: {app.deliveryAddress || <AddressPending />}
      </p>
    );

  return (
    <Card kind="panel" pad="card" className="flex flex-col gap-5">
      <CardHeader
        title="Applicants"
        description="Decisions stay private drafts until you send them."
        actions={
          categories.length > 0 ? (
            <Select
              aria-label="Filter by organization type"
              size="compact"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {orgCategoryLabel(c)}
                </option>
              ))}
            </Select>
          ) : null
        }
        className="mb-0"
      />
      {visible.length === 0 ? (
        <EmptyState>No applicants waiting on a decision.</EmptyState>
      ) : !mdUp ? (
        <ul className="flex flex-col gap-3">
          {visible.map((app) => (
            <li
              key={app.id}
              className={cn(
                SURFACE.inset,
                "flex flex-col gap-3 p-4",
                app.decision === "accepted" && "bg-accent-wash",
              )}
            >
              <div className="min-w-0">
                <p className={cn(TEXT.body, "font-medium text-primary")}>{app.orgName}</p>
                <p className={cn(TEXT.body, subtle(app))}>
                  {app.university}
                  {app.category ? ` · ${orgCategoryLabel(app.category)}` : ""}
                  {` · ${app.followerCount ?? "-"} followers`}
                </p>
                <p className={cn(TEXT.body, "mt-1", subtle(app))}>{app.instagramHandle}</p>
                <p className={cn(TEXT.body, "mt-2 text-primary")}>{app.pitch ?? "—"}</p>
                {shipToLine(app)}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {decisionField(app)}
                {showUnits ? unitsField(app, { label: "Units", className: "w-24" }) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <THead>
            <tr>
              <Th className="w-36">Decision</Th>
              <Th>Organization</Th>
              <Th className="w-48">University</Th>
              <Th className="w-28">Type</Th>
              <Th className="w-32">Instagram</Th>
              <Th className="w-24 text-right">Followers</Th>
              <Th className="w-48">Pitch</Th>
              {showUnits ? <Th className="w-24">Units</Th> : null}
            </tr>
          </THead>
          <TBody>
            {visible.map((app) => (
              <Tr key={app.id} className={cn(app.decision === "accepted" && "bg-accent-wash")}>
                <Td>{decisionField(app)}</Td>
                <Td>
                  <div className="text-primary">{app.orgName}</div>
                  {shipToLine(app)}
                </Td>
                <Td muted>{app.university}</Td>
                <Td muted>{orgCategoryLabel(app.category)}</Td>
                <Td muted>{app.instagramHandle}</Td>
                <Td className="text-right tabular-nums">{app.followerCount ?? "-"}</Td>
                <Td muted className="max-w-48 truncate">
                  {app.pitch ?? "-"}
                </Td>
                {showUnits ? <Td>{unitsField(app, { className: "w-16" })}</Td> : null}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <SendDecisionsBar
        seats={applicants}
        pending={send.isPending}
        error={decide.error ? decide.error.message : null}
        onSend={() => send.mutateAsync()}
        note={
          `${accepted.length} of ${capacityTotal} spots` +
          (showUnits ? ` · ${unitsTaken} of ${totalProductUnits} units` : "")
        }
      />
    </Card>
  );
}

/** Campaign creative editor — only when admin sets brandCanEditCreative. */
function BrandCampaignEditor({ detail }: { detail: BrandDropDetail }) {
  const patch = usePatchBrandDropCreative(detail.id);
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description);
  const [image, setImage] = useState(detail.image);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const httpsPreview = (() => {
    try {
      return new URL(image.trim()).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const onSave = async () => {
    setError(null);
    setNotice(null);
    const body: { title?: string; description?: string; image?: string } = {};
    if (title.trim() !== detail.title) body.title = title.trim();
    if (description.trim() !== detail.description) {
      body.description = description.trim();
    }
    if (image.trim() !== detail.image) body.image = image.trim();
    if (Object.keys(body).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    try {
      await patch.mutateAsync(body);
      setNotice("Campaign updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save campaign.");
    }
  };

  return (
    <Card data-testid="brand-campaign-editor" kind="panel" pad="card">
      <CardHeader
        title="Campaign"
        description="BUZZ can still change this."
        className="mb-5"
      />
      <div className={STACK.default}>
        <TextField
          type="text"
          label="Title"
          value={title}
          disabled={patch.isPending}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Description"
          rows={3}
          value={description}
          disabled={patch.isPending}
          onChange={(e) => setDescription(e.target.value)}
        />
        <TextField
          type="url"
          label="Image URL"
          value={image}
          disabled={patch.isPending}
          onChange={(e) => setImage(e.target.value)}
        />
        {httpsPreview ? (
          <img
            src={image.trim()}
            alt=""
            className="max-h-40 rounded-buzzCard border border-line object-cover"
          />
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            data-testid="brand-save-creative"
            disabled={patch.isPending}
            onClick={() => void onSave()}
          >
            {patch.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
        {notice ? <SuccessBanner>{notice}</SuccessBanner> : null}
        {error ? <ErrorBanner>{error}</ErrorBanner> : null}
      </div>
    </Card>
  );
}

/** GET /api/brands/me/drops/:id. */
function ApiDropDetail() {
  const { dropId } = useParams<{ dropId: string }>();
  const { data: detail, isLoading, error } = useBrandDropDetail(dropId);

  if (isLoading) {
    return (
      <PageShell width="wide">
        <Loader label="Loading drop…" />
      </PageShell>
    );
  }

  if (error instanceof ApiError && error.status === 404) {
    return <Navigate to="/brand/dashboard" replace />;
  }

  if (error || !detail) {
    return (
      <PageShell width="wide" className={STACK.group}>
        {backLink}
        <StatePanel tone="danger">
          {error instanceof Error
            ? error.message
            : "Couldn’t load this drop. Please try again."}
        </StatePanel>
      </PageShell>
    );
  }

  const stage = detail.stage;
  // A canceled drop keeps a frozen report of what happened.
  const showResults = stage === "live" || stage === "wrapped" || stage === "canceled";
  // Brands decide after applications close and until BUZZ wraps the drop.
  const canDecide = stage === "selecting" || stage === "live";

  const aggregateMetrics = {
    dropId: detail.id,
    totalPosts: detail.totalPosts ?? 0,
    totalLikes: detail.totalLikes ?? 0,
    totalComments: detail.totalComments ?? 0,
    totalEngagement: detail.totalEngagement ?? 0,
    totalReach: detail.totalReach ?? 0,
  };

  return (
    <PageShell width="wide" className={STACK.section}>
      <div className="flex flex-col gap-5">
        <PageHeader
          back={backLink}
          title={detail.title}
          description={detail.description}
          actions={<DropStageBadge stage={stage} />}
          className="mb-0"
        />
        {detail.publishedAt != null ? <CopyPublicDropUrl dropId={detail.id} /> : null}
      </div>

      <BrandDropTrackerStepper currentStage={stage} applyCloseAt={detail.applyCloseAt} />

      {detail.brandCanEditCreative && stage !== "wrapped" && stage !== "canceled" ? (
        <BrandCampaignEditor detail={detail} />
      ) : null}

      {canDecide ? (
        <ApiApplicantTable
          applicants={detail.applications ?? []}
          dropId={detail.id}
          capacityTotal={detail.capacityTotal}
          totalProductUnits={detail.totalProductUnits}
        />
      ) : null}

      {showResults ? (
        <>
          <DropKPISummary metrics={aggregateMetrics} />
          <ApiDropOrgTable applicants={detail.applications ?? []} />
        </>
      ) : !canDecide ? (
        <StatePanel>Posts and KPIs will appear here once your drop goes live.</StatePanel>
      ) : null}
    </PageShell>
  );
}

export default function BrandDropDetailPage() {
  return <ApiDropDetail />;
}
