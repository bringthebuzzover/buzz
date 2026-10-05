import { Chip } from "../ui/Chip";

/** Toggle chips for multi-select (niches, open to) and single-select filters. */
export function ChoiceChips({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(option)}
            className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-buzz-coral"
          >
            <Chip tone={on ? "success" : "neutral"}>{option}</Chip>
          </button>
        );
      })}
    </div>
  );
}
