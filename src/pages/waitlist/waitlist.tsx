/**
 * Standalone waitlist route (outside `SiteLayout`): full-bleed background image and rose card
 * that writes submissions to Firestore `waitlist` collection.
 */
import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import waitlistBackground from "../../assets/aboutBackground.png";

/** Fields persisted to Firestore on successful submit. */
type WaitlistForm = {
  name: string;
  companyName: string;
  product: string;
  details: string;
};

/** Empty form used after a successful signup to reset inputs. */
const initialForm: WaitlistForm = {
  name: "",
  companyName: "",
  product: "",
  details: "",
};

/**
 * Controlled form bound to Firestore; shows browser alerts on success/failure.
 */
export default function Waitlist() {
  const [form, setForm] = useState<WaitlistForm>(initialForm);

  /** Generic text/textarea change handler keyed by `name` attribute. */
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const key = e.target.name as keyof WaitlistForm;
    setForm(prev => ({
      ...prev,
      [key]: e.target.value,
    }));
  };

  /** Persists `form` plus `serverTimestamp()` under the `waitlist` collection. */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await addDoc(collection(db, "waitlist"), {
        name: form.name,
        companyName: form.companyName,
        product: form.product,
        details: form.details,
        createdAt: serverTimestamp(),
      });

      alert("You’re on the waitlist!");
      setForm(initialForm);
    } catch (err) {
      console.error(err);
      alert("Something went wrong.");
    }
  };

  return (
    <section
      className="relative flex min-h-screen items-center justify-center bg-cover bg-[center_top] bg-no-repeat max-[600px]:pt-40"
      style={{ backgroundImage: `url(${waitlistBackground})` }}
    >
      <div className="flex w-full items-center justify-center">
        <div className="mx-5 mt-10 w-full max-w-[480px] translate-y-[100px] bg-buzz-waitlistRose px-10 py-12 text-left shadow-buzz max-[600px]:mx-5 max-[600px]:mt-0 max-[600px]:px-7 max-[600px]:py-10">
          <h1 className="mb-7 text-4xl font-black text-buzz-paper max-[600px]:text-3xl">
            Join the Waitlist
          </h1>

          <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
            <input
              name="name"
              placeholder="Your Name"
              value={form.name}
              onChange={handleChange}
              required
              className="border-none bg-buzz-paper px-[18px] py-4 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <input
              name="companyName"
              placeholder="Company Name"
              value={form.companyName}
              onChange={handleChange}
              required
              className="border-none bg-buzz-paper px-[18px] py-4 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <input
              name="product"
              placeholder="Product"
              value={form.product}
              onChange={handleChange}
              required
              className="border-none bg-buzz-paper px-[18px] py-4 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <textarea
              name="details"
              placeholder="Optional details"
              value={form.details}
              onChange={handleChange}
              className="border-none bg-buzz-paper px-[18px] py-4 font-inherit text-base text-buzz-waitlistInk transition-shadow duration-200 ease-out placeholder:text-buzz-inkFaint focus:outline-none focus:ring-2 focus:ring-inset focus:ring-buzz-waitlistPink"
            />

            <button
              type="submit"
              className="mt-4 cursor-pointer border-none bg-buzz-paper px-8 py-4 text-lg font-black text-buzz-waitlistPink transition-colors duration-200 ease-out hover:bg-buzz-cream hover:text-buzz-ink"
            >
              Join Waitlist
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
