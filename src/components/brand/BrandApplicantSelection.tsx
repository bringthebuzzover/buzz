/**
 * Applicant Selection (brand): table of `applied` orgs with sortable columns,
 * member-based unit budget, finalize + shipment roster.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  ExternalLink,
  Heart,
  MapPin,
  Package,
  Truck,
  Users,
  UserCircle,
  X,
} from "lucide-react";
import type { Drop } from "../../types/drop";
import type { DropApplication } from "../../types/orgCampaign";
import type { SeedOrg } from "../../data/seed/seedOrgs";
import type { PostCampaignLink, SocialPost } from "../../types/socialPost";
import { computeOrgAttributedCampaignTotals } from "../../utils/metrics";
import { useMockData } from "../../contexts/MockDataContext";

type RowState = { selected: boolean };

/** Product units reserved for an org = member count (1 unit per member). */
function unitsReservedForOrg(org: SeedOrg): number {
  return Math.max(0, org.memberCount);
}

type ApplicantSortKey =
  | "orgName"
  | "campus"
  | "location"
  | "followers"
  | "members"
  | "attributedLikes";

type SortDir = "asc" | "desc";

type ApplicantRowModel = {
  app: DropApplication;
  org: SeedOrg;
  attributedLikes: number;
};

type BrandApplicantSelectionProps = {
  drop: Drop;
  applications: readonly DropApplication[];
  orgs: readonly SeedOrg[];
  links: readonly PostCampaignLink[];
  posts: readonly SocialPost[];
};

/** Org / name column width (long names truncate; full name on hover). */
const NAME_COL_TH_CLASS = "max-w-[11rem] w-[11rem] min-w-0";
const NAME_COL_TD_CLASS =
  "max-w-[11rem] w-[11rem] min-w-0 px-2 py-3 align-middle";

/** Native checkbox styled for BUZZ (no default blue accent). */
const CHECKBOX_CLASS =
  "h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 border-buzz-lineMid bg-buzz-paper shadow-sm transition-colors accent-buzz-coral checked:border-buzz-coral focus:outline-none focus:ring-2 focus:ring-buzz-coral/35 focus:ring-offset-2 focus:ring-offset-buzz-paper disabled:cursor-not-allowed disabled:opacity-50";

const DATA_COLUMN_META: { label: string; sortKey: ApplicantSortKey }[] = [
  { label: "University", sortKey: "campus" },
  { label: "City / State", sortKey: "location" },
  { label: "Followers", sortKey: "followers" },
  { label: "Members", sortKey: "members" },
  { label: "Campaign likes", sortKey: "attributedLikes" },
];

function instagramProfileUrl(handle: string): string {
  const h = handle.replace(/^@/, "").trim();
  return `https://www.instagram.com/${encodeURIComponent(h)}/`;
}

function OrgSocialModal({
  org,
  onClose,
}: {
  org: SeedOrg;
  onClose: () => void;
}) {
  const igUrl = instagramProfileUrl(org.instagramHandle);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-social-modal-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-buzz-cream p-1.5 text-buzz-inkFaint transition hover:text-buzz-coral"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <div className="border-b border-buzz-lineMid bg-buzz-cream px-6 py-4 pr-12">
          <h2
            id="org-social-modal-title"
            className="text-lg font-bold text-buzz-coral"
          >
            {org.name}
          </h2>
          <p className="mt-0.5 text-sm font-medium text-buzz-inkMuted">
            {org.campus}
          </p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <p className="text-sm font-medium text-buzz-inkMuted">
            View this org&apos;s public Instagram profile (opens in a new tab).
          </p>
          <a
            href={igUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-buzz-coral bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
          >
            <ExternalLink size={16} />
            Instagram {org.instagramHandle}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-buzz-lineMid bg-buzz-cream py-2.5 text-sm font-bold text-buzz-inkMuted transition hover:bg-buzz-neutralHover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function sortRowModels(
  rows: ApplicantRowModel[],
  sortKey: ApplicantSortKey,
  sortDir: SortDir
): ApplicantRowModel[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    switch (sortKey) {
      case "orgName":
        return dir * a.org.name.localeCompare(b.org.name);
      case "campus":
        return dir * a.org.campus.localeCompare(b.org.campus);
      case "location":
        return (
          dir *
          `${a.org.city}, ${a.org.state}`.localeCompare(
            `${b.org.city}, ${b.org.state}`
          )
        );
      case "followers":
        return dir * (a.org.followers - b.org.followers);
      case "members":
        return dir * (a.org.memberCount - b.org.memberCount);
      case "attributedLikes":
        return dir * (a.attributedLikes - b.attributedLikes);
      default:
        return 0;
    }
  });
}

