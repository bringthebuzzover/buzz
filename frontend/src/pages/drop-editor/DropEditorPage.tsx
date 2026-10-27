/**
 * `/drop-editor`: React build of the approved pen.dev drop editor
 * (`design/drop-editor/`). Admin "New drop" by default, brand "Request a
 * drop" with `?mode=brand`. Local state only, with example values; nothing
 * here talks to the API. `?pop=1`, `?edit=1`, and `?desc=1` open a state
 * directly, like the static mockup.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import cornellLogo from "../../assets/unis/cornell.png";
import upennLogo from "../../assets/unis/upenn.png";
import brownLogo from "../../assets/unis/brown.png";
import columbiaLogo from "../../assets/unis/columbia.png";
import yaleLogo from "../../assets/unis/yale.png";
import princetonLogo from "../../assets/unis/princeton.png";
import buzzLogo from "./media/buzz-logo.svg";
import coverPhoto from "./media/sorority.jpg";
import brandLogo from "./media/yerbamate.jpg";
import DateRangePopover from "./DateRangePopover";
import { formatMonthDay, formatShort, startOfDay } from "./dateRange";
import type { DateRange } from "./dateRange";
import "./drop-editor.css";

type Campus = { id: string; name: string; logo: string };

const CAMPUS_POOL: readonly Campus[] = [
  { id: "cornell", name: "Cornell", logo: cornellLogo },
  { id: "upenn", name: "UPenn", logo: upennLogo },
  { id: "brown", name: "Brown", logo: brownLogo },
  { id: "columbia", name: "Columbia", logo: columbiaLogo },
  { id: "yale", name: "Yale", logo: yaleLogo },
  { id: "princeton", name: "Princeton", logo: princetonLogo },
];

const BRAND = "Yerba Madre";
const defaultName = (brand: string) => `${brand} x BUZZ`;

type DetailKey = "description" | "sending" | "location" | "hashtag";

const DETAILS: readonly { key: DetailKey; label: string; help: string }[] = [
  {
    key: "description",
    label: "Description",
    help: "What orgs will read on the drop page before they apply.",
  },
  { key: "sending", label: "What you're sending", help: "What each accepted org receives." },
  { key: "location", label: "Location", help: "Where the drop happens." },
  { key: "hashtag", label: "Campaign hashtag", help: "Orgs use it when they post." },
];

const DESCRIPTION_MAX = 600;

const INITIAL_DETAILS: Record<DetailKey, string> = {
  description:
    "Sample a new flavor at chapter events and share it on Instagram.\n\nEach accepted chapter gets cans for an event of their choice. Post one photo or Reel from the event, tag the brand, and use the campaign hashtag.",
  sending: "Cans, 12 flavors",
  location: "On campus",
  hashtag: "#yerbaxtheta",
};

type StatKey = "orgs" | "units" | "budget";

const firstLine = (text: string) => text.split("\n").find((l) => l.trim()) ?? "";

/** Renders "Brand x BUZZ" with each standalone " x " dimmed. */
function TitleText({ value }: { value: string }): ReactElement {
  const parts = value.split(/(\sx\s)/);
  return (
    <>
      {parts.map((part, i) =>
        /^\sx\s$/.test(part) ? (
          <span key={i}>
            {" "}
            <span className="de-title-x">x</span>{" "}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Card title breaks before " x " so the brand sits on its own line. */
function CardTitle({ value }: { value: string }): ReactElement {
  const at = value.indexOf(" x ");
  if (at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at)}
      <br />
      {value.slice(at + 1)}
    </>
  );
}

function Toggle({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange: (next: boolean) => void;
}): ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`de-toggle${on ? " is-on" : ""}`}
      onClick={() => onChange(!on)}
    />
  );
}

function Section({
  n,
  title,
  hint,
  children,
  className,
}: {
  n: string;
  title: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <section className={`de-sec${className ? ` ${className}` : ""}`}>
      <h2 className="de-sec-h">
        <span className="de-sec-n">{n}</span>
        {title}
        {hint ? <span className="de-sec-hint">{hint}</span> : null}
      </h2>
      {children}
    </section>
  );
}

