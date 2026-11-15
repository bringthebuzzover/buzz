import { stripTokenFromUrl } from "./stripTokenFromUrl";
import { pathForUser } from "./landing";
import { allowlistedOAuthNext, allowlistedPrefill, onboardingQuery, publicDropPath } from "./oauthNext";

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

it.each(["https://example.com", "//example.com", "/d/" + DROP + "?next=bad", "/d/" + DROP + "#bad"])("drops unsafe continuation %s", (next) => {
  expect(onboardingQuery(next)).toBe("");
});
it.each(["https://example.com", "a.b", "x".repeat(257), "draft&next=bad"])("rejects malformed draft %s", (draft) => {
  expect(allowlistedPrefill(draft)).toBeNull();
});

it.each([
  ["pending_org_profile", "/onboarding/profile"],
  ["pending_email_verification", "/onboarding/verify-email"],
  ["pending_approval", "/onboarding/pending-approval"],
  ["pending_instagram", "/onboarding/connect-instagram"],
])("keeps %s behind onboarding while retaining the drop", (status, path) => {
  const user = { id: "test-org", portalRole: "org" as const, status };
  expect(pathForUser(user, `/d/${DROP}`)).toBe(`${path}?next=%2Fd%2F${DROP}`);
  expect(pathForUser(user, "https://example.com")).toBe(path);
});
it("returns active orgs to the validated drop but never routes denied users there", () => {
  const user = { id: "test-org", portalRole: "org" as const, status: "active" };
  expect(pathForUser(user, `/d/${DROP}`)).toBe(`/d/${DROP}`);
  expect(pathForUser(user, "//example.com")).toBe("/org/browse");
  expect(pathForUser({ ...user, status: "denied" }, `/d/${DROP}`)).toBe("/onboarding/denied");
});

it.each([`/d/${DROP}`, "https://example.com"])("removes verification credentials while retaining only a validated next: %s", (next) => {
  window.history.replaceState(null, "", "/onboarding/verify-email?token=fake-verification");
  stripTokenFromUrl(next);
  expect(window.location.search).toBe(onboardingQuery(next));
  window.history.replaceState(null, "", "/");
});
