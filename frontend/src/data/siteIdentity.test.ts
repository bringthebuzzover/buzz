import brandEmails from "@brandEmails";
import { siteIdentity } from "./siteIdentity";

describe("siteIdentity brand emails", () => {
  it("uses contactEmail from backend/brand_emails.json", () => {
    expect(siteIdentity.contact.email).toBe(brandEmails.contactEmail);
    expect(siteIdentity.contact.email).toBe("mc3237@cornell.edu");
  });
});
