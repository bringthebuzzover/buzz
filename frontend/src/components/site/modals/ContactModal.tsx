/**
 * Contact dialog: a two-column marketing panel.
 *
 * Left: the pitch and the other ways to reach us, driven entirely by
 * `siteIdentity` so no handle or address is typed twice. Right: the message
 * form.
 *
 * Everything visual comes from the shared layer — `SURFACE.glassModal`, the
 * `TextField`/`TextArea` primitives, `Button`, and `TEXT` ranks. Nothing here
 * restates a colour, radius, or control height.
 */
import { useState } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import { siteIdentity } from "../../../data/siteIdentity";
import { Button, ErrorBanner, TextArea, TextField } from "../../forms/controls";
import { Modal } from "../../ui/Modal";
import { SURFACE, TEXT } from "../../../theme/tokens";
import { focusRingClass } from "../../../theme/controls";
import { cn } from "../../../theme/cn";
import { useSubmitContact } from "../../../api/hooks/useContactHooks";
import { userFacingApiError } from "../../../api/userFacingError";

type ContactModalProps = {
  /** Dismiss handler wired to the backdrop and close control. */
  onClose: () => void;
};

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const EMPTY = { firstName: "", lastName: "", email: "", message: "" };

type ContactField = keyof typeof EMPTY;

/**
 * Native length caps mirroring the backend schema, so the browser stops the
 * user at the same place the server would (names 100, email 320, message 2000).
 * Without this the first hint of a problem is a 422 after a round-trip.
 */
const MAX_LENGTH: Record<ContactField, number> = {
  firstName: 100,
  lastName: 100,
  email: 320,
  message: 2000,
};

/**
 * The API reports the schema's snake_case names; the form is camelCase. Only
 * these four keys can land on a control — anything else has no home here.
 */
const SERVER_FIELD_TO_CONTROL: Record<string, ContactField> = {
  first_name: "firstName",
  firstName: "firstName",
  last_name: "lastName",
  lastName: "lastName",
  email: "email",
  message: "message",
};

/**
 * Pydantic prefixes messages raised from a ``field_validator`` with
 * "Value error, ". That is a framework artifact, not copy, and the backend
 * messages are already written for a person ("Invalid email address").
 */
function humanizeFieldMessage(message: string): string {
  return message.replace(/^Value error,\s*/i, "").trim();
}

/**
 * Split the API's field errors into the ones that have a control here and the
 * ones that don't. The leftovers are still the server explaining itself, so they
 * go in the banner rather than being dropped on the floor.
 */
function mapServerFields(fields: Record<string, string>): {
  fieldErrors: Partial<Record<ContactField, string>>;
  unplaced: string[];
} {
  const fieldErrors: Partial<Record<ContactField, string>> = {};
  const unplaced: string[] = [];
  for (const [key, raw] of Object.entries(fields)) {
    const text = humanizeFieldMessage(raw);
    // An empty message would render nothing, which is the bug we are fixing.
    if (!text) continue;
    const control = SERVER_FIELD_TO_CONTROL[key];
    if (control) {
      if (!fieldErrors[control]) fieldErrors[control] = text;
    } else if (!unplaced.includes(text)) {
      unplaced.push(text);
    }
  }
  return { fieldErrors, unplaced };
}

const FALLBACK_ERROR = "We couldn't send that. Please try again.";

