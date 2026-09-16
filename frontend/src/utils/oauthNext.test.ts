import { allowlistedOAuthNext, publicDropPath } from "./oauthNext";

const DROP = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("allowlistedOAuthNext", () => {
  it("accepts /d/<uuid> and lowercases it", () => {
    expect(allowlistedOAuthNext(`/d/${DROP.toUpperCase()}`)).toBe(
      `/d/${DROP}`,
    );
  });

  it("rejects other paths", () => {
    expect(allowlistedOAuthNext("/org/browse")).toBeNull();
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
