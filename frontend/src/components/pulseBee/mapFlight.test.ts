import {
  FLIGHT_SPEED,
  FLIGHT_STOPS,
  LOOP_SECONDS,
  PAUSE_SECONDS,
  PIN_TOLERANCE,
  REDUCED_MOTION_DOMAIN,
  VIEW_H,
  VIEW_W,
  buildFlight,
  labelAlign,
  pinAlongPath,
  renderFlightSvg,
  shouldDwell,
} from "./mapFlight";

describe("map flight", () => {
  const plan = buildFlight();

  it("hops six real campuses from the west coast back through the midwest", () => {
    expect(plan.stops.map((stop) => stop.domain)).toEqual([...FLIGHT_STOPS]);
    expect(plan.stops.map((stop) => stop.name)).toEqual([
      "Stanford",
      "Rice",
      "Duke",
      "UPenn",
      "Cornell",
      "UChicago",
    ]);
    expect(REDUCED_MOTION_DOMAIN).toBe("cornell.edu");
    const x = plan.stops.map((stop) => stop.x);
    expect(x[0]).toBeLessThan(x[1]);
    expect(x[1]).toBeLessThan(x[2]);
    expect(x[2]).toBeLessThan(x[3]);
    expect(x[5]).toBeLessThan(x[4]);
    expect(x[0]).toBe(Math.min(...x));
  });

  it("lifts every hop above the straight line and returns to Stanford", () => {
    expect(plan.hops).toHaveLength(FLIGHT_STOPS.length);
    plan.hops.forEach((hop, index) => {
      const next = plan.stops[(index + 1) % plan.stops.length];
      const midY = (hop.from.y + hop.to.y) / 2;
      expect(hop.from.x).toBeCloseTo(plan.stops[index].x, 1);
      expect(hop.from.y).toBeCloseTo(plan.stops[index].y, 1);
      expect(hop.to.x).toBeCloseTo(next.x, 1);
      expect(hop.to.y).toBeCloseTo(next.y, 1);
      expect(hop.control.y).toBeLessThan(midY - 8);
      expect(hop.length).toBeGreaterThan(Math.hypot(hop.to.x - hop.from.x, hop.to.y - hop.from.y));
      [hop.from, hop.control, hop.to].forEach((point) => {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(VIEW_W);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(VIEW_H);
      });
    });
    expect(plan.path.startsWith("M ")).toBe(true);
    expect(plan.path).not.toMatch(/ L /);
    expect(plan.pathLength).toBeCloseTo(
      plan.hops.reduce((sum, hop) => sum + hop.length, 0),
      5,
    );
  });

  it("keeps a constant pace and a 400ms landing inside a 10s loop", () => {
    expect(FLIGHT_SPEED).toBe(1.5);
    expect(plan.flightSeconds).toBeCloseTo(7.6, 5);
    expect(plan.flightSeconds).toBeCloseTo(LOOP_SECONDS - PAUSE_SECONDS * FLIGHT_STOPS.length, 5);
    expect(plan.loopSeconds).toBe(10);
    expect(PAUSE_SECONDS).toBe(0.4);
    expect(plan.arrivals[0]).toBe(0);
    const speed = plan.pathLength / plan.flightSeconds;
    plan.arrivals.forEach((arrival, index) => {
      expect(arrival).toBeCloseTo(plan.stopDistances[index] / speed, 5);
      if (index > 0) expect(arrival).toBeGreaterThan(plan.arrivals[index - 1]);
    });
  });

  it("draws an ink comet on the same paced clock, not a route line", () => {
    expect(plan.trail.length).toBeGreaterThanOrEqual(8);
    expect(plan.trail.length).toBeLessThanOrEqual(10);
    plan.trail.forEach((dot, index) => {
      const t = (index + 1) / (plan.trail.length + 1);
      expect(dot.lag).toBeCloseTo((0.07 + t * 0.8) / FLIGHT_SPEED, 5);
      expect(dot.lag).toBeGreaterThan(0);
      expect(dot.lag).toBeLessThan(plan.flightSeconds);
      expect(dot.opacity).toBeGreaterThan(0);
      expect(dot.opacity).toBeLessThanOrEqual(1);
      if (index > 0) {
        expect(dot.opacity).toBeLessThan(plan.trail[index - 1].opacity);
        expect(dot.scale).toBeLessThan(plan.trail[index - 1].scale);
        expect(dot.lag).toBeGreaterThan(plan.trail[index - 1].lag);
      }
    });

    const markup = renderFlightSvg(plan, "/logos/bee.svg");
    expect(markup).toContain('id="pulsebee-flight"');
    expect(markup).toContain('calcMode="paced"');
    expect(markup).toContain('rotate="auto"');
    expect(markup).toContain('fill="none" stroke="none"');
    expect(markup).toContain('fill="#0b0b0b"');
    expect(markup).not.toMatch(/coral|#ff7f73|#e85d4c/i);
    expect(markup).toContain('href="/logos/bee.svg"');
    expect(markup.match(/<circle /g)).toHaveLength(plan.trail.length);
    expect(markup.match(/begin="-[\d.]+s"/g)?.length).toBe(plan.trail.length);
    expect(markup).toContain(`data-loop-seconds="${plan.loopSeconds}"`);
    expect(markup).toContain(`dur="${plan.flightSeconds}s"`);
    // The fade must be inline style; `.pulse2-map circle` outranks an attribute.
    expect(markup).not.toMatch(/<circle[^>]* opacity="/);
    expect(markup.match(/style="opacity:[\d.]+"/g)).toHaveLength(plan.trail.length);
  });

  it("grows the pause label inward so east-coast names stay on the map", () => {
    const align = (domain: string) => {
      const pin = plan.pins.find((p) => p.domain === domain);
      if (!pin) throw new Error(domain);
      return labelAlign(pin);
    };
    expect(align("stanford.edu")).toBe("start");
    expect(align("upenn.edu")).toBe("end");
    expect(align("cornell.edu")).toBe("end");
    expect(align(REDUCED_MOTION_DOMAIN)).toBe("end");
  });

  it("starts a landing only when the bee reaches a pin it has not already visited", () => {
    const stops = [0, 100, 250];
    expect(pinAlongPath(0, stops)).toEqual({ pin: 0, since: 0 });
    expect(pinAlongPath(40, stops)).toEqual({ pin: 0, since: 40 });
    expect(pinAlongPath(100, stops)).toEqual({ pin: 1, since: 0 });
    expect(pinAlongPath(112, stops)).toEqual({ pin: 1, since: 12 });

    expect(shouldDwell(0, "0:0", null)).toBe(true);
    expect(shouldDwell(PIN_TOLERANCE + 1, "0:0", null)).toBe(false);
    expect(shouldDwell(4, "0:0", "0:0")).toBe(false);
    expect(shouldDwell(0, "1:0", "0:0")).toBe(true);
  });
});
