/**
 * /admin/brands — every brand account, filterable by brand status.
 *
 * The Access column is the important one. `brands.status` alone is misleading:
 * approving a brand leaves its user at `pending_approval` until the invite is
 * redeemed, and denying a brand never touches the user at all. So the row reads
 * the brand status and the password together to say whether anyone can actually
 * log in.
 */
import { Link, useSearchParams } from "react-router-dom";
import {
  useAdminBrands,
  useApproveBrand,
  useDenyBrand,
  useViewAs,
  type AdminBrandRow,
} from "../../api/hooks/useAdminHooks";
import {
  ActionButton,
  AdminTable,
  Cell,
  ErrorNote,
  FilterChips,
  PageHeading,
  Panel,
  Pill,
  Row,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import { formatElapsed } from "../../components/admin/labels";

const FILTERS = [
  { value: null, label: "All" },
  { value: "pending_review", label: "Awaiting review" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
] as const;

const HEADERS = ["Brand", "Status", "Access", "Contact", "Waiting", ""] as const;

/** Can this brand actually sign in, and if not, why not? */
function AccessPill({ row }: { row: AdminBrandRow }) {
  if (row.status === "approved" && !row.passwordSet) {
    return <Pill tone="bad">Never set a password</Pill>;
  }
  if (row.status === "denied" && row.userStatus !== "denied") {
    return <Pill tone="warn">Orphaned user row</Pill>;
  }
  if (row.passwordSet) return <Pill tone="good">Can sign in</Pill>;
  return <Pill>Not invited yet</Pill>;
}

export default function AdminBrandsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const brands = useAdminBrands(status ?? undefined);
  const approve = useApproveBrand();
  const deny = useDenyBrand();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();

  const busy = approve.isPending || deny.isPending;
  const actionError = approve.isError || deny.isError;

  return (
    <div>
      <PageHeading
        title="Brands"
        subtitle="Approving a brand emails a setup invite that expires in 7 days. If it lapses, the account has no way to set a password."
      />

      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {actionError && (
        <ErrorNote>
          That decision did not go through. Reload and try again.
        </ErrorNote>
      )}

      <FilterChips
        options={FILTERS}
        active={status}
        basePath="/admin/brands"
        param="status"
      />

      <Panel>
        {brands.isPending && (
          <p className="px-4 py-6 text-sm font-medium text-buzz-inkMuted">
            Loading brands…
          </p>
        )}
        {brands.isError && (
          <p className="px-4 py-6 text-sm font-medium text-red-700">
            Could not load brands.
          </p>
        )}
        {brands.data && (
          <AdminTable
            headers={HEADERS}
            isEmpty={brands.data.length === 0}
            empty="No brands match this filter."
          >
            {brands.data.map((row) => (
              <Row key={row.id}>
                <Cell>
                  <Link
                    to={`/admin/brands/${row.id}`}
                    className="font-semibold text-buzz-ink hover:text-buzz-coral hover:underline"
                  >
                    {row.brandName}
                  </Link>
                  {row.instagramHandle && (
                    <span className="ml-2 text-xs font-medium text-buzz-inkMuted">
                      @{row.instagramHandle.replace(/^@/, "")}
                    </span>
                  )}
                </Cell>
                <Cell>
                  <StatusPill status={row.status} />
                </Cell>
                <Cell>
                  <AccessPill row={row} />
                </Cell>
                <Cell muted>{row.companyEmail}</Cell>
                <Cell muted>{formatElapsed(row.createdAt)}</Cell>
                <Cell align="right">
                  <div className="flex justify-end gap-2">
                    {row.status === "pending_review" && (
                      <>
                        <ActionButton
                          variant="primary"
                          testId={`approve-brand-${row.id}`}
                          disabled={busy}
                          onClick={() => approve.mutate(row.id)}
                        >
                          Approve
                        </ActionButton>
                        <ActionButton
                          variant="danger"
                          testId={`deny-brand-${row.id}`}
                          disabled={busy}
                          onClick={() => deny.mutate(row.id)}
                        >
                          Deny
                        </ActionButton>
                      </>
                    )}
                    <ActionButton
                      testId={`view-as-${row.userId}`}
                      disabled={!row.impersonatable || viewAsPending}
                      onClick={() => void viewAs(row.userId)}
                    >
                      View as
                    </ActionButton>
                  </div>
                </Cell>
              </Row>
            ))}
          </AdminTable>
        )}
      </Panel>
    </div>
  );
}
