import { act } from "react";
import { Link, Route, Routes } from "react-router-dom";
import { renderWithProviders } from "../../testUtils";
import { ScrollToTop } from "./ScrollToTop";

describe("ScrollToTop", () => {
  it("resets scroll position to (0, 0) upon mount and subsequent route transitions", () => {
    const scrollToSpy = jest.spyOn(window, "scrollTo").mockImplementation(() => {});

    function TestApp() {
      return (
        <>
          <ScrollToTop />
          <nav>
            <Link to="/target">Go to Target</Link>
          </nav>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route path="/target" element={<div>Target Page</div>} />
          </Routes>
        </>
      );
    }

    const { container } = renderWithProviders(<TestApp />);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
    expect(scrollToSpy).toHaveBeenCalledTimes(1);

    const link = container.querySelector("a");
    act(() => {
      link?.click();
    });

    expect(scrollToSpy).toHaveBeenCalledTimes(2);
    expect(scrollToSpy).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "instant" });

    scrollToSpy.mockRestore();
  });
});
