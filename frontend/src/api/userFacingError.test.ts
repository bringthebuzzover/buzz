import { ApiError } from "./errors";
import {
  VALIDATION_FALLBACK,
  fieldFromValidationLoc,
  userFacingApiError,
} from "./userFacingError";

describe("fieldFromValidationLoc", () => {
  it("camelCases the last loc segment", () => {
    expect(fieldFromValidationLoc(["body", "edu_email"])).toBe("eduEmail");
    expect(fieldFromValidationLoc(["body", "eduEmail"])).toBe("eduEmail");
  });

  it("maps shipping keys and __root__ to shipping", () => {
    expect(fieldFromValidationLoc(["body", "shipping_line1"])).toBe("shipping");
    expect(fieldFromValidationLoc(["body", "__root__"])).toBe("shipping");
  });
});

describe("userFacingApiError", () => {
  it("surfaces FastAPI details instead of the envelope message", () => {
    const err = new ApiError(
      "VALIDATION_ERROR",
      "Request validation failed.",
      422,
      {
        errors: [
          {
            loc: ["body", "edu_email"],
            msg: "Must be a valid .edu email address",
          },
        ],
      },
    );
    expect(userFacingApiError(err, "fallback")).toEqual({
      fields: { eduEmail: "Must be a valid .edu email address" },
      banner: null,
    });
  });

  it("falls back when details are missing", () => {
    const err = new ApiError(
      "VALIDATION_ERROR",
      "Request validation failed.",
      422,
      null,
    );
    expect(userFacingApiError(err, "fallback")).toEqual({
      fields: {},
      banner: VALIDATION_FALLBACK,
    });
  });

  it("puts Instagram username validation on the handle field", () => {
    const err = new ApiError(
      "VALIDATION_ERROR",
      "Enter a valid Instagram username (letters, numbers, periods, underscores).",
      400,
      null,
    );
    expect(userFacingApiError(err, "fallback").fields.instagramHandle).toMatch(
      /Instagram username/,
    );
  });

  it("maps EDU_EMAIL_TAKEN onto eduEmail", () => {
    const err = new ApiError(
      "EDU_EMAIL_TAKEN",
      "This .edu email is already associated with another account.",
      409,
    );
    expect(userFacingApiError(err, "fallback")).toEqual({
      fields: {
        eduEmail: "This .edu email is already associated with another account.",
      },
      banner: null,
    });
  });
});
