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
  useReopenDrop,
  useSetDropTracking,
  type AdminApplicant,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
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
  formatDate,
  formatDateTime,
  formatElapsed,
} from "../../components/admin/labels";

const TABS = [
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
  "Tracking",
] as const;

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-2 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral";

function DecisionPill({ decision }: { decision: string }) {
  const tone =
    decision === "accepted" ? "good" : decision === "denied" ? "bad" : "warn";
  return <Pill tone={tone}>{decision}</Pill>;
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
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
                Advance to
              </span>
              <select
                data-testid="tracker-stage"
                className={inputClass}
                value={stage}
                onChange={(event) => setStage(event.target.value)}
              >
                {forwardStages.map((option) => (
                  <option key={option} value={option}>
                    {STAGE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>

            {needsTracking && (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
                  Tracking number (required)
                </span>
                <input
                  data-testid="tracker-tracking-number"
                  className={inputClass}
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="Required for this transition"
                />
              </label>
            )}

            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
                Note (optional)
              </span>
              <input
                data-testid="tracker-note"
                className={inputClass}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          </div>
        )}

        {needsTracking && !trackingNumber.trim() && (
          <p className="text-xs font-bold text-amber-700">
            Tracking is required on the move into this stage.
          </p>
        )}

        {blockedByFinalize && (
          <p className="text-xs font-bold text-red-700">
            The brand has not finalized its applicant selection. Advancing past
            that stage would strand every applicant with no way to decide them.
          </p>
        )}

        {blockedBySkipAwaiting && (
          <p className="text-xs font-bold text-red-700">
            Advance to awaiting_products with a tracking number before
            drop_active.
          </p>
        )}

        {canRepairTracking && (
          <div className="grid grid-cols-1 gap-3 border-t border-buzz-lineMid pt-4 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
                Repair tracking number
              </span>
              <input
                data-testid="repair-tracking-number"
                className={inputClass}
                value={repairTracking}
                onChange={(event) => setRepairTracking(event.target.value)}
              />
            </label>
            <div className="flex items-end">
              <ActionButton
                testId="repair-tracking"
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
            </span>
          </Cell>
          <Cell>
            <DecisionPill decision={applicant.decision} />
          </Cell>
          <Cell muted>{applicant.allocatedUnits ?? "—"}</Cell>
          <Cell muted>{applicant.linkedPostCount}</Cell>
          <Cell muted>{formatDate(applicant.appliedAt)}</Cell>
          <Cell muted>{applicant.trackingNumber ?? "—"}</Cell>
        </Row>
      ))}
    </AdminTable>
  );
}

export default function AdminDropDetailPage() {
  const { dropId } = useParams<{ dropId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const drop = useAdminDrop(dropId);
  const activeTab = searchParams.get("tab") ?? "applicants";
  const data = drop.data;
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
                {data.manualReopen && <Pill tone="warn">Reopened</Pill>}
                {acceptedCount > data.capacityTotal && (
                  <Pill tone="bad">Over capacity</Pill>
                )}
              </div>
            }
          />

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
            </FieldGrid>
          </Panel>

          <TrackerControls
            dropId={data.id}
            currentStage={data.stage}
            finalized={data.finalizedAt !== null}
            manualReopen={data.manualReopen}
            currentTracking={data.trackingNumber}
          />

          <div className="mb-4 flex gap-2 border-b border-buzz-lineMid">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`tab-${tab.id}`}
                onClick={() => setSearchParams({ tab: tab.id })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-bold transition ${
                  activeTab === tab.id
                    ? "border-buzz-coral text-buzz-coral"
                    : "border-transparent text-buzz-inkMuted hover:text-buzz-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

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
                    <span className="ml-2 text-xs font-medium text-amber-700">
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
        </>
      )}
    </div>
  );
}
