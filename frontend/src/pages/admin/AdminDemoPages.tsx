/**
 * /admin/demo — a directory of every portal experience for demos and UI
 * checks. Creator screens run on the in-browser mock, so an admin opens any
 * creator state as a sample creator; organizations and brands are real
 * accounts reached through View as.
 */
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useCloseCreatorApplyWindow,
  useCreatorDrop,
  useStartCreatorDemo,
} from "../../api/hooks/creator/useCreatorHooks";
import type { CreatorDemoScenario } from "../../api/hooks/creator/mockCreatorStore";
import CreatorRosterSection from "../../components/creator/CreatorRosterSection";
import {
  CreatorPayoutQueue,
  CreatorReviewQueue,
} from "../../components/creator/CreatorReviewQueue";
import { ActionButton, PageHeading, Panel } from "../../components/admin/AdminPrimitives";
import { Button, WarningBanner } from "../../components/forms/controls";

const DEMO_DROP_ID = "drop-update";

const CREATOR_SCENARIOS: {
  scenario: CreatorDemoScenario;
  label: string;
  note: string;
  path: string;
}[] = [
  {
    scenario: "guest",
    label: "Applicant",
    note: "Not applied yet. Shows the apply form.",
    path: "/creators/apply",
  },
  {
    scenario: "pending_email",
    label: "Email unconfirmed",
    note: "Applied; waiting on the .edu verification link.",
    path: "/creators/verify",
  },
  {
    scenario: "pending_review",
    label: "Under review",
    note: "Email confirmed; waiting on Buzz approval.",
    path: "/creators/pending",
  },
  {
    scenario: "denied",
    label: "Denied",
    note: "Buzz declined the application.",
    path: "/creators/pending",
  },
  {
    scenario: "pending_instagram",
    label: "Approved, Instagram not connected",
    note: "Must connect Instagram before the portal opens.",
    path: "/creators/connect",
  },
  {
    scenario: "active",
    label: "Active creator",
    note: "Connected and browsing; no campaigns yet.",
    path: "/creators/feed",
  },
  {
    scenario: "active_selected",
    label: "Selected, post not linked",
    note: "Selected for UPDATE Finals Week Reel; picks which Instagram post to link.",
    path: "/creators/campaigns",
  },
  {
    scenario: "active_campaign",
    label: "Active creator with an accepted post",
    note: "Accepted on UPDATE Finals Week Reel; $400 payout pending.",
    path: "/creators/campaigns",
  },
];

const PUBLIC_PAGES = [
  { to: "/", label: "Home" },
  { to: "/for-orgs", label: "For Organizations" },
  { to: "/for-brands", label: "For Brands" },
  { to: "/for-creators", label: "For Creators" },
] as const;

function DirectoryRow({
  label,
  note,
  action,
}: {
  label: string;
  note: string;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span>
        <span className="block text-sm font-bold text-buzz-ink">{label}</span>
        <span className="mt-0.5 block text-xs font-medium text-buzz-inkMuted">{note}</span>
      </span>
      {action}
    </li>
  );
}

const linkClass = "text-sm font-bold text-buzz-coral hover:underline";

export function AdminDemoPage() {
  const navigate = useNavigate();
  const startDemo = useStartCreatorDemo();

  return (
    <div>
      <PageHeading
        title="Demo directory"
        subtitle="Open any portal experience for a demo or a UI check."
      />

      <Panel
        title="Creator portal"
        description="Opens the portal as a sample creator, Jacey Park. Creator data is mock and stays in this browser tab; each open starts from a fresh copy."
      >
        <ul className="divide-y divide-buzz-lineMid">
          {CREATOR_SCENARIOS.map(({ scenario, label, note, path }) => (
            <DirectoryRow
              key={scenario}
              label={label}
              note={note}
              action={
                <ActionButton
                  testId={`creator-demo-${scenario}`}
                  onClick={() => {
                    startDemo.mutate(scenario);
                    navigate(path);
                  }}
                >
                  Open<span className="sr-only"> {label}</span>
                </ActionButton>
              }
            />
          ))}
        </ul>
      </Panel>

      <Panel
        title="Creator tools"
        description="The brand and admin side of creator Drops, on the same mock data. Apply as the sample creator first to see them in the roster."
      >
        <ul className="divide-y divide-buzz-lineMid">
          <DirectoryRow
            label="Brand roster"
            note="Close the apply window, filter applicants, finalize, accept posts."
            action={
              <Link to="/admin/demo/creator-roster" className={linkClass}>
                Open<span className="sr-only"> brand roster</span>
              </Link>
            }
          />
          <DirectoryRow
            label="Creator review and payouts"
            note="Approve or deny applicants; record payouts for accepted posts."
            action={
              <Link to="/admin/demo/creator-review" className={linkClass}>
                Open<span className="sr-only"> creator review and payouts</span>
              </Link>
            }
          />
        </ul>
      </Panel>

      <Panel
        title="Organizations and brands"
        description="These portals run on real accounts. Open an account and use View as."
      >
        <ul className="divide-y divide-buzz-lineMid">
          <DirectoryRow
            label="Organization portal"
            note="Pick an organization, then View as."
            action={
              <Link to="/admin/orgs" className={linkClass}>
                Organizations
              </Link>
            }
          />
          <DirectoryRow
            label="Brand portal"
            note="Pick a brand, then View as."
            action={
              <Link to="/admin/brands" className={linkClass}>
                Brands
              </Link>
            }
          />
        </ul>
      </Panel>

      <Panel title="Public pages">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3">
          {PUBLIC_PAGES.map((page) => (
            <li key={page.to}>
              <Link to={page.to} className={linkClass}>
                {page.label}
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

function MockDataNote() {
  return (
    <div className="mb-6">
      <WarningBanner>Mock creator data, shared with the creator demo in this tab.</WarningBanner>
    </div>
  );
}

export function AdminCreatorRosterDemoPage() {
  const { data: drop } = useCreatorDrop(DEMO_DROP_ID);
  const closeWindow = useCloseCreatorApplyWindow();

  return (
    <div>
      <PageHeading
        title={drop ? `${drop.brandName} · ${drop.title}` : "Brand roster"}
        subtitle="Brand view of a creator Drop."
        actions={
          drop?.windowOpen ? (
            <Button type="button" variant="outline" onClick={() => closeWindow.mutate(drop.id)}>
              Close the apply window
            </Button>
          ) : null
        }
      />
      <MockDataNote />
      <CreatorRosterSection dropId={DEMO_DROP_ID} />
    </div>
  );
}

export function AdminCreatorReviewDemoPage() {
  return (
    <div>
      <PageHeading title="Creator review and payouts" subtitle="Admin view of creators." />
      <MockDataNote />
      <div className="grid gap-10">
        <CreatorReviewQueue />
        <CreatorPayoutQueue />
      </div>
    </div>
  );
}
