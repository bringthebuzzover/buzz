/** Client checks matching org apply / onboarding Pydantic rules. */

export const INVALID_EMAIL_MSG = "Invalid email address";
export const EDU_EMAIL_MSG = "Must be a valid .edu email address";
export const MUST_NOT_BE_EMPTY = "Must not be empty";
export const MEMBER_COUNT_MSG = "Enter a valid member count.";

export function requireNonBlank(raw: string): string | { error: string } {
  const v = raw.trim();
  if (!v) {
    return { error: MUST_NOT_BE_EMPTY };
  }
  return v;
}

export function parseEduEmail(raw: string): string | { error: string } {
  const v = raw.trim().toLowerCase();
  if (v.length > 320 || v.split("@").length !== 2) {
    return { error: INVALID_EMAIL_MSG };
  }
  const [local, domain] = v.split("@");
  if (!local || !domain.endsWith(".edu") || domain.length <= ".edu".length) {
    return { error: EDU_EMAIL_MSG };
  }
  return v;
}

export function parseMemberCount(raw: string): number | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { error: MEMBER_COUNT_MSG };
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    return { error: MEMBER_COUNT_MSG };
  }
  return n;
}

export function isFieldError<T>(
  value: T | { error: string },
): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

/** After collecting field errors and returning, remaining values are parsed. */
export function unwrapParsed<T>(value: T | { error: string }): T {
  if (isFieldError(value)) {
    throw new Error("expected parsed form value");
  }
  return value;
}
