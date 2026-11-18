/** The brand stepper says what a draft is and asks the brand to choose at close. */
import { renderToString } from "react-dom/server";
import BrandDropTrackerStepper from "./BrandDropTrackerStepper";

const closed = Date.UTC(2026, 10, 10, 12);

describe("BrandDropTrackerStepper", () => {
  it("labels a draft as not published", () => {
    const html = renderToString(
      <BrandDropTrackerStepper currentStage="draft" applyCloseAt={closed} />,
    );
    expect(html).toContain("Draft — not published");
    expect(html).not.toContain("Choose your orgs");
  });

  it("asks the brand to choose its orgs in Selecting, with the BUZZ step-in date", () => {
    const html = renderToString(
      <BrandDropTrackerStepper currentStage="selecting" applyCloseAt={closed} />,
    );
    expect(html).toContain("Choose your orgs");
    expect(html).toContain("Nov 10");
    expect(html).toContain("Nov 15");
  });
});
