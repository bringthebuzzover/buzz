import { useLayoutEffect, useState } from "react";
import {
  averageLuminance,
  coverSourceRect,
  toneFromLuminance,
  type FrameRegion,
  type TitleTone,
} from "./titleTone";

export type TitleToneState = {
  tone: TitleTone;
  ready: boolean;
  failed: boolean;
  luminance: number | null;
};

const SAMPLE = 48;

const cache = new Map<string, { tone: TitleTone; luminance: number }>();

const pending: TitleToneState = {
  tone: "light",
  ready: false,
  failed: false,
  luminance: null,
};

function cachedState(src: string): TitleToneState {
  const hit = cache.get(src);
  if (!hit) return pending;
  return { tone: hit.tone, ready: true, failed: false, luminance: hit.luminance };
}

function sampleLuminance(img: HTMLImageElement, region: FrameRegion): number | null {
  const rect = coverSourceRect(img.naturalWidth, img.naturalHeight, region);
  if (rect.width < 1 || rect.height < 1) return null;
  const scale = SAMPLE / Math.max(rect.width, rect.height);
  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height);
  try {
    const { data } = ctx.getImageData(0, 0, width, height);
    return averageLuminance(data);
  } catch {
    return null;
  }
}

/**
 * White or ink for `src`, sampled once from `region` (fractions of the 16:9 cover frame).
 * `override` wins and skips the canvas. A failed sample stays white.
 */
export function useTitleTone(
  src: string,
  region: FrameRegion | null,
  override?: TitleTone,
): TitleToneState {
  const [state, setState] = useState<TitleToneState>(() => cachedState(src));

  useLayoutEffect(() => {
    if (override) return undefined;
    const hit = cache.get(src);
    if (hit) {
      setState((prev) =>
        prev.ready && prev.tone === hit.tone && prev.luminance === hit.luminance && !prev.failed
          ? prev
          : { tone: hit.tone, ready: true, failed: false, luminance: hit.luminance },
      );
      return undefined;
    }
    if (!region || region.width <= 0 || region.height <= 0) return undefined;

    let cancelled = false;
    const fail = () => {
      if (!cancelled) {
        setState({ tone: "light", ready: true, failed: true, luminance: null });
      }
    };
    const apply = (img: HTMLImageElement) => {
      if (cancelled) return;
      const again = cache.get(src);
      if (again) {
        setState({ tone: again.tone, ready: true, failed: false, luminance: again.luminance });
        return;
      }
      const luminance = sampleLuminance(img, region);
      if (luminance == null) {
        fail();
        return;
      }
      const tone = toneFromLuminance(luminance);
      cache.set(src, { tone, luminance });
      setState({ tone, ready: true, failed: false, luminance });
    };

    const img = new Image();
    img.onload = () => apply(img);
    img.onerror = fail;
    img.src = src;
    if (img.complete) {
      if (img.naturalWidth > 0) apply(img);
      else fail();
    }

    return () => {
      cancelled = true;
    };
  }, [src, region, override]);

  if (override) {
    return { tone: override, ready: true, failed: false, luminance: null };
  }
  return state;
}
