import type { ReactNode } from "react";
import { BeeMark } from "./BrandMark";
import { MOTION } from "../../theme/motion";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * Pen empty state: bee, title, support, on a hairline board.
 * Loading copy stays on `StatePanel` so every list doesn't grow a bee.
 */
export function EmptyState({
  title,
  children,
  action,
  float = false,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** Bee float is opt-in. Admin empty states leave it off. */
  float?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-buzzBoard border border-line bg-surface-tile px-6 py-12 text-center",
        className,
      )}
      role="status"
    >
      <BeeMark className={cn("h-12 w-12", float && MOTION.float)} />
      <p className={TEXT.h3}>{title}</p>
      {children ? (
        <p className={cn(TEXT.body, "max-w-sm text-buzz-inkMuted")}>{children}</p>
      ) : null}
      {action}
    </div>
  );
}

/** Pen loader: bee, one lit dot, two quiet dots. Dots are decorative. */
export function Loader({
  label = "Loading…",
  className,
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)} role="status">
      <BeeMark className={cn("h-10 w-10", MOTION.float)} />
      <span className="flex items-center gap-2" aria-hidden>
        <span className="h-1.5 w-1.5 animate-buzz-dots rounded-full bg-accent motion-reduce:animate-none" />
        <span className="h-1.5 w-1.5 animate-buzz-dots rounded-full bg-buzz-paper30 motion-reduce:animate-none [animation-delay:300ms]" />
        <span className="h-1.5 w-1.5 animate-buzz-dots rounded-full bg-buzz-paper30 motion-reduce:animate-none [animation-delay:600ms]" />
      </span>
      <p className={cn(TEXT.body, "text-quiet")}>{label}</p>
    </div>
  );
}
