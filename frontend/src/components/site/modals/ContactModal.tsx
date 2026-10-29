/**
 * Contact dialog: primary contact name, email (mailto), and Instagram from `siteIdentity`.
 * Pen row 49 "Contact": key/value rows and a single Done button.
 */
import type { ReactNode } from "react";
import { siteIdentity } from "../../../data/siteIdentity";
import { Button } from "../../forms/controls";
import { Modal, ModalActions } from "../../ui/Modal";
import { focusRingClass } from "../../../theme/controls";
import { cn } from "../../../theme/cn";

const linkClass = cn(
  "break-all text-primary underline-offset-4 hover:underline",
  focusRingClass,
);

type ContactModalProps = {
  /** Dismiss handler wired to backdrop/close control. */
  onClose: () => void;
};

function ContactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-quiet">{label}</dt>
      <dd className="text-sm text-primary">{children}</dd>
    </div>
  );
}

/** Read-only contact details, not a message form. */
export default function ContactModal({ onClose }: ContactModalProps) {
  const { social, contact } = siteIdentity;

  return (
    <Modal onClose={onClose} title="Contact" description="Reach out anytime!">
      <dl className="flex flex-col gap-4">
        <ContactRow label="Name">{contact.primaryPersonName}</ContactRow>
        <ContactRow label="Email">
          <a href={`mailto:${contact.email}`} className={linkClass}>
            {contact.email}
          </a>
        </ContactRow>
        <ContactRow label="Instagram">
          <a
            href={social.instagram.webUrl}
            target="_blank"
            rel="noreferrer"
            className={linkClass}
          >
            {social.instagram.handleWithAt}
          </a>
        </ContactRow>
      </dl>
      <ModalActions>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </ModalActions>
    </Modal>
  );
}
