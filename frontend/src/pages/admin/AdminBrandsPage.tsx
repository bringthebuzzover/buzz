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
  QueryState,
  Row,
  StatusPill,
} from "../../components/admin/AdminPrimitives";
import { formatElapsed } from "../../components/admin/labels";
import { Select, TextField } from "../../components/forms/controls";

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
          <TextField
            id="invite-brand-name"
            label="Brand name"
            size="compact"
            data-testid="invite-brand-name"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
          <TextField
            id="invite-brand-email"
            label="Company email"
            size="compact"
            type="email"
            data-testid="invite-brand-email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
          />
          <TextField
            id="invite-brand-instagram"
            label="Instagram (optional)"
            size="compact"
            data-testid="invite-brand-instagram"
            value={instagramHandle}
            onChange={(e) => setInstagramHandle(e.target.value)}
          />
          <Select
            id="invite-brand-approve-now"
            label="After create"
            size="compact"
            data-testid="invite-brand-approve-now"
            value={approveNow ? "approve" : "pending"}
            onChange={(e) => setApproveNow(e.target.value === "approve")}
          >
            <option value="approve">Approve and send invite now</option>
            <option value="pending">Create pending — invite later</option>
          </Select>
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
        <QueryState
          isPending={brands.isPending}
          isError={brands.isError}
          label="brands"
        />
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
                  <div className="flex flex-wrap justify-end gap-2">
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
