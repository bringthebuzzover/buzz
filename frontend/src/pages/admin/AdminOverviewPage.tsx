/**
 * /admin — the landing page: what needs a human right now.
 *
 * Two bands. Queue cards carry a count *and* the age of the oldest item, because
 * three orgs waiting nine days is a different problem from three that arrived
 * this morning. Below that, warnings — states that are broken rather than merely
 * waiting — and only the non-zero ones render, so a healthy install shows a
 * single reassuring line instead of a wall of zeros.
 */
import { Link } from "react-router-dom";
import { useAdminOverview } from "../../api/hooks/useAdminHooks";
import {
  PageHeading,
  Panel,
  Pill,
  QueryState,
} from "../../components/admin/AdminPrimitives";
import {
  QUEUE_META,
  SIGNAL_META,
  formatElapsed,
  formatDateTime,
  humanizeKey,
} from "../../components/admin/labels";

function QueueCard({
  queueKey,
  count,
  oldestAt,
}: {
  queueKey: string;
  count: number;
  oldestAt: number | null;
}) {
  const meta = QUEUE_META[queueKey];
  const label = meta?.label ?? humanizeKey(queueKey);
  const clear = count === 0;

  return (
    <Link
      to={meta?.to ?? "/admin"}
      data-testid={`queue-${queueKey}`}
      className="block rounded-lg border border-buzz-lineMid bg-buzz-paper p-4 transition hover:border-buzz-coral"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={`text-3xl font-black ${
            clear ? "text-buzz-inkFaint" : "text-buzz-coral"
          }`}
        >
          {count}
        </span>
        {meta?.owner === "brand" && <Pill>on the brand</Pill>}
      </div>
      <p className="mt-1 text-sm font-bold text-buzz-ink">{label}</p>
      {meta && (
        <p className="mt-1 text-xs font-medium text-buzz-inkMuted">
          {meta.note}
        </p>
      )}
      {!clear && oldestAt !== null && (
        <p className="mt-2 text-xs font-bold text-buzz-inkMuted">
          Oldest waiting {formatElapsed(oldestAt)}
        </p>
      )}
    </Link>
  );
}

export default function AdminOverviewPage() {
  const overview = useAdminOverview();

  return (
    <div>
      <PageHeading
        title="Overview"
        subtitle="Everything waiting on a decision, plus anything in a state the product cannot fix on its own."
      />

      <QueryState
        isPending={overview.isPending}
        isError={overview.isError}
        label="the overview"
      />

      {overview.data && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.data.queues.map((queue) => (
              <QueueCard
                key={queue.key}
                queueKey={queue.key}
                count={queue.count}
                oldestAt={queue.oldestAt}
              />
            ))}
          </div>

          <Panel
            title="Warnings"
            description="Records stuck in a state with no path out, or invariants no database constraint enforces. Surfaced here only — see Health for the full list and KNOWN_GAPS.md for why each is reachable."
          >
            {overview.data.warnings.length === 0 ? (
              <p
                data-testid="no-warnings"
                className="px-4 py-6 text-sm font-medium text-buzz-inkMuted"
              >
                Nothing flagged. Every signal on the Health page is at zero.
              </p>
            ) : (
              <ul className="divide-y divide-buzz-lineMid">
                {overview.data.warnings.map((warning) => {
                  const meta = SIGNAL_META[warning.key];
                  const body = (
                    <>
                      <span className="mt-0.5 shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                        {warning.count}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-buzz-ink">
                          {meta?.label ?? humanizeKey(warning.key)}
                        </span>
                        {meta && (
                          <span className="mt-0.5 block text-xs font-medium text-buzz-inkMuted">
                            {meta.note}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <li key={warning.key} data-testid={`warning-${warning.key}`}>
                      {meta?.to ? (
                        <Link
                          to={meta.to}
                          className="flex gap-3 px-4 py-3 transition hover:bg-buzz-neutralWash"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex gap-3 px-4 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <p className="text-xs font-medium text-buzz-inkFaint">
            Counted {formatDateTime(overview.data.generatedAt)}.
          </p>
        </>
      )}
    </div>
  );
}
