/**
 * Modal overlay listing primary contact name, email (mailto), and Instagram from `siteIdentity`.
 */
import { X, User, Mail } from "lucide-react";
import { siteIdentity } from "../../../data/siteIdentity";

type ContactModalProps = {
  /** Dismiss handler wired to backdrop/close control. */
  onClose: () => void;
};

/** Centered card with close control; content is read-only links, not a message form. */
export default function ContactModal({ onClose }: ContactModalProps) {
  const { images, social, contact } = siteIdentity;
  const mailHref = `mailto:${contact.email}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-buzz-overlay/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border-2 border-buzz-lineMid bg-buzz-paper shadow-buzzLg">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-buzz-paper/35 bg-buzz-paper/10 p-1 text-buzz-paper shadow-sm transition hover:border-buzz-paper/50 hover:bg-buzz-paper/20"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="border-b border-buzz-paper/20 bg-buzz-coralDark p-8 text-center">
          <div className="mb-2 flex justify-center">
            <img
              src={images.logo}
              alt={images.logoAlt}
              className="mx-auto max-h-14 w-auto max-w-[180px] object-contain"
            />
          </div>
          <h2 className="mb-1 text-2xl font-bold text-buzz-paper">
            Contact Us
          </h2>
          <p className="text-sm font-medium text-buzz-paper/85">
            Reach out anytime!
          </p>
        </div>

        <div className="space-y-4 bg-buzz-paper p-6">
          <div className="flex items-center gap-4 rounded-xl border border-transparent p-3 transition hover:border-buzz-neutralHover hover:bg-buzz-neutralWash">
            <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 text-buzz-coral shadow-sm">
              <User size={20} />
            </div>
            <div className="text-left">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz-inkFaint">
                Name
              </p>
              <p className="font-bold text-buzz-ink">
                {contact.primaryPersonName}
              </p>
            </div>
          </div>

          <a
            href={mailHref}
            className="group flex items-center gap-4 rounded-xl border border-transparent p-3 transition hover:border-buzz-neutralHover hover:bg-buzz-neutralWash"
          >
            <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 text-buzz-coral shadow-sm transition group-hover:scale-105">
              <Mail size={20} />
            </div>
            <div className="text-left">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz-inkFaint">
                Email
              </p>
              <p className="font-bold text-buzz-ink transition group-hover:text-buzz-coral">
                {contact.email}
              </p>
            </div>
          </a>

          <a
            href={social.instagram.webUrl}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 rounded-xl border border-transparent p-3 transition hover:border-buzz-neutralHover hover:bg-buzz-neutralWash"
          >
            <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 shadow-sm transition group-hover:scale-105">
              <img
                src={images.socialInstagramIcon}
                alt=""
                className="h-5 w-5"
              />
            </div>
            <div className="text-left">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz-inkFaint">
                Instagram
              </p>
              <p className="font-bold text-buzz-ink transition group-hover:text-buzz-coral">
                {social.instagram.handleWithAt}
              </p>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
