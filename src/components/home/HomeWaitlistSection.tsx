/**
 * Public landing waitlist block: name, org type, email — writes to Firestore `public_waitlist_leads`.
 */
import { useState, type FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";

const ORG_TYPES = [
  { value: "student_org", label: "Student Organization" },
  { value: "company", label: "Company" },
] as const;

type OrgTypeValue = (typeof ORG_TYPES)[number]["value"];

export default function HomeWaitlistSection() {
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState<"" | OrgTypeValue>("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!type) {
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "public_waitlist_leads"), {
        fullName: fullName.trim(),
        type,
        email: email.trim(),
        createdAt: serverTimestamp(),
      });
      alert("Thanks — we’ll be in touch soon.");
      setFullName("");
      setEmail("");
      setType("");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="home-waitlist"
      className="scroll-mt-28 border-t border-buzz-lineMid bg-buzz-butter px-8 py-16"
    >
      <div className="mx-auto max-w-lg">
        <h2 className="mb-2 text-center text-2xl font-bold text-buzz-ink">
          Join the <span className="text-buzz-coral">waitlist</span>
        </h2>
        <p className="mb-8 text-center text-sm font-medium text-buzz-inkMuted">
          Tell us who you are — we&apos;ll reach out when BUZZ is ready for you.
        </p>
        <form
          className="space-y-5 rounded-2xl border border-buzz-lineMid bg-buzz-paper p-8 shadow-sm"
          onSubmit={onSubmit}
        >
          <div>
            <label
              htmlFor="waitlist-full-name"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Full name
            </label>
            <input
              id="waitlist-full-name"
              required
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            />
          </div>
          <div>
            <label
              htmlFor="waitlist-type"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Type
            </label>
            <select
              id="waitlist-type"
              required
              value={type}
              onChange={e => {
                const v = e.target.value;
                setType(v === "" ? "" : (v as OrgTypeValue));
              }}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm text-buzz-ink outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            >
              <option value="" disabled>
                Select
              </option>
              {ORG_TYPES.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="waitlist-email"
              className="mb-2 block text-sm font-bold text-buzz-inkMuted"
            >
              Email
            </label>
            <input
              id="waitlist-email"
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}
