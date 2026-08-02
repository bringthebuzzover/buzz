/**
 * Public Data Deletion Instructions — the URL Meta's App Dashboard points at
 * for the "Data Deletion Instructions URL" field (Instagram App Review).
 *
 * Deletion is handled by an emailed request rather than a webhook: the user
 * emails the address in `siteIdentity.contact`, we delete their data. Keep the
 * contact string in one place (siteIdentity) — never inline it here.
 */
import LegalLayout from "./LegalLayout";
import { siteIdentity } from "../../data/siteIdentity";

const DELETION_SUBJECT = "Data deletion request";

export default function DataDeletionPage() {
  const { contact, brand, social } = siteIdentity;
  const mailtoHref = `mailto:${contact.email}?subject=${encodeURIComponent(DELETION_SUBJECT)}`;
  return (
    <LegalLayout title="Data Deletion" lastUpdated="August 2, 2026">
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
        <li>Your Buzz account and profile.</li>
        <li>
          Your Instagram identity and the access token we hold for you (the
          token is also revoked with Meta).
        </li>
        <li>
          Onboarding details (university, organization info, verified{" "}
          <code>.edu</code> email).
        </li>
        <li>Campaign applications and any post-metric records tied to you.</li>
      </ul>
      <p>
        We may retain a minimal record where required by law (for example, tax
        or fraud-prevention obligations), and aggregated or anonymized data
        that no longer identifies you.
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
