/**
 * Visible only when the SPA was built with REACT_APP_ENV=staging.
 * Production builds leave the variable unset and render nothing.
 */
const STAGING = process.env.REACT_APP_ENV === "staging";

export default function StagingRibbon() {
  if (!STAGING) return null;
  return (
    <div
      role="status"
      data-testid="staging-ribbon"
      className="sticky top-0 z-buzzBanner bg-buzz-butterBright px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-widest text-buzz-ink"
    >
      Staging
    </div>
  );
}
