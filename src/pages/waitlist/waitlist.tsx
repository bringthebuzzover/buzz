/**
 * Brand waitlist route inside `SiteLayout`: photo-forward hero background + refined
 * glass card form.
 *
 * Stage 6: when USE_API is true, submits to POST /api/waitlist instead of Firestore.
 */
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { collection, addDoc } from "firebase/firestore";
import {
  buildBrandWaitlistSubmission,
  db,
  FIRESTORE_COLLECTIONS,
} from "../../firebase";
import { USE_API } from "../../config/featureFlags";
import { API_BASE_URL } from "../../api/config";
import waitlistBackground from "../../assets/boxesImage.png";

type WaitlistForm = {
  submitterName: string;
  entityName: string;
  email: string;
  entityType: "brand" | "org";
  details: string;
};

const initialForm: WaitlistForm = {
  submitterName: "",
  entityName: "",
  email: "",
  entityType: "brand",
  details: "",
};

export default function Waitlist() {
  const [form, setForm] = useState<WaitlistForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const key = e.target.name as keyof WaitlistForm;
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (USE_API) {
        const resp = await fetch(`${API_BASE_URL}/api/waitlist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submitterName: form.submitterName.trim(),
            entityName: form.entityName.trim(),
            email: form.email.trim(),
            entityType: form.entityType,
            details: form.details.trim() || undefined,
          }),
        });
        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          throw new Error(body?.error?.message ?? "Submission failed");
        }
      } else {
        await addDoc(
          collection(db, FIRESTORE_COLLECTIONS.brandWaitlist),
          buildBrandWaitlistSubmission({
            submitterName: form.submitterName.trim(),
            brandName: form.entityName.trim(),
            email: form.email.trim(),
            details: form.details.trim(),
          }),
        );
      }

      alert("You're on the waitlist!");
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="relative isolate min-h-[calc(100vh-14rem)] overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${waitlistBackground})` }}
      />
      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-center px-6 py-16 md:py-24">
        <div className="w-full max-w-xl rounded-3xl border border-buzz-lineMid/60 bg-buzz-butter/30 p-8 text-left shadow-2xl backdrop-blur-sm md:p-10">
          <h1 className="mb-2 text-4xl font-black text-buzz-coral max-[600px]:text-3xl">
            Join the Waitlist
          </h1>
          <p className="mb-7 text-sm font-medium text-buzz-inkMuted">
            Tell us a bit about you. We will reach out when a BUZZ
            representative is ready to onboard your next drop.
          </p>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <input
              name="submitterName"
              placeholder="Your name"
              value={form.submitterName}
              onChange={handleChange}
              required
              className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <input
              name="entityName"
              placeholder="Brand or organization name"
              value={form.entityName}
              onChange={handleChange}
              required
              className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <input
              name="email"
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
              className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <select
              name="entityType"
              value={form.entityType}
              onChange={handleChange}
              className="rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            >
              <option value="brand">Brand</option>
              <option value="org">Student Organization</option>
            </select>

            <textarea
              name="details"
              placeholder="Optional details"
              value={form.details}
              onChange={handleChange}
              className="min-h-28 rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 cursor-pointer rounded-lg border-none bg-buzz-coral px-8 py-3.5 text-lg font-black text-buzz-paper transition-colors duration-200 ease-out hover:bg-buzz-coralDark disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Join Waitlist"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
