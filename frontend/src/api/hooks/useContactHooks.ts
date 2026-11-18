/**
 * `POST /api/contact` — the public marketing contact form.
 *
 * Public on purpose: a visitor with a question has no account to log in with.
 * The backend answers the same success shape for a honeypot hit, so the UI must
 * never try to infer "was I filtered" from the response.
 */
import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "../client";

export type ContactSubmission = {
  name: string;
  type: "organization" | "brand";
  email: string;
  message: string;
  /** Honeypot. Real users never fill it; see `ContactModal`. */
  website?: string;
};

export function useSubmitContact() {
  return useMutation({
    mutationFn: async (submission: ContactSubmission) => {
      const { data } = await apiFetch<{ accepted: boolean }>("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      return data;
    },
  });
}
