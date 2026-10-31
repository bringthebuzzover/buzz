/* eslint-disable testing-library/no-container -- The shared harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { COLLEGES } from "../../data/colleges";
import Marquee from "./Marquee";

const originalResizeObserver = window.ResizeObserver;
const originalMatchMedia = window.matchMedia;
let reduced = false;
let resize: () => void;
const observer = { observe: jest.fn(), disconnect: jest.fn() };
const ResizeObserverMock = jest.fn();

beforeEach(() => {
  reduced = false;
  ResizeObserverMock.mockImplementation((callback: () => void) => { resize = callback; return observer; });
  Object.defineProperty(window, "ResizeObserver", { configurable: true, value: ResizeObserverMock });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: () => ({ matches: reduced, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(window, "ResizeObserver", { configurable: true, value: originalResizeObserver });
  Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
});

it.each([false, true])("keeps the marquee at 32px/s after resizing with reverse %s", (reverse) => {
  const width = jest.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(640);
  const { container, unmount } = renderWithProviders(<Marquee items={COLLEGES} title="College network" reverse={reverse} />);
  const track = container.querySelector<HTMLElement>('[style*="animation-duration"]');
  expect(track?.style.animationDuration).toBe("10s");
  expect(observer.observe).toHaveBeenCalledWith(track);
  width.mockReturnValue(1280);
  act(() => resize());
  expect(track?.style.animationDuration).toBe("20s");
  unmount();
  expect(observer.disconnect).toHaveBeenCalledTimes(1);
});

it("shows one static set of logos without measuring under reduced motion", () => {
  reduced = true;
  const width = jest.spyOn(HTMLElement.prototype, "scrollWidth", "get");
  const { container } = renderWithProviders(<Marquee items={COLLEGES} title="College network" />);
  expect(container.querySelectorAll("img")).toHaveLength(COLLEGES.length);
  expect(container.querySelector('[style*="animation-duration"]')).toBeNull();
  expect(width).not.toHaveBeenCalled();
  expect(ResizeObserverMock).not.toHaveBeenCalled();
});
