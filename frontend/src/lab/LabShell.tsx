import type { ReactElement } from "react";
import { useLocation } from "react-router-dom";
import AppRoot from "../AppRoot";
import { isLabDirectoryPath } from "../data/labEntries";
import LabHomePage from "./LabHomePage";
import "./lab.css";

/**
 * Lab-build frame. `/` and `/lab` are the directory. Every other path keeps
 * the real app, with a fixed preview badge over it.
 */
export default function LabShell(): ReactElement {
  const { pathname } = useLocation();
  return (
    <>
      <p className="lab-badge">Design preview</p>
      {isLabDirectoryPath(pathname) ? <LabHomePage /> : <AppRoot />}
    </>
  );
}
