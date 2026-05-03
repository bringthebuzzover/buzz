/**
 * Public landing waitlist: routes to `brand_waitlist` or `org_waitlist` by selection;
 * does not persist a type field — shape matches the target collection.
 */
import { useState, type FormEvent } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import {
  buildBrandWaitlistSubmission,
  db,
  FIRESTORE_COLLECTIONS,
} from "../../firebase";

const HOME_WAITLIST_KINDS = [
  { value: "org", label: "Student organization" },
  { value: "brand", label: "Brand" },
] as const;

type HomeWaitlistKind = (typeof HOME_WAITLIST_KINDS)[number]["value"];
type SubmitState = "idle" | "submitting" | "sent";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function HomeWaitlistSection() {
  const [submitterName, setSubmitterName] = useState("");
  const [kind, setKind] = useState<"" | HomeWaitlistKind>("");
  const [orgOrBrandName, setOrgOrBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!kind || !orgOrBrandName.trim() || submitState !== "idle") {
      return;
    }
    setSubmitState("submitting");
    try {
      const collectionId =
        kind === "brand"
          ? FIRESTORE_COLLECTIONS.brandWaitlist
          : FIRESTORE_COLLECTIONS.orgWaitlist;
      const payload =
        kind === "brand"
          ? buildBrandWaitlistSubmission({
              submitterName: submitterName.trim(),
              brandName: orgOrBrandName.trim(),
              email: email.trim(),
              details: "",
            })
          : {
              submitterName: submitterName.trim(),
              orgName: orgOrBrandName.trim(),
              email: email.trim(),
              createdAt: serverTimestamp(),
            };

      void addDoc(collection(db, collectionId), payload).catch((err) => {
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
              value={submitterName}
              onChange={(e) => setSubmitterName(e.target.value)}
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
              value={kind}
              onChange={(e) => {
                const v = e.target.value;
                setKind(v === "" ? "" : (v as HomeWaitlistKind));
                setOrgOrBrandName("");
              }}
              className="w-full rounded-lg border border-buzz-lineMid bg-buzz-cream p-3 text-sm text-buzz-ink outline-none focus:border-buzz-coral focus:ring-2 focus:ring-buzz-coral"
            >
              <option value="" disabled>
                Select
              </option>
              {HOME_WAITLIST_KINDS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {kind ? (
            <div>
              <label
                htmlFor="waitlist-org-brand-name"
                className="mb-2 block text-sm font-bold text-buzz-inkMuted"
              >
                {kind === "org" ? "Organization name" : "Brand name"}
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
