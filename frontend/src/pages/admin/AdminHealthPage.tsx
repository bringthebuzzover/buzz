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

function CountBadge({ signal }: { signal: AdminSignal }) {
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
        signal.ok
          ? "bg-buzz-neutral text-buzz-inkMuted"
          : "bg-red-50 text-red-700"
      }`}
    >
      {signal.count}
    </span>
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
        <span className="block text-sm font-bold text-buzz-ink">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-buzz-inkMuted">
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
          className="flex gap-3 px-4 py-3 transition hover:bg-buzz-neutralWash"
        >
          {body}
        </Link>
      ) : (
        <div className="flex gap-3 px-4 py-3">{body}</div>
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
    <ul className="divide-y divide-buzz-lineMid">
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
            title="Pipeline"
            description="Inferred, not measured. Nothing records a job run, so each row watches for the absence of that job's effect — a zero means we found no evidence of failure, which is weaker than a success."
          >
            <ul className="divide-y divide-buzz-lineMid">
              {health.data.pipeline.map((signal) => {
                const meta = PIPELINE_META[signal.key];
                return (
                  <li
                    key={signal.key}
                    data-testid={`signal-${signal.key}`}
                    className="flex gap-3 px-4 py-3"
                  >
                    <CountBadge signal={signal} />
                    <div>
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-buzz-ink">
                        {meta?.label ?? humanizeKey(signal.key)}
                        {meta && <Pill>{meta.schedule}</Pill>}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-buzz-inkMuted">
                        {signal.detail ?? meta?.inference}
                      </p>
                      {meta && signal.detail && (
                        <p className="mt-0.5 text-xs font-medium text-buzz-inkFaint">
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
            title="Instagram tokens"
            description="Org accounts only. An expired token rejects every request that account makes, and the refresh job never retries one that has already lapsed."
          >
            <SignalList
              signals={health.data.instagramTokens}
              meta={TOKEN_BUCKET_META}
            />
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

          <p className="text-xs font-medium text-buzz-inkFaint">
            Counted {formatDateTime(health.data.generatedAt)}. Full detail and the
            underlying queries live in gaps/.
          </p>
        </>
      )}
    </div>
  );
}
