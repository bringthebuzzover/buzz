/**
 * Shared trigger + popover frame for every picker field.
 *
 * All three pickers (`DatePicker`, `DateTimePicker`, `DateRangePicker`) render
 * the same glass field, the same clear affordance and the same floating glass
 * panel. Only the panel body differs, so the chrome is written once.
 *
 * The panel is portalled to `document.body` on purpose. `backdrop-filter`
 * only sees content outside the nearest ancestor that itself has a
 * `backdrop-filter`; these fields sit inside glass cards, so an in-flow panel
 * would blur nothing and page text would read straight through the calendar.
 * Escaping to body gives the panel the real page behind it to blur.
 */
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import {
  focusRingClass,
  fieldErrorClass,
  fieldHintClass,
  fieldLabelClass,
  fieldLabelCompactClass,
} from "../../../theme/controls";

export type ControlSize = "default" | "compact";

export interface PickerFieldProps {
  id?: string;
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  size?: ControlSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Short readout on the trigger, e.g. "Nov 24, 2026". */
  display?: string;
  /** Leading icon slot; defaults to a calendar glyph. */
  icon?: ReactNode;
  /** Extra trigger content rendered before the clear button. */
  accessory?: ReactNode;
  onClear?: () => void;
  canClear?: boolean;
  /** Panel body. */
  children: ReactNode;
  /**
   * Always-mounted node behind the field. The native `<input>` lives here, not
   * in `children`, so form serialization and test fills work while the
   * popover is closed.
   */
  hiddenInput?: ReactNode;
  /** Popover width class, so each picker can size its own panel. */
  panelClassName?: string;
  /** Hide the panel (e.g. while a range Apply is pending). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Gap between the trigger and the panel. */
const GAP = 8;
/** Keep the panel this far inside the viewport on every edge. */
const VIEWPORT_MARGIN = 12;

export function PickerField({
  id,
  label,
  hint,
  error,
  size = "default",
  disabled = false,
  required = false,
  placeholder = "Select",
  className,
  display,
  icon,
  accessory,
  hiddenInput,
  onClear,
  canClear = false,
  children,
  panelClassName,
  open,
  onOpenChange,
}: PickerFieldProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );

  // Fixed positioning against the trigger, re-measured on scroll and resize.
  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const width = panel?.offsetWidth ?? 0;
      const height = panel?.offsetHeight ?? 0;

      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, rect.left),
        Math.max(
          VIEWPORT_MARGIN,
          window.innerWidth - width - VIEWPORT_MARGIN,
        ),
      );

      // Flip above the trigger when the panel would run off the bottom and
      // there is more room up than down.
      const below = rect.bottom + GAP;
      const overflowsBelow = below + height > window.innerHeight - VIEWPORT_MARGIN;
      const roomAbove = rect.top - GAP - VIEWPORT_MARGIN;
      const top =
        overflowsBelow && roomAbove > height
          ? rect.top - GAP - height
          : Math.min(
              below,
              Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN),
            );

      setPosition({ left, top });
    };

    place();
    // A second pass once the panel has real dimensions, so the flip is accurate.
    const frame = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen]);

  // Outside click and Escape. The panel lives outside `containerRef` now, so
  // both nodes are checked.
  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, setOpen]);

  const panel =
    isOpen && !disabled ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label={typeof label === "string" ? label : "Pick a value"}
        style={{
          left: position?.left ?? -9999,
          top: position?.top ?? -9999,
          visibility: position ? "visible" : "hidden",
        }}
        className={cn(
          "fixed z-[130] animate-buzz-rise rounded-buzzModal border border-line p-4",
          "buzz-glass-popover motion-reduce:animate-none",
          "max-w-[calc(100vw-24px)]",
          panelClassName,
        )}
      >
        {children}
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
    >
      {label && (
        <label
          htmlFor={id ? `${id}-trigger` : undefined}
          className={size === "compact" ? fieldLabelCompactClass : fieldLabelClass}
        >
          {label}
          {required && <span className="ml-0.5 text-buzz-yellow">*</span>}
        </label>
      )}

      <button
        ref={triggerRef}
        id={id ? `${id}-trigger` : undefined}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-describedby={
          id && (error || hint)
            ? `${id}-${error ? "error" : "hint"}`
            : undefined
        }
        onClick={() => setOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-buzzField border border-line text-left",
          "bg-buzz-paper04 text-primary backdrop-blur-md backdrop-saturate-125",
          "transition-colors duration-150 motion-reduce:transition-none",
          "hover:border-quiet",
          size === "compact" ? "h-9 px-3 text-sm" : "h-12 px-4 text-sm",
          isOpen && "border-buzz-yellow",
          error && fieldErrorClass,
          disabled && "cursor-not-allowed bg-buzz-neutral text-muted opacity-100",
          focusRingClass,
        )}
      >
        <span
          className={cn("truncate", display ? "text-primary" : "text-quiet")}
        >
          {display || placeholder}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          {accessory}
          {canClear && !disabled && onClear && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear"
              onClick={(event) => {
                event.stopPropagation();
                onClear();
              }}
              className={cn(
                "grid size-5 place-items-center rounded-buzzCheck text-muted hover:bg-buzz-paper08 hover:text-primary",
                MOTION.transitionColors,
              )}
            >
              <X className="size-3.5" />
            </span>
          )}
          <span className={isOpen ? "text-buzz-yellow" : "text-muted"}>
            {icon ?? <CalendarIcon className="size-4" />}
          </span>
        </span>
      </button>

      {panel ? createPortal(panel, document.body) : null}

      {hiddenInput}

      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          className="mt-1.5 text-xs font-medium text-buzz-dangerInk"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={id ? `${id}-hint` : undefined} className={fieldHintClass}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
