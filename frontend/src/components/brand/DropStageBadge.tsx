/**
 * Drop stage badge. Pen: a drop still taking applicants is the yellow wash,
 * one in progress is a yellow outline, a finished or unpublished drop is quiet
 * paper. A draft says plainly that it is not published.
 */
import { DRAFT_NOT_PUBLISHED, dropStageLabel, type DropStage } from "../../utils/dropStage";
import { Badge, Chip } from "../ui/Chip";

export default function DropStageBadge({ stage }: { stage: DropStage }) {
  const label = stage === "draft" ? DRAFT_NOT_PUBLISHED : dropStageLabel(stage);
  if (stage === "applying") return <Badge>{label}</Badge>;
  const quiet = stage === "wrapped" || stage === "draft" || stage === "canceled";
  return (
    <Chip dot tone={quiet ? "neutral" : "pending"}>
      {label}
    </Chip>
  );
}
