/**
 * Lab-build stand-in for `src/api/config.ts`.
 * `craco.config.js` substitutes this module when `VITE_LAB=1`, so the
 * production misconfiguration log does not run. The URL is the same fallback.
 * The lab entry does not mount `AuthProvider`, so nothing refreshes against it.
 */
export const API_BASE_URL = "http://localhost:8000";
