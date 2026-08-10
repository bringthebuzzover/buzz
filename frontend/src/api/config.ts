/**
 * API client configuration. The base URL comes from `REACT_APP_API_URL`
 * (documented in `.env.example`); it falls back to the local FastAPI dev server.
 *
 * CRA inlines `REACT_APP_*` at BUILD time. A production bundle with the URL unset
 * would call `localhost:8000` for every visitor — so the deploy path
 * (`predeploy` → `scripts/check-deploy-env.js`) hard-fails when it's missing, and
 * this runtime guard is a loud backstop. Set `REACT_APP_API_URL` at build time.
 */
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ?? "http://localhost:8000";

if (process.env.NODE_ENV === "production" && !process.env.REACT_APP_API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    "[buzz] REACT_APP_API_URL is unset in a production build — the SPA will call " +
      "http://localhost:8000 and fail. Rebuild with REACT_APP_API_URL set.",
  );
}
