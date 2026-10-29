/**
 * Read-only drop progress (buzz-ops product/PRODUCT.md §5.2). Pen
 * `Stepper / Step`: a 4px bar per stage, yellow once the drop reaches it.
 * Per-org tracking lists live on the org rows below.
 */
import {
  BRAND_DROP_TRACKER_COPY,
  BRAND_DROP_TRACKER_ORDER,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";
import { Notice } from "../forms/controls";
import { Card, CardHeader } from "../ui/Card";
import { GAP, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

export default function BrandDropTrackerStepper({
  currentStage,
}: {
  currentStage: BrandDropTrackerStage;
}) {
  // Pre-publish stages are not in the stepper order (-1), so nothing is lit.
  const currentIdx = BRAND_DROP_TRACKER_ORDER.indexOf(currentStage);

  return (
    <Card kind="panel" pad="card" className="flex flex-col gap-5">
      <CardHeader title="Drop status" className="mb-0" />
      <ol className={cn("grid grid-cols-3", GAP.default)}>
        {BRAND_DROP_TRACKER_ORDER.map((stage, idx) => {
          const reached = currentIdx >= 0 && idx <= currentIdx;
          return (
            <li
              key={stage}
              className="flex flex-col gap-3"
              aria-current={idx === currentIdx ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-1 rounded-full",
                  reached ? "bg-accent" : "bg-buzz-paper09",
                )}
                aria-hidden
              />
              <span className={cn(TEXT.micro, reached ? "text-primary" : "text-quiet")}>
                {BRAND_DROP_TRACKER_COPY[stage].label}
              </span>
            </li>
          );
        })}
      </ol>
      {currentIdx >= 0 ? (
        <Notice tone="accent">
          Tracking numbers are listed on each accepted organization below.
        </Notice>
      ) : null}
    </Card>
  );
}
