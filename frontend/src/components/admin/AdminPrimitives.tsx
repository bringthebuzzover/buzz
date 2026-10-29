/**
 * Shared presentational pieces for the admin panel.
 *
 * Denser than the marketing components on purpose: small type, tight rows, and
 * coral reserved for primary actions and non-zero counts so a page full of zeros
 * reads as calm. Same `buzz-*` palette as the rest of the app — no new colors.
 */
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { STAGE_LABELS, STATUS_LABELS } from "./labels";
import { Button, Checkbox, ErrorBanner } from "../forms/controls";
import { Card, CardHeader } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { PageHeader, BackLink } from "../ui/PageHeader";
import { tableHeadClass } from "../ui/Table";
import { filterChipClass } from "../ui/navItem";
import { StatePanel } from "../ui/StatePanel";
import { TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/** Admin call sites keep `good`/`bad`. Mapped onto pen badge kinds. */
type Tone = "neutral" | "good" | "warn" | "bad";

type BadgeKind = "done" | "live" | "attention" | "quiet" | "danger";

const BADGE_CLASS: Record<BadgeKind, string> = {
  /** Active / approved / published: paper-08, paper dot. */
  done: "border-transparent bg-buzz-paper08 text-primary",
  /** Waiting on us: yellow wash, yellow dot. */
  live: "border-transparent bg-accent-wash text-accent",
  /** In progress: yellow line, yellow dot, no fill. */
  attention: "border-buzz-yellowLine bg-transparent text-accent",
  /** Closed / draft / quiet: paper-08, quiet type. */
  quiet: "border-transparent bg-buzz-paper08 text-quiet",
  danger: "border-buzz-dangerLine bg-buzz-dangerFaded text-buzz-danger",
};

function badgeKindForStatus(status: string): BadgeKind {
  if (
    status === "active" ||
    status === "approved" ||
    status === "published" ||
    status === "converted" ||
    status === "accepted"
  ) {
    return "done";
  }
  if (status === "denied" || status === "erased") return "danger";
  if (
    status === "pending_approval" ||
    status === "pending_review" ||
    status === "received" ||
    status === "request_received" ||
    status === "applied"
  ) {
    return "live";
  }
  if (
    status === "pending_org_profile" ||
    status === "draft" ||
    status === "hidden" ||
    status === "drop_finished"
  ) {
    return "quiet";
  }
  if (
    status.startsWith("pending") ||
    status.startsWith("awaiting") ||
    status.startsWith("finalizing")
  ) {
    return "attention";
  }
  return "quiet";
}

const TONE_KIND: Record<Tone, BadgeKind> = {
  neutral: "quiet",
  good: "done",
  warn: "live",
  bad: "danger",
};

function AdminBadge({
  kind,
  dot = true,
  children,
}: {
  kind: BadgeKind;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium",
        BADGE_CLASS[kind],
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const kind = badgeKindForStatus(status);
  return (
    <AdminBadge kind={kind} dot={kind !== "danger"}>
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </AdminBadge>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const kind = TONE_KIND[tone];
  return (
    <AdminBadge kind={kind} dot={kind === "live" || kind === "done" || kind === "attention"}>
      {children}
    </AdminBadge>
  );
}

export { entityLinkClass } from "../ui/navItem";

/** Quiet text actions in a table row (View as, Open, Remove). */
export const rowActionClass = cn(
  "text-sm text-muted hover:text-primary",
  focusRingClass,
);

/** Apply-time claimed handle not confirmed yet. Hidden once Active — Graph bind confirms. */
export function UnconfirmedIgChip() {
  return (
    <AdminBadge kind="attention" dot={false}>
      Unconfirmed IG
    </AdminBadge>
  );
}

export function IgBindMismatchChip() {
  return <AdminBadge kind="live">IG bind mismatch</AdminBadge>;
}

/** Tracker stage. Live wash for a new request, yellow line while it is moving, quiet when finished. */
export function StagePill({ stage }: { stage: string }) {
  let kind: BadgeKind = "quiet";
  if (stage === "request_received") kind = "live";
  else if (
    stage === "finalizing_agreements" ||
    stage === "awaiting_products" ||
    stage === "drop_active"
  ) {
    kind = "attention";
  }
  return (
    <AdminBadge kind={kind}>
      {STAGE_LABELS[stage] ?? stage.replace(/_/g, " ")}
    </AdminBadge>
  );
}

/**
 * Count on a warning or health row. Pen: 40px-wide numeral, yellow when the
 * row needs a person, quiet when the count is clear. Not a circle.
 */
export function CountMark({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const hot = tone === "warn" || tone === "bad" || tone === "good";
  return (
    <span
      className={cn(
        "inline-flex w-10 shrink-0 text-xl font-medium tabular-nums",
        hot ? "text-accent" : "text-quiet",
      )}
    >
      {children}
    </span>
  );
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return <PageHeader title={title} description={subtitle} actions={actions} />;
}

/** Pen `Link / Back`. Arrow leads the label. */
export function AdminBackLink({ to }: { to: string }) {
  return (
    <BackLink to={to} className="mb-5">
      Back
    </BackLink>
  );
}

export function Panel({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card kind="panel" pad="none" className="mb-8 overflow-hidden">
      {title && (
        <header className="px-6 pt-6">
          <CardHeader
            title={title}
            description={description}
            className="mb-0"
          />
        </header>
      )}
      {children}
    </Card>
  );
}

/**
 * Below `md`, rows become hybrid cards (title + 2-col labeled facts + actions).
 * Desktop stays a table. Labels come from `headers` so pages do not duplicate copy.
 */
function withHybridCellMeta(
  headers: readonly string[],
  children: ReactNode,
): ReactNode {
  const last = headers.length - 1;
  return Children.map(children, (row) => {
    if (!isValidElement<{ children?: ReactNode }>(row)) return row;
    // JSX whitespace between <Cell>s is a child. Index only real cells or
    // labels attach to the wrong column (title would show "University", etc.).
    let cellIndex = 0;
    const cells = Children.map(row.props.children, (cell) => {
      if (!isValidElement(cell) || cell.type !== Cell) return cell;
      const i = cellIndex++;
      const header = headers[i] ?? "";
      return cloneElement(cell as ReactElement<CellProps>, {
        label: header || undefined,
        isTitle: i === 0,
        isActions: i === last && header === "",
      });
    });
    return cloneElement(row, { children: cells });
  });
}

export function AdminTable({
  headers,
  children,
  empty,
  isEmpty,
}: {
  headers: readonly string[];
  children: ReactNode;
  empty: string;
  isEmpty: boolean;
}) {
  return (
    <div className="md:overflow-x-auto">
      <table className="w-full text-left text-sm max-md:block">
        <thead className="max-md:hidden">
          <tr>
            {headers.map((header, i) => (
              <th
                key={header || `actions-${i}`}
                className={tableHeadClass}
              >
                {/* A blank header is a deliberate spacer for an actions column. */}
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-md:flex max-md:flex-col max-md:gap-3 max-md:p-3">
          {withHybridCellMeta(headers, children)}
          {isEmpty && (
            <tr className="max-md:block">
              <td colSpan={headers.length} className="px-0 py-4">
                <EmptyState title={empty} float={false} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Row({
  children,
  attention = false,
}: {
  children: ReactNode;
  /** Yellow-wash row for a record that is waiting on a decision. */
  attention?: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line align-middle last:border-0",
        attention ? "bg-accent-wash" : "hover:bg-buzz-paper04",
        "max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3 max-md:rounded-buzzBoard max-md:border max-md:border-line max-md:bg-surface-tile max-md:p-4",
        attention && "max-md:bg-accent-wash",
      )}
    >
      {children}
    </tr>
  );
}

type CellProps = {
  children: ReactNode;
  muted?: boolean;
  align?: "left" | "right";
  /** Injected by AdminTable from `headers`. */
  label?: string;
  isTitle?: boolean;
  isActions?: boolean;
};

export function Cell({
  children,
  muted = false,
  align = "left",
  label,
  isTitle = false,
  isActions = false,
}: CellProps) {
  const showLabel = Boolean(label) && !isTitle && !isActions;
  return (
    <td
      className={cn(
        "px-4 py-4 text-sm text-primary",
        muted && "text-quiet",
        align === "right" && "text-right",
        // Grid items default to min-width:auto and will blow out the 375px
        // card; wrap long emails / handles instead of clipping in the Panel.
        "max-md:flex max-md:min-w-0 max-md:flex-col max-md:gap-0.5 max-md:break-words max-md:px-0 max-md:py-0",
        isTitle && "max-md:col-span-2 max-md:text-base max-md:font-medium",
        isActions &&
          "max-md:col-span-2 max-md:flex-row max-md:flex-wrap max-md:justify-end",
      )}
    >
      {showLabel ? (
        <span className={cn(TEXT.micro, "hidden max-md:block")}>{label}</span>
      ) : null}
      {children}
    </td>
  );
}

/** Status/stage filter chips. Each chip is a real link so views are shareable. */
export function FilterChips({
  options,
  active,
  basePath,
  param,
}: {
  options: ReadonlyArray<{ value: string | null; label: string }>;
  active: string | null;
  basePath: string;
  param: string;
}) {
  const [searchParams] = useSearchParams();
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === active;
        const next = new URLSearchParams(searchParams);
        if (option.value) next.set(param, option.value);
        else next.delete(param);
        const qs = next.toString();
        const to = qs ? `${basePath}?${qs}` : basePath;
        return (
          <Link
            key={option.label}
            to={to}
            className={filterChipClass(selected)}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Dropdown multiselect for combinable admin list filters (URL owned by caller). */
export function FilterMultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selectedSet = new Set(selected);
  const orderedSelected = options.filter((option) => selectedSet.has(option.value));

  let summary = label;
  if (orderedSelected.length === 1) {
    summary = orderedSelected[0].label;
  } else if (orderedSelected.length > 1) {
    summary = `${orderedSelected[0].label} +${orderedSelected.length - 1}`;
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (selectedSet.has(value)) {
      onChange(selected.filter((item) => item !== value));
      return;
    }
    onChange([...selected, value]);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={filterChipClass(selected.length > 0)}
      >
        {summary}
      </button>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          className="absolute left-0 z-buzzDrawer mt-2 min-w-[14rem] rounded-buzzBoard border border-line bg-surface-pop py-1 shadow-buzz"
        >
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <div
                key={option.value}
                className={cn(
                  "px-3 py-1.5",
                  checked
                    ? "bg-accent-wash text-accent"
                    : "text-muted hover:bg-buzz-paper08 hover:text-primary",
                )}
              >
                <Checkbox
                  role="option"
                  aria-selected={checked}
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  label={
                    <span className="text-xs font-medium">{option.label}</span>
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-quiet">{label}</dt>
      <dd className="mt-1 break-words text-sm text-primary">
        {children}
      </dd>
    </div>
  );
}

export function FieldGrid({
  children,
  columns = 3,
}: {
  children: ReactNode;
  columns?: 2 | 3;
}) {
  return (
    <dl
      className={cn(
        "grid grid-cols-1 gap-5 px-6 py-5 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
      )}
    >
      {children}
    </dl>
  );
}

export function QueryState({
  isPending,
  isError,
  label,
}: {
  isPending: boolean;
  isError: boolean;
  label: string;
}) {
  if (isPending) {
    return <StatePanel>Loading {label}…</StatePanel>;
  }
  if (isError) {
    return <StatePanel tone="danger">Could not load {label}.</StatePanel>;
  }
  return null;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4">
      <ErrorBanner>{children}</ErrorBanner>
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  quiet = false,
  testId,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  /** Table-row action: paper-60 text, no pill. Detail-page actions stay pills. */
  quiet?: boolean;
  testId?: string;
  className?: string;
}) {
  const variants = {
    primary: "primary",
    secondary: "outline",
    danger: "danger",
  } as const;
  return (
    <Button
      type="button"
      variant={quiet ? "ghost" : variants[variant]}
      size="compact"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        quiet &&
          "h-auto border-0 bg-transparent px-0 text-sm text-muted hover:bg-transparent hover:text-primary",
        className,
      )}
    >
      {children}
    </Button>
  );
}

/** Heading chrome (hide, erase): icon only, no circle; fill on hover. */
export function HeadingIconButton({
  children,
  onClick,
  disabled,
  testId,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  className?: string;
  "aria-label": string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="compact"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-10 w-10 border-primary p-0 text-primary hover:bg-primary hover:text-on-accent hover:no-underline",
        className,
      )}
    >
      {children}
    </Button>
  );
}
