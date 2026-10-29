import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import {
  useAddOrgToDrop,
  useAdminOrgs,
  type AdminApplicant,
  type AdminOrgRow,
} from "../../api/hooks/useAdminHooks";
import { Plus } from "lucide-react";
import { Button, Checkbox, ErrorBanner, TextField } from "../forms/controls";
import { Modal, ModalActions } from "../ui/Modal";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";
import { STATUS_LABELS } from "./labels";

type Props = {
  dropId: string;
  dropTitle: string;
  totalProductUnits: number | null;
  applicants: AdminApplicant[];
  onClose: () => void;
};

function orgMatches(org: AdminOrgRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [org.orgName, org.university, org.eduEmail, org.instagramHandle]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

export default function AddOrgToDropModal({
  dropId,
  dropTitle,
  totalProductUnits,
  applicants,
  onClose,
}: Props) {
  const orgs = useAdminOrgs();
  const add = useAddOrgToDrop(dropId);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<AdminOrgRow | null>(null);
  const [units, setUnits] = useState("0");
  const [emailOrg, setEmailOrg] = useState(false);
  const [emailBrand, setEmailBrand] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acceptedIds = useMemo(
    () =>
      new Set(
        applicants.filter((a) => a.decision === "accepted").map((a) => a.orgId),
      ),
    [applicants],
  );
  const appliedIds = useMemo(
    () => new Set(applicants.map((a) => a.orgId)),
    [applicants],
  );

  const matches = (orgs.data ?? []).filter(
    (org): org is AdminOrgRow & { id: string } =>
      org.id != null &&
      org.status !== "erased" &&
      !acceptedIds.has(org.id) &&
      orgMatches(org, query),
  );

  const neverApplied = picked != null && !appliedIds.has(picked.id ?? "");
  const portalReady = picked?.status === "active";

  async function submit() {
    if (!picked?.id) return;
    setError(null);
    let allocated: number | null = null;
    if (totalProductUnits != null) {
      const parsed = Number.parseInt(units, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError("Units must be zero or more.");
        return;
      }
      allocated = parsed;
    }
    try {
      await add.mutateAsync({
        orgId: picked.id,
        allocatedUnits: allocated,
        emailOrg,
        emailBrand,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not add this organization.",
      );
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Add organization"
      description={`Accept a seat on ${dropTitle} without reopening apply. Overbooking is allowed.`}
    >
      {picked == null ? (
        <>
          <div className="flex flex-col gap-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <TextField
              id="add-org-search"
              data-testid="add-org-search"
              label="Search organizations"
              placeholder="Search by name or @handle"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {orgs.isPending && (
                <li className="px-4 py-3 text-sm text-muted">
                  Loading organizations…
                </li>
              )}
              {!orgs.isPending && matches.length === 0 && (
                <li className="px-4 py-3 text-sm text-muted">
                  No matching organizations.
                </li>
              )}
              {matches.slice(0, 40).map((org) => (
                <li key={org.id}>
                  <button
                    type="button"
                    data-testid={`add-org-result-${org.id}`}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-buzzField px-4 py-3 text-left transition hover:bg-accent-wash",
                      focusRingClass,
                    )}
                    onClick={() => setPicked(org)}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-primary">
                        {org.orgName ?? "Unnamed organization"}
                      </span>
                      <span className="text-xs text-muted">
                        {org.university ?? "No campus"}
                        {org.status
                          ? ` · ${STATUS_LABELS[org.status] ?? org.status}`
                          : ""}
                      </span>
                    </span>
                    <Plus size={16} className="shrink-0 text-muted" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ModalActions onCancel={onClose} />
        </>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {error && <ErrorBanner>{error}</ErrorBanner>}
            <div className="flex flex-col gap-1 rounded-buzzField bg-accent-wash px-4 py-3">
              <p className="text-sm font-medium text-primary">
                {picked.orgName ?? "Unnamed organization"}
              </p>
              <p className="text-xs text-muted">
                {picked.university ?? "No campus"}
                {picked.eduEmail ? ` · ${picked.eduEmail}` : ""}
              </p>
            </div>
            {neverApplied && (
              <p
                data-testid="add-org-never-applied-warn"
                className="text-sm font-medium text-buzz-warn"
              >
                This organization never applied to this drop.
              </p>
            )}
            {!portalReady && (
              <p
                data-testid="add-org-portal-warn"
                className="text-sm font-medium text-buzz-warn"
              >
                They cannot use the portal yet (
                {STATUS_LABELS[picked.status] ?? picked.status}).
              </p>
            )}
            {totalProductUnits != null && (
              <TextField
                id="add-org-units"
                data-testid="add-org-units"
                label="Allocated units"
                type="number"
                min={0}
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            )}
            <Checkbox
              data-testid="add-org-email-org"
              checked={emailOrg}
              onChange={(e) => setEmailOrg(e.target.checked)}
              label="Email the organization"
            />
            <Checkbox
              data-testid="add-org-email-brand"
              checked={emailBrand}
              onChange={(e) => setEmailBrand(e.target.checked)}
              label="Email the brand"
            />
          </div>
          <ModalActions
            cancelLabel="Back"
            onCancel={() => {
              setPicked(null);
              setError(null);
            }}
          >
            <Button
              type="button"
              data-testid="add-org-submit"
              loading={add.isPending}
              loadingLabel="Adding…"
              onClick={() => void submit()}
            >
              Add organization
            </Button>
          </ModalActions>
        </>
      )}
    </Modal>
  );
}
