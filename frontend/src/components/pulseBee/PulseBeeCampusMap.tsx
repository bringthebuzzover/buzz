/**
 * Dotted US map from /pulse2, with a bee that visits six campuses.
 * The overlay uses the map viewBox, so the arcs stay on the pins at every width.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import dots from "../../pages/pulseBee/us-dots.json";
import { publicLogo } from "../../utils/publicLogo";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import {
  PAUSE_SECONDS,
  REDUCED_MOTION_DOMAIN,
  VIEW_H,
  VIEW_W,
  applyFlightScale,
  buildFlight,
  labelAlign,
  pinAlongPath,
  renderFlightSvg,
  shouldDwell,
  type FlightPlan,
} from "./mapFlight";

const BEE = publicLogo("bee.svg");
const PAUSE_MS = PAUSE_SECONDS * 1000;

function locateStops(path: SVGPathElement, stops: { x: number; y: number }[]): number[] {
  const total = path.getTotalLength();
  const found = [0];
  let cursor = 0;
  for (let i = 1; i < stops.length; i += 1) {
    const target = stops[i];
    const span = Math.max(total - cursor, 0);
    const steps = 400;
    let bestAt = cursor;
    let best = Number.POSITIVE_INFINITY;
    for (let s = 0; s <= steps; s += 1) {
      const at = cursor + (span * s) / steps;
      const point = path.getPointAtLength(at);
      const err = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
      if (err < best) {
        best = err;
        bestAt = at;
      }
    }
    const step = span / steps || 1;
    for (let s = -10; s <= 10; s += 1) {
      const at = Math.min(total, Math.max(cursor, bestAt + (s * step) / 10));
      const point = path.getPointAtLength(at);
      const err = (point.x - target.x) ** 2 + (point.y - target.y) ** 2;
      if (err < best) {
        best = err;
        bestAt = at;
      }
    }
    found.push(bestAt);
    cursor = bestAt;
  }
  return found;
}

function useMapFlight(plan: FlightPlan, enabled: boolean, onVisit: (domain: string | null) => void) {
  const mapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return undefined;
    const svg = map.querySelector<SVGSVGElement>(".pulsebee-flight svg");
    const route = svg?.querySelector<SVGPathElement>("#pulsebee-flight");
    if (
      !svg ||
      !route ||
      typeof svg.pauseAnimations !== "function" ||
      typeof svg.getCurrentTime !== "function" ||
      typeof route.getTotalLength !== "function"
    ) {
      return undefined;
    }

    const size = () => applyFlightScale(svg, map.clientWidth);
    size();
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(size);
    resize?.observe(map);

    const stopDistances = locateStops(route, plan.stops);
    let inView = typeof IntersectionObserver === "undefined";
    let mode: "fly" | "dwell" = "fly";
    let lastToken: string | null = null;
    let timer: number | null = null;
    let dwellLeft = PAUSE_MS;
    let dwellEndsAt = 0;
    let frame = 0;

    const clearTimer = () => {
      if (timer == null) return;
      window.clearTimeout(timer);
      timer = null;
    };

    // Pausing at time 0 before SMIL samples leaves the bee at the SVG origin.
    // Seeking commits the paced pose, then the pause holds it.
    const hold = () => {
      const time = svg.getCurrentTime();
      if (svg.animationsPaused()) svg.unpauseAnimations();
      svg.setCurrentTime(time);
      svg.pauseAnimations();
    };

    const canPlay = () => inView && !document.hidden;

    const readHit = () => {
      const total = route.getTotalLength();
      const dur = plan.flightSeconds;
      if (total < 1 || dur <= 0) return null;
      const time = svg.getCurrentTime();
      const loop = Math.floor(time / dur + 1e-9);
      const local = time - loop * dur;
      const dist = (local / dur) * total;
      const { pin, since } = pinAlongPath(dist, stopDistances);
      return { pin, since, token: `${loop}:${pin}` };
    };

    const watch = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (mode !== "fly" || !canPlay()) return;
        const hit = readHit();
        if (hit && shouldDwell(hit.since, hit.token, lastToken)) {
          beginDwell(hit.pin, hit.token);
          return;
        }
        watch();
      });
    };

    const finishDwell = () => {
      timer = null;
      mode = "fly";
      onVisit(null);
      if (!canPlay()) return;
      svg.unpauseAnimations();
      watch();
    };

    const startDwellTimer = (ms: number) => {
      clearTimer();
      dwellEndsAt = performance.now() + ms;
      timer = window.setTimeout(finishDwell, ms);
    };

    const beginDwell = (pin: number, token: string) => {
      lastToken = token;
      mode = "dwell";
      hold();
      window.cancelAnimationFrame(frame);
      onVisit(plan.stops[pin]?.domain ?? null);
      dwellLeft = PAUSE_MS;
      startDwellTimer(PAUSE_MS);
    };

    const consider = () => {
      if (!canPlay()) {
        hold();
        window.cancelAnimationFrame(frame);
        if (mode === "dwell" && timer != null) {
          dwellLeft = Math.max(0, dwellEndsAt - performance.now());
          clearTimer();
        }
        return;
      }
      if (mode === "dwell") {
        hold();
        if (timer == null) startDwellTimer(dwellLeft);
        return;
      }
      const hit = readHit();
      if (hit && shouldDwell(hit.since, hit.token, lastToken)) {
        beginDwell(hit.pin, hit.token);
        return;
      }
      svg.unpauseAnimations();
      watch();
    };

    hold();
    document.addEventListener("visibilitychange", consider);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              inView = entries.some((entry) => entry.isIntersecting);
              consider();
            },
            { threshold: 0.15 },
          );
    observer?.observe(map);
    consider();

    return () => {
      clearTimer();
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", consider);
      observer?.disconnect();
      resize?.disconnect();
    };
  }, [enabled, onVisit, plan]);

  return mapRef;
}

export default function PulseBeeCampusMap() {
  const reduced = usePrefersReducedMotion();
  const plan = useMemo(() => buildFlight(), []);
  const markup = useMemo(() => renderFlightSvg(plan, BEE), [plan]);
  const [liveVisit, setLiveVisit] = useState<string | null>(null);
  const onVisit = useMemo(
    () => (domain: string | null) => {
      setLiveVisit((prev) => (prev === domain ? prev : domain));
    },
    [],
  );
  const mapRef = useMapFlight(plan, !reduced, onVisit);

  const visitDomain = reduced ? REDUCED_MOTION_DOMAIN : liveVisit;
  const visit = plan.pins.find((pin) => pin.domain === visitDomain) ?? null;
  const parked = plan.pins.find((pin) => pin.domain === REDUCED_MOTION_DOMAIN) ?? null;

  return (
    <div className="pulse2-map pulsebee-map" ref={mapRef} data-visiting={visitDomain ?? ""}>
      <svg
        className="pulse2-map__land"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label="United States"
      >
        {dots.points.map(([x, y], index) => (
          <circle key={index} cx={x} cy={y} r={dots.r} />
        ))}
      </svg>
      {reduced ? (
        parked ? (
          <img
            className="pulsebee-still"
            src={BEE}
            alt=""
            style={{ left: parked.left, top: parked.top }}
          />
        ) : null
      ) : (
        <div className="pulsebee-flight" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />
      )}
      <div className="pulse2-map__pins">
        {plan.pins.map((pin) => (
          <button
            key={pin.domain}
            type="button"
            className="pulse2-map__pin"
            style={{ left: pin.left, top: pin.top }}
            aria-label={pin.name}
          >
            <span>{pin.name}</span>
          </button>
        ))}
      </div>
      {visit ? (
        <>
          <span className="pulsebee-ring" style={{ left: visit.left, top: visit.top }} />
          <span
            className="pulsebee-label"
            aria-hidden="true"
            data-align={labelAlign(visit)}
            style={{ left: visit.left, top: visit.top }}>
            {visit.name}
          </span>
        </>
      ) : null}
    </div>
  );
}
