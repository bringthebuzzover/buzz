/**
 * Brand waitlist route inside `SiteLayout`: photo-forward hero background + refined
 * glass card form. Submits to POST /api/waitlist.
 */
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { submitWaitlist } from "../../api/waitlist";
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

type SubmitStatus = "idle" | "submitting" | "sent" | "error";

export default function Waitlist() {
  const [form, setForm] = useState<WaitlistForm>(initialForm);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const submitting = status === "submitting";

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const key = e.target.name as keyof WaitlistForm;
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    if (status === "error") setStatus("idle");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setStatus("submitting");

    try {
      await submitWaitlist({
        submitterName: form.submitterName,
        entityName: form.entityName,
        email: form.email,
        entityType: form.entityType,
        details: form.details,
      });
      setForm(initialForm);
      setStatus("sent");
    } catch (err) {
      console.error(err);
      setStatus("error");
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

          {status === "sent" ? (
            <div
              role="status"
              className="rounded-2xl border border-buzz-lineMid bg-buzz-paper p-6 text-center"
            >
              <p className="text-lg font-black text-buzz-coral">
                You&apos;re on the waitlist!
              </p>
              <p className="mt-2 text-sm font-medium text-buzz-inkMuted">
                Thanks — a BUZZ representative will reach out soon.
              </p>
            </div>
          ) : (
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

            {status === "error" ? (
              <p
                role="alert"
                className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
              >
                Something went wrong. Please try again.
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 cursor-pointer rounded-lg border-none bg-buzz-coral px-8 py-3.5 text-lg font-black text-buzz-paper transition-colors duration-200 ease-out hover:bg-buzz-coralDark disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Join Waitlist"}
            </button>
          </form>
          )}
        </div>
      </div>
    </section>
  );
}
