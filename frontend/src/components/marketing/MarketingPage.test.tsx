/* eslint-disable testing-library/no-container -- The repository harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { CollegeNetwork } from "./CollegeNetwork";
import { MarketingPage } from "./MarketingPage";
import { MarketingHero, StackCards, Statement } from "./sections";

let changeMotion: () => void;
let reduced = false;
const originalObserver = window.IntersectionObserver;

beforeEach(() => {
  reduced = false;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({
      get matches() {
        return reduced;
      },
      addEventListener: (_: string, listener: () => void) => {
        changeMotion = listener;
      },
      removeEventListener: jest.fn(),
    }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: originalObserver });
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

it.each([false, true])("keeps campus labels noninteractive with reduced motion %s", (preference) => {
  reduced = preference;
  const { container } = renderWithProviders(<CollegeNetwork />);
  const pins = Array.from(container.querySelectorAll<HTMLElement>("[data-campus]"));
  expect(pins.map((pin) => pin.textContent)).toContain("Cornell");
  expect(pins.some((pin) => pin.matches('button, [role="button"], a[href], [tabindex]'))).toBe(false);
  expect(pins.every((pin) => pin.tabIndex === -1)).toBe(true);
});

it("keeps the fading trail behind the bee on the first eastbound flight", () => {
  const request = jest
    .spyOn(window, "requestAnimationFrame")
    .mockReturnValue(1);
  const { container } = renderWithProviders(<CollegeNetwork />);
  const tick = request.mock.calls[0][0];
  act(() => {
    tick(1000);
    tick(2000);
  });
  const flyers = Array.from(
    container.querySelectorAll<HTMLElement>("[data-flyer]"),
  );
  const positions = flyers.map((flyer) => parseFloat(flyer.style.left));
  expect(positions[0]).toBeGreaterThan(positions[1]);
  expect(positions[1]).toBeGreaterThan(positions[9]);
  expect(Number(flyers[1].style.opacity)).toBeGreaterThan(
    Number(flyers[9].style.opacity),
  );
});

it("parks at Cornell without a trail or animation loop under reduced motion", () => {
  reduced = true;
  const request = jest.spyOn(window, "requestAnimationFrame");
  const { container } = renderWithProviders(<CollegeNetwork />);
  expect(container.querySelectorAll("[data-flyer]")).toHaveLength(1);
  expect(
    container
      .querySelector('[data-campus="Cornell"]')
      ?.getAttribute("data-visiting"),
  ).toBe("true");
  expect(request).not.toHaveBeenCalled();
});

it("cancels flight when the motion preference changes", () => {
  jest.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
  const cancel = jest.spyOn(window, "cancelAnimationFrame");
  const { container } = renderWithProviders(<CollegeNetwork />);
  act(() => {
    reduced = true;
    changeMotion();
  });
  expect(cancel).toHaveBeenCalledWith(42);
  expect(container.querySelectorAll("[data-flyer]")).toHaveLength(1);
  expect(container.querySelector<HTMLElement>("[data-flyer]")?.style.left).toBe(
    `${(747.4 / 880) * 100}%`,
  );
});

it("reveals hero lines and cancels their animations on unmount", () => {
  const cancel = jest.fn();
  const animate = jest.fn(() => ({ cancel }));
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
  });
  const { unmount } = renderWithProviders(
    <MarketingPage>
      <MarketingHero
        title={"Campus\ncommunities"}
        sub="Test copy"
        media="video"
        primary={{ label: "Join" }}
      />
    </MarketingPage>,
  );
  expect(animate).toHaveBeenCalledTimes(3);
  unmount();
  expect(cancel).toHaveBeenCalledTimes(3);
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

it("leaves reduced-motion text visible without scroll observers", () => {
  reduced = true;
  const observer = jest.fn();
  Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: observer });
  const { container } = renderWithProviders(
    <MarketingPage>
      <Statement line1="First line" line2="Second line" />
    </MarketingPage>,
  );
  expect(container.textContent).toBe("First lineSecond line");
  expect(observer).not.toHaveBeenCalled();
  expect(
    container.querySelector("[data-reveal-line]")?.getAttribute("style"),
  ).toBeNull();
});

it("pauses the hero video when reduced motion is enabled", () => {
  jest.spyOn(HTMLMediaElement.prototype, "paused", "get").mockReturnValue(false);
  const pause = jest.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  renderWithProviders(<MarketingHero title="Campus" sub="Test copy" media="video" primary={{ label: "Join" }} />);
  act(() => { reduced = true; changeMotion(); });
  expect(pause).toHaveBeenCalledTimes(1);
});

it.each([
  [false, 1.5, "1", "0deg", "0"],
  [false, 0.5, "0.925", "-1.5deg", "0.5"],
  [false, -0.5, "0.85", "-3deg", "1"],
  [true, 0.5, "", "", ""],
] as const)("scrubs stack layers and hero shade with reduced motion %s at viewport ratio %s", (preference, top, scale, rotate, opacity) => {
  reduced = preference;
  let paint = () => {};
  jest.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    paint = () => callback(0);
    return 42;
  });
  const { container, unmount } = renderWithProviders(<MarketingPage>
    <MarketingHero title="Campus" sub="Test copy" media="video" primary={{ label: "Join" }} />
    <StackCards />
  </MarketingPage>);
  const hero = container.querySelector<HTMLElement>(".marketing-hero")!;
  const shade = container.querySelector<HTMLElement>(".marketing-hero-shade")!;
  jest.spyOn(hero, "getBoundingClientRect").mockReturnValue({
    top: (top - 1) * window.innerHeight, height: window.innerHeight,
  } as DOMRect);
  const cards = container.querySelectorAll<HTMLElement>(".marketing-stack");
  jest.spyOn(cards[1], "getBoundingClientRect").mockReturnValue({ top: top * window.innerHeight } as DOMRect);
  act(() => { window.dispatchEvent(new Event("scroll")); paint(); });
  expect(shade.style.opacity).toBe(opacity);
  expect(cards[0].style.getPropertyValue("--stack-scale")).toBe(scale);
  expect(cards[0].style.getPropertyValue("--stack-rotate")).toBe(rotate);
  expect(cards[cards.length - 1].style.getPropertyValue("--stack-scale")).toBe("");
  unmount();
  expect(shade.style.opacity).toBe("");
  expect(cards[0].style.getPropertyValue("--stack-scale")).toBe("");
  expect(cards[0].style.getPropertyValue("--stack-rotate")).toBe("");
});

it("reveals section lines on entry with a stagger, then stops observing and cleans up", () => {
  let notify: (entries: Partial<IntersectionObserverEntry>[]) => void = () => {};
  const observer = { observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn() };
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    value: jest.fn((callback) => { notify = (entries) => callback(entries); return observer; }),
  });
  const cancel = jest.fn();
  const animate = jest.fn(() => ({ cancel }));
  Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
  const { container, unmount } = renderWithProviders(<MarketingPage><Statement line1="First line" line2="Second line" /></MarketingPage>);
  const group = container.querySelector("[data-reveal-group]");
  expect(observer.observe).toHaveBeenCalledWith(group);
  expect(animate).not.toHaveBeenCalled();
  act(() => notify([{ target: group!, isIntersecting: false }]));
  expect(animate).not.toHaveBeenCalled();
  act(() => notify([{ target: group!, isIntersecting: true }]));
  expect(animate).toHaveBeenCalledTimes(2);
  expect(animate).toHaveBeenNthCalledWith(1, expect.any(Array), expect.objectContaining({ delay: 0 }));
  expect(animate).toHaveBeenNthCalledWith(2, expect.any(Array), expect.objectContaining({ delay: 100 }));
  expect(observer.unobserve).toHaveBeenCalledWith(group);
  unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
  expect(cancel).toHaveBeenCalledTimes(2);
});
