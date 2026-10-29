/**
 * Modal overlay listing primary contact name, email (mailto), and Instagram from `siteIdentity`.
 */
import { User, Mail } from "lucide-react";
import { siteIdentity } from "../../../data/siteIdentity";
import { Modal } from "../../ui/Modal";
import { Logo } from "../../ui/BrandMark";
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
      description="Reach out anytime."
    >
      <div className="text-center">
        <Logo className="mx-auto mb-6 h-10" />
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
            "group flex items-center gap-4 p-3 transition hover:border-quiet",
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
            "group flex items-center gap-4 p-3 transition hover:border-quiet",
          )}
        >
          <div className="rounded-full border border-buzz-lineMid bg-buzz-butter p-2.5 transition group-hover:scale-105">
            <img
              src={images.socialInstagramIcon}
              alt=""
              className="buzz-icon-on-ink h-5 w-5"
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
