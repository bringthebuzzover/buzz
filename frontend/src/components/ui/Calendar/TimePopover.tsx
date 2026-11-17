/**
 * TimePopover — a time trigger with a small glass panel anchored beneath it.
 *
 * The range footer used to expand a full-width time list inline, which pushed
 * the rest of the panel around and sat far from the time it edited. This keeps
 * the list in a compact floating panel directly under its own button, so the
 * layout never moves.
 */
import { useEffect, useRef, useState } from "react";
import { Clock, X } from "lucide-react";
import { cn } from "../../../theme/cn";
import { MOTION } from "../../../theme/motion";
import { focusRingClass } from "../../../theme/controls";
import { TimeList } from "./TimeList";
import { formatDisplayTime } from "./calendarUtils";

/**
 * Surface treatments for the time panel. The page is dark and the panel is
 * dark, so without one of these the two blend together. `tint` is the default:
 * a light paper wash plus a brighter rim reads as a distinct surface while
 * staying in the glass family.
 */


/**
 * Surface treatments for the time panel. The page is near-black and the panel
 * was too, so the two read as one shape. `tint` is the default: a light wash
 * lifts it to a distinct surface while staying in the glass family.
 */

export interface TimePopoverProps {
  /** Panel heading, e.g. "Opening time". */
  label: string;
  /** Accessible name for the trigger. */
  triggerLabel: string;
  /** 24-hour time, HH:mm. */
  value: string;
  onChange: (time24: string) => void;
  disabled?: boolean;
  className?: string;
}

export function TimePopover({
  label,
  triggerLabel,
  value,
  onChange,
  disabled = false,
  className,
}: TimePopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<"below" | "above">("below");

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
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
  }, [open]);

  /**
   * The range panel sits low on the page, so a popover opened below the clock
   * ran past the bottom of the viewport and its Done button became
   * unreachable. Flip above the trigger when there is more room up than down.
   */
  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const trigger = triggerRef.current;
      const pop = popRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const height = pop?.offsetHeight ?? 280;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      setPlacement(spaceBelow < height && spaceAbove > spaceBelow ? "above" : "below");
    };
    measure();
    const frame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [open]);

  const [hours, minutes] = value.split(":").map(Number);
  const display = formatDisplayTime(
    Number.isFinite(hours) ? hours : 9,
    Number.isFinite(minutes) ? minutes : 0,
  );

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${triggerLabel}, currently ${display}`}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-buzzField border px-2.5 text-buzzSmall tabular-nums",
          MOTION.transitionColors,
          focusRingClass,
          disabled && "cursor-not-allowed opacity-50",
          open
            ? "border-buzz-yellow bg-accent-wash text-buzz-yellow"
            : "border-line bg-buzz-paper04 text-primary hover:border-quiet",
        )}
      >
        {display}
        <Clock className={cn("size-3.5", open ? "text-buzz-yellow" : "text-muted")} />
      </button>

      {open && !disabled && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={label}
          className={cn(
            // Anchored to its own button, right-aligned so it never runs past
            // the panel edge. Flips above when there is no room below.
            // Shrink-wraps its content so there is no dead space beside the
            // AM/PM toggle. 132px fits the clock row (58px column + 44px
            // AM/PM + gap + padding) without stretching.
            "absolute right-0 z-[60] w-max min-w-[136px] max-w-[calc(100vw-24px)]",
            placement === "below"
              ? "top-[calc(100%+6px)]"
              : "bottom-[calc(100%+6px)]",
            "buzz-glass-popover animate-buzz-rise rounded-buzzModal p-2.5 motion-reduce:animate-none",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-buzzSmall font-medium text-primary">{label}</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              aria-label="Close time picker"
              className={cn(
                "grid size-6 place-items-center rounded-buzzControl border border-line bg-buzz-paper08 text-muted hover:text-buzz-yellow",
                MOTION.transitionColors,
                focusRingClass,
              )}
            >
              <X className="size-3.5" />
            </button>
          </div>

          <TimeList
            value={value}
            onChange={onChange}
            heightClass="h-[132px]"
          />

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={cn(
                "h-7 rounded-full bg-buzz-yellow px-3 text-buzzLabel font-medium text-on-accent hover:bg-buzz-yellowHover",
                MOTION.press,
                focusRingClass,
              )}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
