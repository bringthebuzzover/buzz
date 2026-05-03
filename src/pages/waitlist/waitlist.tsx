/**
 * Brand waitlist route inside `SiteLayout`: photo-forward hero background + refined
 * glass card form that writes submissions to Firestore `brand_waitlist`.
 */
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { collection, addDoc } from "firebase/firestore";
import {
  buildBrandWaitlistSubmission,
  db,
  FIRESTORE_COLLECTIONS,
} from "../../firebase";
import waitlistBackground from "../../assets/boxesImage.png";

/** Fields persisted to Firestore on successful submit. */
type WaitlistForm = {
  submitterName: string;
  brandName: string;
  email: string;
  details: string;
};

/** Empty form used after a successful signup to reset inputs. */
const initialForm: WaitlistForm = {
  submitterName: "",
  brandName: "",
  email: "",
  details: "",
};

/**
 * Controlled form bound to Firestore; shows browser alerts on success/failure.
 */
export default function Waitlist() {
  const [form, setForm] = useState<WaitlistForm>(initialForm);

  /** Generic text/textarea change handler keyed by `name` attribute. */
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const key = e.target.name as keyof WaitlistForm;
    setForm((prev) => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  /** Persists `form` plus `serverTimestamp()` under the `brand_waitlist` collection. */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await addDoc(
        collection(db, FIRESTORE_COLLECTIONS.brandWaitlist),
        buildBrandWaitlistSubmission({
          submitterName: form.submitterName.trim(),
          brandName: form.brandName.trim(),
          email: form.email.trim(),
          details: form.details.trim(),
        }),
      );

      alert("You’re on the waitlist!");
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
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
            Join the Brand Waitlist
          </h1>
          <p className="mb-7 text-sm font-medium text-buzz-inkMuted">
            Tell us a bit about you and your brand. We will reach out when a
            BUZZ representative is ready to onboard your next drop.
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
              name="brandName"
              placeholder="Brand name"
              value={form.brandName}
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

            <textarea
              name="details"
              placeholder="Optional details"
              value={form.details}
              onChange={handleChange}
              className="min-h-28 rounded-lg border border-buzz-lineMid bg-buzz-paper px-4 py-3 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <button
              type="submit"
              className="mt-2 cursor-pointer rounded-lg border-none bg-buzz-coral px-8 py-3.5 text-lg font-black text-buzz-paper transition-colors duration-200 ease-out hover:bg-buzz-coralDark"
            >
              Join Waitlist
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
