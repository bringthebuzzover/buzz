/**
 * Shared presentational pieces for the admin panel.
 *
 * Denser than the marketing components on purpose: small type, tight rows, and
 * coral reserved for primary actions and non-zero counts so a page full of zeros
 * reads as calm. Same `buzz-*` palette as the rest of the app — no new colors.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { STATUS_LABELS } from "./labels";

type Tone = "neutral" | "good" | "warn" | "bad";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-buzz-lineMid bg-buzz-cream text-buzz-inkMuted",
  good: "border-green-300 bg-green-50 text-green-800",
  warn: "border-amber-300 bg-amber-50 text-amber-800",
  bad: "border-red-300 bg-red-50 text-red-700",
};

/** Terminal states read as bad, waiting states as warn, live states as good. */
function toneForStatus(status: string): Tone {
  if (status === "active" || status === "approved") return "good";
  if (status === "denied" || status === "suspended") return "bad";
  if (status.startsWith("pending")) return "warn";
  return "neutral";
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${
        TONE_CLASS[toneForStatus(status)]
      }`}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
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
    <span
      className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[tone]}`}
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
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-buzz-ink">{title}</h1>
        {subtitle && (
          <p className="mt-1 max-w-2xl text-sm font-medium text-buzz-inkMuted">
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
    <section className="mb-8 overflow-hidden rounded-lg border border-buzz-lineMid bg-buzz-paper">
      {title && (
        <header className="border-b border-buzz-lineMid px-4 py-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-buzz-ink">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
              {description}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  );
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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-buzz-cream text-xs uppercase tracking-wide text-buzz-inkMuted">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-2.5 font-bold">
                {/* A blank header is a deliberate spacer for an actions column. */}
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {children}
          {isEmpty && (
            <tr>
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
    <tr className="border-t border-buzz-lineMid align-middle hover:bg-buzz-neutralWash">
      {children}
    </tr>
  );
}

export function Cell({
  children,
  muted = false,
  align = "left",
}: {
  children: ReactNode;
  muted?: boolean;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-4 py-2.5 ${muted ? "text-buzz-inkMuted" : "text-buzz-ink"} ${
        align === "right" ? "text-right" : ""
      }`}
    >
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
            className={`rounded-full border px-3 py-1 text-xs font-bold transition ${
              selected
                ? "border-buzz-coral bg-buzz-coral text-buzz-paper"
                : "border-buzz-lineMid bg-buzz-paper text-buzz-inkMuted hover:border-buzz-coral hover:text-buzz-coral"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
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
      <dt className="text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-buzz-ink">
        {children}
      </dd>
    </div>
  );
}

export function FieldGrid({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
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
    return (
      <p className="text-sm font-medium text-buzz-inkMuted">Loading {label}…</p>
    );
  }
  if (isError) {
    return (
      <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
        Could not load {label}.
      </p>
    );
  }
  return null;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
      {children}
    </p>
  );
}

export function ActionButton({
  children,
  onClick,
  disabled,
  variant = "secondary",
  testId,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  testId?: string;
}) {
  const variants = {
    primary:
      "border-buzz-coral bg-buzz-coral text-buzz-paper enabled:hover:bg-buzz-coralDark",
    secondary:
      "border-buzz-coral text-buzz-coral enabled:hover:bg-buzz-coral enabled:hover:text-buzz-paper",
    danger: "border-red-300 text-red-700 enabled:hover:bg-red-50",
  };
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]}`}
    >
      {children}
    </button>
  );
}