export default function BrandApplicantSelection({
  drop,
  applications,
  orgs,
  links,
  posts,
}: BrandApplicantSelectionProps) {
  const { finalizeBrandApplicantSelection, setDropTrackerStage } = useMockData();
  const orgById = useMemo(
    () => new Map(orgs.map((o) => [o.id, o])),
    [orgs]
  );

  const [sortKey, setSortKey] = useState<ApplicantSortKey>("orgName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [socialModalOrg, setSocialModalOrg] = useState<SeedOrg | null>(null);

  const totalBudget =
    drop.totalProductUnits ?? Math.max(1, drop.capacityTotal) * 50;

  const appliedForDrop = useMemo(
    () =>
      applications.filter(
        (a) => a.dropId === drop.id && a.decision === "applied"
      ),
    [applications, drop.id]
  );

  const applicantRowModels: ApplicantRowModel[] = useMemo(() => {
    const rows: ApplicantRowModel[] = [];
    for (const app of appliedForDrop) {
      const org = orgById.get(app.orgId);
      if (!org) continue;
      const attr = computeOrgAttributedCampaignTotals({
        orgId: org.id,
        applications,
        links,
        posts,
      });
      rows.push({
        app,
        org,
        attributedLikes: attr.totalLikes,
      });
    }
    return rows;
  }, [appliedForDrop, orgById, applications, links, posts]);

  const sortedApplicantRows = useMemo(
    () => sortRowModels(applicantRowModels, sortKey, sortDir),
    [applicantRowModels, sortKey, sortDir]
  );

  const toggleSort = (key: ApplicantSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      const ascDefault =
        key === "orgName" ||
        key === "campus" ||
        key === "location";
      setSortDir(ascDefault ? "asc" : "desc");
    }
  };

  const sortIndicator = (key: ApplicantSortKey) => {
    if (sortKey !== key) {
      return <ChevronsUpDown size={12} className="opacity-50" />;
    }
    return sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
  };

  const finalized = Boolean(drop.applicantSelectionFinalizedAt);

  const acceptedAllocations = useMemo(
    () =>
      applications.filter(
        (a) =>
          a.dropId === drop.id &&
          a.decision === "accepted" &&
          (a.allocatedUnits ?? 0) > 0
      ),
    [applications, drop.id]
  );

  const finalizedRowModels: ApplicantRowModel[] = useMemo(() => {
    const rows: ApplicantRowModel[] = [];
    for (const app of acceptedAllocations) {
      const org = orgById.get(app.orgId);
      if (!org) continue;
      const attr = computeOrgAttributedCampaignTotals({
        orgId: org.id,
        applications,
        links,
        posts,
      });
      rows.push({
        app,
        org,
        attributedLikes: attr.totalLikes,
      });
    }
    return rows;
  }, [acceptedAllocations, orgById, applications, links, posts]);

  const sortedFinalizedRows = useMemo(
    () => sortRowModels(finalizedRowModels, sortKey, sortDir),
    [finalizedRowModels, sortKey, sortDir]
  );

  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    if (finalized) return;
    setRows((prev) => {
      const next = { ...prev };
      for (const app of appliedForDrop) {
        if (next[app.id] === undefined) {
          next[app.id] = { selected: false };
        }
      }
      return next;
    });
  }, [appliedForDrop, finalized]);

  const allocatedSum = useMemo(() => {
    return appliedForDrop.reduce((sum, app) => {
      const r = rows[app.id];
      if (!r?.selected) return sum;
      const org = orgById.get(app.orgId);
      if (!org) return sum;
      return sum + unitsReservedForOrg(org);
    }, 0);
  }, [appliedForDrop, rows, orgById]);

  const remaining = totalBudget - allocatedSum;
  const overBudget = remaining < 0;

  const toggleRow = (applicationId: string) => {
    setRows((prev) => {
      const cur = prev[applicationId] ?? { selected: false };
      return {
        ...prev,
        [applicationId]: { selected: !cur.selected },
      };
    });
  };

  const handleFinalize = () => {
    if (overBudget || finalized) return;
    const allocations = appliedForDrop
      .filter((app) => {
        if (!rows[app.id]?.selected) return false;
        const org = orgById.get(app.orgId);
        return org != null && unitsReservedForOrg(org) > 0;
      })
      .map((app) => ({
        applicationId: app.id,
        units: unitsReservedForOrg(orgById.get(app.orgId)!),
      }));
    finalizeBrandApplicantSelection(drop.id, allocations);
  };

  const handleContinueToShipping = () => {
    setDropTrackerStage(drop.id, "products_in_transit");
  };

  const thSortable = (
    key: ApplicantSortKey,
    label: string,
    narrow?: boolean,
    thExtraClass?: string
  ) => (
    <th
      scope="col"
      className={`border-b border-buzz-line bg-buzz-cream/90 px-3 py-3 text-left ${
        narrow ? "w-px whitespace-nowrap" : ""
      } ${thExtraClass ?? ""}`}
    >
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-buzz-inkMuted hover:text-buzz-coral"
      >
        {label}
        {sortIndicator(key)}
      </button>
    </th>
  );

  const modalOverlay =
    socialModalOrg != null ? (
      <OrgSocialModal
        org={socialModalOrg}
        onClose={() => setSocialModalOrg(null)}
      />
    ) : null;

  if (finalized && acceptedAllocations.length === 0) {
    return (
      <>
        <div className="mt-8 rounded-2xl border border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
          Applicant selection was finalized. No unit allocations were recorded on
          this drop.
        </div>
        {modalOverlay}
      </>
    );
  }

  if (finalized) {
    return (
      <>
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl border-2 border-buzz-coral/40 bg-buzz-cream px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-buzz-ink">
                  Finalized partners
                </h2>
                <p className="text-sm font-medium text-buzz-inkMuted">
                  Shipment roster — sort columns by clicking headers.
                </p>
              </div>
              <button
                type="button"
                onClick={handleContinueToShipping}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-buzz-coral bg-buzz-coral px-4 py-2 text-sm font-bold text-buzz-paper shadow-sm transition hover:bg-buzz-coralDark"
              >
                <Truck size={16} />
                Continue to products in transit
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
            <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
              <thead>
                <tr>
                  {thSortable("orgName", "Name", false, NAME_COL_TH_CLASS)}
                  {thSortable("campus", "University", true)}
                  {thSortable("members", "Members", true)}
                  <th
                    scope="col"
                    className="border-b border-buzz-line bg-buzz-cream/90 px-3 py-3 text-xs font-bold uppercase tracking-wider text-buzz-inkMuted"
                  >
                    Contact
                  </th>
                  <th
                    scope="col"
                    className="border-b border-buzz-line bg-buzz-cream/90 px-3 py-3 text-xs font-bold uppercase tracking-wider text-buzz-inkMuted"
                  >
                    Delivery address
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedFinalizedRows.map(({ app, org }) => (
                  <tr
                    key={app.id}
                    className="border-b border-buzz-lineMid/80 odd:bg-buzz-cream/30"
                  >
                    <td className={NAME_COL_TD_CLASS}>
                      <button
                        type="button"
                        title={org.name}
                        onClick={() => setSocialModalOrg(org)}
                        className="block w-full truncate text-left text-sm font-bold text-buzz-coral hover:underline"
                      >
                        {org.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium text-buzz-ink">
                      {org.campus}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium text-buzz-ink">
                      <span className="inline-flex items-center gap-1">
                        <UserCircle
                          size={14}
                          className="shrink-0 text-buzz-coral"
                        />
                        {org.memberCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-buzz-ink">
                      {org.contactName}
                    </td>
                    <td className="max-w-[10rem] min-w-0 break-words px-3 py-3 text-xs leading-snug text-buzz-inkMuted">
                      {org.deliveryAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {modalOverlay}
      </>
    );
  }

  if (appliedForDrop.length === 0) {
    return (
      <>
        <div className="mt-8 rounded-2xl border border-dashed border-buzz-lineMid bg-buzz-cream p-8 text-center text-sm font-medium text-buzz-inkMuted">
          No pending applications for this drop yet. Once orgs apply and the
          window closes, they will appear here for selection.
        </div>
        {modalOverlay}
      </>
    );
  }

  return (
    <>
      <div className="mt-8 space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm sm:flex-row sm:items-center sm:gap-5">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="rounded-xl bg-buzz-butter p-2 text-buzz-coral">
              <Package size={22} />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-buzz-ink">
                Applicant selection
              </h2>
              <p className="text-sm font-medium text-buzz-inkMuted">
                Sort by column headers. Click a name for Instagram. Each selected
                org reserves{" "}
                <strong className="text-buzz-ink">1 unit per member</strong>{" "}
                (member count).
              </p>
            </div>
          </div>
          <div className="w-full shrink-0 rounded-xl border border-buzz-lineMid bg-buzz-cream px-6 py-4 text-center sm:w-72 sm:text-right md:w-80">
            <p className="text-xs font-bold uppercase tracking-wider text-buzz-inkMuted">
              Units remaining
            </p>
            <p
              className={`text-2xl font-black tabular-nums ${
                overBudget ? "text-buzz-coralDark" : "text-buzz-coral"
              }`}
            >
              {remaining}
            </p>
            <p className="text-xs font-medium text-buzz-inkFaint">
              of {totalBudget} total
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-buzz-lineMid bg-buzz-paper shadow-sm">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-12 border-b border-buzz-line bg-buzz-cream/90 py-3 pl-5 pr-2"
                >
                  <span className="sr-only">Include</span>
                </th>
                {thSortable("orgName", "Name", false, NAME_COL_TH_CLASS)}
                {DATA_COLUMN_META.map((c) =>
                  thSortable(c.sortKey, c.label, true)
                )}
              </tr>
            </thead>
            <tbody>
              {sortedApplicantRows.map(({ app, org, attributedLikes }) => {
                const r = rows[app.id] ?? { selected: false };
                return (
                  <tr
                    key={app.id}
                    className={`border-b border-buzz-lineMid/80 ${
                      r.selected
                        ? "bg-buzz-butter/50"
                        : "odd:bg-buzz-cream/20"
                    }`}
                  >
                    <td className="py-3 pl-5 pr-2 align-middle">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        onChange={() => toggleRow(app.id)}
                        className={CHECKBOX_CLASS}
                        aria-label={`Select ${org.name}`}
                      />
                    </td>
                    <td className={NAME_COL_TD_CLASS}>
                      <button
                        type="button"
                        title={org.name}
                        onClick={() => setSocialModalOrg(org)}
                        className="block w-full truncate text-left text-sm font-bold text-buzz-coral hover:underline"
                      >
                        {org.name}
                      </button>
                    </td>
                    <td className="px-3 py-3 font-medium text-buzz-ink">
                      {org.campus}
                    </td>
                    <td className="px-3 py-3 text-buzz-inkMuted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin
                          size={14}
                          className="shrink-0 text-buzz-coral"
                        />
                        {org.city}, {org.state}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium text-buzz-ink">
                      <span className="inline-flex items-center gap-1">
                        <Users size={14} className="text-buzz-coral" />
                        {org.followers.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium text-buzz-ink">
                      <span className="inline-flex items-center gap-1">
                        <UserCircle
                          size={14}
                          className="text-buzz-coral"
                        />
                        {org.memberCount}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-buzz-ink">
                      <span className="inline-flex items-center gap-1">
                        <Heart size={14} className="text-buzz-coral" />
                        {attributedLikes.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleFinalize}
            disabled={
              overBudget ||
              finalized ||
              !appliedForDrop.some((app) => {
                if (!rows[app.id]?.selected) return false;
                const o = orgById.get(app.orgId);
                return o != null && unitsReservedForOrg(o) > 0;
              })
            }
            className="rounded-xl border-2 border-buzz-coral bg-buzz-coral px-6 py-3 text-sm font-black uppercase tracking-wide text-buzz-paper shadow-md transition hover:bg-buzz-coralDark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Finalize applicants
          </button>
        </div>
        {overBudget ? (
          <p className="text-center text-sm font-semibold text-buzz-coralDark">
            Selected orgs need more units than you have (members sum to{" "}
            {allocatedSum}, budget is {totalBudget}). Deselect orgs or increase
            the drop&apos;s unit budget.
          </p>
        ) : null}
      </div>
      {modalOverlay}
    </>
  );
}
