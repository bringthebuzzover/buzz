/**
 * Campus-to-campus flight for /pulse-bee.
 *
 * One SVG path in the map's viewBox (the same Albers projection as the pins).
 * The bee and a comet of ink dots share that path and one SMIL clock:
 * calcMode="paced", rotate="auto", and negative `begin` lags, the same
 * idea as the old home-page bee. Paced motion cannot hold still (it ignores
 * keyTimes), so each landing freezes that shared clock for 400ms.
 */
import { geoAlbersUsa } from "d3-geo";
import { COLLEGES } from "../../data/colleges";
import dots from "../../pages/pulseBee/us-dots.json";

export const VIEW_W = dots.width;
export const VIEW_H = dots.height;

/** West, then across the south and up the east coast, then back through the midwest. */
export const FLIGHT_STOPS = [
  "stanford.edu",
  "rice.edu",
  "duke.edu",
  "upenn.edu",
  "cornell.edu",
  "uchicago.edu",
] as const;

export const REDUCED_MOTION_DOMAIN = "cornell.edu";
/** 1.5× the original 15s loop: 7.6s of paced flight and a 400ms pause on each pin. */
export const FLIGHT_SPEED = 1.5;
export const PAUSE_SECONDS = 0.4;
export const LOOP_SECONDS = 10;
export const INK = "#0b0b0b";

/** How close the paced bee must be, in viewBox units, before a landing counts. */
export const PIN_TOLERANCE = 22;

/**
 * bee.svg faces up-right. A clockwise 50° turn lays the nose on +x, which
 * animateMotion rotate="auto" then aims along the path. The body sits a
 * little left and below the image center.
 */
export const BEE_NOSE_CLOCKWISE_DEG = 50;
export const BEE_BODY_X = 0.454;
export const BEE_BODY_Y = 0.586;

const TRAIL_COUNT = 9;
/** Seconds behind the bee at 1× speed. Divided by FLIGHT_SPEED so the comet covers the same path length. */
const TRAIL_LAG_HEAD = 0.07;
const TRAIL_LAG_SPAN = 0.8;

export type Pt = { x: number; y: number };

export type CampusPin = Pt & {
  name: string;
  domain: string;
  left: string;
  top: string;
};

export type Hop = { from: Pt; control: Pt; to: Pt; length: number };

export type TrailDot = { lag: number; opacity: number; scale: number };

export type FlightPlan = {
  pins: CampusPin[];
  stops: CampusPin[];
  hops: Hop[];
  path: string;
  pathLength: number;
  flightSeconds: number;
  loopSeconds: number;
  stopDistances: number[];
  arrivals: number[];
  trail: TrailDot[];
};

export function beePxForMapWidth(mapWidth: number): number {
  if (mapWidth < 480) return 17;
  if (mapWidth < 800) return 24;
  return 26;
}

export function dotPxForMapWidth(mapWidth: number): number {
  return mapWidth < 480 ? 3.2 : 4.6;
}

