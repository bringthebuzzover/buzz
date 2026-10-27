/**
 * Title color for a photo card: white (#ffffff) or ink (#0b0b0b).
 * "light" is white text. "dark" is ink text.
 */

export type TitleTone = "light" | "dark";

/** Fractions of the visible frame (object-fit: cover), not of the raw file. */
export type FrameRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Ink #0b0b0b. Contrast is against this, matching the painted title. */
const INK = { r: 11, g: 11, b: 11 };

function channelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for an 8-bit sRGB pixel. */
function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

function contrastRatio(a: number, b: number): number {
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE_L = 1;
const INK_L = relativeLuminance(INK.r, INK.g, INK.b);

/**
 * Black text when white would have less contrast than ink, otherwise white.
 * A tie stays white.
 */
export function toneFromLuminance(luminance: number): TitleTone {
  if (!Number.isFinite(luminance)) return "light";
  const whiteContrast = contrastRatio(WHITE_L, luminance);
  const blackContrast = contrastRatio(INK_L, luminance);
  return whiteContrast < blackContrast ? "dark" : "light";
}

/** Average relative luminance. Ignores fully transparent pixels. */
export function averageLuminance(pixels: Uint8ClampedArray): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] === 0) continue;
    sum += relativeLuminance(pixels[i], pixels[i + 1], pixels[i + 2]);
    count += 1;
  }
  if (count === 0) return null;
  return sum / count;
}

/**
 * Map a frame-fraction box through object-fit: cover into source pixels.
 * The frame is wider than it is tall (carousel cards are 16:9).
 */
export function coverSourceRect(
  imageWidth: number,
  imageHeight: number,
  region: FrameRegion,
  frameAspect = 16 / 9,
): FrameRegion {
  if (imageWidth < 1 || imageHeight < 1) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const imageAspect = imageWidth / imageHeight;
  const visibleW = Math.min(1, frameAspect / imageAspect);
  const visibleH = Math.min(1, imageAspect / frameAspect);
  const originX = (1 - visibleW) / 2;
  const originY = (1 - visibleH) / 2;
  return {
    x: (originX + region.x * visibleW) * imageWidth,
    y: (originY + region.y * visibleH) * imageHeight,
    width: region.width * visibleW * imageWidth,
    height: region.height * visibleH * imageHeight,
  };
}
