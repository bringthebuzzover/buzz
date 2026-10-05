/**
 * Creator journey gates: apply leaves the creator pending, pending and denied
 * creators cannot reach the feed, and only an approved, connected creator can
 * apply to a Drop.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { actions, getState, resetCreatorMock } from "../../api/hooks/creator/mockCreatorStore";
import type { CreatorStatus } from "../../api/hooks/creator/types";
import CreatorApplyPage from "./CreatorApplyPage";
import CreatorCampaignsPage from "./CreatorCampaignsPage";
import CreatorConnectPage from "./CreatorConnectPage";
import CreatorFeedPage from "./CreatorFeedPage";
import CreatorPendingPage from "./CreatorPendingPage";
import CreatorStatusGate from "./CreatorStatusGate";
import CreatorVerifyPage from "./CreatorVerifyPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const ROUTES: [string, (CreatorStatus | null)[], JSX.Element][] = [
  ["/creators/apply", [null], <CreatorApplyPage />],
  ["/creators/verify", ["pending_email"], <CreatorVerifyPage />],
  ["/creators/pending", ["pending_review", "denied"], <CreatorPendingPage />],
  ["/creators/connect", ["pending_instagram"], <CreatorConnectPage />],
  ["/creators/feed", ["active"], <CreatorFeedPage />],
  ["/creators/campaigns", ["active"], <CreatorCampaignsPage />],
];

function Harness({ at }: { at: string }) {
  return (
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        {ROUTES.map(([path, allow, element]) => (
          <Route
            key={path}
            path={path}
            element={<CreatorStatusGate allow={allow}>{element}</CreatorStatusGate>}
          />
        ))}
      </Routes>
    </MemoryRouter>
  );
}

function type(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  expect(input).not.toBeNull();
  const proto =
    input instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  act(() => {
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(container: HTMLElement, label: RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((el) =>
    label.test(el.textContent ?? ""),
  );
  expect(button).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

const viewerId = () => getState().viewerId as string;

describe("creator journey", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (at: string) => {
    act(() => {
      root.render(<Harness key={at} at={at} />);
    });
  };

  beforeEach(() => {
    resetCreatorMock();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("sends a guest on the feed to apply", () => {
    render("/creators/feed");
    expect(container.textContent).toMatch(/Apply as a creator/);
  });

  it("leaves a new applicant pending and off the feed", () => {
    render("/creators/apply");
    click(container, /Submit application/);
    expect(container.textContent).toMatch(/Fix the highlighted fields/);

    type(container, "name", "Jacey Park");
    type(container, "school", "Cornell University");
    type(container, "eduEmail", "jacey@cornell.edu");
    type(container, "claimedHandle", "jaceyonbudget");
    click(container, /^Personal finance$/);
    click(container, /Submit application/);
    expect(container.textContent).toMatch(/Check your campus email/);
    expect(container.textContent).toMatch(/jacey@cornell\.edu/);

    click(container, /Open verification link/);
    expect(container.textContent).toMatch(/Awaiting Approval/);

    render("/creators/feed");
    expect(container.textContent).toMatch(/Awaiting Approval/);
    expect(container.textContent).not.toMatch(/Finals Week Reel/);

    render("/creators/campaigns");
    expect(container.textContent).toMatch(/Awaiting Approval/);
  });

  it("keeps a denied creator on the pending screen", () => {
    act(() => {
      actions.apply({
        name: "Sam",
        school: "UCLA",
        city: "",
        gradYear: "",
        eduEmail: "sam@ucla.edu",
        claimedHandle: "@sam",
        niches: ["Tech"],
        bio: "",
        tiktokHandle: "",
        openTo: [],
      });
      actions.confirmEmail();
      actions.reviewCreator(viewerId(), false);
    });
    render("/creators/feed");
    expect(container.textContent).toMatch(/not approved/);
  });

  it("lets an approved creator connect, apply, and see zero earnings", () => {
    act(() => {
      actions.apply({
        name: "Jacey",
        school: "Cornell University",
        city: "",
        gradYear: "",
        eduEmail: "jacey@cornell.edu",
        claimedHandle: "@jaceyonbudget",
        niches: ["Personal finance"],
        bio: "",
        tiktokHandle: "",
        openTo: [],
      });
      actions.confirmEmail();
      actions.reviewCreator(viewerId(), true);
    });
    render("/creators/feed");
    expect(container.textContent).toMatch(/Connect @jaceyonbudget/);

    click(container, /Connect Instagram/);
    expect(container.textContent).toMatch(/Finals Week Reel/);

    click(container, /^Apply$/);
    type(container, "pitch-drop-update", "A Reel of my study routine.");
    click(container, /Submit application/);
    expect(container.textContent).toMatch(/Applied/);

    render("/creators/campaigns");
    expect(container.textContent).toMatch(/A Reel of my study routine\./);
    expect(container.textContent).toMatch(/Paid\$0/);
    expect(container.textContent).toMatch(/Pending\$0/);
  });
});
