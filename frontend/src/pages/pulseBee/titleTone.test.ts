import { averageLuminance, toneFromLuminance } from "./titleTone";

function solid(r: number, g: number, b: number, n = 4): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = r;
    pixels[i + 1] = g;
    pixels[i + 2] = b;
    pixels[i + 3] = 255;
  }
  return pixels;
}

describe("toneFromLuminance", () => {
  it("picks black text for a bright sample", () => {
    const luminance = averageLuminance(solid(255, 255, 255));
    expect(luminance).toBeCloseTo(1, 5);
    expect(toneFromLuminance(luminance as number)).toBe("dark");
  });

  it("picks white text for a dark sample", () => {
    const luminance = averageLuminance(solid(0, 0, 0));
    expect(luminance).toBeCloseTo(0, 5);
    expect(toneFromLuminance(luminance as number)).toBe("light");
  });

  it("picks black text for a light gray and white text for a near-black gray", () => {
    expect(toneFromLuminance(averageLuminance(solid(220, 220, 220)) as number)).toBe("dark");
    expect(toneFromLuminance(averageLuminance(solid(12, 12, 12)) as number)).toBe("light");
  });
});