function DetailModal({
  field,
  value,
  onSave,
  onClose,
}: {
  field: (typeof DETAILS)[number];
  value: string;
  onSave: (value: string) => void;
  onClose: () => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const isDescription = field.key === "description";
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="de-scrim" onClick={onClose} aria-hidden="true" />
      <div className="de-modal" role="dialog" aria-modal="true" aria-labelledby="de-modal-title">
        <div className="de-modal-head">
          <h3 id="de-modal-title">{field.label}</h3>
          <button type="button" className="de-modal-x" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="de-modal-help">{field.help}</p>
        <div className="de-modal-field">
          {isDescription ? (
            <div className="de-toolbar" aria-hidden="true">
              <span className="is-on">Aa</span>
              <span style={{ fontWeight: 500 }}>B</span>
              <span style={{ fontStyle: "italic" }}>I</span>
              <span>Link</span>
              <span>• List</span>
            </div>
          ) : null}
          {isDescription ? (
            <textarea
              autoFocus
              value={draft}
              maxLength={DESCRIPTION_MAX}
              aria-label={field.label}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <input
              autoFocus
              value={draft}
              aria-label={field.label}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSave(draft);
              }}
            />
          )}
          {isDescription ? (
            <div className="de-modal-meta">
              <span>Shown on the drop card: first line only</span>
              <span>
                {draft.length} / {DESCRIPTION_MAX}
              </span>
            </div>
          ) : null}
        </div>
        <div className="de-modal-foot">
          <button type="button" className="de-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="de-btn-y" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </div>
    </>
  );
}

