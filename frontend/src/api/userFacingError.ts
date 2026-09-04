/**
 * Map API errors onto org apply/profile fields. Branch on `code`; never show
 * the 422 envelope "Request validation failed."
 */
import { ApiError } from "./errors";

export const VALIDATION_FALLBACK =
  "Check the highlighted fields and try again.";

const SHIPPING_FIELDS = new Set([
  "shippingLine1",
  "shippingLine2",
  "shippingCity",
  "shippingState",
  "shippingPostalCode",
  "shippingPlaceId",
]);

function toCamel(segment: string): string {
  return segment.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Last FastAPI `loc` segment → camelCase form key. */
export function fieldFromValidationLoc(loc: unknown): string | null {
  if (!Array.isArray(loc) || loc.length === 0) {
    return null;
  }
  const last = loc[loc.length - 1];
  if (typeof last !== "string") {
    return null;
  }
  if (last === "__root__") {
    return "shipping";
  }
  const camel = toCamel(last);
  if (SHIPPING_FIELDS.has(camel)) {
    return "shipping";
  }
  return camel;
}

type FastApiItem = { loc?: unknown; msg?: unknown };

function validationItems(details: Record<string, unknown> | null): FastApiItem[] {
  const raw = details?.errors;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is FastApiItem => typeof item === "object" && item !== null);
}

export type FormApiError = {
  fields: Record<string, string>;
  banner: string | null;
};

function genericEnvelope(message: string): boolean {
  return message === "Request validation failed." || message.trim() === "";
}

/**
 * Turn an unknown catch value into field errors and/or a form banner.
 */
export function userFacingApiError(
  err: unknown,
  fallbackBanner: string,
): FormApiError {
  if (!(err instanceof ApiError)) {
    return { fields: {}, banner: fallbackBanner };
  }

  if (err.code === "EDU_EMAIL_TAKEN") {
    return { fields: { eduEmail: err.message }, banner: null };
  }
  if (err.code === "INSTAGRAM_HANDLE_TAKEN") {
    return { fields: { instagramHandle: err.message }, banner: null };
  }
  if (
    err.code === "INVALID_SHIPPING_ADDRESS" ||
    err.code === "ADDRESS_PROVIDER_UNAVAILABLE"
  ) {
    return { fields: { shipping: err.message }, banner: null };
  }

  if (err.code === "VALIDATION_ERROR") {
    const fields: Record<string, string> = {};
    for (const item of validationItems(err.details)) {
      const key = fieldFromValidationLoc(item.loc);
      const msg = typeof item.msg === "string" ? item.msg : "";
      if (key && msg && !fields[key]) {
        fields[key] = msg;
      }
    }
    if (Object.keys(fields).length > 0) {
      return { fields, banner: null };
    }
    if (/instagram/i.test(err.message)) {
      return { fields: { instagramHandle: err.message }, banner: null };
    }
    if (/shipping|mailing|zip/i.test(err.message)) {
      return { fields: { shipping: err.message }, banner: null };
    }
    if (genericEnvelope(err.message)) {
      return { fields: {}, banner: VALIDATION_FALLBACK };
    }
    return { fields: {}, banner: err.message };
  }

  return { fields: {}, banner: err.message };
}
