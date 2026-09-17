/** User-facing Instagram OAuth callback failures. Branch on `code` only. */

export type InstagramCallbackCopy = {
  title: string;
  body: string;
  applyRequired?: boolean;
};

export const INSTAGRAM_CALLBACK_MISSING_PARAMS =
  "Couldn't finish Instagram login. Go back and try again.";

export const INSTAGRAM_CALLBACK_NETWORK =
  "Could not reach the server. Please try again.";

export const INSTAGRAM_CALLBACK_APPLY_FIRST =
  "Buzz doesn't create accounts from Instagram login anymore. Apply as a student organization first, then connect Instagram after approval.";

export const INSTAGRAM_CALLBACK_LOGIN_EXPIRED =
  "This login expired. Go back and try Instagram again — stay in this window.";

export const INSTAGRAM_CALLBACK_META =
  "Instagram didn't hand Buzz a session. Try again. If it keeps happening, the org account may not be a Business or Creator.";

export const INSTAGRAM_CALLBACK_UNKNOWN =
  "Instagram login didn't complete. Try again.";

export const INSTAGRAM_CALLBACK_MISSING: InstagramCallbackCopy = {
  title: "Couldn't finish sign-in",
  body: INSTAGRAM_CALLBACK_MISSING_PARAMS,
};

export const INSTAGRAM_CALLBACK_OFFLINE: InstagramCallbackCopy = {
  title: "Couldn't finish sign-in",
  body: INSTAGRAM_CALLBACK_NETWORK,
};

export function instagramCallbackFailureCopy(
  code: string | undefined,
  message: string | undefined,
): InstagramCallbackCopy {
  if (code === "ORG_APPLY_REQUIRED") {
    return {
      title: "Apply first",
      body: INSTAGRAM_CALLBACK_APPLY_FIRST,
      applyRequired: true,
    };
  }
  if (code === "OAUTH_STATE_INVALID") {
    return {
      title: "Couldn't finish sign-in",
      body: INSTAGRAM_CALLBACK_LOGIN_EXPIRED,
    };
  }
  if (code === "UNAUTHORIZED") {
    return {
      title: "Instagram didn't connect",
      body: INSTAGRAM_CALLBACK_META,
    };
  }
  if (code === "RATE_LIMITED") {
    return {
      title: "Too many attempts",
      body: "Wait a minute and try again.",
    };
  }
  if (code === "NOT_FOUND") {
    return {
      title: "Connect link is stale",
      body: "Ask Buzz to resend the connect email.",
    };
  }
  if (code === "INTERNAL_ERROR") {
    return {
      title: "Something went wrong on our side",
      body: "Try again. If it persists, contact Buzz.",
    };
  }
  if (code === "INSTAGRAM_PERSONAL_ACCOUNT" && message) {
    return { title: "Can't use this Instagram", body: message };
  }
  if (code === "INSTAGRAM_HANDLE_TAKEN" && message) {
    return { title: "Instagram already connected", body: message };
  }
  if (code === "INVALID_ONBOARDING_STATE" && message) {
    return { title: "Not ready to connect Instagram", body: message };
  }
  return {
    title: "Couldn't finish sign-in",
    body: INSTAGRAM_CALLBACK_UNKNOWN,
  };
}
