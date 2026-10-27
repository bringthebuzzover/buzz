/**
 * Entry for the lab build only. `craco.config.js` selects this when
 * `VITE_LAB=1`. Production stays on `src/index.tsx`.
 *
 * Does not mount `AuthProvider`. The preview must not refresh a session.
 */
import "../index.css";
import { mountApp } from "../bootstrap";
import LabShell from "./LabShell";

mountApp(<LabShell />);
