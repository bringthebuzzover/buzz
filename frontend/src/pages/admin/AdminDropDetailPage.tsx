/**
 * /admin/drops/:dropId — one drop, with lifecycle / config / roster facets.
 *
 * Tabs rather than a sidebar section here: the record is fixed and these are
 * facets of it. The tab lives in `?tab=` so a specific view is still a shareable
 * URL.
 *
 * The stage is computed (utils/dropStage). BUZZ drafts and sends per-seat
 * decisions at any stage, reopens by moving the close date, wraps or unwraps
 * the drop, and can cancel it (final). A seat ends as withdrew or removed (with
 * a reason); hard delete is only for test data. Tracking and delivery live on
 * accepted, sent seats.
 */
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import {
  useAdminDrop,
  useCancelDrop,
  useDeleteSeat,
  useHideDrop,
  usePatchAdminDropConfig,
  usePublishDrop,
  useSendAdminDecisions,
  useSetAdminSeatDecision,
  useSetDropWrapped,
  useSyncAndAutolink,
  useUnhideDrop,
  type AdminApplicant,
  type AdminDropConfigPatch,
  type AdminSeatDecision,
  type AdminDropDetail,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import {
  Checkbox,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Tabs } from "../../components/ui/Tabs";
import {
  DropFormFields,
  dropToForm,
  parseDropForm,
  dropFormError,
  type DropFormState,
} from "../../components/admin/DropForm";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import {
  ActionButton,
  AdminBackLink,
  AdminTable,
  Cell,
  ErrorNote,
  entityLinkClass,
  Field,
  FieldGrid,
  HeadingIconButton,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  StagePill,
  Row,
} from "../../components/admin/AdminPrimitives";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  formatCompactCount,
  formatDate,
  formatDateTime,
} from "../../components/admin/labels";
import AddOrgToDropModal from "../../components/admin/AddOrgToDropModal";
import CopyPublicDropUrl from "../../components/drop/CopyPublicDropUrl";
import { ApplicantShipping } from "../../components/admin/ApplicantShipping";
import { ENDED_DECISIONS } from "../../utils/dropStage";
import { SeatDecisionSelect, SendDecisionsBar } from "../../components/drop/SeatDecisions";

const TABS = [
  { id: "tracker", label: "Lifecycle" },
  { id: "config", label: "Config" },
  { id: "applicants", label: "Applicants" },
  { id: "timeline", label: "Timeline" },
  { id: "attribution", label: "Attribution" },
] as const;

type DropTabId = (typeof TABS)[number]["id"];

function isDropTabId(value: string): value is DropTabId {
  return TABS.some((tab) => tab.id === value);
}

function StageRail({ current }: { current: string }) {
  const index = STAGE_ORDER.indexOf(current as (typeof STAGE_ORDER)[number]);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
      {STAGE_ORDER.map((stage, i) => {
        const reached = index >= 0 && i <= index;
        return (
          <div key={stage} className="flex min-w-0 flex-col gap-3">
            <div
              className={cn(
                "h-1 rounded-full",
                reached ? "bg-accent" : "bg-buzz-paper09",
              )}
            />
            <p className={cn("text-xs", reached ? "text-primary" : "text-quiet")}>
              {STAGE_LABELS[stage] ?? stage}
            </p>
          </div>
        );
      })}
    </div>
  );
}

const INTENT_HEADERS = ["Organization", "Status", "Pitch", "Created"] as const;

const APPLICANT_HEADERS = [
  "Organization",
  "Followers",
  "Decision",
  "Units",
  "Posts",
  "Applied",
  "Shipping",
  "",
] as const;

/** Withdrew and removed end a seat; it leaves the org's view and frees its units. */
const DECISION_TONE: Record<string, "good" | "bad" | "warn" | "neutral"> = {
  accepted: "good",
  denied: "bad",
  removed: "bad",
  withdrew: "neutral",
};

function DecisionPill({ decision }: { decision: string }) {
  return <Pill tone={DECISION_TONE[decision] ?? "warn"}>{decision}</Pill>;
}

