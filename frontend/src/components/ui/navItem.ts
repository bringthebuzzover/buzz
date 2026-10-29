import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

/** Quiet text action (Contact, Log out, "Change school email"): muted type, paper on hover. */
export const quietLinkClass = cn(
  "inline-flex items-center gap-2 whitespace-nowrap text-sm text-muted transition hover:text-primary disabled:opacity-50",
  focusRingClass,
);

/** Marketing nav item: paper type, hairline underline when active. */
export function marketingNavItemClass(active: boolean) {
  return cn(
    "whitespace-nowrap text-sm text-buzz-fg transition hover:text-buzz-yellow",
    active && "underline decoration-buzz-fg decoration-1 underline-offset-8",
  );
}

/**
 * Admin nav item. Pen: radius 10, padding 12, 16px icon slot, yellow-faded
 * active state. The authenticated header keeps the pill (`appNavItemClass`).
 */
export function adminNavItemClass(active: boolean) {
  return cn(
    "inline-flex w-full items-center gap-3 rounded-buzzField p-3 text-sm font-normal transition",
    focusRingClass,
    active
      ? "bg-accent-wash text-primary"
      : "text-muted hover:bg-buzz-paper08 hover:text-primary",
  );
}

/** App top bar nav item. Pen `Nav / Item`: pill, paper-08 fill when active. */
export function appNavItemClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-normal transition",
    focusRingClass,
    active
      ? "bg-buzz-paper08 text-primary"
      : "text-muted hover:bg-buzz-paper04 hover:text-primary",
  );
}

/** Filter chips. Pen `Chip`: selected is the paper pill, the rest are hairline. */
export function filterChipClass(selected: boolean) {
  return cn(
    "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-2 text-sm font-normal transition",
    focusRingClass,
    selected
      ? "border-transparent bg-primary text-on-accent"
      : "border-line bg-transparent text-muted hover:border-primary hover:text-primary",
  );
}
