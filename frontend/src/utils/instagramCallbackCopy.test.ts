import {
  INSTAGRAM_CALLBACK_UNAUTHORIZED,
  INSTAGRAM_CALLBACK_UNKNOWN,
  instagramCallbackFailureCopy,
} from "./instagramCallbackCopy";

describe("instagramCallbackFailureCopy", () => {
  it("keeps personal-account backend copy", () => {
    expect(
      instagramCallbackFailureCopy(
        "INSTAGRAM_PERSONAL_ACCOUNT",
        "Your Instagram account must be a Business or Creator account. Convert it in the Instagram app, then try again.",
      ),
    ).toMatch(/Business or Creator/);
  });

  it("does not leak Graph jargon or status for UNAUTHORIZED", () => {
    const copy = instagramCallbackFailureCopy(
      "UNAUTHORIZED",
      "Instagram code exchange failed.",
    );
    expect(copy).toBe(INSTAGRAM_CALLBACK_UNAUTHORIZED);
    expect(copy).not.toMatch(/401|code exchange/i);
  });

  it("uses generic try-again for unknown codes", () => {
    expect(
      instagramCallbackFailureCopy("INTERNAL_ERROR", "Instagram login failed (502)."),
    ).toBe(INSTAGRAM_CALLBACK_UNKNOWN);
  });
});
