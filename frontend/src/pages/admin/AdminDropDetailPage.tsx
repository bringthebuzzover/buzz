/**
 * /admin/drops/:dropId — one drop, with the tracker controls.
 *
 * Tabs rather than a sidebar section here: the record is fixed and these are
 * facets of it. The tab lives in `?tab=` so a specific view is still a shareable
 * URL.
 *
 * The tracker is forward-only and two of its transitions are one-shot, which the
 * form has to make obvious: a tracking number is only writable on the move into
 * "awaiting products", and skipping past "finalizing agreements" before the brand
 * has picked applicants would strand every applicant permanently.
 */
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  useAdminDrop,
  useAdvanceTracker,
  useClearReopen,
  useHideDrop,
  usePatchAdminDropConfig,
  usePublishDrop,
  useReopenDrop,
  useSetDropTracking,
  useUnhideDrop,
  type AdminApplicant,
  type AdminDropConfigPatch,
  type AdminDropDetail,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import {
  Checkbox,
  DateTimeField,
  ErrorBanner,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
  WarningBanner,
} from "../../components/forms/controls";
import {
  ActionButton,
  AdminTable,
  Cell,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  Row,
} from "../../components/admin/AdminPrimitives";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  adminApplicantShipTo,
  formatDate,
  formatDateTime,
  formatElapsed,
  toDatetimeLocalValue,
} from "../../components/admin/labels";

const TABS = [
  { id: "config", label: "Config" },
  { id: "applicants", label: "Applicants" },
  { id: "timeline", label: "Timeline" },
  { id: "attribution", label: "Attribution" },
] as const;

const APPLICANT_HEADERS = [
  "Organization",
  "Decision",
  "Units",
  "Posts",
  "Applied",
  "Ship to",
] as const;

function DecisionPill({ decision }: { decision: string }) {
  const tone =
    decision === "accepted" ? "good" : decision === "denied" ? "bad" : "warn";
  return <Pill tone={tone}>{decision}</Pill>;
}

const LOGISTICS_LOCKED = new Set(["drop_active", "drop_finished"]);

