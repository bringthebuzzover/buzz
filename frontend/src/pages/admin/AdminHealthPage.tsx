/**
 * /admin/health — the operational signals, in four blocks.
 *
 * The pipeline block is honest about being a proxy. Buzz records no job-run
 * history and no logging config, so nothing can answer "did last night's cron
 * run?" directly; what these rows watch for is the *absence* of each job's
 * effect. The banner says so, because a green row that only means "we could not
 * detect a failure" is worse than no row at all.
 */
import { Link } from "react-router-dom";
import { useAdminHealth, type AdminSignal } from "../../api/hooks/useAdminHooks";
import {
  CountMark,
  PageHeading,
  Panel,
  Pill,
  QueryState,
} from "../../components/admin/AdminPrimitives";
import {
  PIPELINE_META,
  SIGNAL_META,
  TOKEN_BUCKET_META,
  formatDateTime,
  humanizeKey,
} from "../../components/admin/labels";
import { cn } from "../../theme/cn";

function CountBadge({ signal }: { signal: AdminSignal }) {
  return (
    <CountMark tone={signal.ok ? "neutral" : "bad"}>{signal.count}</CountMark>
  );
}

/** One row: count, label, and the explanation of why the state is reachable. */
function SignalRow({
  signal,
  label,
  note,
  to,
}: {
  signal: AdminSignal;
  label: string;
  note: string;
  to?: string;
}) {
  const body = (
    <>
      <CountBadge signal={signal} />
      <span>
        <span className="block text-sm font-medium text-primary">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-muted">
          {note}
        </span>
      </span>
    </>
  );
  return (
    <li data-testid={`signal-${signal.key}`}>
      {to && !signal.ok ? (
        <Link
          to={to}
          className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-pop"
        >
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

function SignalList({
  signals,
  meta,
}: {
  signals: AdminSignal[];
  meta: Record<string, { label: string; note: string; to?: string }>;
}) {
  return (
    <ul className="divide-y divide-line px-6">
      {signals.map((signal) => {
        const entry = meta[signal.key];
        return (
          <SignalRow
            key={signal.key}
            signal={signal}
            label={entry?.label ?? humanizeKey(signal.key)}
            note={entry?.note ?? ""}
            to={entry?.to}
          />
        );
      })}
    </ul>
  );
}

export default function AdminHealthPage() {
  const health = useAdminHealth();

  return (
    <div>
      <PageHeading
        title="Health"
        subtitle="Background jobs, Instagram token state, and the invariants no database constraint enforces."
      />

      <QueryState
        isPending={health.isPending}
        isError={health.isError}
        label="health signals"
      />

      {health.data && (
        <>
          <Panel
            title="Background jobs"
            description="Inferred, not measured. Nothing records a job run, so each row watches for the absence of that job's effect — a zero means we found no evidence of failure, which is weaker than a success."
          >
            <ul className="divide-y divide-line px-6">
              {health.data.pipeline.map((signal) => {
                const meta = PIPELINE_META[signal.key];
                return (
                  <li
                    key={signal.key}
                    data-testid={`signal-${signal.key}`}
                    className="flex items-start gap-3 px-4 py-3"
                  >
                    <CountBadge signal={signal} />
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                        {meta?.label ?? humanizeKey(signal.key)}
                        {meta && <Pill>{meta.schedule}</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-muted">
                        {signal.detail ?? meta?.inference}
                      </p>
                      {meta && signal.detail && (
                        <p className="mt-0.5 text-xs font-medium text-quiet">
                          {meta.inference}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel
            title="Instagram connections"
            description="Organization accounts only. Authenticated requests with an expired Instagram token return INSTAGRAM_TOKEN_EXPIRED until the organization reconnects via OAuth (/reconnect-instagram). The refresh job never retries a token that has already lapsed."
          >
            <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 xl:grid-cols-3">
              {health.data.instagramTokens.map((signal) => {
                const meta = TOKEN_BUCKET_META[signal.key];
                const hot = !signal.ok && signal.count > 0;
                return (
                  <div
                    key={signal.key}
                    data-testid={`signal-${signal.key}`}
                    className={cn(
                      "flex flex-col gap-2 rounded-buzzBoard border p-5",
                      hot
                        ? "border-buzz-yellowLine bg-accent-wash"
                        : "border-line bg-surface-tile",
                    )}
                  >
                    <p
                      className={cn(
                        "text-4xl font-medium tabular-nums",
                        hot ? "text-accent" : "text-primary",
                      )}
                    >
                      {signal.count}
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {meta?.label ?? humanizeKey(signal.key)}
                    </p>
                    {meta?.note ? (
                      <p className="text-xs text-quiet">{meta.note}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel
            title="Data integrity"
            description="States the API can reach but has no way to undo, plus invariants enforced per request rather than by the schema."
          >
            <SignalList signals={health.data.integrity} meta={SIGNAL_META} />
          </Panel>

          <Panel
            title="Silent loss"
            description="Writes that were accepted and then went nowhere. Nothing here surfaces to the user who triggered it."
          >
            <SignalList signals={health.data.silent} meta={SIGNAL_META} />
          </Panel>

          <p className="text-xs font-medium text-quiet">
            Counted {formatDateTime(health.data.generatedAt)}.
          </p>
        </>
      )}
    </div>
  );
}
