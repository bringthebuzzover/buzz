/**
 * /admin/requests/:id — side-by-side ticket | draft-drop editor (buzz-ops engineering/plans/archive/2026-seeded-launch.md Phase B).
 *
 * Left: draft editor (Campaign, Logistics, Settings, Drop). Save and Publish
 * sit in the page header. Right: the brand request, read-only.
 * Prefill copies title, location, capacity, total units, and hashtag only.
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
import {
  ActionButton,
  AdminBackLink,
  ErrorNote,
  entityLinkClass,
  Field,
  FieldGrid,
  PageHeading,
  Panel,
  Pill,
  QueryState,
} from "../../components/admin/AdminPrimitives";
import { formatDate, formatDateTime } from "../../components/admin/labels";
import { Notice, SuccessBanner } from "../../components/forms/controls";
import { TEXT } from "../../theme/tokens";
import {
  DropFormFields,
  DropFormSection,
  dropToForm,
  emptyForm,
  isValidHeroImage,
  parseDropForm,
  dropFormError,
  type DropFormState,
} from "../../components/admin/DropForm";
import { cn } from "../../theme/cn";

/**
 * Copy logistics the brand already named. The org-facing description is left
 * untouched — the admin writes it. Missing optionals are left alone so a blank
 * ticket does not wipe capacity or a hashtag the admin already typed. Total
 * units are set only when both organization count and units per org exist.
 */
function applyRequestPrefill(
  form: DropFormState,
  ticket: {
    title?: string | null;
    location?: string | null;
    campaignHashtag?: string | null;
    orgCount?: number | null;
    unitsPerOrg?: number | null;
  },
): DropFormState {
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

function requiredReady(form: DropFormState): boolean {
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
            className={entityLinkClass}
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
  const [form, setForm] = useState<DropFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (linkedDrop) {
      setForm(dropToForm(linkedDrop));
    }
  }, [linkedDrop]);

  const published =
    linkedDrop?.publishedAt != null || minted?.publishedAt != null;
  const ready = requiredReady(form);
  const busy = create.isPending || patch.isPending || publish.isPending;

  const setField = <K extends keyof DropFormState>(
    key: K,
    value: DropFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSaveDraft = async () => {
    setError(null);
    setNotice(null);
    try {
      const body = parseDropForm(form);
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
        dropFormError(err, "Could not save draft."),
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
      await patch.mutateAsync(parseDropForm(form));
      await publish.mutateAsync(undefined);
      setMinted({ ...drop, publishedAt: Date.now() });
      setNotice("Drop published. Brand was emailed the monitor link.");
    } catch (err) {
      setError(
        dropFormError(err, "Could not publish."),
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
        <DropFormFields form={form} setField={setField} prefix="draft" disabled={busy} />

        <DropFormSection
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
        </DropFormSection>
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
          <Notice>
            Start with Prefill from request: it copies title, location, capacity,
            total units, and the hashtag. Nothing is saved until you save the draft.
          </Notice>
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
