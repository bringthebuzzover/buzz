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
      // Scrolls inside itself on narrow screens. The hairline is an inset
      // shadow, not a border, so the active tab's bar still covers it.
      className={cn(
        "flex gap-6 overflow-x-auto shadow-[inset_0_-1px_0_theme(colors.line)]",
        className,
      )}
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
            data-testid={`tab-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 pb-3 text-sm transition",
              // Inset ring: an outer one would be clipped by the scroll box.
              focusRingClass,
              "focus-visible:ring-inset focus-visible:ring-offset-0",
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
