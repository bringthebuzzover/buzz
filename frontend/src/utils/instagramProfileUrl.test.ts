import { instagramProfileUrl } from "./instagramProfileUrl";

describe("instagramProfileUrl", () => {
  it("builds a www.instagram.com URL and strips a leading @", () => {
    expect(instagramProfileUrl("@acme_brand")).toBe(
      "https://www.instagram.com/acme_brand/",
    );
  });

  it("returns null for empty handles", () => {
    expect(instagramProfileUrl(null)).toBeNull();
    expect(instagramProfileUrl("  ")).toBeNull();
  });
});
