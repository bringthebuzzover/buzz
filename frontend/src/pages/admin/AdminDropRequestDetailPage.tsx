/**
 * /admin/requests/:id — side-by-side ticket | draft-drop editor (LAUNCH.md Phase B).
 *
 * Left: draft editor (Campaign, Logistics, Settings, Drop). Save and Publish
 * sit in the page header. Right: the brand request, read-only.
 * Prefill copies title, location, capacity, total units, and hashtag only.
 */
import { useEffect, useState, type ReactNode } from "react";
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
  AdminBackLink,
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
  SuccessBanner,
  TextArea,
  TextField,
} from "../../components/forms/controls";
import { Toggle } from "../../components/ui/Toggle";
import { STACK, TEXT } from "../../theme/tokens";
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

/**
 * Copy logistics the brand already named. The org-facing description is left
 * untouched — the admin writes it. Missing optionals are left alone so a blank
 * ticket does not wipe capacity or a hashtag the admin already typed. Total
 * units are set only when both organization count and units per org exist.
 */
function applyRequestPrefill(
  form: DraftFormState,
  ticket: {
    title?: string | null;
    location?: string | null;
    campaignHashtag?: string | null;
    orgCount?: number | null;
    unitsPerOrg?: number | null;
  },
): DraftFormState {
  const next = { ...form };
  const title = ticket.title?.trim();
  if (title) next.title = title;
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

function EditorSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn(STACK.tight, "border-t border-line px-4 py-4")}>
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

function TicketPanel({ ticket }: { ticket: AdminDropRequest }) {
  return (
    <Panel
      title="Brand request"
      description="Read-only. The message and product stay here — they are not copied into the org-facing description."
    >
      <FieldGrid columns={2}>
        <Field label="Brand">
          <Link
            to={`/admin/brands/${ticket.brandId}`}
            className="text-primary hover:text-accent"
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
      <div className="space-y-3 border-t border-line px-4 py-4">
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Title</p>
          <p className="text-sm font-medium text-primary">{display(ticket.title)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Tell us about the campaign</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-primary">
            {ticket.message}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>What you're sending</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-primary">
            {display(ticket.product)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Campuses or area</p>
          <p className="text-sm font-medium text-primary">{display(ticket.location)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>When do you want this live?</p>
          <p className="text-sm font-medium text-primary">
            {formatTargetDate(ticket.targetDate)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Organizations</p>
          <p className="text-sm font-medium text-primary">{display(ticket.orgCount)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Units per organization</p>
          <p className="text-sm font-medium text-primary">{display(ticket.unitsPerOrg)}</p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Campaign hashtag</p>
          <p className="text-sm font-medium text-primary">
            {display(ticket.campaignHashtag)}
          </p>
        </div>
        <div>
          <p className={cn(TEXT.micro, "text-muted")}>Notes</p>
          <p className="whitespace-pre-wrap text-sm font-medium text-muted">
            {ticket.notes?.trim() ? ticket.notes : "—"}
          </p>
        </div>
        {ticket.convertedDropId && (
          <p className="text-xs font-medium text-muted">
            Linked drop:{" "}
            <Link
              to={`/admin/drops/${ticket.convertedDropId}`}
              className="text-accent hover:underline"
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
      <div className="space-y-3 border-t border-line px-4 py-4">
        <p className="whitespace-pre-wrap text-sm font-medium text-primary">
          {drop.description}
        </p>
        <Link
          to={`/admin/drops/${drop.id}?tab=config`}
          className="inline-block text-sm text-accent hover:underline"
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
  linkedPending,
  linkedError,
}: {
  ticket: AdminDropRequest;
  linkedDrop: AdminDropDetail | undefined;
  linkedPending: boolean;
  linkedError: boolean;
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

  const saveLabel =
    create.isPending || patch.isPending ? "Saving…" : "Save draft";
  const headerActions = published ? null : (
    <div className="flex flex-wrap gap-2">
      <ActionButton
        testId="save-draft"
        disabled={busy || !ready}
        onClick={() => void onSaveDraft()}
      >
        {saveLabel}
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
  );

  const editor =
    published && drop ? (
      <PublishedDropSummary drop={drop} />
    ) : (
      <Panel
        title="Draft drop"
        description="You write the org-facing description. Prefill does not copy the brand message or product."
      >
        <EditorSection
          title="Campaign"
          description="What organizations see: title, story, and hero image."
        >
          <TextField
            id="draft-title"
            label="Title"
            size="compact"
            data-testid="draft-title"
            value={form.title}
            disabled={busy}
            onChange={(e) => setField("title", e.target.value)}
          />
          <TextArea
            id="draft-description"
            label="Description"
            size="compact"
            data-testid="draft-description"
            rows={4}
            value={form.description}
            disabled={busy}
            placeholder="Org-facing copy. Write this yourself."
            onChange={(e) => setField("description", e.target.value)}
          />
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
              className="max-h-40 rounded-buzzBoard border border-line object-cover"
            />
          ) : null}
        </EditorSection>

        <EditorSection
          title="Logistics"
          description="Where it runs, how many seats, and the apply window."
        >
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </EditorSection>

        <EditorSection
          title="Settings"
          description="Hashtag matching and who may edit creative after publish."
        >
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-primary">Brand can edit details</p>
              <p className="mt-1 text-xs text-quiet">
                Lets the brand change title, description and image. Dates, capacity
                and publishing stay with BUZZ.
              </p>
            </div>
            <Toggle
              data-testid="draft-brand-can-edit"
              checked={form.brandCanEditCreative}
              disabled={busy}
              onChange={(next) => setField("brandCanEditCreative", next)}
              label="Brand can edit details"
            />
          </div>
        </EditorSection>

        <EditorSection
          title="Drop"
          description="Unpublished until you publish. Organizations cannot see it yet."
        >
          <Pill tone="warn">Draft</Pill>
          {!ready && (
            <p className="text-xs font-medium text-muted">
              Fill title, description, https image, location, capacity, and
              apply window to enable Save and Publish.
            </p>
          )}
        </EditorSection>
      </Panel>
    );

  return (
    <div>
      <PageHeading
        title={`Request · ${ticket.title?.trim() || ticket.brandName}`}
        subtitle={`${ticket.brandName} · request received ${formatDate(ticket.createdAt)}. The first Save creates the drop, later saves update it.`}
        actions={headerActions}
      />

      {linkedPending && (
        <QueryState isPending isError={false} label="the linked draft" />
      )}
      {linkedError && <ErrorNote>Could not load the linked drop.</ErrorNote>}

      {!published && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <SuccessBanner>
            Start with Prefill from request: it copies title, location, capacity,
            total units, and the hashtag. Nothing is saved until you save the draft.
          </SuccessBanner>
          <ActionButton
            testId="prefill-from-request"
            disabled={busy}
            onClick={prefill}
          >
            Prefill from request
          </ActionButton>
        </div>
      )}

      {notice && <SuccessBanner>{notice}</SuccessBanner>}
      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        {editor}
        <TicketPanel ticket={ticket} />
      </div>
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
      <AdminBackLink to="/admin/requests" />

      <QueryState
        isPending={ticket.isPending}
        isError={ticket.isError}
        label="this request"
      />

      {ticket.data && (
        <DraftEditor
          ticket={ticket.data}
          linkedDrop={linked.data}
          linkedPending={Boolean(linkedId && linked.isPending)}
          linkedError={Boolean(linkedId && linked.isError)}
        />
      )}
    </div>
  );
}
