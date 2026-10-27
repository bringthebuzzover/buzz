/**
 * Directory for the BUZZ Lab preview. Add a design by appending one object.
 * Production builds do not import this module. See docs/LAB.md.
 */
import pulseThumb from "../lab/media/pulse.jpg";
import pulseTwoThumb from "../lab/media/pulse2.jpg";
import inspoThumb from "../lab/media/inspo.jpg";
import dropEditorThumb from "../lab/media/drop-editor.jpg";
import logoThumb from "../lab/media/logo-options.svg";
import pulseBeeThumb from "../lab/media/pulse-bee.jpg";
import pulseBeeOrgsThumb from "../lab/media/pulse-bee-orgs.jpg";
import pulseBeeBrandsThumb from "../lab/media/pulse-bee-brands.jpg";

/**
 * Cloudflare Pages project subdomain, the label before `.pages.dev`.
 * Placeholder until the project exists. Branch-preview links use it as-is.
 */
export const LAB_PAGES_PROJECT = "{project}";

export const LAB_STATUSES = ["Live", "Frozen", "Idea", "Mockup"] as const;

export type LabStatus = (typeof LAB_STATUSES)[number];

export type LabQuickLink = {
  label: string;
  href: string;
};

export type LabEntry = {
  id: string;
  name: string;
  note: string;
  status: LabStatus;
  /** Path on this lab host. */
  href: string;
  prUrl?: string;
  /**
   * Git branch that currently has this route, when it is not on
   * `design/brainstorm` yet. Pages publishes a branch alias for it.
   */
  branch?: string;
  /** Path on the branch preview. Defaults to `href`. */
  branchPath?: string;
  thumbnail: string;
  thumbnailAlt: string;
  thumbnailFit?: "cover" | "contain";
  quickLinks?: readonly LabQuickLink[];
};

const DROP_EDITOR = "/lab/drop-editor/";
const DROP_EDITOR_APP = "/drop-editor";

/**
 * Cloudflare branch alias: lowercased, every non-alphanumeric run becomes
 * one hyphen. `fix/api` → `fix-api`.
 */
export function branchAlias(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function branchPreviewUrl(
  branch: string,
  path: string,
  project: string = LAB_PAGES_PROJECT,
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `https://${branchAlias(branch)}.${project}.pages.dev${normalized}`;
}

export function isLabDirectoryPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return path === "/" || path === "/lab";
}

export const labEntries: readonly LabEntry[] = [
  {
    id: "pulse",
    name: "Pulse",
    note: "Original approved marketing page. Black, off-white, and yellow.",
    status: "Frozen",
    href: "/pulse",
    thumbnail: pulseThumb,
    thumbnailAlt:
      "Students carrying Yerba Madre cases outside a stone campus building.",
  },
  {
    id: "pulse2",
    name: "Pulse 2",
    note: "Active redesign on the same system, with a real US campus map.",
    status: "Live",
    href: "/pulse2",
    prUrl: "https://github.com/bringthebuzzover/buzz/pull/20",
    thumbnail: pulseTwoThumb,
    thumbnailAlt: "Two students holding Yerba Madre cans indoors.",
  },
  {
    id: "inspo",
    name: "Inspo",
    note: "Parked marketing concept on this branch. Cream field, campus map.",
    status: "Idea",
    href: "/inspo",
    thumbnail: inspoThumb,
    thumbnailAlt:
      "Inspo hero: Tap into Gen Z everywhere, beside a dotted campus map.",
  },
  {
    id: "pulse-bee",
    name: "Pulse Bee",
    note: "Pulse 2 plus a bee that flies campus to campus on the college map.",
    status: "Live",
    href: "/pulse-bee",
    prUrl: "https://github.com/bringthebuzzover/buzz/pull/22",
    thumbnail: pulseBeeThumb,
    thumbnailAlt: "Pulse Bee hero: Campus marketing, powered by student communities.",
  },
  {
    id: "pulse-bee-orgs",
    name: "Pulse Bee: Organizations",
    note: "Pulse Bee page for student organizations. What they get, steps, drops, FAQ.",
    status: "Mockup",
    href: "/pulse-bee/orgs",
    thumbnail: pulseBeeOrgsThumb,
    thumbnailAlt: "Pulse Bee organizations hero over the Kappa Alpha Theta x Yerba Madre photo.",
  },
  {
    id: "pulse-bee-brands",
    name: "Pulse Bee: Brands",
    note: "Pulse Bee page for brands. Steps, goals, college network, FAQ.",
    status: "Mockup",
    href: "/pulse-bee/brands",
    thumbnail: pulseBeeBrandsThumb,
    thumbnailAlt: "Pulse Bee brands hero over the Epsilon Nu Tau x UPDATE photo.",
  },
  {
    id: "drop-editor",
    name: "Drop editor",
    note: "Static mockup of the drop editor. Open a state directly.",
    status: "Mockup",
    href: DROP_EDITOR,
    thumbnail: dropEditorThumb,
    thumbnailAlt: "Drop editor mockup, brand mode, Yerba Madre x BUZZ.",
    quickLinks: [
      { label: "Brand", href: `${DROP_EDITOR}?mode=brand` },
      { label: "Date picker", href: `${DROP_EDITOR}?pop=1` },
      { label: "Description", href: `${DROP_EDITOR}?desc=1` },
      { label: "Rename", href: `${DROP_EDITOR}?edit=1` },
    ],
  },
  {
    id: "drop-editor-react",
    name: "Drop editor (React)",
    note: "The drop editor built in the app. Click around; nothing saves.",
    status: "Live",
    href: DROP_EDITOR_APP,
    thumbnail: dropEditorThumb,
    thumbnailAlt: "Drop editor, admin mode, Yerba Madre x BUZZ.",
    quickLinks: [
      { label: "Brand", href: `${DROP_EDITOR_APP}?mode=brand` },
      { label: "Date picker", href: `${DROP_EDITOR_APP}?pop=1` },
      { label: "Description", href: `${DROP_EDITOR_APP}?desc=1` },
      { label: "Rename", href: `${DROP_EDITOR_APP}?edit=1` },
    ],
  },
  {
    id: "logo-options",
    name: "Logo options",
    note: "Wordmark sketches from design/logo-options on this branch.",
    status: "Idea",
    href: "/lab/logo-options/",
    thumbnail: logoThumb,
    thumbnailAlt: "Herald bee sketch from the logo options.",
    thumbnailFit: "contain",
  },
];
