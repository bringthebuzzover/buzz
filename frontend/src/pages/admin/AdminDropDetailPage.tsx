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
import { useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import {
  useAdminDrop,
  useAddApplicantShipment,
  useCancelDrop,
  useDeleteApplicantShipment,
  useDeleteSeat,
  useHideDrop,
  usePatchAdminDropConfig,
  usePublishDrop,
  useSendAdminDecisions,
  useSetAdminSeatDecision,
  useSetApplicantDelivered,
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
  DateTimeField,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Tabs } from "../../components/ui/Tabs";
import { Toggle } from "../../components/ui/Toggle";
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
  adminApplicantShipTo,
  formatCompactCount,
  formatDate,
  formatDateTime,
  toDatetimeLocalValue,
} from "../../components/admin/labels";
import AddOrgToDropModal from "../../components/admin/AddOrgToDropModal";
import CopyPublicDropUrl from "../../components/drop/CopyPublicDropUrl";
import { carrierLabel, type Shipment } from "../../utils/shipments";
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

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-6 space-y-4 rounded-buzzBoard border border-line bg-surface-card p-6">
      <div>
        <h3 className={TEXT.h3}>{title}</h3>
        {description ? (
          <p className={cn(TEXT.meta, "mt-1")}>{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function httpsImageSrc(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? value.trim() : null;
  } catch {
    return null;
  }
}

const INTENT_HEADERS = ["Organization", "Status", "Pitch", "Created"] as const;

const APPLICANT_HEADERS = [
  "Organization",
  "Followers",
  "Decision",
  "Units",
  "Posts",
  "Applied",
  "Ship to",
  "Shipments",
  "",
] as const;

/** Withdrew and removed end a seat; it leaves the org's view and frees its units. */
const ENDED_DECISIONS = new Set(["withdrew", "removed"]);

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
  // Capacity and units stay editable; only a wrapped drop locks the window.
  const windowLocked = data.stage === "wrapped";
  const unpublished = data.publishedAt == null;
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description);
  const [image, setImage] = useState(data.image);
  const [location, setLocation] = useState(data.location);
  const [capacity, setCapacity] = useState(String(data.capacityTotal));
  const [units, setUnits] = useState(
    data.totalProductUnits === null ? "" : String(data.totalProductUnits),
  );
  const [clearUnits, setClearUnits] = useState(false);
  const [openAt, setOpenAt] = useState(toDatetimeLocalValue(data.applyOpenAt));
  const [closeAt, setCloseAt] = useState(
    toDatetimeLocalValue(data.applyCloseAt),
  );
  const [hashtag, setHashtag] = useState(data.campaignHashtag ?? "");
  const [clearHashtag, setClearHashtag] = useState(false);
  const [brandCanEditCreative, setBrandCanEditCreative] = useState(
    Boolean(data.brandCanEditCreative),
  );
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    setNotice(null);
    const body: AdminDropConfigPatch = {};
    if (title.trim() !== data.title) body.title = title.trim();
    if (description.trim() !== data.description) {
      body.description = description.trim();
    }
    if (image.trim() !== data.image) body.image = image.trim();
    if (location.trim() !== data.location) body.location = location.trim();
    if (brandCanEditCreative !== Boolean(data.brandCanEditCreative)) {
      body.brandCanEditCreative = brandCanEditCreative;
    }
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setError("Capacity must be an integer ≥ 1.");
      return;
    }
    if (cap !== data.capacityTotal) body.capacityTotal = cap;
    if (!windowLocked) {
      const openMs = new Date(openAt).getTime();
      const closeMs = new Date(closeAt).getTime();
      if (!Number.isFinite(openMs) || !Number.isFinite(closeMs)) {
        setError("Apply window times are invalid.");
        return;
      }
      if (openMs !== data.applyOpenAt) body.applyOpenAt = openMs;
      if (closeMs !== data.applyCloseAt) body.applyCloseAt = closeMs;
    }
    if (clearUnits) {
      if (data.totalProductUnits !== null) body.totalProductUnits = null;
    } else if (units.trim() !== "") {
      const u = Number(units);
      if (!Number.isInteger(u) || u < 1) {
        setError("Unit budget must be an integer ≥ 1, or clear to spot-only.");
        return;
      }
      if (u !== data.totalProductUnits) body.totalProductUnits = u;
    }
    if (clearHashtag) {
      if (data.campaignHashtag !== null) body.campaignHashtag = null;
    } else if (hashtag.trim() !== (data.campaignHashtag ?? "")) {
      body.campaignHashtag = hashtag.trim() || null;
    }

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

  const previewSrc = httpsImageSrc(image);

  return (
    <div>
      <ConfigSection
        title="Campaign"
        description="What organizations see on the drop: title, story, and hero image."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          {previewSrc ? (
            <div className="relative aspect-video min-h-48 w-full shrink-0 overflow-hidden rounded-buzzBoard border border-line sm:w-auto">
              <img
                src={previewSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <TextField
              id="drop-config-title"
              label="Title"
              size="compact"
              value={title}
              disabled={patch.isPending}
              onChange={(e) => setTitle(e.target.value)}
            />
            <TextArea
              id="drop-config-description"
              label="Description"
              size="compact"
              rows={5}
              value={description}
              disabled={patch.isPending}
              wrapperClassName="flex min-h-0 flex-1 flex-col"
              className="min-h-[7.5rem] flex-1"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <TextField
          id="drop-config-image"
          label="Image (https)"
          size="compact"
          type="url"
          value={image}
          disabled={patch.isPending}
          onChange={(e) => setImage(e.target.value)}
        />
      </ConfigSection>

      <ConfigSection
        title="Logistics"
        description={
          windowLocked
            ? "The apply window is locked on a wrapped drop. Unwrap it first to change the dates."
            : "Where it runs, how many seats, and the apply window. To reopen applications, move the close date later."
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="drop-config-location"
              label="Location"
              size="compact"
              value={location}
              disabled={patch.isPending}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <TextField
            id="drop-config-capacity"
            label="Capacity"
            size="compact"
            type="number"
            min={1}
            value={capacity}
            disabled={patch.isPending}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <div>
            <TextField
              id="drop-config-units"
              label="Total units"
              size="compact"
              type="number"
              min={1}
              value={units}
              disabled={clearUnits || patch.isPending}
              placeholder="Leave empty, then clear for spot-only"
              onChange={(e) => setUnits(e.target.value)}
            />
            <Checkbox
              wrapperClassName="mt-1"
              checked={clearUnits}
              disabled={patch.isPending}
              onChange={(e) => setClearUnits(e.target.checked)}
              label={
                <span className="text-xs text-muted">
                  Clear to spot-only
                </span>
              }
            />
          </div>
          <DateTimeField
            id="drop-config-open-at"
            label="Apply opens"
            size="compact"
            value={openAt}
            disabled={windowLocked || patch.isPending}
            onChange={(e) => setOpenAt(e.target.value)}
          />
          <DateTimeField
            id="drop-config-close-at"
            label="Apply closes"
            size="compact"
            value={closeAt}
            disabled={windowLocked || patch.isPending}
            onChange={(e) => setCloseAt(e.target.value)}
          />
        </div>
      </ConfigSection>

      <ConfigSection
        title="Settings"
        description="Hashtag matching and who may edit creative after publish."
      >
        <TextField
          id="drop-config-hashtag"
          label="Campaign hashtag"
          size="compact"
          value={hashtag}
          disabled={clearHashtag || patch.isPending}
          placeholder="e.g. springdrop (no # required)"
          onChange={(e) => setHashtag(e.target.value)}
        />
        <Checkbox
          wrapperClassName="mt-1"
          checked={clearHashtag}
          disabled={patch.isPending}
          onChange={(e) => setClearHashtag(e.target.checked)}
          label={
            <span className="text-xs text-muted">Clear hashtag</span>
          }
        />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Brand can edit details</p>
            <p id="brand-can-edit-creative-help" className="mt-1 text-xs text-quiet">
              Lets the brand change title, description and image. Dates, capacity
              and publishing stay with BUZZ.
            </p>
          </div>
          <Toggle
            id="brand-can-edit-creative"
            data-testid="brand-can-edit-creative"
            checked={brandCanEditCreative}
            disabled={patch.isPending}
            onChange={setBrandCanEditCreative}
            label="Brand can edit details"
            aria-describedby="brand-can-edit-creative-help"
          />
        </div>
      </ConfigSection>

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
          description="Final: there is no undo. Decisions, tracking, delivery, post links and metric syncs stop. Seats and posts stay on record, and you can still end a seat with a reason."
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
              : "Ends the campaign. Brands can no longer decide seats; organizations can still link posts for 30 days."
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

function ApplicantShipmentEditor({
  dropId,
  applicant,
}: {
  dropId: string;
  applicant: AdminApplicant;
}) {
  const add = useAddApplicantShipment(dropId, applicant.id);
  const remove = useDeleteApplicantShipment(dropId, applicant.id);
  const setDelivered = useSetApplicantDelivered(applicant.id);
  const [tn, setTn] = useState("");
  const [carrier, setCarrier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const shipments = (applicant.shipments ?? []) as Shipment[];

  const onAdd = async () => {
    const trackingNumber = tn.trim();
    if (!trackingNumber) return;
    const pickedCarrier = carrier;
    setError(null);
    setTn("");
    setCarrier("");
    try {
      await add.mutateAsync({
        trackingNumber,
        carrier: pickedCarrier || undefined,
      });
    } catch (err) {
      setTn(trackingNumber);
      setCarrier(pickedCarrier);
      setError(
        err instanceof ApiError ? err.message : "Could not add tracking.",
      );
    }
  };

  return (
    <div
      className="min-w-[14rem] space-y-2"
      data-testid={`applicant-shipments-${applicant.id}`}
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <ul className="space-y-1">
        {shipments.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 text-xs font-semibold"
          >
            <span>
              {carrierLabel(s.carrier)} #{s.trackingNumber}
            </span>
            <button
              type="button"
              data-testid={`remove-shipment-${s.id}`}
              className="text-accent hover:underline"
              disabled={remove.isPending}
              onClick={() => void remove.mutateAsync(s.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <TextField
          id={`add-tn-${applicant.id}`}
          data-testid={`add-shipment-tn-${applicant.id}`}
          label="Tracking number"
          size="compact"
          value={tn}
          onChange={(e) => setTn(e.target.value)}
        />
        <Select
          id={`add-carrier-${applicant.id}`}
          data-testid={`add-shipment-carrier-${applicant.id}`}
          size="compact"
          label="Carrier (if not 1Z / FedEx digits)"
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
        >
          <option value="">Infer</option>
          <option value="ups">UPS</option>
          <option value="fedex">FedEx</option>
          <option value="unknown">Unknown</option>
        </Select>
        <ActionButton
          testId={`add-shipment-${applicant.id}`}
          disabled={add.isPending || !tn.trim()}
          onClick={() => void onAdd()}
        >
          {add.isPending ? "Adding…" : "Add tracking"}
        </ActionButton>
        <Checkbox
          data-testid={`delivered-${applicant.id}`}
          checked={applicant.deliveredAt != null}
          disabled={setDelivered.isPending}
          onChange={(e) => {
            setError(null);
            setDelivered
              .mutateAsync(e.target.checked)
              .catch((err: unknown) =>
                setError(err instanceof ApiError ? err.message : "Could not save delivery."),
              );
          }}
          label={
            <span className="text-xs text-muted">
              Delivered
              {applicant.deliveredAt != null ? ` ${formatDate(applicant.deliveredAt)}` : ""}
            </span>
          }
        />
      </div>
    </div>
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
            <Cell muted>
              {applicant.accountErased
                ? "—"
                : adminApplicantShipTo(
                    applicant.decision,
                    applicant.shippingCity,
                    applicant.shippingState,
                  )}
            </Cell>
            <Cell>
              {live ? (
                <ApplicantShipmentEditor dropId={dropId} applicant={applicant} />
              ) : (
                <span className="text-xs font-medium text-muted">—</span>
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
