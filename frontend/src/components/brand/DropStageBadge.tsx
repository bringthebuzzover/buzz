/**
 * Brand-facing drop stage badge. Pen: a new request is the yellow wash, a drop
 * in progress is a yellow outline, a finished drop is quiet paper.
 */
import {
  BRAND_DROP_TRACKER_COPY,
  type BrandDropTrackerStage,
} from "../../types/brandPortal";
import { Badge, Chip } from "../ui/Chip";

export default function DropStageBadge({ stage }: { stage: string }) {
  const label =
    BRAND_DROP_TRACKER_COPY[stage as BrandDropTrackerStage]?.label ??
    stage.replace(/_/g, " ");
  if (stage === "request_received") return <Badge>{label}</Badge>;
  return (
    <Chip dot tone={stage === "drop_finished" ? "neutral" : "pending"}>
      {label}
    </Chip>
  );
}
