import { cn } from "../../theme/cn";

/**
 * Underline tabs. Pen `Tabs / Tab`: quiet label, 2px yellow bar on the active one.
 */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  className,
}: {
  label: string;
  tabs: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-6 border-b border-buzz-line", className)}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm transition",
              selected
                ? "border-buzz-yellow text-buzz-fg"
                : "border-transparent text-buzz-inkMuted hover:text-buzz-fg",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
