/** User-facing Instagram OAuth callback failures. Branch on `code` only. */

export const INSTAGRAM_CALLBACK_MISSING_PARAMS =
  "Couldn't finish Instagram login. Go back and try again.";

export const INSTAGRAM_CALLBACK_UNAUTHORIZED =
  "Instagram login didn't complete. Try again.";

export const INSTAGRAM_CALLBACK_UNKNOWN =
  "Instagram login didn't complete. Try again.";

export const INSTAGRAM_CALLBACK_NETWORK =
  "Could not reach the server. Please try again.";

const KEEP_BACKEND = new Set([
  "INSTAGRAM_PERSONAL_ACCOUNT",
  "INSTAGRAM_HANDLE_TAKEN",
  "INVALID_ONBOARDING_STATE",
]);

export function instagramCallbackFailureCopy(
  code: string | undefined,
  message: string | undefined,
): string {
  if (code && KEEP_BACKEND.has(code) && message) {
    return message;
  }
  if (code === "UNAUTHORIZED") {
    return INSTAGRAM_CALLBACK_UNAUTHORIZED;
  }
  return INSTAGRAM_CALLBACK_UNKNOWN;
}
