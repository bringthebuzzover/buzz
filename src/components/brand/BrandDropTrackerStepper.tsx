/**
 * Read-only 5-stage progress stepper for a drop. Highlights the current stage
 * and shows tracking number copy on `awaiting_products` and beyond when one is
 * available (PRODUCT.md §5.2).
 */
import { Truck } from "lucide-react";
import {
  BRAND_DROP_TRACKER_COPY,
  BRAND_DROP_TRACKER_ORDER,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";

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
    <div className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-buzz-ink">Drop status</h2>
        <span className="rounded-full border border-buzz-lineMid bg-buzz-cream px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-buzz-coral">
          {BRAND_DROP_TRACKER_COPY[currentStage].label}
        </span>
      </div>

      <ol className="grid grid-cols-1 gap-4 md:grid-cols-5">
        {BRAND_DROP_TRACKER_ORDER.map((stage, idx) => {
          const reached = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          const copy = BRAND_DROP_TRACKER_COPY[stage];
          return (
            <li
              key={stage}
              className={`relative flex flex-col gap-2 rounded-xl border p-4 transition ${
                isCurrent
                  ? "border-buzz-coral bg-buzz-butter shadow-sm"
                  : reached
                    ? "border-buzz-lineMid bg-buzz-cream"
                    : "border-buzz-lineMid bg-buzz-paper opacity-60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                    reached
                      ? "bg-buzz-coral text-buzz-paper"
                      : "bg-buzz-cream text-buzz-inkMuted"
                  }`}
                >
                  {idx + 1}
                </span>
                <span className="text-sm font-bold text-buzz-ink">
                  {copy.label}
                </span>
              </div>
              <p className="text-xs font-medium leading-snug text-buzz-inkMuted">
                {copy.subcopy}
              </p>
            </li>
          );
        })}
      </ol>

      {trackingVisible ? (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-buzz-lineMid bg-buzz-butter p-4">
          <Truck size={20} className="text-buzz-coral" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-buzz-inkMuted">
              Shipment tracking
            </p>
            <p className="text-sm font-bold text-buzz-ink">
              #{trackingNumber}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
