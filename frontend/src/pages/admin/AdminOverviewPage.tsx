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
  AdminTable,
  Cell,
  CountMark,
  PageHeading,
  Panel,
  Pill,
  QueryState,
  Row,
} from "../../components/admin/AdminPrimitives";
import { LinkButton } from "../../components/forms/controls";
import {
  QUEUE_META,
  SIGNAL_META,
  formatElapsed,
  formatDateTime,
  humanizeKey,
} from "../../components/admin/labels";
import { PAD, SURFACE, TEXT } from "../../theme/tokens";
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
        SURFACE.cardFlat,
        PAD.default,
        "block transition hover:border-buzz-coral",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            TEXT.metric,
            clear ? "text-buzz-inkFaint" : "text-buzz-coral",
          )}
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
            title="Needs a look"
            description="Instagram identity tickets and Connect handle mismatches. Approve or deny a ticket; Ack a mismatch on the org."
          >
            <div data-testid="needs-a-look">
              <AdminTable
                headers={["Org", "Why", "Waiting", ""]}
                isEmpty={(overview.data.items ?? []).length === 0}
                empty="No Instagram identity items."
              >
                {(overview.data.items ?? []).map((item) => (
                  <Row key={`${item.kind}-${item.id}`}>
                    <Cell>
                      <span className="font-semibold text-buzz-ink">
                        {item.orgName ?? "Organization"}
                      </span>
                      <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
                        {item.kind === "ig_change_pending"
                          ? "Identity request"
                          : "Bind mismatch"}
                      </span>
                    </Cell>
                    <Cell muted>{item.subtitle}</Cell>
                    <Cell muted>{formatElapsed(item.createdAt ?? null)}</Cell>
                    <Cell align="right">
                      <LinkButton
                        to={item.href}
                        size="compact"
                        variant="outline"
                        data-testid={`attention-${item.kind}-${item.id}`}
                      >
                        Open
                      </LinkButton>
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
                      <CountMark tone="bad">{warning.count}</CountMark>
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
                          className="flex items-start gap-3 px-4 py-3 transition hover:bg-buzz-neutralWash"
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

          <p className="text-xs font-medium text-buzz-inkFaint">
            Counted {formatDateTime(overview.data.generatedAt)}.
          </p>
        </>
      )}
    </div>
  );
}
