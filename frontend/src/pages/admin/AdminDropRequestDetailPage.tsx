/**
 * /admin/requests/:id — side-by-side ticket | draft-drop editor (LAUNCH.md Phase B).
 *
 * Left: intake ticket (reference only — not auto-filled into creative).
 * Right: draft form. Save draft mints an unpublished drop linked to the ticket;
 * Publish is a separate action once a drop exists.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  useAdminDrop,
  useAdminDropRequest,
  useCreateAdminDrop,
  usePatchAdminDropConfig,
  usePublishDrop,
  type AdminDropDetail,
  type AdminDropRequest,
} from "../../api/hooks/useAdminHooks";
import { ApiError } from "../../api/client";
import {
  ActionButton,
  ErrorNote,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  Pill,
  QueryState,
} from "../../components/admin/AdminPrimitives";
import {
  formatDate,
  formatDateTime,
  toDatetimeLocalValue,
} from "../../components/admin/labels";

const fieldLabelClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint";

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-2 text-sm outline-none focus:border-buzz-coral focus:ring-1 focus:ring-buzz-coral disabled:opacity-60";

function isValidHeroImage(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().includes("placehold.co")) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function defaultWindow() {
  const open = Date.now() + 24 * 60 * 60 * 1000;
  const close = open + 7 * 24 * 60 * 60 * 1000;
  return {
    openAt: toDatetimeLocalValue(open),
    closeAt: toDatetimeLocalValue(close),
  };
}

type DraftFormState = {
  title: string;
  description: string;
  image: string;
  location: string;
  capacity: string;
  units: string;
  openAt: string;
  closeAt: string;
  hashtag: string;
};

function emptyForm(): DraftFormState {
  const win = defaultWindow();
  return {
    title: "",
    description: "",
    image: "",
    location: "",
    capacity: "10",
    units: "",
    openAt: win.openAt,
    closeAt: win.closeAt,
    hashtag: "",
  };
}

function formFromDrop(drop: AdminDropDetail): DraftFormState {
  return {
    title: drop.title,
    description: drop.description,
    image: drop.image,
    location: drop.location,
    capacity: String(drop.capacityTotal),
    units:
      drop.totalProductUnits === null ? "" : String(drop.totalProductUnits),
    openAt: toDatetimeLocalValue(drop.applyOpenAt),
    closeAt: toDatetimeLocalValue(drop.applyCloseAt),
    hashtag: drop.campaignHashtag ?? "",
  };
}

function requiredReady(form: DraftFormState): boolean {
  return (
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    isValidHeroImage(form.image.trim()) &&
    form.location.trim().length > 0 &&
    Number.isInteger(Number(form.capacity)) &&
    Number(form.capacity) >= 1 &&
    Number.isFinite(new Date(form.openAt).getTime()) &&
    Number.isFinite(new Date(form.closeAt).getTime())
  );
}

function TicketPanel({ ticket }: { ticket: AdminDropRequest }) {
  return (
    <Panel title="Ticket" description="Reference only — do not paste as title/description.">
      <FieldGrid>
        <Field label="Brand">
          <Link
            to={`/admin/brands/${ticket.brandId}`}
            className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
          >
            {ticket.brandName}
          </Link>
        </Field>
        <Field label="Status">
          <Pill
            tone={
              ticket.status === "converted"
                ? "good"
                : ticket.status === "received"
                  ? "warn"
                  : "neutral"
            }
          >
            {ticket.status}
          </Pill>
        </Field>
        <Field label="Created">{formatDateTime(ticket.createdAt)}</Field>
        <Field label="Updated">{formatDateTime(ticket.updatedAt)}</Field>
      </FieldGrid>
      <div className="space-y-3 border-t border-buzz-lineMid px-4 py-4">
        <div>
          <p className={fieldLabelClass}>Message</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-buzz-ink">
            {ticket.message}
          </p>
        </div>
        <div>
          <p className={fieldLabelClass}>Notes</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-buzz-inkMuted">
            {ticket.notes?.trim() ? ticket.notes : "—"}
          </p>
        </div>
        {ticket.convertedDropId && (
          <p className="text-xs font-medium text-buzz-inkMuted">
            Linked drop:{" "}
            <Link
              to={`/admin/drops/${ticket.convertedDropId}`}
              className="font-bold text-buzz-coral hover:underline"
            >
              open drop detail
            </Link>
          </p>
        )}
      </div>
    </Panel>
  );
}

function PublishedDropSummary({ drop }: { drop: AdminDropDetail }) {
  return (
    <Panel
      title="Published drop"
      description="Creative and logistics live on drop detail. This ticket stays the intake record."
    >
      <FieldGrid>
        <Field label="Title">{drop.title}</Field>
        <Field label="Location">{drop.location}</Field>
        <Field label="Published">
          {drop.publishedAt != null ? formatDate(drop.publishedAt) : "—"}
        </Field>
      </FieldGrid>
      <div className="space-y-3 border-t border-buzz-lineMid px-4 py-4">
        <p className="whitespace-pre-wrap text-sm font-medium text-buzz-ink">
          {drop.description}
        </p>
        <Link
          to={`/admin/drops/${drop.id}?tab=config`}
          className="inline-block text-sm font-bold text-buzz-coral hover:underline"
        >
          Open drop config
        </Link>
      </div>
    </Panel>
  );
}

function DraftEditor({
  ticket,
  linkedDrop,
}: {
  ticket: AdminDropRequest;
  linkedDrop: AdminDropDetail | undefined;
}) {
  const create = useCreateAdminDrop();
  const [minted, setMinted] = useState<AdminDropDetail | undefined>(undefined);
  const drop = linkedDrop ?? minted;
  const dropId = drop?.id ?? "";
  const patch = usePatchAdminDropConfig(dropId);
  const publish = usePublishDrop(dropId);
  const [form, setForm] = useState<DraftFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (linkedDrop) {
      setForm(formFromDrop(linkedDrop));
    }
  }, [linkedDrop]);

  const published =
    linkedDrop?.publishedAt != null || minted?.publishedAt != null;
  const ready = requiredReady(form);
  const busy = create.isPending || patch.isPending || publish.isPending;

  const setField = <K extends keyof DraftFormState>(
    key: K,
    value: DraftFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseBody = () => {
    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Capacity must be an integer ≥ 1.");
    }
    const openMs = new Date(form.openAt).getTime();
    const closeMs = new Date(form.closeAt).getTime();
    if (!Number.isFinite(openMs) || !Number.isFinite(closeMs)) {
      throw new Error("Apply window times are invalid.");
    }
    if (openMs >= closeMs) {
      throw new Error("Apply opens must be before apply closes.");
    }
    if (!isValidHeroImage(form.image.trim())) {
      throw new Error("Image must be an https:// URL (not a placeholder).");
    }
    let units: number | null | undefined;
    if (form.units.trim() !== "") {
      const u = Number(form.units);
      if (!Number.isInteger(u) || u < 1) {
        throw new Error("Unit budget must be an integer ≥ 1, or leave empty.");
      }
      units = u;
    } else {
      units = null;
    }
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      image: form.image.trim(),
      location: form.location.trim(),
      capacityTotal: capacity,
      applyOpenAt: openMs,
      applyCloseAt: closeMs,
      totalProductUnits: units,
      campaignHashtag: form.hashtag.trim() || null,
    };
  };

  const onSaveDraft = async () => {
    setError(null);
    setNotice(null);
    try {
      const body = parseBody();
      if (drop) {
        await patch.mutateAsync(body);
        setNotice("Draft updated.");
      } else {
        const created = (await create.mutateAsync({
          brandId: ticket.brandId,
          dropRequestId: ticket.id,
          ...body,
        })) as AdminDropDetail | undefined;
        if (created?.id) setMinted(created);
        setNotice("Draft saved. You can publish when ready.");
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save draft.",
      );
    }
  };

  const onPublish = async () => {
    setError(null);
    setNotice(null);
    if (!drop) {
      setError("Save a draft before publishing.");
      return;
    }
    if (!ready) {
      setError("Fill required creative and logistics fields before publishing.");
      return;
    }
    try {
      await patch.mutateAsync(parseBody());
      await publish.mutateAsync(undefined);
      setMinted({ ...drop, publishedAt: Date.now() });
      setNotice("Drop published. Brand was emailed the monitor link.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not publish.",
      );
    }
  };

  if (published && drop) {
    return <PublishedDropSummary drop={drop} />;
  }

  return (
    <Panel
      title="Draft drop"
      description="Admin writes creative and logistics. Ticket text is reference only."
    >
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="warn">Draft</Pill>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Title</span>
            <input
              data-testid="draft-title"
              className={inputClass}
              value={form.title}
              disabled={busy}
              onChange={(e) => setField("title", e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Description</span>
            <textarea
              data-testid="draft-description"
              rows={3}
              className={inputClass}
              value={form.description}
              disabled={busy}
              onChange={(e) => setField("description", e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Image (https)</span>
            <input
              data-testid="draft-image"
              className={inputClass}
              value={form.image}
              disabled={busy}
              placeholder="https://…"
              onChange={(e) => setField("image", e.target.value)}
            />
            {isValidHeroImage(form.image) ? (
              <img
                src={form.image.trim()}
                alt=""
                className="mt-2 max-h-40 rounded-lg border border-buzz-lineMid object-cover"
              />
            ) : null}
          </label>
          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Location</span>
            <input
              data-testid="draft-location"
              className={inputClass}
              value={form.location}
              disabled={busy}
              onChange={(e) => setField("location", e.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Capacity</span>
            <input
              type="number"
              min={1}
              data-testid="draft-capacity"
              className={inputClass}
              value={form.capacity}
              disabled={busy}
              onChange={(e) => setField("capacity", e.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Unit budget</span>
            <input
              type="number"
              min={1}
              data-testid="draft-units"
              className={inputClass}
              value={form.units}
              disabled={busy}
              placeholder="Optional"
              onChange={(e) => setField("units", e.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Apply opens</span>
            <input
              type="datetime-local"
              data-testid="draft-open-at"
              className={inputClass}
              value={form.openAt}
              disabled={busy}
              onChange={(e) => setField("openAt", e.target.value)}
            />
          </label>
          <label className="block">
            <span className={fieldLabelClass}>Apply closes</span>
            <input
              type="datetime-local"
              data-testid="draft-close-at"
              className={inputClass}
              value={form.closeAt}
              disabled={busy}
              onChange={(e) => setField("closeAt", e.target.value)}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className={fieldLabelClass}>Campaign hashtag</span>
            <input
              data-testid="draft-hashtag"
              className={inputClass}
              value={form.hashtag}
              disabled={busy}
              placeholder="optional"
              onChange={(e) => setField("hashtag", e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <ActionButton
            testId="save-draft"
            disabled={busy || !ready}
            onClick={() => void onSaveDraft()}
          >
            {create.isPending || patch.isPending ? "Saving…" : "Save draft"}
          </ActionButton>
          {drop ? (
            <ActionButton
              variant="primary"
              testId="publish-drop"
              disabled={busy || !ready}
              onClick={() => void onPublish()}
            >
              {publish.isPending ? "Publishing…" : "Publish"}
            </ActionButton>
          ) : (
            <ActionButton variant="primary" disabled onClick={() => undefined}>
              Publish
            </ActionButton>
          )}
        </div>
        {!ready && (
          <p className="text-xs font-medium text-buzz-inkMuted">
            Fill title, description, https image, location, capacity, and apply
            window to enable Save draft / Publish.
          </p>
        )}
        {notice && (
          <p className="text-sm font-medium text-green-700">{notice}</p>
        )}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
  );
}

export default function AdminDropRequestDetailPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const ticket = useAdminDropRequest(requestId);
  const linkedId = ticket.data?.convertedDropId ?? undefined;
  const linked = useAdminDrop(linkedId);

  return (
    <div>
      <Link
        to="/admin/requests"
        className="mb-4 inline-block text-xs font-bold text-buzz-coral hover:underline"
      >
        &larr; All requests
      </Link>

      <QueryState
        isPending={ticket.isPending}
        isError={ticket.isError}
        label="this request"
      />

      {ticket.data && (
        <>
          <PageHeading
            title={`Request · ${ticket.data.brandName}`}
            subtitle="Side-by-side ticket and draft. Publish only after creative and logistics are real."
          />

          {linkedId && linked.isPending && (
            <p className="mb-4 text-sm font-medium text-buzz-inkMuted">
              Loading linked draft…
            </p>
          )}
          {linkedId && linked.isError && (
            <ErrorNote>Could not load the linked drop.</ErrorNote>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <TicketPanel ticket={ticket.data} />
            <DraftEditor
              ticket={ticket.data}
              linkedDrop={linked.data}
            />
          </div>
        </>
      )}
    </div>
  );
}
