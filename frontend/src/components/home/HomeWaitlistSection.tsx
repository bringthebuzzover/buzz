/**
 * Public landing waitlist. Submits to `POST /api/waitlist` (Postgres), the same
 * backend surface the full-page `/waitlist` form uses — the org/brand selection
 * maps to the request's `entityType`.
 */
import { useState, type FormEvent } from "react";
import { submitWaitlist } from "../../api/waitlist";

const HOME_WAITLIST_KINDS = [
  { value: "org", label: "Student organization" },
  { value: "brand", label: "Brand" },
] as const;

type HomeWaitlistKind = (typeof HOME_WAITLIST_KINDS)[number]["value"];
type SubmitState = "idle" | "submitting" | "sent" | "error";

export default function HomeWaitlistSection() {
  const [submitterName, setSubmitterName] = useState("");
  const [kind, setKind] = useState<"" | HomeWaitlistKind>("");
  const [orgOrBrandName, setOrgOrBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      !kind ||
      !orgOrBrandName.trim() ||
      submitState === "submitting" ||
      submitState === "sent"
    ) {
      return;
    }
    setSubmitState("submitting");
    try {
      await submitWaitlist({
        submitterName,
        entityName: orgOrBrandName,
        email,
        entityType: kind,
      });
      setSubmitState("sent");
    } catch (err) {
      console.error(err);
      setSubmitState("error");
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
          {submitState === "error" ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700"
            >
              Something went wrong. Please try again.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitState === "submitting" || submitState === "sent"}
            className="w-full rounded-lg bg-buzz-coral py-3 text-sm font-bold text-buzz-paper shadow-md transition enabled:hover:bg-buzz-coralDark disabled:opacity-60"
          >
            {submitState === "submitting"
              ? "Sending..."
              : submitState === "sent"
                ? "Sent!"
                : "Submit"}
          </button>
        </form>
      </div>
    </section>
  );
}