function project(): ReturnType<typeof geoAlbersUsa> {
  return geoAlbersUsa().scale(dots.scale).translate(dots.translate as [number, number]);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function projectColleges(): CampusPin[] {
  const geo = project();
  return COLLEGES.flatMap((college) => {
    const xy = geo([college.lng, college.lat]);
    if (!xy) return [];
    return [
      {
        name: college.name,
        domain: college.domain,
        x: xy[0],
        y: xy[1],
        left: `${(xy[0] / VIEW_W) * 100}%`,
        top: `${(xy[1] / VIEW_H) * 100}%`,
      },
    ];
  });
}

/**
 * Which way the pause label grows from its pin. Pins right of center grow
 * left, so long names like UPenn and Cornell stay inside a 375px map.
 */
export function labelAlign(pin: Pt): "start" | "end" {
  return pin.x > VIEW_W / 2 ? "end" : "start";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Quadratic control lifted above the straight line, kept inside the viewBox. */
export function arcControl(from: Pt, to: Pt): Pt {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const lift = Math.min(72, Math.max(18, len * 0.16));
  const nx = -dy / len;
  const ny = dx / len;
  const sign = ny <= 0 ? 1 : -1;
  let cx = midX + sign * nx * lift;
  let cy = midY + sign * ny * lift;
  if (midY - cy < lift * 0.45) {
    cx = midX;
    cy = midY - lift;
  }
  const pad = 22;
  return {
    x: round(clamp(cx, pad, VIEW_W - pad)),
    y: round(clamp(cy, pad, VIEW_H - pad)),
  };
}

export function quadPoint(from: Pt, control: Pt, to: Pt, t: number): Pt {
  const m = 1 - t;
  return {
    x: m * m * from.x + 2 * m * t * control.x + t * t * to.x,
    y: m * m * from.y + 2 * m * t * control.y + t * t * to.y,
  };
}

export function quadLength(from: Pt, control: Pt, to: Pt): number {
  let length = 0;
  let prev = from;
  const steps = 32;
  for (let i = 1; i <= steps; i += 1) {
    const next = quadPoint(from, control, to, i / steps);
    length += Math.hypot(next.x - prev.x, next.y - prev.y);
    prev = next;
  }
  return length;
}

function trailDots(flightSeconds: number): TrailDot[] {
  return Array.from({ length: TRAIL_COUNT }, (_, index) => {
    const t = (index + 1) / (TRAIL_COUNT + 1);
    const opacity = 0.92 * (1 - t) ** 1.15;
    return {
      lag: Math.min(flightSeconds * 0.45, (TRAIL_LAG_HEAD + t * TRAIL_LAG_SPAN) / FLIGHT_SPEED),
      opacity: Math.round(opacity * 1000) / 1000,
      scale: Math.round((1 - t * 0.68) * 1000) / 1000,
    };
  });
}

export function buildFlight(): FlightPlan {
  const pins = projectColleges();
  const byDomain = new Map(pins.map((pin) => [pin.domain, pin]));
  const stops = FLIGHT_STOPS.map((domain) => {
    const pin = byDomain.get(domain);
    if (!pin) throw new Error(`Missing campus ${domain}`);
    return pin;
  });

  const hops: Hop[] = stops.map((stop, index) => {
    const next = stops[(index + 1) % stops.length];
    const from = { x: round(stop.x), y: round(stop.y) };
    const to = { x: round(next.x), y: round(next.y) };
    const control = arcControl(from, to);
    return { from, control, to, length: quadLength(from, control, to) };
  });

  const pathLength = hops.reduce((sum, hop) => sum + hop.length, 0);
  const flightSeconds = Math.round((LOOP_SECONDS - PAUSE_SECONDS * stops.length) * 1000) / 1000;
  const stopDistances: number[] = [0];
  hops.slice(0, -1).forEach((hop) => {
    stopDistances.push(stopDistances[stopDistances.length - 1] + hop.length);
  });
  const arrivals = stopDistances.map((distance) => (distance / pathLength) * flightSeconds);
  const path = pathData(hops);

  return {
    pins,
    stops,
    hops,
    path,
    pathLength,
    flightSeconds,
    loopSeconds: LOOP_SECONDS,
    stopDistances,
    arrivals,
    trail: trailDots(flightSeconds),
  };
}

function pathData(hops: Hop[]): string {
  const n = (value: number) => value.toFixed(2);
  const start = hops[0].from;
  let d = `M ${n(start.x)} ${n(start.y)}`;
  hops.forEach((hop) => {
    d += ` Q ${n(hop.control.x)} ${n(hop.control.y)} ${n(hop.to.x)} ${n(hop.to.y)}`;
  });
  return d;
}

export function pinAlongPath(dist: number, stopDistances: number[]): { pin: number; since: number } {
  let pin = 0;
  for (let i = 1; i < stopDistances.length; i += 1) {
    if (dist + 0.01 >= stopDistances[i]) pin = i;
  }
  return { pin, since: dist - stopDistances[pin] };
}

export function shouldDwell(since: number, token: string, lastToken: string | null): boolean {
  return since >= -1 && since <= PIN_TOLERANCE && token !== lastToken;
}

function xmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** SMIL markup. Parsed as HTML so the shared clock actually starts. */
export function renderFlightSvg(plan: FlightPlan, beeSrc: string, mapWidth = 880): string {
  const beePx = beePxForMapWidth(mapWidth);
  const bee = (beePx * VIEW_W) / mapWidth;
  const dot = (dotPxForMapWidth(mapWidth) * VIEW_W) / mapWidth;
  const dur = `${plan.flightSeconds}s`;
  const src = xmlAttr(beeSrc);
  const motion = (begin: string, rotate: "auto" | "0") =>
    `<animateMotion dur="${dur}" repeatCount="indefinite" begin="${begin}" calcMode="paced" rotate="${rotate}"><mpath href="#pulsebee-flight" xlink:href="#pulsebee-flight"/></animateMotion>`;

  // Inline style, not an opacity attribute: the shared `.pulse2-map circle`
  // rule outranks presentation attributes and would flatten the fade.
  const dotsMarkup = plan.trail
    .map((dotStep) => {
      const behind = (plan.flightSeconds - dotStep.lag).toFixed(3);
      const radius = (dot * dotStep.scale).toFixed(2);
      return `<circle data-scale="${dotStep.scale}" r="${radius}" fill="${INK}" style="opacity:${dotStep.opacity.toFixed(3)}">${motion(`-${behind}s`, "0")}</circle>`;
    })
    .join("");

  const beeMarkup = `<g>${motion("0s", "auto")}<g transform="rotate(${BEE_NOSE_CLOCKWISE_DEG})"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 0.93;1 1" dur="0.22s" repeatCount="indefinite" additive="sum"/><image class="pulsebee-bee" href="${src}" xlink:href="${src}" x="${(-bee * BEE_BODY_X).toFixed(2)}" y="${(-bee * BEE_BODY_Y).toFixed(2)}" width="${bee.toFixed(2)}" height="${bee.toFixed(2)}"/></g></g></g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" focusable="false" data-flight-seconds="${plan.flightSeconds}" data-loop-seconds="${plan.loopSeconds}"><path id="pulsebee-flight" d="${plan.path}" fill="none" stroke="none"/>${dotsMarkup}${beeMarkup}</svg>`;
}

export function applyFlightScale(svg: SVGSVGElement, mapWidth: number): void {
  if (mapWidth < 1) return;
  const bee = (beePxForMapWidth(mapWidth) * VIEW_W) / mapWidth;
  const image = svg.querySelector("image");
  if (image) {
    image.setAttribute("width", bee.toFixed(2));
    image.setAttribute("height", bee.toFixed(2));
    image.setAttribute("x", (-bee * BEE_BODY_X).toFixed(2));
    image.setAttribute("y", (-bee * BEE_BODY_Y).toFixed(2));
  }
  const dot = (dotPxForMapWidth(mapWidth) * VIEW_W) / mapWidth;
  svg.querySelectorAll<SVGCircleElement>("circle[data-scale]").forEach((circle) => {
    const scale = Number(circle.dataset.scale);
    if (!Number.isFinite(scale)) return;
    circle.setAttribute("r", (dot * scale).toFixed(2));
  });
}
