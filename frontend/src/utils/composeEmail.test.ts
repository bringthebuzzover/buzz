import brandEmails from "@brandEmails";
import { composeDefaultBody, opsCcAddresses } from "./composeEmail";

describe("opsCcAddresses", () => {
  it("lists contact and ops, skipping the To address", () => {
    const cc = opsCcAddresses(brandEmails.contactEmail);
    expect(cc).toEqual([brandEmails.opsCcEmail]);
  });

  it("keeps both when To is someone else", () => {
    expect(opsCcAddresses("org@school.edu")).toEqual([
      brandEmails.contactEmail,
      brandEmails.opsCcEmail,
    ]);
  });
});

describe("composeDefaultBody", () => {
  it("names the recipient and Reply-To contact", () => {
    const body = composeDefaultBody("Theta");
    expect(body).toContain("Hi Theta,");
    expect(body).toContain(brandEmails.contactEmail);
  });
});
