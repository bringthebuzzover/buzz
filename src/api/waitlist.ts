/**
 * Public waitlist submission. Used by both the home lead-gen section and the
 * full `/waitlist` page, so the request shape lives in one place. Goes through
 * the shared `apiFetch` (envelope unwrap + typed `ApiError`); no auth required.
 */
import { apiFetch } from "./client";

export type WaitlistEntityType = "brand" | "org";

export type WaitlistSubmission = {
  submitterName: string;
  entityName: string;
  email: string;
  entityType: WaitlistEntityType;
  details?: string;
};

export async function submitWaitlist(payload: WaitlistSubmission): Promise<void> {
  await apiFetch("/api/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      submitterName: payload.submitterName.trim(),
      entityName: payload.entityName.trim(),
      email: payload.email.trim(),
      entityType: payload.entityType,
      details: payload.details?.trim() || undefined,
    }),
  });
}
