/**
 * Read-only drop progress. Pen `Stepper / Step`: a 4px bar per stage, yellow
 * once the drop reaches it. Per-org tracking lists live on the org rows below.
 */
import {
  DRAFT_NOT_PUBLISHED,
  DROP_STAGE_LABEL,
  PUBLISHED_STAGES,
  type DropStage,
} from "../../utils/dropStage";
import { shortDate } from "../../utils/dropStatus";
import { Notice } from "../forms/controls";
import { Card, CardHeader } from "../ui/Card";
import { GAP, TEXT } from "../../theme/tokens";
import { cn } from "../../theme/cn";

/** D-2: BUZZ steps in when the brand hasn't sent decisions this long after close. */
const BUZZ_STEPS_IN_DAYS = 5;


export default function BrandDropTrackerStepper({
  currentStage,
  applyCloseAt,
}: {
  currentStage: DropStage;
  applyCloseAt: number;
}) {
  // Draft and canceled are not in the published order (-1), so nothing is lit.
  const currentIdx = PUBLISHED_STAGES.indexOf(currentStage);
  const live = currentStage === "live" || currentStage === "wrapped";

  return (
    <Card kind="panel" pad="card" className="flex flex-col gap-5">
      <CardHeader title="Drop status" className="mb-0" />
      <ol className={cn("grid grid-cols-5", GAP.default)}>
        {PUBLISHED_STAGES.map((stage, idx) => {
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
                {DROP_STAGE_LABEL[stage]}
              </span>
            </li>
          );
        })}
      </ol>
      {currentStage === "draft" ? (
        <Notice>{DRAFT_NOT_PUBLISHED}. Orgs can&apos;t see it yet; BUZZ publishes it.</Notice>
      ) : null}
      {currentStage === "selecting" ? (
        <Notice tone="accent">
          Choose your orgs. Applications closed {shortDate(applyCloseAt)}. Decide below and
          send by {shortDate(applyCloseAt + BUZZ_STEPS_IN_DAYS * 86_400_000)}, or BUZZ will
          choose for you.
        </Notice>
      ) : null}
      {currentStage === "canceled" ? (
        <Notice>BUZZ canceled this drop. Nothing more happens on it.</Notice>
      ) : null}
      {live ? (
        <Notice tone="accent">
          Tracking numbers are listed on each accepted organization below.
        </Notice>
      ) : null}
    </Card>
  );
}
