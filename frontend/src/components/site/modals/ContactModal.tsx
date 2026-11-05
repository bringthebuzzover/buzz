/**
 * Contact dialog: Instagram, LinkedIn, and Email channels from `siteIdentity`.
 * Pen row 49 "Contact": pretty clickable card tiles, icons, and a single Done button.
 */
import { ArrowUpRight, Mail } from "lucide-react";
import { siteIdentity } from "../../../data/siteIdentity";
import { Button } from "../../forms/controls";
import { Modal, ModalActions } from "../../ui/Modal";
import { focusRingClass } from "../../../theme/controls";
import { cn } from "../../../theme/cn";

type ContactModalProps = {
  /** Dismiss handler wired to backdrop/close control. */
  onClose: () => void;
};

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      strokeWidth="2"
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

/** Read-only contact details, not a message form. */
export default function ContactModal({ onClose }: ContactModalProps) {
  const { social, contact, brand } = siteIdentity;

  const channels = [
    {
      label: "Instagram",
      value: social.instagram.handleWithAt,
      href: social.instagram.webUrl,
      isExternal: true,
      icon: <InstagramIcon className="h-5 w-5" />,
    },
    {
      label: "LinkedIn",
      value: brand.displayName,
      href: social.linkedin.companyUrl,
      isExternal: true,
      icon: <LinkedInIcon className="h-5 w-5" />,
    },
    {
      label: "Email",
      value: contact.email,
      href: `mailto:${contact.email}`,
      isExternal: false,
      icon: <Mail className="h-5 w-5" aria-hidden="true" />,
    },
  ] as const;

  return (
    <Modal onClose={onClose} title="Contact" description="Reach out anytime!">
      <div className="flex flex-col gap-3">
        {channels.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            target={channel.isExternal ? "_blank" : undefined}
            rel={channel.isExternal ? "noopener noreferrer" : undefined}
            className={cn(
              "group flex items-center gap-3.5 rounded-buzzCard border border-line bg-surface-tile px-4 py-3 transition-colors hover:border-buzz-paper30 hover:bg-buzz-paper08",
              focusRingClass,
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-buzzField bg-buzz-paper08 text-accent">
              {channel.icon}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
              <span className="text-xs uppercase tracking-wide text-quiet">{channel.label}</span>
              <span className="truncate text-sm font-medium text-primary">{channel.value}</span>
            </div>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-quiet transition-colors group-hover:text-primary"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
      <ModalActions>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </ModalActions>
    </Modal>
  );
}
