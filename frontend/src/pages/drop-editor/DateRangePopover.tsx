/**
 * Two-month range picker for the drop editor's application window.
 * Presets on the left, today always ringed and labelled, y-fade band
 * between the yellow ends. Commits only on Apply.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import {
  PRESETS,
  addMonths,
  formatMonthDay,
  formatMonthYear,
  formatShort,
  matchPreset,
  monthGrid,
  pickDay,
  presetRange,
  rangeDays,
  sameDay,
  startOfDay,
} from "./dateRange";
import type { DateRange, PresetId } from "./dateRange";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

type Props = {
  value: DateRange;
  today: Date;
  openTime: string;
  closeTime: string;
  onApply: (range: DateRange) => void;
  onClose: () => void;
};

export default function DateRangePopover({
  value,
  today,
  openTime,
  closeTime,
  onApply,
  onClose,
}: Props): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const todayDay = startOfDay(today);
  const [draft, setDraft] = useState<DateRange>(value);
  const [hover, setHover] = useState<Date | null>(null);
  const [customPicked, setCustomPicked] = useState(false);
  const [view, setView] = useState<Date>(() => addMonths(todayDay, 0));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: MouseEvent) => {
      const el = ref.current;
      const target = event.target as Node;
      if (!el || el.contains(target)) return;
      if ((target as Element).closest?.("[data-date-trigger]")) return;
      onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const preset: PresetId | null =
    draft.start && draft.end && !customPicked ? matchPreset(draft, todayDay) : customPicked ? "custom" : null;

  // While choosing the end, hovering previews the band.
  const shown: DateRange =
    draft.start && !draft.end && hover && hover.getTime() > draft.start.getTime()
      ? { start: draft.start, end: hover }
      : draft;

  const days = rangeDays(draft);

  const choosePreset = (id: PresetId) => {
    const range = presetRange(id, todayDay);
    if (!range) {
      setCustomPicked(true);
      setDraft({ start: null, end: null });
      return;
    }
    setCustomPicked(false);
    setDraft(range);
    if (range.start) setView(addMonths(range.start, range.start.getMonth() === todayDay.getMonth() ? 0 : -1));
  };

  const renderMonth = (month: Date) => (
    <div className="de-month" key={month.toISOString()}>
      <div className="de-month-title">{formatMonthYear(month)}</div>
      <div className="de-cal" role="grid" aria-label={formatMonthYear(month)}>
        {WEEKDAYS.map((d) => (
          <div className="de-cal-hd" key={d} aria-hidden="true">
            {d}
          </div>
        ))}
        {monthGrid(month).map((day, i) => {
          if (!day) return <div className="de-day is-blank" key={`b${i}`} />;
          const past = day.getTime() < todayDay.getTime();
          const isToday = sameDay(day, todayDay);
          const isStart = sameDay(day, shown.start);
          const isEnd = sameDay(day, shown.end);
          const t = day.getTime();
          const inRange =
            !!shown.start && !!shown.end && t > shown.start.getTime() && t < shown.end.getTime();
          const hasBand = !!shown.start && !!shown.end && !sameDay(shown.start, shown.end);
          const cls = [
            "de-day",
            past && "is-past",
            isToday && "is-today",
            inRange && "is-range",
            isStart && "is-start",
            isEnd && "is-end",
            hasBand && isStart && "has-band-right",
            hasBand && isEnd && "has-band-left",
            day.getDay() === 0 && "is-row-start",
            day.getDay() === 6 && "is-row-end",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div className={cls} key={t}>
              <button
                type="button"
                className="de-day-btn"
                disabled={past}
                aria-pressed={isStart || isEnd}
                aria-label={`${formatShort(day)}${isToday ? ", today" : ""}`}
                aria-current={isToday ? "date" : undefined}
                onMouseEnter={() => setHover(day)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  setCustomPicked(true);
                  setDraft((prev) => pickDay(prev, day));
                }}
              >
                {day.getDate()}
              </button>
              {isToday ? <span className="de-today-label">Today</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="de-pop" ref={ref} role="dialog" aria-label="Application window">
      <div className="de-presets">
        <div className="de-presets-label">Quick pick</div>
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`de-preset${preset === p.id ? " is-on" : ""}`}
            aria-pressed={preset === p.id}
            onClick={() => choosePreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="de-pop-main">
        <div className="de-pop-head">
          <button
            type="button"
            className="de-nav"
            aria-label="Previous month"
            onClick={() => setView((v) => addMonths(v, -1))}
          >
            ‹
          </button>
          <button
            type="button"
            className="de-today-chip"
            onClick={() => setView(addMonths(todayDay, 0))}
          >
            <i aria-hidden="true" />
            Today, {formatMonthDay(todayDay)}
          </button>
          <button
            type="button"
            className="de-nav"
            aria-label="Next month"
            onClick={() => setView((v) => addMonths(v, 1))}
          >
            ›
          </button>
        </div>
        <div className="de-months">
          {renderMonth(view)}
          {renderMonth(addMonths(view, 1))}
        </div>
        <div className="de-pop-foot">
          <div className="de-foot-time">
            <span className="de-foot-label">Opens</span>
            <b>{draft.start ? formatShort(draft.start) : "—"}</b>
            <span className="de-time-chip">{openTime}</span>
          </div>
          <span className="de-foot-dash" aria-hidden="true">
            →
          </span>
          <div className="de-foot-time">
            <span className="de-foot-label">Closes</span>
            <b>{draft.end ? formatShort(draft.end) : "—"}</b>
            <span className="de-time-chip">{closeTime}</span>
          </div>
          <span className="de-flex" />
          <button
            type="button"
            className="de-ghost"
            onClick={() => {
              setCustomPicked(true);
              setDraft({ start: null, end: null });
            }}
          >
            Clear
          </button>
          <button
            type="button"
            className="de-apply"
            disabled={!days}
            onClick={() => onApply(draft)}
          >
            {days ? (
              <>
                Apply <span className="de-apply-dot">·</span> {days} {days === 1 ? "day" : "days"}
              </>
            ) : (
              "Apply"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
