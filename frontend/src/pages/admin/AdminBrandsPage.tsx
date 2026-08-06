/**
 * /admin/brands — every brand account, filterable by brand status.
 *
 * The Access column is the important one. `brands.status` alone is misleading:
 * approving a brand leaves its user at `pending_approval` until the invite is
 * redeemed, and denying a brand never touches the user at all. So the row reads
 * the brand status and the password together to say whether anyone can actually
 * log in.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useAdminBrands,
  useApproveBrand,
  useCreateBrand,
  useDenyBrand,
  useViewAs,
  INVITE_EMAIL_FAILED_COPY,
  type AdminBrandRow,
  type BrandInviteActionResult,
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

const inputClass =
  "w-full rounded-lg border border-buzz-lineMid bg-buzz-paper px-3 py-2 text-sm font-medium text-buzz-ink outline-none focus:border-buzz-coral";

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

function InviteBrandForm() {
  const create = useCreateBrand();
  const [brandName, setBrandName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [approveNow, setApproveNow] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const data = (await create.mutateAsync({
        brandName: brandName.trim(),
        companyEmail: companyEmail.trim(),
        instagramHandle: instagramHandle.trim() || undefined,
        approveNow,
      })) as BrandInviteActionResult;
      setBrandName("");
      setCompanyEmail("");
      setInstagramHandle("");
      if (approveNow && data.emailSent === false) {
        setError(INVITE_EMAIL_FAILED_COPY);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create brand.");
    }
  };

  return (
    <Panel
      title="Invite brand"
      description="Works even when public self-registration is off. Choose whether to approve and email the setup invite immediately, or leave the brand pending for later."
    >
      <div className="space-y-3 px-4 py-4">
        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
              Brand name
            </span>
            <input
              data-testid="invite-brand-name"
              className={inputClass}
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
              Company email
            </span>
            <input
              data-testid="invite-brand-email"
              type="email"
              className={inputClass}
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
              Instagram (optional)
            </span>
            <input
              data-testid="invite-brand-instagram"
              className={inputClass}
              value={instagramHandle}
              onChange={(e) => setInstagramHandle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-buzz-inkFaint">
              After create
            </span>
            <select
              data-testid="invite-brand-approve-now"
              className={inputClass}
              value={approveNow ? "approve" : "pending"}
              onChange={(e) => setApproveNow(e.target.value === "approve")}
            >
              <option value="approve">Approve and send invite now</option>
              <option value="pending">Create pending — invite later</option>
            </select>
          </label>
        </div>
        <ActionButton
          variant="primary"
          testId="invite-brand-submit"
          disabled={
            create.isPending || !brandName.trim() || !companyEmail.trim()
          }
          onClick={() => void submit()}
        >
          {create.isPending ? "Creating…" : "Create brand"}
        </ActionButton>
      </div>
    </Panel>
  );
}

export default function AdminBrandsPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const brands = useAdminBrands(status ?? undefined);
  const approve = useApproveBrand();
  const deny = useDenyBrand();
  const { viewAs, error: viewAsError, isPending: viewAsPending } = useViewAs();
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const busy = approve.isPending || deny.isPending;
  const actionError = approve.isError || deny.isError;

  const onApprove = async (brandId: string) => {
    setInviteNotice(null);
    try {
      const data = (await approve.mutateAsync(
        brandId,
      )) as BrandInviteActionResult;
      if (data.emailSent === false) {
        setInviteNotice(INVITE_EMAIL_FAILED_COPY);
      }
    } catch {
      // actionError banner covers hard failures
    }
  };

  return (
    <div>
      <PageHeading
        title="Brands"
        subtitle="Approving a brand emails a setup invite that expires in 7 days. If it lapses, use Resend invite on the brand detail page."
      />

      {viewAsError && <ErrorNote>{viewAsError}</ErrorNote>}
      {inviteNotice && <ErrorNote>{inviteNotice}</ErrorNote>}
      {actionError && (
        <ErrorNote>
          That decision did not go through. Reload and try again.
        </ErrorNote>
      )}

      <InviteBrandForm />

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
                          onClick={() => void onApprove(row.id)}
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
