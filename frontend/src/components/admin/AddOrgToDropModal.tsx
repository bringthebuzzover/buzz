import { useMemo, useState } from "react";
import { ApiError } from "../../api/client";
import {
  useAddOrgToDrop,
  useAdminOrgs,
  type AdminApplicant,
  type AdminOrgRow,
} from "../../api/hooks/useAdminHooks";
import { Button, Checkbox, TextField } from "../forms/controls";
import { Modal } from "../ui/Modal";
import { STACK, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";
import { ActionButton, ErrorNote } from "./AdminPrimitives";
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
      size="wide"
    >
      <div className={cn(STACK.tight, "px-6 pb-6 pt-4")}>
        {error && <ErrorNote>{error}</ErrorNote>}
        {picked == null ? (
          <>
            <TextField
              id="add-org-search"
              data-testid="add-org-search"
              label="Search organizations"
              size="compact"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <ul className="max-h-64 overflow-y-auto divide-y divide-buzz-lineMid rounded-buzzControl border border-buzz-lineMid">
              {orgs.isPending && (
                <li className="px-3 py-2 text-sm text-buzz-inkMuted">
                  Loading organizations…
                </li>
              )}
              {!orgs.isPending && matches.length === 0 && (
                <li className="px-3 py-2 text-sm text-buzz-inkMuted">
                  No matching organizations.
                </li>
              )}
              {matches.slice(0, 40).map((org) => (
                <li key={org.id}>
                  <button
                    type="button"
                    data-testid={`add-org-result-${org.id}`}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-buzz-paper"
                    onClick={() => setPicked(org)}
                  >
                    <span className="text-sm font-semibold text-buzz-ink">
                      {org.orgName ?? "Unnamed organization"}
                    </span>
                    <span className={TEXT.meta}>
                      {org.university ?? "No campus"}
                      {org.status
                        ? ` · ${STATUS_LABELS[org.status] ?? org.status}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-buzz-ink">
              {picked.orgName ?? "Unnamed organization"}
            </p>
            <p className={TEXT.meta}>
              {picked.university ?? "No campus"}
              {picked.eduEmail ? ` · ${picked.eduEmail}` : ""}
            </p>
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
                size="compact"
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => {
                  setPicked(null);
                  setError(null);
                }}
              >
                Back
              </Button>
              <ActionButton
                variant="primary"
                testId="add-org-submit"
                disabled={add.isPending}
                onClick={() => void submit()}
              >
                {add.isPending ? "Adding…" : "Add organization"}
              </ActionButton>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
