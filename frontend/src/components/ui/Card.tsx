import type { HTMLAttributes, ReactNode } from "react";
import { PAD, SURFACE, TEXT, type PadStep, type SurfaceKind } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/**
 * The surface primitive. Before this existed, cards were assembled per file,
 * which is why the app carried 11 `rounded-*` variants and 5 shadow families —
 * often two or three inside a single component tree.
 *
 * Pick `kind` by role (see `SURFACE`), not by how it looks today.
 */
export function Card({
  kind = "card",
  pad = "card",
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  kind?: SurfaceKind;
  pad?: PadStep | "none";
}) {
  return (
    <div
      className={cn(SURFACE[kind], pad !== "none" && PAD[pad], className)}
      {...rest}
    >
      {children}
    </div>
  );
}

/**
 * Card title + optional supporting line. `max-w-prose` on the description is
 * deliberate: uncapped panel descriptions were running ~1150px on wide admin
 * screens.
 */
export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h3 className={TEXT.h3}>{title}</h3>
        {description && (
          <p className={cn(TEXT.meta, "mt-1 max-w-prose")}>{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
