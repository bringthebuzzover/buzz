import {
  EDU_EMAIL_MSG,
  MEMBER_COUNT_MSG,
  MUST_NOT_BE_EMPTY,
  isFieldError,
  parseEduEmail,
  parseMemberCount,
  requireNonBlank,
} from "./formValidation";

describe("parseEduEmail", () => {
  it("accepts a .edu address", () => {
    expect(parseEduEmail("  GREEKS@Cornell.EDU ")).toBe("greeks@cornell.edu");
  });

  it("rejects gmail", () => {
    const r = parseEduEmail("president@gmail.com");
    expect(isFieldError(r) && r.error).toBe(EDU_EMAIL_MSG);
  });
});

describe("parseMemberCount", () => {
  it("rejects decimals", () => {
    const r = parseMemberCount("12.5");
    expect(isFieldError(r) && r.error).toBe(MEMBER_COUNT_MSG);
  });

  it("accepts integers", () => {
    expect(parseMemberCount("40")).toBe(40);
  });
});

describe("requireNonBlank", () => {
  it("rejects whitespace-only", () => {
    const r = requireNonBlank("   ");
    expect(isFieldError(r) && r.error).toBe(MUST_NOT_BE_EMPTY);
  });
});
