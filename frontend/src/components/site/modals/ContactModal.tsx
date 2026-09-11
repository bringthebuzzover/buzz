/**
 * Modal overlay listing primary contact name, email (mailto), and Instagram from `siteIdentity`.
 */
import { User, Mail } from "lucide-react";
import { siteIdentity } from "../../../data/siteIdentity";
import { Modal } from "../../ui/Modal";
import { STACK, SURFACE, TEXT } from "../../../theme/tokens";
import { cn } from "../../../theme/cn";

type ContactModalProps = {
  /** Dismiss handler wired to backdrop/close control. */
  onClose: () => void;
};

/** Centered card with close control; content is read-only links, not a message form. */
export default function ContactModal({ onClose }: ContactModalProps) {
  const { images, social, contact } = siteIdentity;
  const mailHref = `mailto:${contact.email}`;

  return (
    <Modal
      onClose={onClose}
      title="Contact Us"
      hideTitle
      className="[&_[aria-label=Close]]:text-buzz-paper [&_[aria-label=Close]]:hover:bg-buzz-paper/20 [&_[aria-label=Close]]:hover:text-buzz-paper"
    >
      <div className="border-b border-buzz-paper/20 bg-buzz-coralDark px-8 pb-8 pt-10 text-center">
        <div className="mb-2 flex justify-center">
          <img
            src={images.logo}
            alt={images.logoAlt}
            className="mx-auto max-h-14 w-auto max-w-[180px] object-contain"
          />
        </div>
        <h2 className={cn(TEXT.h2, "mb-1 text-buzz-paper")}>Contact Us</h2>
        <p className={cn(TEXT.body, "font-medium text-buzz-paper/85")}>
          Reach out anytime!
        </p>
      </div>

      <div className={cn(STACK.default, "bg-buzz-paper p-6")}>
        <div className={cn(SURFACE.inset, "flex items-center gap-4 p-3")}>
          <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 text-buzz-coral">
            <User size={20} />
          </div>
          <div className="text-left">
            <p className={cn(TEXT.micro, "mb-0.5 text-buzz-inkFaint")}>Name</p>
            <p className="font-semibold text-buzz-ink">
              {contact.primaryPersonName}
            </p>
          </div>
        </div>

        <a
          href={mailHref}
          className={cn(
            SURFACE.inset,
            "group flex items-center gap-4 p-3 transition hover:border-buzz-neutralHover",
          )}
        >
          <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 text-buzz-coral transition group-hover:scale-105">
            <Mail size={20} />
          </div>
          <div className="text-left">
            <p className={cn(TEXT.micro, "mb-0.5 text-buzz-inkFaint")}>Email</p>
            <p className="font-semibold text-buzz-ink transition group-hover:text-buzz-coral">
              {contact.email}
            </p>
          </div>
        </a>

        <a
          href={social.instagram.webUrl}
          target="_blank"
          rel="noreferrer"
          className={cn(
            SURFACE.inset,
            "group flex items-center gap-4 p-3 transition hover:border-buzz-neutralHover",
          )}
        >
          <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 transition group-hover:scale-105">
            <img
              src={images.socialInstagramIcon}
              alt=""
              className="h-5 w-5"
            />
          </div>
          <div className="text-left">
            <p className={cn(TEXT.micro, "mb-0.5 text-buzz-inkFaint")}>
              Instagram
            </p>
            <p className="font-semibold text-buzz-ink transition group-hover:text-buzz-coral">
              {social.instagram.handleWithAt}
            </p>
          </div>
        </a>
      </div>
    </Modal>
  );
}
