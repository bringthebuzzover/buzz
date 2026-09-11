import { cn } from "./cn";
import { TEXT, TONE } from "./tokens";

describe("cn / twMerge font-size vs tone color", () => {
  it("keeps chip micro size next to a tone text color", () => {
    const merged = cn(TEXT.micro, TONE.success);
    expect(merged).toMatch(/\btext-xs\b/);
    expect(merged).toMatch(/\btext-buzz-success\b/);
  });

  it("does not let a buzz text color eat text-buzzMicro", () => {
    const merged = cn("text-buzzMicro", "text-buzz-warn");
    expect(merged).toMatch(/\btext-buzzMicro\b/);
    expect(merged).toMatch(/\btext-buzz-warn\b/);
  });
});
