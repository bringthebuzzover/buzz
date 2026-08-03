/**
 * Public Privacy Policy. Grounded in the data the platform actually collects
 * (Instagram OAuth identity, university `.edu` email, brand application
 * details) and the processors it relies on (Meta/Instagram, Resend, the
 * hosting provider).
 *
 * NOTE: This is a good-faith engineering draft, NOT legal advice. Have counsel
 * review and adjust jurisdiction-specific clauses before public launch.
 */
import LegalLayout from "./LegalLayout";
import { siteIdentity } from "../../data/siteIdentity";

export default function PrivacyPolicyPage() {
  const { contact, brand } = siteIdentity;
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="July 2, 2026">
      <p>
        {brand.displayName} (“Buzz”, “we”, “us”) connects brands with student
        organizations for campus marketing campaigns. This policy explains what
        information we collect, how we use it, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Contact &amp; inquiry details:</strong> your name, email
          address, brand or organization name, and any message you submit via
          our contact form or a brand application.
        </li>
        <li>
          <strong>Student organization accounts:</strong> when you log in with
          Instagram, we receive your Instagram account identity and basic
          profile, and — with your permission — media and engagement insights
          for posts you associate with a campaign. During onboarding we also
          collect your university, organization name, number of members, a
          shipping address, and a university <code>.edu</code> email address we
          verify.
        </li>
        <li>
          <strong>Brand accounts:</strong> company information, the contact
          details of authorized users, and campaign requests.
        </li>
        <li>
          <strong>Usage &amp; technical data:</strong> standard log and device
          data needed to operate and secure the service.
        </li>
      </ul>

      <h2>How we use information</h2>
      <ul>
        <li>To operate the platform — matching brands and organizations,
          managing campaigns, and displaying engagement metrics.</li>
        <li>To verify eligibility (including university <code>.edu</code> email
          verification) and to review and approve accounts.</li>
        <li>To send transactional email such as verification links and
          application decisions.</li>
        <li>To secure the service, prevent abuse, and comply with law.</li>
      </ul>

      <h2>How information is shared</h2>
      <p>
        We do not sell your personal information. We share data with service
        providers who process it on our behalf, including:
      </p>
      <ul>
        <li><strong>Meta Platforms / Instagram</strong> — for login and, with
          your permission, retrieving post metrics via the Instagram Graph API.</li>
        <li><strong>Resend</strong> — for delivering transactional email.</li>
        <li><strong>Our cloud hosting and database provider</strong> — for
          running the application and storing data.</li>
      </ul>
      <p>
        A student organization’s aggregate campaign metrics are shared with the
        participating brand for that campaign. We may also disclose information
        where required by law.
      </p>

      <h2>Data retention</h2>
      <p>
        We keep information for as long as your account is active or as needed to
        provide the service, then retain and delete it in line with our
        operational and legal needs.
      </p>

      <h2>Your choices &amp; rights</h2>
      <ul>
        <li>You may request access to, correction of, or deletion of your
          personal information by contacting us.</li>
        <li>You can disconnect the Instagram connection or ask us to close your
          account at any time.</li>
        <li>Depending on where you live, you may have additional rights under
          applicable privacy laws.</li>
      </ul>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${contact.email}`}>{contact.email}</a>.
      </p>
    </LegalLayout>
  );
}
