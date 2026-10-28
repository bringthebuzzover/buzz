import { isInstagramAuthorizeUrl } from "./instagramAuthorizeUrl";

describe("isInstagramAuthorizeUrl", () => {
  it("allows the Instagram authorize endpoint only", () => {
    expect(
      isInstagramAuthorizeUrl(
        "https://www.instagram.com/oauth/authorize?client_id=1&state=abc#weblink",
      ),
    ).toBe(true);
    expect(isInstagramAuthorizeUrl("https://instagram.com/oauth/authorize?state=abc")).toBe(
      true,
    );
  });

  it("rejects open redirects", () => {
    expect(isInstagramAuthorizeUrl("https://evil.example/oauth/authorize")).toBe(false);
    expect(isInstagramAuthorizeUrl("https://www.instagram.com/other")).toBe(false);
    expect(isInstagramAuthorizeUrl("http://www.instagram.com/oauth/authorize")).toBe(false);
    expect(isInstagramAuthorizeUrl("not a url")).toBe(false);
  });
});