function DropConfigEditors({ data }: { data: AdminDropDetail }) {
  const patch = usePatchAdminDropConfig(data.id);
  const publish = usePublishDrop(data.id);
  // After wrap-up only the copy (title, story, image, location) can change.
  const copyOnly = data.stage === "wrapped";
  const unpublished = data.publishedAt == null;
  const [form, setForm] = useState(() => dropToForm(data));
  const setField = <K extends keyof DropFormState>(key: K, value: DropFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };
  const [clearUnits, setClearUnits] = useState(false);
  const [clearHashtag, setClearHashtag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    setNotice(null);
    let parsed;
    try {
      parsed = parseDropForm(form, { config: true, copyOnly, clearUnits, clearHashtag });
    } catch (err) {
      setError(dropFormError(err, "Could not save configuration."));
      return;
    }
    // Send only what changed. Blank units are left alone; wrapped drops never
    // send dates, and dates are compared as shown (whole minutes), so an
    // untouched date with seconds is not rewritten.
    const { applyOpenAt, applyCloseAt, totalProductUnits, campaignHashtag, ...rest } = parsed;
    const shown = dropToForm(data);
    const candidates: AdminDropConfigPatch = {
      ...rest,
      ...(!copyOnly && form.openAt !== shown.openAt && { applyOpenAt }),
      ...(!copyOnly && form.closeAt !== shown.closeAt && { applyCloseAt }),
      ...((clearUnits || form.units.trim() !== "") && { totalProductUnits }),
      ...((clearHashtag || form.hashtag.trim() !== (data.campaignHashtag ?? "")) && {
        campaignHashtag,
      }),
    };
    const current: AdminDropConfigPatch = {
      ...data,
      brandCanEditCreative: Boolean(data.brandCanEditCreative),
    };
    const body = Object.fromEntries(
      Object.entries(candidates).filter(
        ([key, value]) => value !== current[key as keyof AdminDropConfigPatch],
      ),
    );
    if (Object.keys(body).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    try {
      await patch.mutateAsync(body);
      setNotice("Configuration saved.");
      setClearUnits(false);
      setClearHashtag(false);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not save configuration.",
      );
    }
  };

  const onPublish = async () => {
    setError(null);
    setNotice(null);
    try {
      await publish.mutateAsync(undefined);
      setNotice("Drop published.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not publish this drop.",
      );
    }
  };

  return (
    <div>
      <DropFormFields
        form={form} setField={setField} prefix="drop-config"
        disabled={patch.isPending} copyOnly={copyOnly}
        clearUnits={clearUnits} setClearUnits={setClearUnits}
        clearHashtag={clearHashtag} setClearHashtag={setClearHashtag}
      />

      <div className={cn(STACK.tight, "px-4 py-4")}>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            variant="primary"
            testId="save-drop-config"
            disabled={patch.isPending || publish.isPending}
            onClick={() => void onSave()}
          >
            {patch.isPending ? "Saving…" : "Save configuration"}
          </ActionButton>
          {unpublished && (
            <ActionButton
              variant="primary"
              testId="publish-drop"
              disabled={patch.isPending || publish.isPending}
              onClick={() => void onPublish()}
            >
              {publish.isPending ? "Publishing…" : "Publish"}
            </ActionButton>
          )}
        </div>
        {notice && <SuccessBanner>{notice}</SuccessBanner>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </div>
  );
}

function CancelDropButton({ drop }: { drop: AdminDropDetail }) {
  const cancel = useCancelDrop(drop.id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(typed: string) {
    setError(null);
    try {
      await cancel.mutateAsync(typed.trim());
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not cancel this drop.");
    }
  }

  return (
    <>
      <ActionButton
        variant="danger"
        testId="drop-cancel"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Cancel drop
      </ActionButton>
      {open && (
        <ConfirmDialog
          title="Cancel this drop"
          description="Final: there is no undo. Decisions, tracking, delivery, post links and metric syncs stop. Seats and posts stay on record, and you can still end a seat with a reason. Organizations still in the running and the brand are emailed."
          expected={drop.title}
          inputLabel="Type the drop title"
          error={error}
          destructive
          confirmLabel="Cancel drop"
          cancelLabel="Keep drop"
          pendingLabel="Canceling…"
          pending={cancel.isPending}
          inputTestId="drop-cancel-confirm"
          submitTestId="drop-cancel-submit"
          onConfirm={(typed) => void submit(typed)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function LifecycleControls({ drop }: { drop: AdminDropDetail }) {
  const setWrapped = useSetDropWrapped(drop.id);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const wrapped = drop.stage === "wrapped";
  const canceled = drop.stage === "canceled";
  // Wrap-up follows Selecting or Live (the matrix); unwrap undoes it.
  const canWrap =
    drop.hiddenAt == null && (drop.stage === "selecting" || drop.stage === "live");

  async function toggle() {
    setError(null);
    try {
      await setWrapped.mutateAsync(!wrapped);
      setConfirming(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the drop.");
    }
  }

  return (
    <Panel
      title="Lifecycle"
      description="The stage is computed from the dates and the seats. Reopen applications by moving the close date later in Config. Wrap the drop when the campaign is over; organizations can still link posts for 30 days after. Cancel only a drop that will not happen."
    >
      <div className="space-y-4 px-6 py-5">
        {canceled ? (
          <p className={cn(TEXT.body, "flex items-center gap-2 text-muted")} data-testid="drop-canceled">
            <Pill tone="bad">Canceled</Pill>
            {drop.canceledAt != null ? formatDateTime(drop.canceledAt) : null}
          </p>
        ) : (
          <StageRail current={drop.stage} />
        )}
        {error && !confirming && <ErrorNote>{error}</ErrorNote>}
        {drop.publishedAt != null && !canceled && (
          <div className="flex flex-wrap gap-2">
            {(wrapped || canWrap) && (
              <ActionButton
                variant={wrapped ? "secondary" : "primary"}
                testId={wrapped ? "drop-unwrap" : "drop-wrap"}
                disabled={setWrapped.isPending}
                onClick={() => {
                  setError(null);
                  setConfirming(true);
                }}
              >
                {wrapped ? "Unwrap drop" : "Wrap up drop"}
              </ActionButton>
            )}
            {!wrapped && <CancelDropButton drop={drop} />}
          </div>
        )}
      </div>
      {confirming && (
        <ConfirmDialog
          title={wrapped ? "Unwrap drop" : "Wrap up drop"}
          description={
            wrapped
              ? "The drop goes back to the stage its dates and seats give it. Organizations can link posts again."
              : "Ends the campaign. Organizations still waiting on a decision are emailed \"not selected\", orgs taking part get a thank-you, and the brand gets a recap. Send drafted acceptances first. Organizations can still link posts for 30 days."
          }
          error={error}
          confirmLabel={wrapped ? "Unwrap" : "Wrap up"}
          pendingLabel={wrapped ? "Unwrapping…" : "Wrapping up…"}
          pending={setWrapped.isPending}
          submitTestId={wrapped ? "drop-unwrap-confirm" : "drop-wrap-confirm"}
          onConfirm={() => void toggle()}
          onClose={() => setConfirming(false)}
        />
      )}
    </Panel>
  );
}

function SignupIntents({
  intents,
}: {
  intents: AdminDropDetail["intents"];
}) {
  return (
    <Panel
      title="Signup intents (not applicants)"
      description="Organizations that asked to apply before they were approved and connected. Brands never see these rows."
    >
      <AdminTable
        headers={INTENT_HEADERS}
        isEmpty={intents.length === 0}
        empty="No signup intents on this drop."
      >
        {intents.map((intent) => (
          <Row key={intent.id}>
            <Cell>
              <span className="font-medium text-primary">{intent.orgName}</span>
            </Cell>
            <Cell>
              <Pill tone={intent.status === "expired" ? "warn" : "neutral"}>
                {intent.status}
              </Pill>
            </Cell>
            <Cell muted>{intent.pitch ?? "—"}</Cell>
            <Cell muted>{formatDateTime(intent.createdAt)}</Cell>
          </Row>
        ))}
      </AdminTable>
    </Panel>
  );
}

/** BUZZ can seat an org at any published stage, including after wrap (retro), until canceled. */
function canLateAdd(drop: AdminDropDetail): boolean {
  return drop.publishedAt != null && drop.hiddenAt == null && drop.stage !== "canceled";
}

/** End a seat on record: the org withdrew (by email, say) or BUZZ removed it. */
function EndSeatButton({
  applicant,
  onEnd,
  pending,
  error,
}: {
  applicant: AdminApplicant;
  onEnd: (decision: "withdrew" | "removed", reason: string) => Promise<boolean>;
  pending: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"removed" | "withdrew">("removed");
  const [reason, setReason] = useState("");

  return (
    <>
      <ActionButton
        quiet
        variant="secondary"
        testId={`end-seat-${applicant.id}`}
        onClick={() => setOpen(true)}
      >
        End seat
      </ActionButton>
      {open && (
        <ConfirmDialog
          title={`End ${applicant.orgName}'s seat`}
          description="The seat leaves the organization's view at once and its units are freed. Linked posts stay on record. Removed seats can't re-apply; a withdrawn org can."
          error={error}
          destructive
          confirmLabel="End seat"
          pendingLabel="Saving…"
          pending={pending}
          submitTestId={`end-seat-submit-${applicant.id}`}
          onConfirm={() =>
            void onEnd(kind, reason.trim()).then((ok) => ok && setOpen(false))
          }
          onClose={() => setOpen(false)}
        >
          <Select
            id={`end-kind-${applicant.id}`}
            label="Why it ended"
            value={kind}
            onChange={(e) => setKind(e.target.value as "removed" | "withdrew")}
          >
            <option value="removed">BUZZ removed it</option>
            <option value="withdrew">The organization withdrew</option>
          </Select>
          <TextArea
            id={`end-reason-${applicant.id}`}
            data-testid={`end-reason-${applicant.id}`}
            label={kind === "removed" ? "Reason (required, BUZZ-only)" : "Note (optional, BUZZ-only)"}
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </ConfirmDialog>
      )}
    </>
  );
}

function DeleteSeatButton({
  dropId,
  applicant,
}: {
  dropId: string;
  applicant: AdminApplicant;
}) {
  const remove = useDeleteSeat(dropId);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(typed: string) {
    setError(null);
    try {
      await remove.mutateAsync({ applicationId: applicant.id, confirm: typed.trim() });
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this seat.");
    }
  }

  return (
    <>
      <ActionButton
        quiet
        variant="secondary"
        testId={`delete-seat-${applicant.id}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Delete
      </ActionButton>
      {open && (
        <ConfirmDialog
          title="Delete seat (test data)"
          description="Erases this seat, its tracking numbers, and its linked post metrics as if it never existed. For test data and mistakes only; to end a real seat, use End seat. Type delete to confirm."
          expected="delete"
          inputLabel="Type delete"
          matches={(typed) => typed.trim().toLowerCase() === "delete"}
          error={error}
          destructive
          confirmLabel="Delete seat"
          pendingLabel="Deleting…"
          pending={remove.isPending}
          inputTestId={`delete-confirm-${applicant.id}`}
          submitTestId={`delete-confirm-submit-${applicant.id}`}
          onConfirm={(typed) => void submit(typed)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Applicants({
  dropId,
  applicants,
  unitsMode,
}: {
  dropId: string;
  applicants: AdminApplicant[];
  unitsMode: boolean;
}) {
  const decide = useSetAdminSeatDecision(dropId);
  const send = useSendAdminDecisions(dropId);
  const [error, setError] = useState<string | null>(null);
  const setDecision = async (
    applicant: AdminApplicant,
    decision: AdminSeatDecision,
    units?: number,
    reason?: string,
  ): Promise<boolean> => {
    setError(null);
    try {
      await decide.mutateAsync({
        applicationId: applicant.id,
        decision,
        allocatedUnits:
          decision === "accepted" && unitsMode
            ? (units ?? applicant.allocatedUnits ?? 0)
            : null,
        reason,
      });
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the decision.");
      return false;
    }
  };
  return (
    <>
    <div className="px-6 pb-4">
      <SendDecisionsBar
        seats={applicants}
        pending={send.isPending}
        error={error}
        onSend={() => send.mutateAsync(undefined)}
        locks={false}
      />
    </div>
    <AdminTable
      headers={APPLICANT_HEADERS}
      isEmpty={applicants.length === 0}
      empty="Nobody has applied to this drop."
    >
      {applicants.map((applicant) => {
        const ended = ENDED_DECISIONS.has(applicant.decision);
        const live = applicant.decision === "accepted" && applicant.decisionSentAt != null;
        return (
          <Row key={applicant.id} attention={applicant.decision === "applied"}>
            <Cell>
              <Link
                to={`/admin/orgs/${applicant.userId}`}
                className={`block ${entityLinkClass}`}
              >
                {applicant.orgName}
              </Link>
              {applicant.university ? (
                <span className="mt-0.5 block text-xs text-quiet">
                  {applicant.university}
                </span>
              ) : null}
              {applicant.addedBy === "late_add" ? (
                <span className="mt-1 block">
                  <Pill tone="neutral">Late add</Pill>
                </span>
              ) : null}
              {applicant.accountErased ? (
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone="neutral">Metrics frozen</Pill>
                  {applicant.metricsFrozenAt != null ? (
                    <span className="text-xs font-medium text-muted">
                      {formatDate(applicant.metricsFrozenAt)}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </Cell>
            <Cell muted>
              {formatCompactCount(applicant.followerCount)}
            </Cell>
            <Cell>
              {applicant.accountErased || ended ? (
                <div className="flex flex-col gap-1">
                  <DecisionPill decision={applicant.decision} />
                  {applicant.endReason ? (
                    <span className="max-w-48 text-xs text-muted">{applicant.endReason}</span>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <SeatDecisionSelect
                    id={applicant.id}
                    orgName={applicant.orgName}
                    value={applicant.decision}
                    sent={applicant.decisionSentAt != null}
                    disabled={decide.isPending}
                    onChange={(next) => void setDecision(applicant, next)}
                  />
                  {applicant.decision !== "applied" && applicant.decisionSentAt == null ? (
                    <span className="text-xs font-medium text-buzz-warn">Not sent</span>
                  ) : null}
                </div>
              )}
            </Cell>
            <Cell muted>
              {unitsMode && applicant.decision === "accepted" && !applicant.accountErased ? (
                <TextField
                  key={`${applicant.id}-${applicant.allocatedUnits ?? 0}`}
                  id={`units-${applicant.id}`}
                  aria-label={`Units for ${applicant.orgName}`}
                  type="number"
                  min={0}
                  size="compact"
                  className="w-20"
                  disabled={decide.isPending}
                  defaultValue={applicant.allocatedUnits ?? 0}
                  onBlur={(e) => {
                    const units = Math.max(0, parseInt(e.target.value, 10) || 0);
                    if (units !== (applicant.allocatedUnits ?? 0)) {
                      void setDecision(applicant, "accepted", units);
                    }
                  }}
                />
              ) : (
                applicant.allocatedUnits ?? "—"
              )}
            </Cell>
            <Cell muted>{applicant.linkedPostCount}</Cell>
            <Cell muted>{formatDate(applicant.appliedAt)}</Cell>
            <Cell>
              {applicant.accountErased ||
              (applicant.decision !== "applied" && applicant.decision !== "accepted") ? (
                <span className="text-xs font-medium text-muted">—</span>
              ) : (
                <ApplicantShipping dropId={dropId} applicant={applicant} live={live} />
              )}
            </Cell>
            <Cell align="right">
              <div className="flex flex-col items-end gap-1">
                {!ended && !applicant.accountErased && (
                  <EndSeatButton
                    applicant={applicant}
                    pending={decide.isPending}
                    error={error}
                    onEnd={(decision, reason) =>
                      setDecision(applicant, decision, undefined, reason || undefined)
                    }
                  />
                )}
                <DeleteSeatButton dropId={dropId} applicant={applicant} />
              </div>
            </Cell>
          </Row>
        );
      })}
    </AdminTable>
    </>
  );
}

function HideCampaignButton({ drop }: { drop: AdminDropDetail }) {
  const hide = useHideDrop(drop.id);
  const unhide = useUnhideDrop(drop.id);
  const [open, setOpen] = useState(false);
  const [notifyBrand, setNotifyBrand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (drop.publishedAt == null) {
    return null;
  }

  function closeDialog() {
    setOpen(false);
    setNotifyBrand(false);
    setError(null);
  }

  async function doHide() {
    setError(null);
    try {
      await hide.mutateAsync({ confirm: drop.title, notifyBrand });
      closeDialog();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not hide this drop.",
      );
    }
  }

  async function doUnhide() {
    setError(null);
    try {
      await unhide.mutateAsync(undefined);
      closeDialog();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not unhide this drop.",
      );
    }
  }

  const hidden = drop.hiddenAt != null;

  return (
    <>
      <HeadingIconButton
        testId={hidden ? "drop-unhide" : "hide-drop"}
        aria-label={hidden ? "Unhide campaign" : "Hide campaign"}
        disabled={hidden ? unhide.isPending : false}
        onClick={() => setOpen(true)}
      >
        {hidden ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
      </HeadingIconButton>
      {open && (
        hidden ? (
          <ConfirmDialog
            title="Unhide campaign"
            description="Organization and brand portals will see this drop again at the same URLs."
            error={error}
            confirmLabel="Unhide"
            pendingLabel="Unhiding…"
            pending={unhide.isPending}
            submitTestId="drop-unhide-submit"
            onConfirm={() => void doUnhide()}
            onClose={closeDialog}
          />
        ) : (
          <ConfirmDialog
            title="Hide campaign"
            description="Removes this published drop from every organization and brand portal. Type the drop title to confirm. No email unless you opt in."
            expected={drop.title}
            inputLabel="Type the drop title to confirm"
            error={error}
            destructive
            confirmLabel="Hide campaign"
            pendingLabel="Hiding…"
            pending={hide.isPending}
            inputTestId="hide-drop-confirm"
            submitTestId="hide-drop-submit"
            onConfirm={() => void doHide()}
            onClose={closeDialog}
          >
            <Checkbox
              data-testid="hide-drop-notify-brand"
              checked={notifyBrand}
              onChange={(e) => setNotifyBrand(e.target.checked)}
              label="Email the brand that this campaign was withdrawn"
            />
          </ConfirmDialog>
        )
      )}
    </>
  );
}

function AttributionPanel({ drop }: { drop: AdminDropDetail }) {
  const sync = useSyncAndAutolink(drop.id);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canRun = drop.publishedAt != null && drop.hiddenAt == null;

  async function run() {
    setError(null);
    setNotice(null);
    try {
      await sync.mutateAsync(undefined);
      setNotice(
        "Pulled Instagram for accepted organizations and scanned captions. Suggestions stay unconfirmed until the organization taps Confirm.",
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sync this drop.",
      );
    }
  }

  return (
    <Panel description="Posts the organizations have linked to this campaign, and suggestions the scan found that nobody has confirmed.">
      <FieldGrid>
        <Field label="Attributed posts">{drop.linkedPostCount}</Field>
        <Field label="Unconfirmed suggestions">
          {drop.pendingSuggestionCount}
          {drop.pendingSuggestionCount > 0 && (
            <span className="ml-2 text-xs font-medium text-buzz-warn">
              metrics understate reality until organizations confirm these
            </span>
          )}
        </Field>
        <Field label="Brand handle">
          {drop.brandInstagramHandle
            ? `@${drop.brandInstagramHandle.replace(/^@/, "")}`
            : "Not set — nothing to match on"}
        </Field>
      </FieldGrid>
      {canRun && (
        <div className={cn(STACK.tight, "border-t border-line px-4 py-4")}>
          {error && <ErrorNote>{error}</ErrorNote>}
          {notice && <SuccessBanner>{notice}</SuccessBanner>}
          <p className={TEXT.meta}>
            This can take a minute. Only this drop&apos;s accepted organizations are
            pulled. Follower counts are not refreshed.
          </p>
          <ActionButton
            variant="primary"
            testId="sync-and-autolink"
            disabled={sync.isPending}
            onClick={() => void run()}
          >
            {sync.isPending ? "Syncing…" : "Sync and autolink"}
          </ActionButton>
        </div>
      )}
    </Panel>
  );
}

export default function AdminDropDetailPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const drop = useAdminDrop(dropId);
  const data = drop.data;
  const defaultTab: DropTabId = data?.publishedAt == null ? "config" : "applicants";
  const tabParam = searchParams.get("tab");
  const activeTab: DropTabId =
    tabParam && isDropTabId(tabParam) ? tabParam : defaultTab;
  const acceptedCount =
    data?.applicants.filter((a) => a.decision === "accepted").length ?? 0;
  const [addOrgOpen, setAddOrgOpen] = useState(false);

  return (
    <div>
      <AdminBackLink to="/admin/drops" />

      <QueryState
        isPending={drop.isPending}
        isError={drop.isError}
        label="this drop"
      />

      {data && (
        <>
          <PageHeading
            title={data.title}
            subtitle={`${data.brandName} · ${data.location}`}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <StagePill stage={data.stage} />
                {data.hiddenAt != null && <Pill tone="bad">Hidden</Pill>}
                {acceptedCount > data.capacityTotal && (
                  <Pill tone="bad">Over capacity</Pill>
                )}
                <HideCampaignButton drop={data} />
              </div>
            }
          />

          {data.publishedAt != null ? (
            <div className="mb-4">
              <CopyPublicDropUrl dropId={data.id} />
            </div>
          ) : null}

          <Tabs
            label="Drop sections"
            tabs={TABS}
            value={activeTab}
            onChange={(id) => setSearchParams({ tab: id })}
            className="mb-8 gap-8"
          />

          {activeTab === "tracker" && <LifecycleControls drop={data} />}

          {activeTab === "config" && (
            <>
              <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {(
                  [
                    ["Capacity", `${acceptedCount} accepted of ${data.capacityTotal}`],
                    [
                      "Total units",
                      data.totalProductUnits === null
                        ? "Spot-only (no units)"
                        : `${data.allocatedUnits} of ${data.totalProductUnits} allocated`,
                    ],
                    [
                      "Wrapped",
                      data.wrappedAt ? formatDateTime(data.wrappedAt) : "Not yet",
                    ],
                    [
                      "Published",
                      data.publishedAt != null ? formatDateTime(data.publishedAt) : "Draft",
                    ],
                  ] as const
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-buzzCard border border-line bg-surface-tile p-4"
                  >
                    <p className="text-sm text-quiet">{label}</p>
                    <p className="mt-3 text-xl font-medium text-primary">{value}</p>
                  </div>
                ))}
              </div>
              {data.dropRequestId && (
                <p className="mb-6 text-sm text-muted">
                  Drop request{" "}
                  <Link
                    to={`/admin/requests/${data.dropRequestId}`}
                    className={entityLinkClass}
                  >
                    View ticket
                  </Link>
                </p>
              )}
              <DropConfigEditors data={data} />
            </>
          )}
          {activeTab === "applicants" && (
            <>
              <SignupIntents intents={data.intents ?? []} />
              <Panel title="Applicants">
              {canLateAdd(data) && (
                <div className="flex justify-end px-6 pb-2">
                  <ActionButton
                    testId="add-org-open"
                    onClick={() => setAddOrgOpen(true)}
                  >
                    Add organization
                  </ActionButton>
                </div>
              )}
              <Applicants
                dropId={data.id}
                applicants={data.applicants}
                unitsMode={data.totalProductUnits != null}
              />
              {addOrgOpen && (
                <AddOrgToDropModal
                  dropId={data.id}
                  dropTitle={data.title}
                  totalProductUnits={data.totalProductUnits}
                  applicants={data.applicants}
                  onClose={() => setAddOrgOpen(false)}
                />
              )}
              </Panel>
            </>
          )}

          {activeTab === "timeline" && (
            <Panel description="Stage transitions, oldest first. Older events may carry legacy stage names.">
              {data.trackerEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm font-medium text-muted">
                  No tracker events recorded yet.
                </p>
              ) : (
                <ol className="divide-y divide-line">
                  {data.trackerEvents.map((event) => (
                    <li key={event.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-primary">
                        {STAGE_LABELS[event.stage] ?? event.stage}
                      </p>
                      <p className="text-xs font-medium text-muted">
                        {formatDateTime(event.occurredAt)}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}

          {activeTab === "attribution" && (
            <AttributionPanel drop={data} />
          )}
        </>
      )}
    </div>
  );
}
