import {
  INSTAGRAM_CALLBACK_APPLY_FIRST,
  INSTAGRAM_CALLBACK_LOGIN_EXPIRED,
  INSTAGRAM_CALLBACK_META,
  INSTAGRAM_CALLBACK_UNKNOWN,
  instagramCallbackFailureCopy,
} from "./instagramCallbackCopy";

describe("instagramCallbackFailureCopy", () => {
  it("tells unknown Instagram to apply first", () => {
    const copy = instagramCallbackFailureCopy("ORG_APPLY_REQUIRED", "ignored");
    expect(copy.title).toBe("Apply first");
    expect(copy.body).toBe(INSTAGRAM_CALLBACK_APPLY_FIRST);
    expect(copy.applyRequired).toBe(true);
  });

  it("keeps personal-account backend copy", () => {
    const copy = instagramCallbackFailureCopy(
      "INSTAGRAM_PERSONAL_ACCOUNT",
      "Your Instagram account must be a Business or Creator account. Convert it in the Instagram app, then try again.",
    );
    expect(copy.title).toBe("Can't use this Instagram");
    expect(copy.body).toMatch(/Business or Creator/);
  });

  it("uses expired-login copy for OAuth state, not cookie jargon", () => {
    const copy = instagramCallbackFailureCopy(
      "OAUTH_STATE_INVALID",
      "Invalid or expired OAuth state.",
    );
    expect(copy.title).toBe("Couldn't finish sign-in");
    expect(copy.body).toBe(INSTAGRAM_CALLBACK_LOGIN_EXPIRED);
    expect(copy.body).not.toMatch(/cookie|SameSite|browser settings/i);
  });

  it("does not leak Graph jargon or status for Meta UNAUTHORIZED", () => {
    const copy = instagramCallbackFailureCopy(
      "UNAUTHORIZED",
      "Instagram code exchange failed.",
    );
    expect(copy.title).toBe("Instagram didn't connect");
    expect(copy.body).toBe(INSTAGRAM_CALLBACK_META);
    expect(copy.body).not.toMatch(/401|code exchange/i);
  });

  it("maps rate limit, stale connect, and server error", () => {
    expect(instagramCallbackFailureCopy("RATE_LIMITED", "Too many requests.")).toEqual({
      title: "Too many attempts",
      body: "Wait a minute and try again.",
    });
    expect(instagramCallbackFailureCopy("NOT_FOUND", "Organization account not found.")).toEqual({
      title: "Connect link is stale",
      body: "Ask Buzz to resend the connect email.",
    });
    expect(instagramCallbackFailureCopy("INTERNAL_ERROR", "Instagram login failed (502).")).toEqual({
      title: "Something went wrong on our side",
      body: "Try again. If it persists, contact Buzz.",
    });
  });

  it("uses generic try-again for unknown codes", () => {
    const copy = instagramCallbackFailureCopy("HTTP_ERROR", "nope");
    expect(copy.title).toBe("Couldn't finish sign-in");
    expect(copy.body).toBe(INSTAGRAM_CALLBACK_UNKNOWN);
  });
});
