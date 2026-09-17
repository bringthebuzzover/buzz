/**
 * PublicDropPage — restore_failed still shows the drop (acquisition URL).
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const mockUseAuth = jest.fn();
const mockUseDropDetail = jest.fn();

jest.mock("../../contexts/AuthContext", () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

jest.mock("../../api/hooks/useDropHooks", () => ({
  useDropDetail: (...args: unknown[]) => mockUseDropDetail(...args),
  usePatchDropIntent: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

import PublicDropPage from "./PublicDropPage";

const now = Date.now();
const DROP_ID = "00000000-0000-0000-0000-000000000063";

function openDrop() {
  return {
    id: DROP_ID,
    brandName: "Acme",
    title: "Spring Drop",
    description: "Campaign copy",
    image: "https://cdn.example.test/hero.png",
    location: "Bay Area",
    capacityTotal: 8,
    acceptedCount: 0,
    applyOpenAt: now - 86_400_000,
    applyCloseAt: now + 7 * 86_400_000,
    manualReopen: false,
    applicantSelectionFinalizedAt: null,
  };
}

describe("PublicDropPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockUseAuth.mockReset();
    mockUseDropDetail.mockReset();
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

  it("still shows the drop when session restore failed", () => {
    mockUseAuth.mockReturnValue({
      status: "restore_failed",
      user: null,
      login: jest.fn(),
      retryRestore: jest.fn(),
      abandonRestore: jest.fn(),
    });
    mockUseDropDetail.mockReturnValue({
      isLoading: false,
      isError: false,
      error: null,
      data: openDrop(),
    });

    act(() => {
      root.render(
        <MemoryRouter initialEntries={[`/d/${DROP_ID}`]}>
          <Routes>
            <Route path="/d/:dropId" element={<PublicDropPage />} />
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Spring Drop");
    expect(container.querySelector('[data-testid="session-restore-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="auth-shell"]')).toBeNull();
    expect(container.textContent).not.toMatch(/Request to join Buzz and apply/);
  });
});
