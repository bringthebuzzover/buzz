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
import {
  DateTimeField,
  Select,
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

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
  brandCanEditCreative: boolean;
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
    brandCanEditCreative: false,
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
    brandCanEditCreative: Boolean(drop.brandCanEditCreative),
  };
}

/** Campaign brief, with the product line appended when the brand sent one. */
function requestDescription(ticket: {
  message: string;
  product?: string | null;
}): string {
  const message = ticket.message.trim();
  const product = ticket.product?.trim();
  if (message && product) {
    return `${message}\n\nWhat you're sending: ${product}`;
  }
  return message || product || "";
}

/**
 * Copy known request fields into the draft. Missing optionals are left alone
 * so a blank ticket does not wipe capacity or a hashtag the admin already typed.
 * Total units are set only when both organization count and units per org exist.
 */
function applyRequestPrefill(
  form: DraftFormState,
  ticket: {
    title?: string | null;
    message: string;
    product?: string | null;
    location?: string | null;
    campaignHashtag?: string | null;
    orgCount?: number | null;
    unitsPerOrg?: number | null;
  },
): DraftFormState {
  const next = { ...form };
  const title = ticket.title?.trim();
  if (title) next.title = title;
  const description = requestDescription(ticket);
  if (description) next.description = description;
  const location = ticket.location?.trim();
  if (location) next.location = location;
  const hashtag = ticket.campaignHashtag?.trim();
  if (hashtag) next.hashtag = hashtag;
  if (ticket.orgCount != null) next.capacity = String(ticket.orgCount);
  if (ticket.orgCount != null && ticket.unitsPerOrg != null) {
    next.units = String(ticket.orgCount * ticket.unitsPerOrg);
  }
  return next;
}

function display(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}

function formatTargetDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function TicketPanel({
  ticket,
  onPrefill,
  prefillDisabled,
}: {
  ticket: AdminDropRequest;
  onPrefill?: () => void;
  prefillDisabled?: boolean;
}) {
  return (
    <Panel
      title="Ticket"
      description="Request fields are read-only. Prefill copies them into the draft; nothing is saved until you save."
    >
      <FieldGrid columns={2}>
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
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Title</p>
          <p className="text-sm font-medium text-buzz-ink">{display(ticket.title)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Tell us about the campaign</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-buzz-ink">
            {ticket.message}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>What you're sending</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-buzz-ink">
            {display(ticket.product)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Campuses or area</p>
          <p className="text-sm font-medium text-buzz-ink">{display(ticket.location)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>When do you want this live?</p>
          <p className="text-sm font-medium text-buzz-ink">
            {formatTargetDate(ticket.targetDate)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Organizations</p>
          <p className="text-sm font-medium text-buzz-ink">{display(ticket.orgCount)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Units per organization</p>
          <p className="text-sm font-medium text-buzz-ink">{display(ticket.unitsPerOrg)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Campaign hashtag</p>
          <p className="text-sm font-medium text-buzz-ink">
            {display(ticket.campaignHashtag)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>Notes</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-buzz-inkMuted">
            {ticket.notes?.trim() ? ticket.notes : "—"}
          </p>
        </div>
        {onPrefill ? (
          <ActionButton
            testId="prefill-from-request"
            disabled={prefillDisabled}
            onClick={onPrefill}
          >
            Prefill from request
          </ActionButton>
        ) : null}
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
      <FieldGrid columns={2}>
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
        throw new Error("Total units must be an integer ≥ 1, or leave empty.");
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
      brandCanEditCreative: form.brandCanEditCreative,
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

  const prefill = () => {
    setForm((prev) => applyRequestPrefill(prev, ticket));
    setError(null);
    setNotice(
      "Filled from the request. Nothing is saved until you save the draft.",
    );
  };

  const editor =
    published && drop ? (
      <PublishedDropSummary drop={drop} />
    ) : (
    <Panel
      title="Draft drop"
      description="Admin writes creative and logistics. Use Prefill from request to copy the ticket, then edit before saving."
    >
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="warn">Draft</Pill>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="draft-title"
              label="Title"
              size="compact"
              data-testid="draft-title"
              value={form.title}
              disabled={busy}
              onChange={(e) => setField("title", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextArea
              id="draft-description"
              label="Description"
              size="compact"
              data-testid="draft-description"
              rows={3}
              value={form.description}
              disabled={busy}
              onChange={(e) => setField("description", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField
              id="draft-image"
              label="Image (https)"
              size="compact"
              data-testid="draft-image"
              value={form.image}
              disabled={busy}
              placeholder="https://…"
              onChange={(e) => setField("image", e.target.value)}
            />
            {isValidHeroImage(form.image) ? (
              <img
                src={form.image.trim()}
                alt=""
                className="mt-2 max-h-40 rounded-buzzCard border border-buzz-lineMid object-cover"
              />
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <TextField
              id="draft-location"
              label="Location"
              size="compact"
              data-testid="draft-location"
              value={form.location}
              disabled={busy}
              onChange={(e) => setField("location", e.target.value)}
            />
          </div>
          <TextField
            id="draft-capacity"
            label="Capacity"
            size="compact"
            type="number"
            min={1}
            data-testid="draft-capacity"
            value={form.capacity}
            disabled={busy}
            onChange={(e) => setField("capacity", e.target.value)}
          />
          <TextField
            id="draft-units"
            label="Total units"
            size="compact"
            type="number"
            min={1}
            data-testid="draft-units"
            value={form.units}
            disabled={busy}
            placeholder="Optional — organizations × units per org"
            onChange={(e) => setField("units", e.target.value)}
          />
          <DateTimeField
            id="draft-open-at"
            label="Apply opens"
            size="compact"
            data-testid="draft-open-at"
            value={form.openAt}
            disabled={busy}
            onChange={(e) => setField("openAt", e.target.value)}
          />
          <DateTimeField
            id="draft-close-at"
            label="Apply closes"
            size="compact"
            data-testid="draft-close-at"
            value={form.closeAt}
            disabled={busy}
            onChange={(e) => setField("closeAt", e.target.value)}
          />
          <div className="sm:col-span-2">
            <TextField
              id="draft-hashtag"
              label="Campaign hashtag"
              size="compact"
              data-testid="draft-hashtag"
              value={form.hashtag}
              disabled={busy}
              placeholder="optional"
              onChange={(e) => setField("hashtag", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Select
              id="draft-brand-can-edit"
              data-testid="draft-brand-can-edit"
              label="Who can edit"
              size="compact"
              value={form.brandCanEditCreative ? "brand" : "admin"}
              disabled={busy}
              onChange={(e) =>
                setField("brandCanEditCreative", e.target.value === "brand")
              }
            >
              <option value="admin">Admin only</option>
              <option value="brand">
                Brand can edit title, description, and image
              </option>
            </Select>
          </div>
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
        {notice && <SuccessBanner>{notice}</SuccessBanner>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div>
    </Panel>
    );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <TicketPanel
        ticket={ticket}
        onPrefill={published ? undefined : prefill}
        prefillDisabled={busy}
      />
      {editor}
    </div>
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
            <QueryState
              isPending={linked.isPending}
              isError={false}
              label="the linked draft"
            />
          )}
          {linkedId && linked.isError && (
            <ErrorNote>Could not load the linked drop.</ErrorNote>
          )}

          <DraftEditor ticket={ticket.data} linkedDrop={linked.data} />
        </>
      )}
    </div>
  );
}
