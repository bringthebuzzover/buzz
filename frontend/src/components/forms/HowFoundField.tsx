import { useId } from "react";
import type { components } from "../../api/generated/schema";
import { fieldLabelClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import { TextField } from "./controls";
import FieldError from "./FieldError";

export type HowFoundSource = components["schemas"]["HowFoundSource"];

const OPTIONS: ReadonlyArray<{ value: HowFoundSource; label: string }> = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "referral", label: "Referral" },
  { value: "search_engine", label: "Search engine" },
  { value: "other", label: "Other" },
];

export function howFoundPayload(source: HowFoundSource | "", other: string) {
  if (!source) return {};
  if (source === "other") return { howFound: source, howFoundOther: other.trim() };
  return { howFound: source };
}

export function HowFoundField({
  value,
  onChange,
  otherValue,
  onOtherChange,
  disabled,
  error,
  otherError,
}: {
  value: HowFoundSource | "";
  onChange: (next: HowFoundSource) => void;
  otherValue: string;
  onOtherChange: (next: string) => void;
  disabled: boolean;
  error?: string;
  otherError?: string;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const groupError = error ?? (value !== "other" ? otherError : undefined);
  const errorId = `${id}-error`;

  return (
    <div>
      <span id={labelId} className={fieldLabelClass}>
        How did you find us?
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={groupError ? errorId : undefined}
        aria-invalid={groupError ? true : undefined}
        className="flex flex-wrap gap-1.5"
      >
        {OPTIONS.map(({ value: option, label }) => (
          <label key={option} className="relative flex flex-auto">
            <input
              type="radio"
              name={id}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              disabled={disabled}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex h-10 w-full select-none items-center justify-center whitespace-nowrap rounded-buzzField border px-2 text-xs font-medium backdrop-blur-md backdrop-saturate-125 transition-all duration-150",
                "peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-buzz-yellow peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-page",
                disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                value === option
                  ? "border-buzz-yellowLine bg-accent-wash text-accent shadow-[inset_0_1px_0_rgba(246,211,42,0.18)]"
                  : "border-line bg-buzz-paper04 text-muted hover:border-quiet hover:bg-buzz-paper08 hover:text-primary",
              )}
            >
              {label}
            </span>
          </label>
        ))}
      </div>
      {groupError ? <FieldError id={errorId} message={groupError} /> : null}
      {value === "other" ? (
        <div className="mt-2.5">
          <TextField
            aria-label="Specify how you found us"
            placeholder="Tell us how you found BUZZ…"
            maxLength={120}
            pattern=".*\S.*"
            title="Enter how you found BUZZ."
            required
            disabled={disabled}
            value={otherValue}
            onChange={(event) => onOtherChange(event.target.value)}
            error={otherError}
          />
        </div>
      ) : null}
    </div>
  );
}
