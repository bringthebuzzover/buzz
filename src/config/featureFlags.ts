/**
 * Build-time feature flags (CRA inlines `process.env.REACT_APP_*` as strings).
 *
 * `USE_API` is the Stage 4 strangler switch: when `true`, the migrated slice(s)
 * (currently the org drop feed at `/org/browse`) render from the real backend
 * API instead of the demo `MockDataContext` stores. Default `false` → the demo
 * behaves exactly as before.
 */
export const USE_API = process.env.REACT_APP_USE_API === "true";
