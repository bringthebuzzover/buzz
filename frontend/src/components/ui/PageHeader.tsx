import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/**
 * Page title block. Pen `Page / Head`: optional kicker in yellow, title,
 * support line, actions. `back` is the pen's back link (arrow leads the label).
 */
export function PageHeader({
  kicker,
  title,
  description,
  actions,
  back,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-3", className)}>
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker ? (
            <p className="mb-2 text-xs font-medium tracking-[0.04em] text-accent">
              {kicker}
            </p>
          ) : null}
          <h1 className={TEXT.h1}>{title}</h1>
          {description ? (
            <p className={cn(TEXT.bodyLong, "mt-2 max-w-2xl text-buzz-inkMuted")}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Pen `Link / Back`. The arrow leads the label. */
export function BackLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 self-start text-sm text-buzz-inkMuted transition hover:text-buzz-fg",
        focusRingClass,
        className,
      )}
    >
      <ArrowLeft size={14} aria-hidden />
      {children}
    </Link>
  );
}
