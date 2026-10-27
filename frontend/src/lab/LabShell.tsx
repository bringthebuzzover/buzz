import type { ReactElement } from "react";
import { useLocation } from "react-router-dom";
import AppRoot from "../AppRoot";
import { isLabDirectoryPath } from "../data/labEntries";
import LabHomePage from "./LabHomePage";
import "./badge.css";
import "./lab.css";

/**
 * Lab-build frame. `/` and `/lab` are the directory, under a "Design preview"
 * badge. Every other path keeps the real app, and the badge becomes a link
 * back to the directory. A plain `<a>` reloads, so a design page's scroll
 * and motion state never leak into the directory.
 */
export default function LabShell(): ReactElement {
  const { pathname } = useLocation();
  const directory = isLabDirectoryPath(pathname);
  return (
    <>
      {directory ? (
        <p className="lab-badge">Design preview</p>
      ) : (
        <a
          className="lab-badge lab-badge--back"
          href="/"
          title="Design preview. Back to all designs."
        >
          <span aria-hidden="true">←</span> All designs
        </a>
      )}
      {directory ? <LabHomePage /> : <AppRoot />}
    </>
  );
}
