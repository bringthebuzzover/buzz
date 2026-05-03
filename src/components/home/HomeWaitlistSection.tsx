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
type SubmitState = "idle" | "submitting" | "sent";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function HomeWaitlistSection() {
  const [fullName, setFullName] = useState("");
  const [type, setType] = useState<"" | OrgTypeValue>("");
  const [orgOrBrandName, setOrgOrBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!type || !orgOrBrandName.trim() || submitState !== "idle") {
      return;
    }
    setSubmitState("submitting");
    try {
      void addDoc(collection(db, "public_waitlist_leads"), {
        fullName: fullName.trim(),
        type,
        orgOrBrandName: orgOrBrandName.trim(),
        email: email.trim(),
        createdAt: serverTimestamp(),
      }).catch((err) => {
        console.error(err);
      });
      await wait(1500);
      setSubmitState("sent");
    } catch (err) {
      console.error(err);
      alert("Something went wrong. Please try again.");
      setSubmitState("idle");
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
              onChange={(e) => setFullName(e.target.value)}
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
              onChange={(e) => {
                const v = e.target.value;
                setType(v === "" ? "" : (v as OrgTypeValue));
                setOrgOrBrandName("");
              }}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm text-buzz-ink outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            >
              <option value="" disabled>
                Select
              </option>
              {ORG_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {type ? (
            <div>
              <label
                htmlFor="waitlist-org-brand-name"
                className="mb-2 block text-sm font-bold text-buzz-inkMuted"
              >
                {type === "student_org" ? "Organization name" : "Brand name"}
              </label>
              <input
                id="waitlist-org-brand-name"
                required
                type="text"
                value={orgOrBrandName}
                onChange={(e) => setOrgOrBrandName(e.target.value)}
                className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
              />
            </div>
          ) : null}
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
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            />
          </div>
          <button
            type="submit"
            disabled={submitState !== "idle"}
            className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:opacity-60"
          >
            {submitState === "idle"
              ? "Submit"
              : submitState === "submitting"
                ? "Sending..."
                : "Sent!"}
          </button>
        </form>
      </div>
    </section>
  );
}
