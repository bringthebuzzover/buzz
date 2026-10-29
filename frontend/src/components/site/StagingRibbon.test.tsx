import { renderWithProviders } from "../../testUtils";

function renderRibbon(env: string | undefined) {
  const previous = process.env.REACT_APP_ENV;
  if (env === undefined) delete process.env.REACT_APP_ENV;
  else process.env.REACT_APP_ENV = env;

  let StagingRibbon!: typeof import("./StagingRibbon").default;
  jest.isolateModules(() => {
    StagingRibbon = require("./StagingRibbon").default;
  });
  const { container, unmount } = renderWithProviders(<StagingRibbon />);
  const restore = () => {
    unmount();
    if (previous === undefined) delete process.env.REACT_APP_ENV;
    else process.env.REACT_APP_ENV = previous;
  };
  return { container, restore };
}

describe("StagingRibbon", () => {
  it("is hidden unless the build env is staging", () => {
    const hidden = renderRibbon(undefined);
    expect(hidden.container.querySelector("[data-testid='staging-ribbon']")).toBeNull();
    hidden.restore();

    const prod = renderRibbon("production");
    expect(prod.container.querySelector("[data-testid='staging-ribbon']")).toBeNull();
    prod.restore();

    const staging = renderRibbon("staging");
    expect(staging.container.textContent).toMatch(/staging/i);
    staging.restore();
  });
});
