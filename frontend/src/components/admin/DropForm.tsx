import type { ReactNode } from "react";
import type { AdminDropDetail } from "../../api/hooks/useAdminHooks";
import { Checkbox, DateTimeField, TextArea, TextField } from "../forms/controls";
import { Toggle } from "../ui/Toggle";
import { toDatetimeLocalValue } from "./labels";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export function isValidHeroImage(url: string, allowPlaceholder = false): boolean {
  const trimmed = url.trim();
  if (!allowPlaceholder && trimmed.toLowerCase().includes("placehold.co")) {
    return false;
  }
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

export type DropFormState = {
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

export function emptyForm(): DropFormState {
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

export function dropToForm(drop: AdminDropDetail): DropFormState {
  return {
    title: drop.title,
    description: drop.description,
    image: drop.image,
    location: drop.location,
    capacity: String(drop.capacityTotal),
    units: drop.totalProductUnits === null ? "" : String(drop.totalProductUnits),
    openAt: toDatetimeLocalValue(drop.applyOpenAt),
    closeAt: toDatetimeLocalValue(drop.applyCloseAt),
    hashtag: drop.campaignHashtag ?? "",
    brandCanEditCreative: Boolean(drop.brandCanEditCreative),
  };
}

export function DropFormSection({
  title,
  description,
  children,
  config = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  config?: boolean;
}) {
  return (
    <section className={config
      ? "mb-6 space-y-4 rounded-buzzBoard border border-line bg-surface-card p-6"
      : cn(STACK.tight, "border-t border-line px-4 py-4")}
    >
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

type ParseOptions = {
  config?: boolean;
  copyOnly?: boolean;
  clearUnits?: boolean;
  clearHashtag?: boolean;
};

export function parseDropForm(form: DropFormState, options: ParseOptions = {}) {
  const { config, copyOnly, clearUnits, clearHashtag } = options;
  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Capacity must be an integer ≥ 1.");
  }
  const openMs = new Date(form.openAt).getTime();
  const closeMs = new Date(form.closeAt).getTime();
  if (!copyOnly && (!Number.isFinite(openMs) || !Number.isFinite(closeMs))) {
    throw new Error("Apply window times are invalid.");
  }
  if (!config && openMs >= closeMs) {
    throw new Error("Apply opens must be before apply closes.");
  }
  if (!config && !isValidHeroImage(form.image)) {
    throw new Error("Image must be an https:// URL (not a placeholder).");
  }
  let units: number | null = null;
  if (!clearUnits && form.units.trim() !== "") {
    units = Number(form.units);
    if (!Number.isInteger(units) || units < 1) {
      throw new Error(
        config
          ? "Unit budget must be an integer ≥ 1, or clear to spot-only."
          : "Total units must be an integer ≥ 1, or leave empty.",
      );
    }
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
    campaignHashtag: clearHashtag ? null : form.hashtag.trim() || null,
    brandCanEditCreative: form.brandCanEditCreative,
  };
}

export function dropFormError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback; // ApiError extends Error
}

export function DropFormFields({
  form,
  setField,
  prefix,
  disabled,
  copyOnly = false,
  clearUnits = false,
  clearHashtag = false,
  setClearUnits,
  setClearHashtag,
}: {
  form: DropFormState;
  setField: <K extends keyof DropFormState>(key: K, value: DropFormState[K]) => void;
  prefix: "draft" | "drop-config";
  disabled: boolean;
  copyOnly?: boolean;
  clearUnits?: boolean;
  clearHashtag?: boolean;
  setClearUnits?: (value: boolean) => void;
  setClearHashtag?: (value: boolean) => void;
}) {
  const config = prefix === "drop-config";
  const logisticsLocked = copyOnly || disabled;
  const fieldProps = (suffix: string) => ({
    id: `${prefix}-${suffix}`,
    "data-testid": config ? undefined : `${prefix}-${suffix}`,
  });
  const preview = isValidHeroImage(form.image, config) ? (
    <img
      src={form.image.trim()} alt=""
      className={config
        ? "absolute inset-0 h-full w-full object-cover"
        : "max-h-40 rounded-buzzBoard border border-line object-cover"}
    />
  ) : null;
  const titleAndDescription = (
    <>
      <TextField
        {...fieldProps("title")} label="Title" size="compact"
        value={form.title} disabled={disabled}
        onChange={(e) => setField("title", e.target.value)}
      />
      <TextArea
        {...fieldProps("description")} label="Description" size="compact"
        rows={config ? 5 : 4} value={form.description} disabled={disabled}
        placeholder={config ? undefined : "Org-facing copy. Write this yourself."}
        wrapperClassName={config ? "flex min-h-0 flex-1 flex-col" : undefined}
        className={config ? "min-h-[7.5rem] flex-1" : undefined}
        onChange={(e) => setField("description", e.target.value)}
      />
    </>
  );
  const unitsField = (
    <TextField
      {...fieldProps("units")} label="Total units" size="compact" type="number" min={1}
      value={form.units} disabled={clearUnits || logisticsLocked}
      placeholder={config ? "Leave empty, then clear for spot-only" : "Optional — organizations × units per org"}
      onChange={(e) => setField("units", e.target.value)}
    />
  );
  return (
    <>
      <DropFormSection config={config} title="Campaign" description={config
        ? "What organizations see on the drop: title, story, and hero image."
        : "What organizations see: title, story, and hero image."}>
        {config ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            {preview && (
              <div className="relative aspect-video min-h-48 w-full shrink-0 overflow-hidden rounded-buzzBoard border border-line sm:w-auto">
                {preview}
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-3">{titleAndDescription}</div>
          </div>
        ) : titleAndDescription}
        <TextField
          {...fieldProps("image")} label="Image (https)" size="compact"
          type={config ? "url" : undefined} value={form.image} disabled={disabled}
          placeholder={config ? undefined : "https://…"}
          onChange={(e) => setField("image", e.target.value)}
        />
        {!config && preview}
      </DropFormSection>
      <DropFormSection config={config} title="Logistics" description={config
        ? copyOnly
          ? "Wrapped up: only the copy and location can change. Unwrap the drop to change seats, units, dates or the hashtag."
          : "Where it runs, how many seats, and the apply window. To reopen applications, move the close date later."
        : "Where it runs, how many seats, and the apply window."}>
        <div className={config ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-6" : "grid gap-3 sm:grid-cols-2"}>
          <div className={config ? "sm:col-span-2 lg:col-span-2" : "sm:col-span-2"}>
            <TextField
              {...fieldProps("location")} label="Location" size="compact"
              value={form.location} disabled={disabled}
              onChange={(e) => setField("location", e.target.value)}
            />
          </div>
          <div className={config ? "lg:col-span-2" : undefined}>
            <TextField
              {...fieldProps("capacity")} label="Capacity" size="compact" type="number" min={1}
              value={form.capacity} disabled={logisticsLocked}
              onChange={(e) => setField("capacity", e.target.value)}
            />
          </div>
          {config ? (
            <div className="lg:col-span-2">
              {unitsField}
              <Checkbox
                wrapperClassName="mt-1" checked={clearUnits} disabled={logisticsLocked}
                onChange={(e) => setClearUnits?.(e.target.checked)}
                label={<span className="text-xs text-muted">Clear to spot-only</span>}
              />
            </div>
          ) : unitsField}
          <div className={config ? "lg:col-span-3" : undefined}>
            <DateTimeField
              {...fieldProps("open-at")} label="Apply opens" size="compact"
              value={form.openAt} disabled={logisticsLocked}
              onChange={(e) => setField("openAt", e.target.value)}
            />
          </div>
          <div className={config ? "lg:col-span-3" : undefined}>
            <DateTimeField
              {...fieldProps("close-at")} label="Apply closes" size="compact"
              value={form.closeAt} disabled={logisticsLocked}
              onChange={(e) => setField("closeAt", e.target.value)}
            />
          </div>
        </div>
      </DropFormSection>
      <DropFormSection config={config} title="Settings"
        description="Hashtag matching and who may edit creative after publish.">
        <TextField
          {...fieldProps("hashtag")} label="Campaign hashtag" size="compact"
          value={form.hashtag} disabled={clearHashtag || logisticsLocked}
          placeholder={config ? "e.g. springdrop (no # required)" : "optional"}
          onChange={(e) => setField("hashtag", e.target.value)}
        />
        {config && (
          <Checkbox
            wrapperClassName="mt-1" checked={clearHashtag} disabled={logisticsLocked}
            onChange={(e) => setClearHashtag?.(e.target.checked)}
            label={<span className="text-xs text-muted">Clear hashtag</span>}
          />
        )}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-primary">Brand can edit details</p>
            <p id={config ? "brand-can-edit-creative-help" : undefined} className="mt-1 text-xs text-quiet">
              Lets the brand change title, description and image. Dates, capacity
              and publishing stay with BUZZ.
            </p>
          </div>
          <Toggle
            id={config ? "brand-can-edit-creative" : undefined}
            data-testid={config ? "brand-can-edit-creative" : "draft-brand-can-edit"}
            checked={form.brandCanEditCreative} disabled={logisticsLocked}
            onChange={(next) => setField("brandCanEditCreative", next)}
            label="Brand can edit details"
            aria-describedby={config ? "brand-can-edit-creative-help" : undefined} />
        </div>
      </DropFormSection>
    </>
  );
}
