import { pathForUser } from "./landing";
import type { AuthUser } from "../contexts/AuthContext";

function user(portalRole: AuthUser["portalRole"], status = "active"): AuthUser {
  return { id: "1", portalRole, status };
}

describe("pathForUser", () => {
  it("sends a creator to the creator feed, not admin or the org browse", () => {
    expect(pathForUser(user("creator"))).toBe("/creators/feed");
    expect(pathForUser(user("org"))).toBe("/org/browse");
    expect(pathForUser(user("admin"))).toBe("/admin");
  });
});
