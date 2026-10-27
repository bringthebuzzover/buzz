import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  branchPreviewUrl,
  labEntries,
  type LabEntry,
} from "../data/labEntries";

function LinkedUrl({ href }: { href: string }): ReactElement {
  const bits = href.split(/(?<=[./])/);
  return (
    <p className="lab-url">
      {bits.map((bit, index) => (
        <span key={index}>
          {bit}
          {index < bits.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </p>
  );
}

function EntryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): ReactElement {
  const external = /^https?:/.test(href);
  if (!external && !href.startsWith("/lab/")) {
    return <Link to={href}>{children}</Link>;
  }
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function LabCard({ entry }: { entry: LabEntry }): ReactElement {
  const preview = entry.branch
    ? branchPreviewUrl(entry.branch, entry.branchPath ?? entry.href)
    : null;

  return (
    <article className="lab-card">
      <div
        className={
          entry.thumbnailFit === "contain"
            ? "lab-thumb lab-thumb--contain"
            : "lab-thumb"
        }
      >
        <img src={entry.thumbnail} alt={entry.thumbnailAlt} />
      </div>
      <div className="lab-body">
        <div className="lab-name-row">
          <h2 className="lab-name">{entry.name}</h2>
          <span className={`lab-status lab-status--${entry.status.toLowerCase()}`}>
            {entry.status}
          </span>
        </div>
        <p className="lab-note">{entry.note}</p>
        {entry.quickLinks && entry.quickLinks.length > 0 ? (
          <ul className="lab-quick">
            {entry.quickLinks.map((link) => (
              <li key={link.href}>
                <a className="lab-pill" href={link.href}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {entry.branch ? (
          <p className="lab-pending">
            On <code>{entry.branch}</code> until it merges. This host 404s
            until then.
          </p>
        ) : null}
        <div className="lab-links">
          <EntryLink href={entry.href}>{entry.href}</EntryLink>
          {entry.prUrl ? (
            <a href={entry.prUrl} target="_blank" rel="noreferrer">
              Pull request
            </a>
          ) : null}
          {preview ? (
            <a href={preview} target="_blank" rel="noreferrer">
              Branch preview
            </a>
          ) : null}
        </div>
        {preview ? <LinkedUrl href={preview} /> : null}
      </div>
    </article>
  );
}

export default function LabHomePage(): ReactElement {
  return (
    <div className="lab">
      <a className="lab-skip" href="#designs">
        Skip to designs
      </a>
      <div className="lab-wrap">
        <header>
          <p className="lab-mark">
            BUZZ <span>Lab</span>
          </p>
          <p className="lab-kicker">Private</p>
          <h1 className="lab-display">BUZZ Lab</h1>
          <p className="lab-support">
            Brainstorm and in-progress designs, in one directory. This host is
            a preview, not the live site.
          </p>
        </header>
        <ul id="designs" className="lab-grid">
          {labEntries.map((entry) => (
            <li key={entry.id}>
              <LabCard entry={entry} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