function DropConfigEditors({ data }: { data: AdminDropDetail }) {
  const patch = usePatchAdminDropConfig(data.id);
  const publish = usePublishDrop(data.id);
  const logisticsLocked = LOGISTICS_LOCKED.has(data.stage);
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
    if (!logisticsLocked) {
      const cap = Number(capacity);
      if (!Number.isInteger(cap) || cap < 1) {
        setError("Capacity must be an integer ≥ 1.");
        return;
      }
      if (cap !== data.capacityTotal) body.capacityTotal = cap;

      const openMs = new Date(openAt).getTime();
      const closeMs = new Date(closeAt).getTime();
      if (!Number.isFinite(openMs) || !Number.isFinite(closeMs)) {
        setError("Apply window times are invalid.");
        return;
      }
      if (openMs !== data.applyOpenAt) body.applyOpenAt = openMs;
      if (closeMs !== data.applyCloseAt) body.applyCloseAt = closeMs;

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

  return (
    <div className="mt-4 border-t border-buzz-lineMid">
      <div className="space-y-3 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-buzz-inkMuted">
          Edit configuration
        </p>
        {logisticsLocked && (
          <p className="text-xs font-medium text-buzz-inkMuted">
            Capacity, window, and unit budget are locked while the drop is live or
            finished. Hashtag can still be updated.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="drop-config-title"
              label="Title"
              size="compact"
              value={title}
              disabled={patch.isPending}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              id="drop-config-description"
              label="Description"
              size="compact"
              rows={3}
              value={description}
              disabled={patch.isPending}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              id="drop-config-image"
              label="Image (https)"
              size="compact"
              type="url"
              value={image}
              disabled={patch.isPending}
              onChange={(e) => setImage(e.target.value)}
            />
          </div>
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
            disabled={logisticsLocked || patch.isPending}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <div>
            <TextField
              id="drop-config-units"
              label="Unit budget"
              size="compact"
              type="number"
              min={1}
              value={units}
              disabled={logisticsLocked || clearUnits || patch.isPending}
              placeholder="Leave empty, then clear for spot-only"
              onChange={(e) => setUnits(e.target.value)}
            />
            <Checkbox
              wrapperClassName="mt-1"
              checked={clearUnits}
              disabled={logisticsLocked || patch.isPending}
              onChange={(e) => setClearUnits(e.target.checked)}
              label={<span className="text-xs text-buzz-inkMuted">Clear to spot-only</span>}
            />
          </div>
          <DateTimeField
            id="drop-config-open-at"
            label="Apply opens"
            size="compact"
            value={openAt}
            disabled={logisticsLocked || patch.isPending}
            onChange={(e) => setOpenAt(e.target.value)}
          />
          <DateTimeField
            id="drop-config-close-at"
            label="Apply closes"
            size="compact"
            value={closeAt}
            disabled={logisticsLocked || patch.isPending}
            onChange={(e) => setCloseAt(e.target.value)}
          />
          <div className="sm:col-span-2">
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
              label={<span className="text-xs text-buzz-inkMuted">Clear hashtag</span>}
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              id="brand-can-edit-creative"
              data-testid="brand-can-edit-creative"
              label="Who can edit"
              size="compact"
              value={brandCanEditCreative ? "brand" : "admin"}
              disabled={patch.isPending}
              onChange={(e) => setBrandCanEditCreative(e.target.value === "brand")}
              aria-describedby="brand-can-edit-creative-help"
            >
              <option value="admin">Admin only</option>
              <option value="brand">
                Brand can edit title, description, and image
              </option>
            </Select>
            <p
              id="brand-can-edit-creative-help"
              className="mt-0.5 text-xs font-medium text-buzz-inkMuted"
            >
              Brand cannot change dates, capacity, or publish.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
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

function TrackerControls({
  dropId,
  currentStage,
  finalized,
  manualReopen,
  currentTracking,
}: {
  dropId: string;
  currentStage: string;
  finalized: boolean;
  manualReopen: boolean;
  currentTracking: string | null;
}) {
  const advance = useAdvanceTracker(dropId);
  const reopen = useReopenDrop(dropId);
  const clearReopen = useClearReopen(dropId);
  const setTracking = useSetDropTracking(dropId);
  const [error, setError] = useState<string | null>(null);
  const [repairTracking, setRepairTracking] = useState(currentTracking ?? "");

  const currentIndex = STAGE_ORDER.indexOf(
    currentStage as (typeof STAGE_ORDER)[number],
  );
  const forwardStages = STAGE_ORDER.slice(currentIndex + 1);
  const [stage, setStage] = useState<string>(forwardStages[0] ?? "");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [note, setNote] = useState("");

  const needsTracking = stage === "awaiting_products";
  const awaitingIdx = STAGE_ORDER.indexOf("awaiting_products");
  const stageIdx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  // The backend refuses any jump past selection while the brand has not decided
  // its applicants, because finalize requires the selection stage and there is no
  // way back.
  const blockedByFinalize =
    !finalized &&
    stageIdx > STAGE_ORDER.indexOf("finalizing_agreements");
  // Jumping over awaiting_products would strand accepted orgs without tracking.
  const blockedBySkipAwaiting =
    currentIndex < awaitingIdx && stageIdx > awaitingIdx;
  const canRepairTracking = currentIndex >= awaitingIdx;
  const liveOrFinished =
    currentStage === "drop_active" || currentStage === "drop_finished";
  // Live/finished + finalized: apply stays closed even with manual_reopen, so
  // do not offer a no-op "Reopen apply window" control.
  const canReopenApply = !(liveOrFinished && finalized);
  const advanceDisabled =
    advance.isPending ||
    blockedByFinalize ||
    blockedBySkipAwaiting ||
    (needsTracking && !trackingNumber.trim());

  const submit = async () => {
    setError(null);
    try {
      await advance.mutateAsync({ stage, trackingNumber, note });
      setTrackingNumber("");
      setNote("");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not advance the tracker.",
      );
    }
  };

  const doReopen = async () => {
    setError(null);
    try {
      await reopen.mutateAsync(undefined);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not reopen the drop.",
      );
    }
  };

  const doClearReopen = async () => {
    setError(null);
    try {
      await clearReopen.mutateAsync(undefined);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not clear the reopen flag.",
      );
    }
  };

  const doRepairTracking = async () => {
    setError(null);
    try {
      await setTracking.mutateAsync(repairTracking.trim());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not update the tracking number.",
      );
    }
  };

  return (
    <Panel
      title="Tracker"
      description="Stages only move forward. Tracking is required on the move into awaiting products. Pre-live reopen clears finalize for a new selection round; once a live or finished drop is finalized, apply stays closed."
    >
      <div className="space-y-4 px-4 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}

        {forwardStages.length === 0 ? (
          <p className="text-sm font-medium text-buzz-inkMuted">
            This drop is at the final stage.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              id="tracker-stage"
              data-testid="tracker-stage"
              size="compact"
              label="Advance to"
              value={stage}
              onChange={(event) => setStage(event.target.value)}
            >
              {forwardStages.map((option) => (
                <option key={option} value={option}>
                  {STAGE_LABELS[option]}
                </option>
              ))}
            </Select>

            {needsTracking && (
              <TextField
                id="tracker-tracking-number"
                data-testid="tracker-tracking-number"
                label="Tracking number (required)"
                size="compact"
                value={trackingNumber}
                onChange={(event) => setTrackingNumber(event.target.value)}
                placeholder="Required for this transition"
              />
            )}

            <div className="sm:col-span-2">
              <TextField
                id="tracker-note"
                data-testid="tracker-note"
                label="Note (optional)"
                size="compact"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        )}

        {needsTracking && !trackingNumber.trim() && (
          <WarningBanner>
            Tracking is required on the move into this stage.
          </WarningBanner>
        )}

        {blockedByFinalize && (
          <ErrorBanner>
            The brand has not finalized its applicant selection. Advancing past
            that stage would strand every applicant with no way to decide them.
          </ErrorBanner>
        )}

        {blockedBySkipAwaiting && (
          <ErrorBanner>
            Advance to awaiting_products with a tracking number before
            drop_active.
          </ErrorBanner>
        )}

        {canRepairTracking && (
          <div className="grid grid-cols-1 gap-3 border-t border-buzz-lineMid pt-4 sm:grid-cols-[1fr_auto]">
            <TextField
              id="repair-tracking-number"
              data-testid="repair-tracking-number"
              label="Repair tracking number"
              size="compact"
              value={repairTracking}
              onChange={(event) => setRepairTracking(event.target.value)}
            />
            <div className="flex items-end">
              <ActionButton
                testId="repair-tracking"
                className="self-end"
                disabled={setTracking.isPending || !repairTracking.trim()}
                onClick={() => void doRepairTracking()}
              >
                {setTracking.isPending ? "Saving…" : "Save tracking"}
              </ActionButton>
            </div>
          </div>
        )}

        {!canReopenApply && (
          <p className="text-xs font-bold text-buzz-inkMuted">
            Apply cannot reopen while selection is finalized on a live or
            finished drop.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {forwardStages.length > 0 && (
            <ActionButton
              variant="primary"
              testId="tracker-advance"
              disabled={advanceDisabled}
              onClick={() => void submit()}
            >
              {advance.isPending ? "Advancing…" : "Advance stage"}
            </ActionButton>
          )}
          {canReopenApply && (
            <ActionButton
              testId="drop-reopen"
              disabled={reopen.isPending}
              onClick={() => void doReopen()}
            >
              {reopen.isPending ? "Reopening…" : "Reopen apply window"}
            </ActionButton>
          )}
          {manualReopen && (
            <ActionButton
              testId="drop-clear-reopen"
              disabled={clearReopen.isPending}
              onClick={() => void doClearReopen()}
            >
              {clearReopen.isPending ? "Clearing…" : "Clear reopen"}
            </ActionButton>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Applicants({ applicants }: { applicants: AdminApplicant[] }) {
  return (
    <AdminTable
      headers={APPLICANT_HEADERS}
      isEmpty={applicants.length === 0}
      empty="Nobody has applied to this drop."
    >
      {applicants.map((applicant) => (
        <Row key={applicant.id}>
          <Cell>
            <Link
              to={`/admin/orgs/${applicant.userId}`}
              className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
            >
              {applicant.orgName}
            </Link>
            <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
              {applicant.university}
              {applicant.accountErased ? " · Account deleted" : ""}
            </span>
          </Cell>
          <Cell>
            <DecisionPill decision={applicant.decision} />
          </Cell>
          <Cell muted>{applicant.allocatedUnits ?? "—"}</Cell>
          <Cell muted>{applicant.linkedPostCount}</Cell>
          <Cell muted>{formatDate(applicant.appliedAt)}</Cell>
          <Cell muted>
            {adminApplicantShipTo(
              applicant.decision,
              applicant.deliveryAddress,
            )}
          </Cell>
        </Row>
      ))}
    </AdminTable>
  );
}

function HideCampaignPanel({ drop }: { drop: AdminDropDetail }) {
  const hide = useHideDrop(drop.id);
  const unhide = useUnhideDrop(drop.id);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [notifyBrand, setNotifyBrand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (drop.publishedAt == null) {
    return null;
  }

  const titleMatches = confirmTitle === drop.title;

  async function doHide() {
    setError(null);
    try {
      await hide.mutateAsync({ confirm: confirmTitle, notifyBrand });
      setConfirmTitle("");
      setNotifyBrand(false);
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
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not unhide this drop.",
      );
    }
  }

  if (drop.hiddenAt != null) {
    return (
      <Panel
        title="Hidden campaign"
        description="Org and brand portals cannot see this drop. Unhide restores the same URLs."
      >
        <div className="px-4 py-4">
          {error && <ErrorNote>{error}</ErrorNote>}
          <ActionButton
            variant="primary"
            testId="drop-unhide"
            disabled={unhide.isPending}
            onClick={() => void doUnhide()}
          >
            {unhide.isPending ? "Unhiding…" : "Unhide campaign"}
          </ActionButton>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Hide campaign"
      description="Removes this published drop from every org and brand portal. Confirm by typing the exact title. No email unless you opt in."
    >
      <div className="space-y-3 px-4 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <TextField
          id="hide-drop-confirm"
          data-testid="hide-drop-confirm"
          label="Type the drop title to confirm"
          size="compact"
          value={confirmTitle}
          autoComplete="off"
          onChange={(e) => setConfirmTitle(e.target.value)}
        />
        <Checkbox
          data-testid="hide-drop-notify-brand"
          checked={notifyBrand}
          onChange={(e) => setNotifyBrand(e.target.checked)}
          label="Email the brand that this campaign was withdrawn"
        />
        <ActionButton
          variant="danger"
          testId="hide-drop"
          disabled={!titleMatches || hide.isPending}
          onClick={() => void doHide()}
        >
          {hide.isPending ? "Hiding…" : "Hide campaign"}
        </ActionButton>
      </div>
    </Panel>
  );
}

export default function AdminDropDetailPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const drop = useAdminDrop(dropId);
  const data = drop.data;
  const defaultTab = data?.publishedAt == null ? "config" : "applicants";
  const activeTab = searchParams.get("tab") ?? defaultTab;
  const acceptedCount =
    data?.applicants.filter((a) => a.decision === "accepted").length ?? 0;

  return (
    <div>
      <Link
        to="/admin/drops"
        className="mb-4 inline-block text-xs font-bold text-buzz-coral hover:underline"
      >
        &larr; All drops
      </Link>

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
                <Pill>{STAGE_LABELS[data.stage] ?? data.stage}</Pill>
                {data.publishedAt == null ? (
                  <Pill tone="warn">Draft</Pill>
                ) : (
                  <Pill tone="good">Published</Pill>
                )}
                {data.hiddenAt != null && <Pill tone="bad">Hidden</Pill>}
                {data.manualReopen && <Pill tone="warn">Reopened</Pill>}
                {acceptedCount > data.capacityTotal && (
                  <Pill tone="bad">Over capacity</Pill>
                )}
              </div>
            }
          />

          <TrackerControls
            dropId={data.id}
            currentStage={data.stage}
            finalized={data.finalizedAt !== null}
            manualReopen={data.manualReopen}
            currentTracking={data.trackingNumber}
          />

          <div className="mb-4 flex gap-2 overflow-x-auto border-b border-buzz-lineMid">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`tab-${tab.id}`}
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "border-buzz-coral text-buzz-coral"
                    : "border-transparent text-buzz-inkMuted hover:text-buzz-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "config" && (
            <Panel title="Configuration">
              <FieldGrid>
                <Field label="Capacity">
                  {acceptedCount} accepted of {data.capacityTotal}
                </Field>
                <Field label="Unit budget">
                  {data.totalProductUnits === null
                    ? "Spot-only (no units)"
                    : `${data.allocatedUnits} of ${data.totalProductUnits} allocated`}
                </Field>
                <Field label="Apply window">
                  {formatDate(data.applyOpenAt)} – {formatDate(data.applyCloseAt)}
                  {data.applyCloseAt <= Date.now() && (
                    <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
                      closed {formatElapsed(data.applyCloseAt)} ago
                    </span>
                  )}
                </Field>
                <Field label="Selection finalized">
                  {data.finalizedAt ? (
                    formatDateTime(data.finalizedAt)
                  ) : (
                    <Pill tone="warn">Not yet</Pill>
                  )}
                </Field>
                <Field label="Tracking number">
                  {data.trackingNumber ?? "—"}
                </Field>
                <Field label="Campaign hashtag">
                  {data.campaignHashtag ?? (
                    <span className="text-buzz-inkMuted">
                      None — auto-link matches on the brand handle only
                    </span>
                  )}
                </Field>
                <Field label="Published">
                  {data.publishedAt != null ? (
                    formatDateTime(data.publishedAt)
                  ) : (
                    <Pill tone="warn">Draft</Pill>
                  )}
                </Field>
                {data.dropRequestId && (
                  <Field label="Drop request">
                    <Link
                      to={`/admin/requests/${data.dropRequestId}`}
                      className="font-bold text-buzz-coral hover:underline"
                    >
                      View ticket
                    </Link>
                  </Field>
                )}
              </FieldGrid>
              <DropConfigEditors data={data} />
            </Panel>
          )}
          {activeTab === "applicants" && (
            <Panel>
              <Applicants applicants={data.applicants} />
            </Panel>
          )}

          {activeTab === "timeline" && (
            <Panel description="Stage transitions, oldest first. Notes prefixed with 'auto:' were written by the auto-close job.">
              {data.trackerEvents.length === 0 ? (
                <p className="px-4 py-6 text-sm font-medium text-buzz-inkMuted">
                  No tracker events recorded yet.
                </p>
              ) : (
                <ol className="divide-y divide-buzz-lineMid">
                  {data.trackerEvents.map((event) => (
                    <li key={event.id} className="px-4 py-3">
                      <p className="text-sm font-bold text-buzz-ink">
                        {STAGE_LABELS[event.stage] ?? event.stage}
                      </p>
                      <p className="text-xs font-medium text-buzz-inkMuted">
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
            <Panel description="Posts the orgs have linked to this campaign, and suggestions the scan job found that nobody has confirmed.">
              <FieldGrid>
                <Field label="Attributed posts">{data.linkedPostCount}</Field>
                <Field label="Unconfirmed suggestions">
                  {data.pendingSuggestionCount}
                  {data.pendingSuggestionCount > 0 && (
                    <span className="ml-2 text-xs font-medium text-buzz-warn">
                      metrics understate reality until orgs confirm these
                    </span>
                  )}
                </Field>
                <Field label="Brand handle">
                  {data.brandInstagramHandle
                    ? `@${data.brandInstagramHandle.replace(/^@/, "")}`
                    : "Not set — nothing to match on"}
                </Field>
              </FieldGrid>
            </Panel>
          )}

          <HideCampaignPanel drop={data} />
        </>
      )}
    </div>
  );
}
