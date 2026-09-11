/**
 * Read-only campaign progress stepper for a drop. Highlights the current stage
 * and shows tracking number copy on `products_in_transit` and beyond when one is
 * available (PRODUCT.md §5.2).
 */
import { Truck } from "lucide-react";
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
  trackingNumber?: string;
};

export default function BrandDropTrackerStepper({
  currentStage,
  trackingNumber,
}: BrandDropTrackerStepperProps) {
  const currentIdx = BRAND_DROP_TRACKER_ORDER.indexOf(currentStage);
  const trackingVisible =
    Boolean(trackingNumber) &&
    BRAND_DROP_TRACKER_ORDER.indexOf("awaiting_products") <= currentIdx;

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

      {trackingVisible ? (
        <div className="mt-6 flex items-center gap-3 rounded-buzzControl border border-buzz-lineMid bg-buzz-butter p-4">
          <Truck size={20} className="text-buzz-coral" />
          <div>
            <p className={cn(TEXT.micro, "text-buzz-inkMuted")}>
              Shipment tracking
            </p>
            <p className={TEXT.body}>#{trackingNumber}</p>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
