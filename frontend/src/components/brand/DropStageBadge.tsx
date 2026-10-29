/**
 * Drop stage badge. Pen: a drop still taking applicants is the yellow wash,
 * one in progress is a yellow outline, a wrapped drop is quiet paper.
 */
import { dropStageLabel, type DropStage } from "../../utils/dropStage";
import { Badge, Chip } from "../ui/Chip";

export default function DropStageBadge({ stage }: { stage: DropStage }) {
  const label = dropStageLabel(stage);
  if (stage === "applying") return <Badge>{label}</Badge>;
  return (
    <Chip dot tone={stage === "wrapped" || stage === "draft" ? "neutral" : "pending"}>
      {label}
    </Chip>
  );
}
