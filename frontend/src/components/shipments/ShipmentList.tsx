import { carrierLabel, type Shipment } from "../../utils/shipments";
import { TEXT } from "../../theme/tokens";
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
      <p className={cn(TEXT.meta, "text-buzz-inkMuted")} data-testid={testId}>
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-1" data-testid={testId}>
      {shipments.map((s) => (
        <li key={s.id} className={cn(TEXT.body, "font-semibold")}>
          <span className={cn(TEXT.micro, "mr-2 text-buzz-inkMuted")}>
            {carrierLabel(s.carrier)}
          </span>
          {s.trackUrl ? (
            <a
              href={s.trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`track-link-${s.id}`}
              className="text-buzz-coral hover:underline"
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
