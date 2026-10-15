import { allowlistedOAuthNext, publicDropPath } from "./oauthNext";

const DROP = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("allowlistedOAuthNext", () => {
  it("accepts /d/<uuid> and lowercases it", () => {
    expect(allowlistedOAuthNext(`/d/${DROP.toUpperCase()}`)).toBe(
      `/d/${DROP}`,
    );
  });

  it("accepts the creator feed and rejects other paths", () => {
    expect(allowlistedOAuthNext("/creators/feed")).toBe("/creators/feed");
    expect(allowlistedOAuthNext("/org/browse")).toBeNull();
    expect(allowlistedOAuthNext("/admin")).toBeNull();
    expect(allowlistedOAuthNext(`/d/${DROP}/extra`)).toBeNull();
    expect(allowlistedOAuthNext("/login")).toBeNull();
    expect(allowlistedOAuthNext(null)).toBeNull();
  });
});

describe("publicDropPath", () => {
  it("builds the public path", () => {
    expect(publicDropPath(DROP)).toBe(`/d/${DROP}`);
  });
});
