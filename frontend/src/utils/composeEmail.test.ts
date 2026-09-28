import brandEmails from "@brandEmails";
import { composeDefaultBody, opsCcAddresses } from "./composeEmail";

describe("opsCcAddresses", () => {
  it("skips a blank ops address and the To address", () => {
    expect(brandEmails.opsCcEmail.trim()).toBe("");
    expect(opsCcAddresses(brandEmails.contactEmail)).toEqual([]);
  });

  it("CCs the contact address when To is someone else", () => {
    expect(opsCcAddresses("org@school.edu")).toEqual([brandEmails.contactEmail]);
  });
});

describe("composeDefaultBody", () => {
  it("names the recipient and Reply-To contact", () => {
    const body = composeDefaultBody("Theta");
    expect(body).toContain("Hi Theta,");
    expect(body).toContain(brandEmails.contactEmail);
  });
});