export default function ContactModal({ onClose }: ContactModalProps) {
  const { social, contact, brand } = siteIdentity;
  const submit = useSubmitContact();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ContactField, string>>>({});
  // Honeypot lives outside `form` so it is never echoed into state a user sees.
  const [website, setWebsite] = useState("");

  const channels = [
    {
      label: "Instagram",
      value: social.instagram.handleWithAt,
      href: social.instagram.webUrl,
      isExternal: true,
      icon: <InstagramIcon className="h-4 w-4" />,
    },
    {
      label: "LinkedIn",
      value: brand.displayName,
      href: social.linkedin.companyUrl,
      isExternal: true,
      icon: <LinkedInIcon className="h-4 w-4" />,
    },
    {
      label: "Email",
      value: contact.email,
      href: `mailto:${contact.email}`,
      isExternal: false,
      icon: <Mail className="h-4 w-4" aria-hidden="true" />,
    },
  ] as const;

  const onChange =
    (field: keyof typeof EMPTY) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A new attempt retires the previous attempt's errors, field-level included:
    // leaving them up while the request runs claims the new input is still bad.
    setError(null);
    setFieldErrors({});
    try {
      await submit.mutateAsync({ ...form, website });
      // Clear the message body only; names stay in case they write again.
      setForm((prev) => ({ ...prev, message: "" }));
    } catch (err) {
      // A 422 usually resolves to per-field messages with no banner, so reading
      // only `.banner` here was a silent no-op: `error` stayed null and the user
      // saw nothing at all. Render both channels instead.
      const mapped = userFacingApiError(err, FALLBACK_ERROR);
      const { fieldErrors: placed, unplaced } = mapServerFields(mapped.fields);
      setFieldErrors(placed);
      // Anything that could not be placed on a control goes in the banner, so a
      // validation failure is never invisible; when there is nothing at all to
      // show, say the send failed rather than nothing.
      const banner =
        mapped.banner?.trim() ||
        unplaced.join(" ") ||
        (Object.keys(placed).length === 0 ? FALLBACK_ERROR : "");
      setError(banner || null);
    }
  };

  if (submit.isSuccess) {
    return (
      <Modal onClose={onClose} title="Message sent" wide>
        <div className="flex flex-col items-start gap-4 p-8 md:p-12">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-accent-wash text-accent">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>
            <h2 className={cn(TEXT.h2, "text-primary")}>Thanks — we got it.</h2>
          </div>
          <p className={cn(TEXT.bodyLong, "max-w-[46ch] text-muted")}>
            We&apos;ll reply to{" "}
            <span className="text-primary">{form.email}</span> soon.
          </p>
          <Button type="button" onClick={onClose} className="mt-2">
            Done
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="Get in touch with us" wide>
      <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] md:pl-8">
        <div className="flex min-w-0 flex-col justify-center py-4 md:py-8">
          <h2 className={cn(TEXT.h2, "text-primary")}>
            Get in touch
            <br />
            with us<span className="text-accent">.</span>
          </h2>
          <p className={cn(TEXT.bodyLong, "mt-6 max-w-[34ch] text-muted")}>
            Have questions or ideas? We&apos;d love to hear from you. Reach out
            anytime and let&apos;s connect.
          </p>

          <nav
            aria-label="Other ways to contact us"
            className="mt-8 flex w-full max-w-[352px] flex-col border-t border-line"
          >
            {channels.map((channel) => (
              <a
                key={channel.label}
                href={channel.href}
                target={channel.isExternal ? "_blank" : undefined}
                rel={channel.isExternal ? "noopener noreferrer" : undefined}
                className={cn(
                  "group flex min-w-0 flex-col gap-1 border-b border-line py-3",
                  focusRingClass,
                )}
              >
                <span className="flex min-h-[18px] items-center gap-2 text-buzzLabel text-accent">
                  {channel.icon}
                  {channel.label}
                </span>
                <span className="flex items-center gap-1.5 text-buzzSmall text-primary transition-colors group-hover:text-accent">
                  {channel.value}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 text-quiet opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
              </a>
            ))}
          </nav>
        </div>

        <form
          onSubmit={onSubmit}
          className={cn(
            SURFACE.card,
            "flex min-w-0 flex-col justify-center px-5 py-8 md:px-7",
          )}
        >
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <TextField
              id="contact-first-name"
              label="First name"
              autoComplete="given-name"
              required
              maxLength={MAX_LENGTH.firstName}
              value={form.firstName}
              disabled={submit.isPending}
              onChange={onChange("firstName")}
              error={fieldErrors.firstName}
            />
            <TextField
              id="contact-last-name"
              label="Last name"
              autoComplete="family-name"
              maxLength={MAX_LENGTH.lastName}
              value={form.lastName}
              disabled={submit.isPending}
              onChange={onChange("lastName")}
              error={fieldErrors.lastName}
            />
            <div className="sm:col-span-2">
              <TextField
                id="contact-email"
                type="email"
                label="Email address"
                autoComplete="email"
                required
                maxLength={MAX_LENGTH.email}
                value={form.email}
                disabled={submit.isPending}
                onChange={onChange("email")}
                error={fieldErrors.email}
              />
            </div>
            <div className="sm:col-span-2">
              <TextArea
                id="contact-message"
                label="Message"
                                required
                rows={5}
                resizable
                maxLength={MAX_LENGTH.message}
                value={form.message}
                disabled={submit.isPending}
                onChange={onChange("message")}
                error={fieldErrors.message}
              />
            </div>
          </div>

          {/*
            Honeypot. Hidden from people and from screen readers, and off the tab
            order, so only an automated filler ever puts text here. Uses the
            shared TextField primitive (the primitives lint rule requires the
            field components); the wrapper stays focus-inert but present,
            because `display: none` is skipped by some bots.
          */}
          <div aria-hidden="true" className="h-0 w-0 overflow-hidden opacity-0">
            <TextField
              id="contact-website"
              label="Website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          <Button
            type="submit"
            disabled={submit.isPending}
            fullWidth
            className="mt-6"
          >
            {submit.isPending ? "Sending…" : "Send"}
          </Button>
        </form>
      </div>
    </Modal>
  );
}
