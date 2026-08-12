/**
 * /admin/drops — every drop, filterable by tracker stage or by attention state.
 *
 * Two filter dimensions because they answer different questions. Stage is "where
 * is this in the pipeline"; attention is "who is blocked and why", and those cut
 * across stages — a drop awaiting selection and a drop the auto-close cron never
 * touched are both sitting still for unrelated reasons. Selections combine via
 * repeated URL keys (OR within a dimension, AND across).
 */
import { Link, useSearchParams } from "react-router-dom";
import { useAdminDrops } from "../../api/hooks/useAdminHooks";
import {
  AdminTable,
  Cell,
  FilterMultiSelect,
  PageHeading,
  Panel,
  Pill,
  Row,
} from "../../components/admin/AdminPrimitives";
import {
  STAGE_LABELS,
  STAGE_ORDER,
  formatDate,
  formatElapsed,
} from "../../components/admin/labels";

const STAGE_OPTIONS = STAGE_ORDER.map((value) => ({
  value,
  label: STAGE_LABELS[value] ?? value,
}));

const ATTENTION_OPTIONS = [
  { value: "awaiting_finalization", label: "Awaiting selection" },
  { value: "ready_to_advance", label: "Ready to advance" },
  { value: "autoclose_overdue", label: "Auto-close overdue" },
  { value: "reopened_stuck", label: "Reopened and stuck" },
  { value: "no_tracking", label: "Missing tracking" },
] as const;

const HEADERS = [
  "Drop",
  "Brand",
  "Stage",
  "Applied",
  "Accepted",
  "Window closes",
  "Flags",
] as const;

function replaceParamValues(
  current: URLSearchParams,
  key: string,
  values: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete(key);
  for (const value of values) {
    next.append(key, value);
  }
  return next;
}

export default function AdminDropsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stages = searchParams.getAll("stage");
  const attentions = searchParams.getAll("attention");
  const drops = useAdminDrops({
    stage: stages,
    attention: attentions,
  });

  return (
    <div>
      <PageHeading
        title="Drops"
        subtitle="Campaign lifecycle across every brand. Open a drop to move its tracker or reopen its apply window."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterMultiSelect
          label="Stage"
          options={STAGE_OPTIONS}
          selected={stages}
          onChange={(next) =>
            setSearchParams(replaceParamValues(searchParams, "stage", next), {
              replace: true,
            })
          }
        />
        <FilterMultiSelect
          label="Attention"
          options={[...ATTENTION_OPTIONS]}
          selected={attentions}
          onChange={(next) =>
            setSearchParams(
              replaceParamValues(searchParams, "attention", next),
              { replace: true },
            )
          }
        />
      </div>

      <Panel>
        {drops.isPending && (
          <p className="px-4 py-6 text-sm font-medium text-buzz-inkMuted">
            Loading drops…
          </p>
        )}
        {drops.isError && (
          <p className="px-4 py-6 text-sm font-medium text-red-700">
            Could not load drops.
          </p>
        )}
        {drops.data && (
          <AdminTable
            headers={HEADERS}
            isEmpty={drops.data.length === 0}
            empty="No drops match this filter."
          >
            {drops.data.map((drop) => {
              const closed = drop.applyCloseAt <= Date.now();
              return (
                <Row key={drop.id}>
                  <Cell>
                    <Link
                      to={`/admin/drops/${drop.id}`}
                      className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                    >
                      {drop.title}
                    </Link>
                  </Cell>
                  <Cell muted>
                    <Link
                      to={`/admin/brands/${drop.brandId}`}
                      className="hover:text-buzz-coral hover:underline"
                    >
                      {drop.brandName}
                    </Link>
                  </Cell>
                  <Cell muted>{STAGE_LABELS[drop.stage] ?? drop.stage}</Cell>
                  <Cell muted>{drop.appliedCount}</Cell>
                  <Cell
                    muted={drop.acceptedCount <= drop.capacityTotal}
                  >
                    {drop.acceptedCount} / {drop.capacityTotal}
                  </Cell>
                  <Cell muted>
                    {closed
                      ? `closed ${formatElapsed(drop.applyCloseAt)} ago`
                      : formatDate(drop.applyCloseAt)}
                  </Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-1">
                      {drop.manualReopen && <Pill tone="warn">Reopened</Pill>}
                      {drop.acceptedCount > drop.capacityTotal && (
                        <Pill tone="bad">Over capacity</Pill>
                      )}
                      {drop.brandStatus !== "approved" && (
                        <Pill tone="bad">Brand {drop.brandStatus}</Pill>
                      )}
                      {drop.stage === "awaiting_products" &&
                        drop.trackingNumber === null && (
                          <Pill tone="bad">No tracking</Pill>
                        )}
                    </div>
                  </Cell>
                </Row>
              );
            })}
          </AdminTable>
        )}
      </Panel>
    </div>
  );
}
