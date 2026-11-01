import { renderToString } from "react-dom/server";
import Marquee from "../components/site/Marquee";
import { COLLEGES } from "./colleges";

describe("COLLEGES", () => {
  it("gives every school a committed logo and never a logo CDN", () => {
    expect(COLLEGES.length).toBeGreaterThan(0);
    const sources = COLLEGES.map((college) => college.logoSrc);
    expect(new Set(sources).size).toBe(sources.length);
    for (const college of COLLEGES) {
      expect(college.logoSrc).toBeTruthy();
      expect(college.logoSrc).not.toMatch(/clearbit|icon\.horse/i);
    }
    const view = renderToString(
      <Marquee items={COLLEGES} />,
    );
    expect(view).not.toMatch(/clearbit|icon\.horse/i);
    expect(view).toContain("Stanford");
    expect(view).toContain("Johns Hopkins");
    expect(view.match(/max-w-\[120px\]/g)).toHaveLength(COLLEGES.length * 2);
    expect(view).toContain("grayscale");
    expect(view).toContain("group-hover:grayscale-0");
    expect(view).not.toContain("w-[320%]");
    expect(view).not.toContain("max-w-none");
  });
});
