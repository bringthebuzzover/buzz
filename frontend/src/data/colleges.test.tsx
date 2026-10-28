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
    const html = renderToString(
      <Marquee items={COLLEGES} title="Our College Network" />,
    );
    expect(html).not.toMatch(/clearbit|icon\.horse/i);
    expect(html).toContain("Stanford");
    expect(html).toContain("Johns Hopkins");
    expect(html).toContain("w-[320%]");
    expect(html).toContain("w-[210%]");
    expect(html).toContain("w-[180%]");
    expect(html).toContain("w-[160%]");
  });
});