export default function DropEditorPage({ today: todayProp }: { today?: Date } = {}): ReactElement {
  const [params] = useSearchParams();
  const brandMode = params.get("mode") === "brand";
  const today = useMemo(() => startOfDay(todayProp ?? new Date()), [todayProp]);

  const [dropType, setDropType] = useState(0);
  const [customName, setCustomName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(() => params.has("edit"));
  const [nameDraft, setNameDraft] = useState(defaultName(BRAND));
  const nameRef = useRef<HTMLInputElement>(null);

  const [campuses, setCampuses] = useState<Campus[]>(() => CAMPUS_POOL.slice(0, 3));
  const [range, setRange] = useState<DateRange>({
    start: new Date(2026, 10, 2),
    end: new Date(2026, 10, 13),
  });
  const [popOpen, setPopOpen] = useState(() => params.has("pop"));
  const [details, setDetails] = useState(INITIAL_DETAILS);
  const [editingDetail, setEditingDetail] = useState<DetailKey | null>(() =>
    params.has("desc") ? "description" : null,
  );
  const [stats, setStats] = useState<Record<StatKey, string>>({
    orgs: "8",
    units: "48",
    budget: "2",
  });
  const [inFeed, setInFeed] = useState(true);
  const [brandCanEdit, setBrandCanEdit] = useState(false);
  const [notes, setNotes] = useState("");

  const name = customName ?? defaultName(BRAND);
  const typeOptions = brandMode
    ? ["Product drop", "Event activation", "Not sure yet"]
    : ["Product drop", "Event activation", "Content only"];

  useEffect(() => {
    const prevTitle = document.title;
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.title = brandMode ? "Request a drop · BUZZ" : "New drop · BUZZ";
    document.body.style.backgroundColor = "#0b0b0b";
    document.documentElement.style.backgroundColor = "#0b0b0b";
    return () => {
      document.title = prevTitle;
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, [brandMode]);

  useEffect(() => {
    if (!editingName) return;
    const input = nameRef.current;
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }, [editingName]);

  const startRename = () => {
    setNameDraft(name);
    setEditingName(true);
  };
  const commitRename = () => {
    const next = nameDraft.trim();
    setCustomName(!next || next === defaultName(BRAND) ? null : next);
    setEditingName(false);
  };
  const resetName = () => {
    setCustomName(null);
    setNameDraft(defaultName(BRAND));
    nameRef.current?.focus();
  };

  const closePop = useCallback(() => setPopOpen(false), []);
  const closeDetail = useCallback(() => setEditingDetail(null), []);

  const addCampus = () => {
    const next = CAMPUS_POOL.find((c) => !campuses.some((x) => x.id === c.id));
    if (next) setCampuses([...campuses, next]);
  };

  const editingField = DETAILS.find((d) => d.key === editingDetail);
  const opensLabel = range.start ? formatShort(range.start) : "Pick a date";
  const closesLabel = range.end ? formatShort(range.end) : "Pick a date";

  return (
    <div className={`drop-editor${brandMode ? " is-brand" : ""}`}>
      <header className="de-bar">
        <img src={buzzLogo} alt="BUZZ" className="de-logo" />
        <nav className="de-crumb" aria-label="Breadcrumb">
          {brandMode ? "Dashboard" : "Drops"} / <b>{brandMode ? "Request a drop" : "New drop"}</b>
        </nav>
        <span className="de-flex" />
        <span className="de-saved">
          <span className="de-saved-dot" aria-hidden="true" />
          Draft saved
        </span>
        <span className="de-avatar" aria-label="Signed in as LG">
          LG
        </span>
      </header>

      <div className="de-wrap">
        <main className="de-form">
          <div className="de-seg" role="radiogroup" aria-label="Drop type">
            {typeOptions.map((label, i) => (
              <button
                type="button"
                role="radio"
                aria-checked={dropType === i}
                key={label}
                className={dropType === i ? "is-on" : undefined}
                onClick={() => setDropType(i)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="de-title-wrap">
            {editingName ? (
              <div className="de-title is-editing">
                <span className="de-title-mirror" aria-hidden="true">
                  <TitleText value={nameDraft || " "} />
                </span>
                <input
                  ref={nameRef}
                  className="de-title-input"
                  value={nameDraft}
                  aria-label="Drop name"
                  size={1}
                  spellCheck={false}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") {
                      setNameDraft(name);
                      setEditingName(false);
                    }
                  }}
                />
              </div>
            ) : (
              <h1 className="de-title">
                <button type="button" className="de-title-btn" onClick={startRename} title="Click to rename">
                  <TitleText value={name} />
                </button>
              </h1>
            )}
            {editingName ? (
              <p className="de-title-hint">
                <span aria-hidden="true">✎</span> Click to rename · Default is <b>[Brand] x BUZZ</b>
                <button
                  type="button"
                  className="de-reset"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={resetName}
                >
                  Reset to default
                </button>
              </p>
            ) : null}
          </div>

          <div className="de-chips">
            <button type="button" className="de-chip">
              + Short summary
            </button>
            <span className="de-chip">
              <img src={brandLogo} alt="" />
              {BRAND}
            </span>
          </div>

          <Section n="01" title="Campuses" hint="Pins appear on the map">
            <div className="de-chips">
              {campuses.map((c) => (
                <span className="de-uni" key={c.id}>
                  <img src={c.logo} alt="" />
                  {c.name}
                  <button
                    type="button"
                    className="de-uni-x"
                    aria-label={`Remove ${c.name}`}
                    onClick={() => setCampuses(campuses.filter((x) => x.id !== c.id))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="de-add"
                onClick={addCampus}
                disabled={campuses.length === CAMPUS_POOL.length}
              >
                + Add campus
              </button>
            </div>
          </Section>

          <Section
            n="02"
            title={brandMode ? "Preferred timing" : "Application window"}
            hint="ET"
            className="de-sec-dates"
          >
            <div className="de-rows">
              {[
                { label: "Apply opens", date: opensLabel, time: "9:00am" },
                { label: "Apply closes", date: closesLabel, time: "11:59pm" },
              ].map((row) => (
                <button
                  type="button"
                  className="de-row"
                  key={row.label}
                  data-date-trigger
                  aria-expanded={popOpen}
                  onClick={() => setPopOpen((open) => !open)}
                >
                  <span className="de-row-l">{row.label}</span>
                  <span className="de-tz">GMT-4</span>
                  <span className="de-pill">{row.date}</span>
                  <span className="de-pill">{row.time}</span>
                </button>
              ))}
            </div>
            {popOpen ? (
              <DateRangePopover
                value={range}
                today={today}
                openTime="9:00 AM"
                closeTime="11:59 PM"
                onClose={closePop}
                onApply={(next) => {
                  setRange(next);
                  setPopOpen(false);
                }}
              />
            ) : null}
          </Section>

          <Section n="03" title="Details">
            <div className="de-rows">
              {DETAILS.map((d) => (
                <button
                  type="button"
                  className="de-row is-link"
                  key={d.key}
                  onClick={() => setEditingDetail(d.key)}
                >
                  <span className="de-row-l">{d.label}</span>
                  <span className="de-row-m">
                    {d.key === "description" ? firstLine(details[d.key]) : details[d.key]}
                  </span>
                  <span className="de-row-ar" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section n="04" title="Reach" hint={brandMode ? "Ballpark is fine" : "Tap a number to edit"}>
            <div className="de-stats">
              {(
                [
                  { key: "orgs", label: "Organizations" },
                  { key: "units", label: "Units per org" },
                  { key: "budget", label: "Unit budget", prefix: "$", suffix: "/ unit" },
                ] as { key: StatKey; label: string; prefix?: string; suffix?: string }[]
              ).map((s) => (
                <label className="de-stat" key={s.key}>
                  <small>{s.label}</small>
                  <span className="de-stat-value">
                    {s.prefix ? <span className="de-stat-prefix">{s.prefix}</span> : null}
                    <span className="de-stat-field">
                      <span aria-hidden="true">{stats[s.key] || "0"}</span>
                      <input
                        inputMode="numeric"
                        value={stats[s.key]}
                        size={1}
                        onChange={(e) =>
                          setStats({ ...stats, [s.key]: e.target.value.replace(/[^\d.]/g, "") })
                        }
                      />
                    </span>
                    {s.suffix ? <i>{s.suffix}</i> : null}
                  </span>
                </label>
              ))}
            </div>
          </Section>

          {brandMode ? (
            <Section n="06" title="Anything else?">
              <textarea
                className="de-notes"
                rows={1}
                value={notes}
                placeholder="Goals, launches, campuses you care about…"
                aria-label="Anything else?"
                onChange={(e) => setNotes(e.target.value)}
              />
            </Section>
          ) : (
            <Section n="05" title="Settings">
              <div className="de-rows">
                <div className="de-row">
                  <span className="de-row-l">Show in org drop feed</span>
                  <Toggle on={inFeed} label="Show in org drop feed" onChange={setInFeed} />
                </div>
                <div className="de-row">
                  <span className="de-row-l">Brand can edit details</span>
                  <Toggle on={brandCanEdit} label="Brand can edit details" onChange={setBrandCanEdit} />
                </div>
                <div className="de-row">
                  <span className="de-row-l">Stage</span>
                  <span className="de-pill is-y">Draft</span>
                </div>
              </div>
            </Section>
          )}
        </main>

        <aside className="de-side" aria-label="Preview">
          <div className="de-side-label">
            <span>How orgs will see it</span>
            <span>Drop feed</span>
          </div>
          <article className="de-card">
            <div className="de-cover" style={{ backgroundImage: `url(${coverPhoto})` }}>
              {range.start ? (
                <span className="de-cover-status">Applications open {formatMonthDay(range.start)}</span>
              ) : null}
              <button type="button" className="de-cover-replace">
                Replace cover
              </button>
              <div className="de-cover-over">
                <div className="de-cover-brand">
                  <img src={brandLogo} alt="" />
                  {BRAND} · {typeOptions[dropType]}
                </div>
                <h3>
                  <CardTitle value={name} />
                </h3>
              </div>
            </div>
            <div className="de-card-body">
              <p>{firstLine(details.description)}</p>
              <div className="de-card-meta">
                <div>
                  <span>Campuses</span>
                  {campuses.length}
                </div>
                <div>
                  <span>Spots</span>
                  {stats.orgs || 0} orgs
                </div>
                <div>
                  <span>Closes</span>
                  {range.end ? formatMonthDay(range.end) : "—"}
                </div>
              </div>
              <div className="de-card-apply">Apply</div>
            </div>
          </article>
          <button type="button" className="de-cta">
            {brandMode ? "Send request" : "Save drop"}
          </button>
          <p className="de-note">
            {brandMode
              ? "Buzz reviews it and reaches out within a few days."
              : "Autosaves as you go. Publishing moves it to Open."}
          </p>
        </aside>
      </div>

      {editingField ? (
        <DetailModal
          field={editingField}
          value={details[editingField.key]}
          onClose={closeDetail}
          onSave={(value) => {
            setDetails({ ...details, [editingField.key]: value });
            setEditingDetail(null);
          }}
        />
      ) : null}
    </div>
  );
}
