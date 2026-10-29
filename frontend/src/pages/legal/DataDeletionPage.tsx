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
    <LegalLayout
      title="Data Deletion"
      lastUpdated="October 28, 2026"
      toc={[
        { id: "how-to-request", label: "How to request deletion" },
        { id: "what-gets-deleted", label: "What gets deleted" },
        {
          id: "revoking-access",
          label: "Revoking access without deleting your account",
        },
        { id: "contact", label: "Contact" },
      ]}
    >
      <p>
        You can ask {brand.displayName} (“Buzz”) to delete the personal data we
        hold about you at any time. This page explains how.
      </p>

      <h2 id="how-to-request">How to request deletion</h2>
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

      <h2 id="what-gets-deleted">What gets deleted</h2>
      <ul>
        <li>
          Your Buzz login identity and profile contact details (including email
          on file, shipping/contact fields, and Instagram credentials we hold
          for you).
        </li>
        <li>
          Identifiable Instagram data tied to your account: handle, user id,
          access tokens, post permalinks, captions, media URLs, thumbnails, and
          media ids.
        </li>
      </ul>
      <p>
        If you are an organization that already ran a campaign, the brand keeps
        an anonymized record of that participation (shown as “Deleted
        organization”) and the last likes, comments, reach, views, saves, and
        shares from your linked posts, plus the time and media type of each
        post. Those numbers stay in the brand’s campaign totals. They are
        frozen on the deletion date and are not refreshed from Instagram. We
        do not keep profile visits, follows, watch time, skip rate, the post
        content, your handle, or your profile (name, campus, contact, or
        shipping address). Carrier tracking numbers already recorded on a
        campaign shipment may remain so the brand can see what was sent.
      </p>
      <p>
        If you are a brand, drops stay up for organizations that already
        joined. Those organizations may still see an anonymized brand name on
        campaigns they participated in. A brand deletion does not delete those
        organizations’ posts or metrics.
      </p>
      <p>
        We may retain a minimal record where required by law (for example, tax
        or fraud-prevention obligations).
      </p>
      <p>
        When an email address is on file at the time of deletion, we may send a
        confirmation email to that address after the wipe completes.
      </p>

      <h2 id="revoking-access">Revoking access without deleting your account</h2>
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

      <h2 id="contact">Contact</h2>
      <p>
        Questions about this process:{" "}
        <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </LegalLayout>
  );
}
