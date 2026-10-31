/* eslint-disable testing-library/no-container -- The repository harness uses React DOM; Testing Library is not installed. */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import { CollegeNetwork } from "./CollegeNetwork";
import { MarketingPage } from "./MarketingPage";
import { MarketingHero, Statement } from "./sections";

let changeMotion: () => void;
let reduced = false;

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
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
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
  const { container } = renderWithProviders(
    <MarketingPage>
      <Statement line1="First line" line2="Second line" />
    </MarketingPage>,
  );
  expect(container.textContent).toBe("First lineSecond line");
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
