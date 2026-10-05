/**
 * Sticky bar shown while an admin walks the creator portal from the demo
 * directory. Exit resets the mock creator data and returns to the directory.
 */
import {
  useCreatorSession,
  useExitCreatorDemo,
} from "../../api/hooks/creator/useCreatorHooks";

export default function CreatorDemoBanner() {
  const { data: session } = useCreatorSession();
  const exitDemo = useExitCreatorDemo();

  if (!session.demo) return null;

  return (
    <div
      role="status"
      data-testid="creator-demo-banner"
      className="sticky top-0 z-buzzBanner flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-buzz-butter px-4 py-2 text-center text-sm font-semibold text-buzz-ink"
    >
      <span>Creator demo with mock data</span>
      <button
        type="button"
        data-testid="exit-creator-demo"
        onClick={() => {
          exitDemo.mutate();
          window.location.href = "/admin/demo";
        }}
        className="rounded-buzzControl border border-buzz-ink/60 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide transition hover:bg-buzz-ink hover:text-buzz-butter"
      >
        Exit demo
      </button>
    </div>
  );
}
