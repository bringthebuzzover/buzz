/**
 * Read-only campaign progress stepper for a drop. Highlights the current stage
 * (PRODUCT.md §5.2). Per-org tracking lists live on the org cards below.
 */
import {
  BRAND_DROP_TRACKER_COPY,
  BRAND_DROP_TRACKER_ORDER,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { GAP, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

type BrandDropTrackerStepperProps = {
  currentStage: BrandDropTrackerStage;
};

export default function BrandDropTrackerStepper({
  currentStage,
}: BrandDropTrackerStepperProps) {
  const currentIdx = BRAND_DROP_TRACKER_ORDER.indexOf(currentStage);

  return (
    <Card kind="card" pad="card">
      <div className="mb-6 flex items-center justify-between">
        <h2 className={TEXT.h3}>Drop status</h2>
        <Chip accent>
          {BRAND_DROP_TRACKER_COPY[currentStage]?.label ?? currentStage}
        </Chip>
      </div>

      <ol className={cn("grid grid-cols-1 md:grid-cols-3", GAP.default)}>
        {BRAND_DROP_TRACKER_ORDER.map((stage, idx) => {
          // Legacy pre-publish stages are not in the stepper order (idx -1).
          const reached = currentIdx >= 0 && idx <= currentIdx;
          const isCurrent = currentIdx >= 0 && idx === currentIdx;
          const copy = BRAND_DROP_TRACKER_COPY[stage];
          return (
            <li
              key={stage}
              className={cn(
                "relative flex min-h-[3.25rem] items-center justify-center rounded-buzzControl border px-3 py-3 text-center transition",
                isCurrent
                  ? "border-buzz-coral bg-buzz-butter shadow-buzz"
                  : reached
                    ? "border-buzz-lineMid bg-buzz-cream"
                    : "border-buzz-lineMid bg-buzz-paper opacity-60",
              )}
            >
              <span className={cn(TEXT.body, "font-semibold leading-snug text-buzz-ink")}>
                {copy.label}
              </span>
            </li>
          );
        })}
      </ol>

      {currentIdx >= BRAND_DROP_TRACKER_ORDER.indexOf("awaiting_products") ? (
        <p className={cn(TEXT.meta, "mt-6 text-buzz-inkMuted")}>
          Tracking numbers are listed on each accepted organization below.
        </p>
      ) : null}
    </Card>
  );
}
