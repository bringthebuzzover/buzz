/**
 * Public Terms of Service.
 *
 * NOTE: This is a good-faith engineering draft, NOT legal advice. Have counsel
 * review and adjust jurisdiction-specific clauses (governing law, liability,
 * arbitration) before public launch.
 */
import LegalLayout from "./LegalLayout";
import { siteIdentity } from "../../data/siteIdentity";

export default function TermsPage() {
  const { contact, brand } = siteIdentity;
  return (
    <LegalLayout title="Terms of Service" lastUpdated="July 2, 2026">
      <p>
        These Terms govern your use of {brand.displayName} (“Buzz”). By creating
        an account or using the service, you agree to these Terms.
      </p>

      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your credentials
          secure. You are responsible for activity under your account.</li>
        <li>Student organization accounts require a verified university
          <code> .edu</code> email and are subject to approval by Buzz.</li>
        <li>Brand accounts are provisioned or approved by Buzz.</li>
      </ul>

      <h2>Campaigns &amp; the Buzz marketplace</h2>
      <p>
        Buzz facilitates connections between brands and student organizations.
        Brands approve or deny applicants for each drop, and Buzz coordinates
        logistics. Participation, capacity, and application windows are governed
        by the rules shown in the product.
      </p>

      <h2>Your content</h2>
      <ul>
        <li>You retain ownership of the social content you create. By linking a
          post to a campaign, you grant the participating brand and Buzz a
          limited license to view and report on its engagement metrics for that
          campaign.</li>
        <li>You are responsible for complying with the terms of any third-party
          platform (such as Instagram) you connect.</li>
      </ul>

      <h2>Acceptable use</h2>
      <ul>
        <li>Do not misuse the service, attempt to access data you are not
          authorized to, or violate any law or third-party right.</li>
        <li>Do not submit false information or impersonate others.</li>
      </ul>

      <h2>Disclaimers &amp; limitation of liability</h2>
      <p>
        The service is provided “as is” without warranties of any kind. To the
        maximum extent permitted by law, Buzz is not liable for indirect or
        consequential damages arising from your use of the service.
      </p>

      <h2>Changes &amp; termination</h2>
      <p>
        We may update these Terms or suspend accounts that violate them. Continued
        use after an update constitutes acceptance of the revised Terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </LegalLayout>
  );
}
