/**
 * Tracking numbers as the pen's KV row: carrier label over the number.
 * Wraps to a column in narrow cells (the brand drop table).
 */
import { carrierLabel, type Shipment } from "../../utils/shipments";
import { TEXT } from "../../theme/tokens";
import { focusRingClass } from "../../theme/controls";
import { cn } from "../../theme/cn";

type Props = {
  shipments: Shipment[];
  empty?: string;
  testId?: string;
};

export default function ShipmentList({
  shipments,
  empty = "No tracking numbers yet.",
  testId,
}: Props) {
  if (shipments.length === 0) {
    return (
      <p className={cn(TEXT.body, "text-quiet")} data-testid={testId}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-3" data-testid={testId}>
      {shipments.map((s) => (
        <li key={s.id} className={cn(TEXT.body, "flex flex-col gap-1 text-primary")}>
          <span className="text-xs text-quiet">{carrierLabel(s.carrier)}</span>
          {s.trackUrl ? (
            <a
              href={s.trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`track-link-${s.id}`}
              className={cn(
                "underline decoration-buzz-paper30 underline-offset-4 transition hover:decoration-primary",
                focusRingClass,
              )}
            >
              #{s.trackingNumber}
            </a>
          ) : (
            <span>#{s.trackingNumber}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
