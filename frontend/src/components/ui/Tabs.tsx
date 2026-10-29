import { useRef } from "react";
import { focusRingClass } from "../../theme/controls";
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
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);

  function move(next: number) {
    const index = (next + tabs.length) % tabs.length;
    onChange(tabs[index].id);
    buttons.current[index]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("flex gap-6 border-b border-line", className)}
      onKeyDown={(event) => {
        const index = tabs.findIndex((tab) => tab.id === value);
        if (event.key === "ArrowRight") {
          event.preventDefault();
          move(index + 1);
        } else if (event.key === "ArrowLeft") {
          event.preventDefault();
          move(index - 1);
        } else if (event.key === "Home") {
          event.preventDefault();
          move(0);
        } else if (event.key === "End") {
          event.preventDefault();
          move(tabs.length - 1);
        }
      }}
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm transition",
              focusRingClass,
              selected
                ? "border-accent text-primary"
                : "border-transparent text-muted hover:text-primary",
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
