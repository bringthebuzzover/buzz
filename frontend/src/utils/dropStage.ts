/**
 * Drop lifecycle stage — frontend mirror of `backend/app/services/lifecycle.py`.
 *
 * The API computes and returns `stage` on every drop; screens only label and
 * order it, never re-derive it. Hidden is a separate flag on top of any stage.
 */
import type { components } from "../api/generated/schema";

export type DropStage = components["schemas"]["DropStage"];

/** Lifecycle order. Draft is BUZZ-only; brands and orgs see the rest. */
export const DROP_STAGE_ORDER: readonly DropStage[] = [
  "draft",
  "upcoming",
  "applying",
  "selecting",
  "live",
  "wrapped",
] as const;

/** Stages after publish (brand stepper, org progress). */
export const PUBLISHED_STAGES: readonly DropStage[] = DROP_STAGE_ORDER.slice(1);

export const DROP_STAGE_LABEL: Record<DropStage, string> = {
  draft: "Draft",
  upcoming: "Upcoming",
  applying: "Applying",
  selecting: "Selecting",
  live: "Live",
  wrapped: "Wrapped",
};

/** Label for a stage, tolerating legacy names on old tracker events. */
export function dropStageLabel(stage: string): string {
  return DROP_STAGE_LABEL[stage as DropStage] ?? stage.replace(/_/g, " ");
}
