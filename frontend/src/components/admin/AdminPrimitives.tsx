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
import { Link } from "react-router-dom";
import { STATUS_LABELS } from "./labels";
import { Button, Checkbox, ErrorBanner } from "../forms/controls";
import { Card, CardHeader } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { StatePanel } from "../ui/StatePanel";
import { TEXT, TONE, type Tone as TokenTone } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/** Admin call sites keep `good`/`bad`; map onto the token tone names. */
type Tone = "neutral" | "good" | "warn" | "bad";

const ADMIN_TONE: Record<Tone, TokenTone> = {
  neutral: "neutral",
  good: "success",
  warn: "warn",
  bad: "danger",
};

/** Terminal states read as bad, waiting states as warn, live states as good. */
function toneForStatus(status: string): Tone {
  if (status === "active" || status === "approved") return "good";
  if (status === "denied" || status === "erased") return "bad";
  if (status.startsWith("pending")) return "warn";
  return "neutral";
}

/** Chip classes for FilterChips (links) and the drops All/Draft/Published/Hidden buttons. */
export function filterChipClass(selected: boolean) {
  return cn(
    "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 transition",
    TEXT.micro,
    selected
      ? "border-buzz-coral bg-buzz-coral text-buzz-paper"
      : cn(TONE.neutral, "hover:border-buzz-coral hover:text-buzz-coral"),
  );
}

export function StatusPill({ status }: { status: string }) {
  return (
    <Chip tone={ADMIN_TONE[toneForStatus(status)]} className="min-h-9">
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </Chip>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <Chip tone={ADMIN_TONE[tone]} className="min-h-9">
      {children}
    </Chip>
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
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className={TEXT.h1}>{title}</h1>
        {subtitle && (
          <p className={cn(TEXT.meta, "mt-1 max-w-2xl font-medium")}>
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
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
        <header className="border-b border-buzz-lineMid px-4 py-3">
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
        <thead className="bg-buzz-cream text-xs uppercase tracking-wide text-buzz-inkMuted max-md:hidden">
          <tr>
            {headers.map((header, i) => (
              <th
                key={header || `actions-${i}`}
                className="px-4 py-2.5 font-semibold"
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
              <td
                colSpan={headers.length}
                className="px-4 py-10 text-center text-sm font-medium text-buzz-inkMuted"
              >
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <tr
      className={cn(
        "border-t border-buzz-lineMid align-middle hover:bg-buzz-neutralWash",
        "max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3 max-md:rounded-buzzCard max-md:border max-md:border-buzz-lineMid max-md:bg-buzz-paper max-md:p-4 max-md:hover:bg-buzz-paper",
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
        "px-4 py-2.5",
        muted ? "text-buzz-inkMuted" : "text-buzz-ink",
        align === "right" && "text-right",
        // Grid items default to min-width:auto and will blow out the 375px
        // card; wrap long emails / handles instead of clipping in the Panel.
        "max-md:flex max-md:min-w-0 max-md:flex-col max-md:gap-0.5 max-md:break-words max-md:px-0 max-md:py-0",
        isTitle && "max-md:col-span-2 max-md:text-base max-md:font-semibold",
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
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === active;
        const to = option.value
          ? `${basePath}?${param}=${encodeURIComponent(option.value)}`
          : basePath;
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
          className="absolute left-0 z-buzzDrawer mt-2 min-w-[14rem] rounded-buzzControl border border-buzz-lineMid bg-buzz-paper py-1 shadow-buzz"
        >
          {options.map((option) => {
            const checked = selectedSet.has(option.value);
            return (
              <div
                key={option.value}
                className={`px-3 py-1.5 ${
                  checked
                    ? "bg-buzz-coral/10 text-buzz-coral"
                    : "text-buzz-inkMuted hover:bg-buzz-neutralWash hover:text-buzz-ink"
                }`}
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
      <dt className={cn(TEXT.micro, "text-buzz-inkMuted")}>{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-buzz-ink">
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
        "grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2",
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
  testId,
  className,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
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
      variant={variants[variant]}
      size="compact"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </Button>
  );
}
