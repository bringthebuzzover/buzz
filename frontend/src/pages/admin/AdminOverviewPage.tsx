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
import { ArrowUpRight } from "lucide-react";
import { useAdminOverview } from "../../api/hooks/useAdminHooks";
// META-REVIEWER-PATH: delete this import and <MetaReviewerAdminCard /> below.
import MetaReviewerAdminCard from "../../meta-reviewer/MetaReviewerAdminCard";
import {
  AdminTable,
  Cell,
  CountMark,
  PageHeading,
  Panel,
  QueryState,
  Row,
  rowActionClass,
} from "../../components/admin/AdminPrimitives";
import {
  QUEUE_META,
  SIGNAL_META,
  formatElapsed,
  formatDateTime,
  humanizeKey,
} from "../../components/admin/labels";
import { TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

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
      className={cn(
        "flex flex-col gap-2 rounded-buzzBoard border p-5 transition hover:border-accent",
        focusRingClass,
        clear
          ? "border-line bg-surface-tile"
          : "border-buzz-yellowLine bg-accent-wash",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            TEXT.h1,
            "tabular-nums",
            clear ? "text-primary" : "text-accent",
          )}
        >
          {count}
        </span>
        <span className="flex-1" />
        <ArrowUpRight size={16} className="text-quiet" aria-hidden />
      </div>
      <p className="text-sm font-medium text-primary">{label}</p>
      {meta && <p className="text-xs text-quiet">{meta.note}</p>}
      {!clear && oldestAt !== null && (
        <p className="text-xs text-accent">Oldest waiting {formatElapsed(oldestAt)}</p>
      )}
      {meta?.owner === "brand" && (
        <p className="text-xs text-accent">On the brand</p>
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

      {/* META-REVIEWER-PATH: nothing here unless the reviewer path is enabled. */}
      <MetaReviewerAdminCard />

      <QueryState
        isPending={overview.isPending}
        isError={overview.isError}
        label="the overview"
      />

      {overview.data && (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            title="Needs a look"
            description="Instagram identity tickets, brand handle requests, and Connect handle mismatches. Approve or deny a ticket; Ack a mismatch on the organization."
          >
            <div data-testid="needs-a-look">
              <AdminTable
                headers={["Organization", "Why", "Waiting", ""]}
                isEmpty={(overview.data.items ?? []).length === 0}
                empty="No Instagram identity items."
              >
                {(overview.data.items ?? []).map((item) => (
                  <Row key={`${item.kind}-${item.id}`} attention>
                    <Cell>
                      <span className="font-medium text-primary">
                        {item.orgName ?? "Organization"}
                      </span>
                      <span className="ml-2 text-xs font-medium text-muted">
                        {item.kind === "ig_change_pending"
                          ? "Identity request"
                          : item.kind === "brand_ig_change_pending"
                            ? "Brand handle"
                            : "Bind mismatch"}
                      </span>
                    </Cell>
                    <Cell muted>{item.subtitle}</Cell>
                    <Cell muted>{formatElapsed(item.createdAt ?? null)}</Cell>
                    <Cell align="right">
                      <Link
                        to={item.href}
                        className={rowActionClass}
                        data-testid={`attention-${item.kind}-${item.id}`}
                      >
                        Open
                      </Link>
                    </Cell>
                  </Row>
                ))}
              </AdminTable>
            </div>
          </Panel>

          <Panel
            title="Warnings"
            description="Records stuck in a state with no path out, or invariants no database constraint enforces. Surfaced here only — see Health for the full list."
          >
            {overview.data.warnings.length === 0 ? (
              <p
                data-testid="no-warnings"
                className="px-4 py-6 text-sm font-medium text-muted"
              >
                Nothing flagged. Every signal on the Health page is at zero.
              </p>
            ) : (
              <ul className="divide-y divide-line px-6">
                {overview.data.warnings.map((warning) => {
                  const meta = SIGNAL_META[warning.key];
                  const body = (
                    <>
                      <CountMark tone="bad">{warning.count}</CountMark>
                      <span>
                        <span className="block text-sm font-medium text-primary">
                          {meta?.label ?? humanizeKey(warning.key)}
                        </span>
                        {meta && (
                          <span className="mt-0.5 block text-xs font-medium text-muted">
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
                          className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-pop"
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className="flex items-start gap-3 px-4 py-3">{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <p className="text-xs font-medium text-quiet">
            Counted {formatDateTime(overview.data.generatedAt)}.
          </p>
        </>
      )}
    </div>
  );
}
