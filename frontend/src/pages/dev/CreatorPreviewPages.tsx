/**
 * Development-only previews of the brand and admin creator surfaces. Routed
 * only when `NODE_ENV === "development"` and linked from nowhere; the real
 * homes are the brand Drop page and the admin console.
 */
import type { ReactNode } from "react";
import {
  useCloseCreatorApplyWindow,
  useCreatorDrop,
} from "../../api/hooks/creator/useCreatorHooks";
import CreatorRosterSection from "../../components/creator/CreatorRosterSection";
import { CreatorPayoutQueue, CreatorReviewQueue } from "../../components/creator/CreatorReviewQueue";
import { Button, WarningBanner } from "../../components/forms/controls";
import PageShell from "../../components/site/PageShell";
import { TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

const PREVIEW_DROP_ID = "drop-update";

function PreviewFrame({ wash, children }: { wash: string; children: ReactNode }) {
  return (
    <div className={cn("min-h-screen", wash)}>
      <PageShell>
        <div className="mb-6">
          <WarningBanner>Development preview with mock data.</WarningBanner>
        </div>
        {children}
      </PageShell>
    </div>
  );
}

export function CreatorBrandPreviewPage() {
  const { data: drop } = useCreatorDrop(PREVIEW_DROP_ID);
  const closeWindow = useCloseCreatorApplyWindow();

  return (
    <PreviewFrame wash="bg-buzz-cream">
      <p className={cn(TEXT.micro, "mb-2 font-semibold text-buzz-coral")}>{drop?.brandName}</p>
      <h1 className={cn(TEXT.h1, "mb-2 text-buzz-ink")}>{drop?.title}</h1>
      <p className={cn(TEXT.body, "mb-6 text-buzz-inkMuted")}>Digital Drop · creators</p>
      {drop?.windowOpen ? (
        <div className="mb-6">
          <Button type="button" variant="outline" onClick={() => closeWindow.mutate(drop.id)}>
            Close the apply window
          </Button>
        </div>
      ) : null}
      <CreatorRosterSection dropId={PREVIEW_DROP_ID} />
    </PreviewFrame>
  );
}

export function CreatorAdminPreviewPage() {
  return (
    <PreviewFrame wash="bg-buzz-neutralWash">
      <h1 className={cn(TEXT.h1, "mb-6 text-buzz-ink")}>Creators</h1>
      <div className="grid gap-10">
        <CreatorReviewQueue />
        <CreatorPayoutQueue />
      </div>
    </PreviewFrame>
  );
}
