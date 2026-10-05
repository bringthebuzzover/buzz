import type { PortfolioItem } from "../../api/hooks/creator/types";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export function CompletenessBar({ score }: { score: number }) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <span id="creator-completeness" className={TEXT.meta}>
          Profile completeness
        </span>
        <span className={cn(TEXT.body, "font-semibold text-buzz-ink")}>{score}%</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby="creator-completeness"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score}
        className="h-2 overflow-hidden rounded-full bg-buzz-lineMid"
      >
        <div className="h-full bg-buzz-coral" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function PortfolioGrid({ items }: { items: PortfolioItem[] }) {
  if (items.length === 0) {
    return (
      <p className={cn(TEXT.body, "text-buzz-inkMuted")}>
        No portfolio items yet. Add past work below.
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="overflow-hidden rounded-buzzCard border border-buzz-lineMid bg-buzz-paper"
        >
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="h-24 w-full object-cover" />
          ) : (
            <div className="flex h-24 items-end bg-buzz-butter p-3" aria-hidden>
              <span className="text-sm font-semibold text-buzz-ink">{item.format}</span>
            </div>
          )}
          <div className="p-3">
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className={cn(TEXT.body, "font-medium text-buzz-coral hover:underline")}
              >
                {item.title}
              </a>
            ) : (
              <p className={TEXT.body}>{item.title}</p>
            )}
            <p className={cn(TEXT.meta, "mt-1")}>
              {item.source === "connected" ? "From your Instagram" : "Added by you"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const formatCount = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("en-US");

export function ConnectedStats({
  followers,
  posts,
  activeDeliverables,
}: {
  followers: number | null;
  posts: number | null;
  activeDeliverables?: number;
}) {
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat value={formatCount(followers)} label="Followers" note="from Instagram" />
      <Stat value={formatCount(posts)} label="Posts" note="from Instagram" />
      <Stat value="—" label="Engagement" note="not available yet" />
      {activeDeliverables !== undefined ? (
        <Stat value={String(activeDeliverables)} label="Active deliverables" />
      ) : null}
    </dl>
  );
}

function Stat({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className={TEXT.meta}>
        {label}
        {note ? ` · ${note}` : ""}
      </dt>
      <dd className={cn(TEXT.metric, "text-buzz-ink")}>{value}</dd>
    </div>
  );
}
