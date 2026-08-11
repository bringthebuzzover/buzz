/**
 * Public Data Deletion Instructions — the URL Meta's App Dashboard points at
 * for the "Data Deletion Instructions URL" field (Instagram App Review).
 *
 * Deletion requests start via mailto; fulfillment for org accounts is admin
 * hybrid erase (PRODUCT §3.1.2). Keep the contact string in siteIdentity.
 */
import LegalLayout from "./LegalLayout";
import { siteIdentity } from "../../data/siteIdentity";

const DELETION_SUBJECT = "Data deletion request";

export default function DataDeletionPage() {
  const { contact, brand, social } = siteIdentity;
  const mailtoHref = `mailto:${contact.email}?subject=${encodeURIComponent(DELETION_SUBJECT)}`;
  return (
    <LegalLayout title="Data Deletion" lastUpdated="August 11, 2026">
      <p>
        You can ask {brand.displayName} (“Buzz”) to delete the personal data we
        hold about you at any time. This page explains how.
      </p>

      <h2>How to request deletion</h2>
      <ol>
        <li>
          Email <a href={mailtoHref}>{contact.email}</a> with the subject
          “{DELETION_SUBJECT}”.
        </li>
        <li>
          Send from the email address associated with your account, or include
          your Instagram handle ({social.instagram.handleWithAt}) so we can
          locate the right account.
        </li>
        <li>
          We’ll confirm receipt and complete the deletion within{" "}
          <strong>30 days</strong>.
        </li>
      </ol>

      <h2>What gets deleted</h2>
      <ul>
        <li>
          Your Buzz login identity and profile contact details (including email
          on file, shipping/contact fields, and Instagram credentials we hold
          for you).
        </li>
        <li>
          Identifiable post content tied to your account (permalinks, captions,
          and media), which we anonymize or remove.
        </li>
      </ul>
      <p>
        Campaign participation metrics (for example attributed likes, comments,
        and engagement used in brand reporting) may remain in anonymized form
        after your identity is removed. We may also retain a minimal record
        where required by law (for example, tax or fraud-prevention
        obligations).
      </p>
      <p>
        When an email address is on file at the time of deletion, we may send a
        confirmation email to that address after the wipe completes.
      </p>

      <h2>Revoking access without deleting your account</h2>
      <p>
        If you only want to disconnect Instagram from Buzz (without deleting
        your account), remove the app from your Instagram settings:{" "}
        <a
          href="https://www.instagram.com/accounts/manage_access/"
          target="_blank"
          rel="noreferrer"
        >
          instagram.com/accounts/manage_access
        </a>
        . Instagram will notify us and we’ll invalidate the stored token.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this process:{" "}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </LegalLayout>
  );
}
