/**
 * AdminDropRequestDetailPage — Publish stays disabled until required fields.
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import AdminDropRequestDetailPage from "./AdminDropRequestDetailPage";

const mockUseAdminDropRequest = jest.fn();
const mockUseAdminDrop = jest.fn();
const mockCreateDrop = jest.fn();
const mockPatchDrop = jest.fn();
let mockPending = false;

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminDropRequest: (...args: unknown[]) => mockUseAdminDropRequest(...args),
  useAdminDrop: (...args: unknown[]) => mockUseAdminDrop(...args),
  useCreateAdminDrop: () => ({
    mutateAsync: (...args: unknown[]) => mockCreateDrop(...args),
    isPending: mockPending,
  }),
  usePatchAdminDropConfig: () => ({
    mutateAsync: (...args: unknown[]) => mockPatchDrop(...args),
    isPending: mockPending,
  }),
  usePublishDrop: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

const now = Date.now();

const openTicket = {
  id: "req-1",
  brandId: "brand-1",
  brandName: "Acme",
  message: "Want a spring drop",
  notes: null,
  status: "received",
  convertedDropId: null as string | null,
  createdAt: now,
  updatedAt: now,
};

function linkedDrop(publishedAt: number | null) {
  return {
    id: "drop-1",
    brandId: "brand-1",
    brandName: "Acme",
    brandStatus: "approved",
    brandInstagramHandle: null,
    title: "Spring Drop",
    description: "Real campaign",
    image: "https://cdn.example.test/hero.png",
    location: "Bay Area",
    capacityTotal: 8,
    applyOpenAt: now + 86400000,
    applyCloseAt: now + 8 * 86400000,
    stage: "upcoming",
    needsTracking: false,
    totalProductUnits: null,
    campaignHashtag: null,
    wrappedAt: null,
    publishedAt,
    dropRequestId: "req-1",
    createdAt: now,
    allocatedUnits: 0,
    linkedPostCount: 0,
    pendingSuggestionCount: 0,
    applicants: [],
    trackerEvents: [],
    brandCanEditCreative: false,
  };
}

describe("AdminDropRequestDetailPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockPending = false;
    mockPatchDrop.mockReset();
    mockCreateDrop.mockReset();
    mockCreateDrop.mockResolvedValue({
      id: "drop-1",
      publishedAt: null,
    });
    mockUseAdminDropRequest.mockReturnValue({
      data: { ...openTicket },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: false,
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it("disables Publish until a draft exists with required fields", () => {
    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;

    expect(container.querySelector('[data-testid="publish-drop"]')).toBeNull();
    const stub = Array.from(container.querySelectorAll("button")).find(
      (el) => el.textContent === "Publish",
    ) as HTMLButtonElement | undefined;
    expect(stub).toBeTruthy();
    expect(stub!.disabled).toBe(true);

    const save = container.querySelector(
      '[data-testid="save-draft"]',
    ) as HTMLButtonElement | null;
    expect(save).toBeTruthy();
    expect(save!.disabled).toBe(true);
  });

  function setInput(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function fillRequired(container: HTMLElement, image: string) {
    setInput(
      container.querySelector('[data-testid="draft-title"]') as HTMLInputElement,
      "Spring Drop",
    );
    setInput(
      container.querySelector(
        '[data-testid="draft-description"]',
      ) as HTMLTextAreaElement,
      "Real campaign",
    );
    setInput(
      container.querySelector('[data-testid="draft-image"]') as HTMLInputElement,
      image,
    );
    setInput(
      container.querySelector('[data-testid="draft-location"]') as HTMLInputElement,
      "Bay Area",
    );
  }

  it("keeps Save draft disabled for http and placehold.co images", () => {
    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;

    const save = () =>
      container.querySelector('[data-testid="save-draft"]') as HTMLButtonElement;

    act(() => {
      fillRequired(container, "http://cdn.example.test/hero.png");
    });
    expect(save().disabled).toBe(true);

    act(() => {
      fillRequired(container, "https://placehold.co/600x400/png");
    });
    expect(save().disabled).toBe(true);

    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
    });
    expect(save().disabled).toBe(false);
  });

  it("enables Publish after Save draft returns a drop", async () => {
    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;

    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
    });
    const save = container.querySelector(
      '[data-testid="save-draft"]',
    ) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    await act(async () => {
      save.click();
    });

    const publish = container.querySelector(
      '[data-testid="publish-drop"]',
    ) as HTMLButtonElement | null;
    expect(publish).toBeTruthy();
    expect(publish!.disabled).toBe(false);
  });

  it("keeps draft-title / save-draft / publish-drop for an unpublished converted drop", () => {
    mockUseAdminDropRequest.mockReturnValue({
      data: {
        ...openTicket,
        status: "converted",
        convertedDropId: "drop-1",
      },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: linkedDrop(null),
      isPending: false,
      isError: false,
    });

    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;

    expect(container.querySelector('[data-testid="draft-title"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="save-draft"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="publish-drop"]')).toBeTruthy();
  });

  it("hides the draft form after publish and links to drop Config", () => {
    mockUseAdminDropRequest.mockReturnValue({
      data: {
        ...openTicket,
        status: "converted",
        convertedDropId: "drop-1",
      },
      isPending: false,
      isError: false,
    });
    mockUseAdminDrop.mockReturnValue({
      data: linkedDrop(now),
      isPending: false,
      isError: false,
    });

    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;

    expect(container.querySelector('[data-testid="draft-title"]')).toBeNull();
    expect(container.querySelector('[data-testid="save-draft"]')).toBeNull();
    expect(container.querySelector('[data-testid="publish-drop"]')).toBeNull();
    expect(container.querySelector('[data-testid="prefill-from-request"]')).toBeNull();
    const configLink = Array.from(container.querySelectorAll("a")).find((el) =>
      (el.getAttribute("href") ?? "").includes("tab=config"),
    );
    expect(configLink).toBeTruthy();
  });

  const field = (name: string) =>
    container.querySelector(`[data-testid="draft-${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
  const saveButton = () =>
    container.querySelector('[data-testid="save-draft"]') as HTMLButtonElement;
  const fieldTime = (name: string) => new Date(field(name).value).getTime();

  it.each(["title", "description", "image", "location", "capacity", "open-at", "close-at"])(
    "blocks saving when required %s is empty",
    (name) => {
      renderOpenTicket();
      act(() => fillRequired(container, "https://cdn.example.test/hero.png"));
      expect(saveButton().disabled).toBe(false);
      const blank = name === "capacity" || name.endsWith("-at") ? "" : "   ";
      act(() => setInput(field(name), blank));
      expect(saveButton().disabled).toBe(true);
      act(() => saveButton().click());
      expect(mockCreateDrop).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])("prefills and submits the shared form (edit=%s)", async (edit) => {
    jest.spyOn(Date, "now").mockReturnValue(now);
    const drop = {
      ...linkedDrop(null), totalProductUnits: 96, campaignHashtag: "testdrop",
      brandCanEditCreative: true,
    };
    if (edit) {
      mockUseAdminDrop.mockReturnValue({ data: drop, isPending: false, isError: false });
    }
    renderOpenTicket();
    const expectedValues = edit
      ? [drop.title, drop.description, drop.image, drop.location, "8", "96", "testdrop"]
      : ["", "", "", "", "10", "", ""];
    ["title", "description", "image", "location", "capacity", "units", "hashtag"].forEach(
      (name, index) => expect(field(name).value).toBe(expectedValues[index]),
    );
    const toggle = container.querySelector('[data-testid="draft-brand-can-edit"]')!;
    expect(toggle.getAttribute("aria-checked")).toBe(String(edit));
    expect(fieldTime("open-at")).toBe(Math.floor(drop.applyOpenAt / 60000) * 60000);
    expect(fieldTime("close-at")).toBe(Math.floor(drop.applyCloseAt / 60000) * 60000);
    expect(fieldTime("open-at")).toBeGreaterThan(Date.now());
    expect(fieldTime("close-at")).toBeGreaterThan(fieldTime("open-at"));
    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
      setInput(field("title"), "  Test Drop  ");
      setInput(field("capacity"), "12");
    });
    const expected = {
      title: "Test Drop", description: "Real campaign",
      image: "https://cdn.example.test/hero.png", location: "Bay Area", capacityTotal: 12,
      applyOpenAt: fieldTime("open-at"), applyCloseAt: fieldTime("close-at"),
      totalProductUnits: edit ? 96 : null, campaignHashtag: edit ? "testdrop" : null,
      brandCanEditCreative: edit,
    };
    await act(async () => { saveButton().click(); });
    expect(edit ? mockPatchDrop : mockCreateDrop).toHaveBeenCalledTimes(1);
    expect(edit ? mockPatchDrop : mockCreateDrop).toHaveBeenCalledWith(edit ? expected : {
      brandId: "brand-1", dropRequestId: "req-1", ...expected,
    });
    expect(edit ? mockCreateDrop : mockPatchDrop).not.toHaveBeenCalled();
  });

  it.each([
    { error: new Error("Save failed. Try again."), message: "Save failed. Try again." },
    { error: "unstructured failure", message: "Could not save draft." },
  ])("displays a save failure and allows retry: $message", async ({ error, message }) => {
    mockCreateDrop.mockRejectedValueOnce(error);
    renderOpenTicket();
    act(() => fillRequired(container, "https://cdn.example.test/hero.png"));
    await act(async () => { saveButton().click(); });
    expect(container.textContent).toContain(message);
    expect(saveButton().disabled).toBe(false);
    await act(async () => { saveButton().click(); });
    expect(mockCreateDrop).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain(message);
  });

  it("displays shared parser errors without sending a request", async () => {
    renderOpenTicket();
    act(() => {
      fillRequired(container, "https://cdn.example.test/hero.png");
      setInput(field("close-at"), field("open-at").value);
    });
    await act(async () => { saveButton().click(); });
    expect(container.textContent).toContain("Apply opens must be before apply closes.");
    expect(mockCreateDrop).not.toHaveBeenCalled();
  });

  it.each([false, true])("disables fields and actions while saving (edit=%s)", (edit) => {
    if (edit) {
      mockUseAdminDrop.mockReturnValue({
        data: linkedDrop(null), isPending: false, isError: false,
      });
    }
    const view = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1", path: "/admin/requests/:requestId",
    });
    container = view.container;
    act(() => fillRequired(container, "https://cdn.example.test/hero.png"));
    expect(saveButton().disabled).toBe(false);
    mockPending = true;
    view.rerender(<AdminDropRequestDetailPage />);
    expect(saveButton().textContent).toBe("Saving…");
    const controls = container.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>(
      "input, textarea, button",
    );
    controls.forEach((control) => expect(control.disabled).toBe(true));
    act(() => saveButton().click());
    expect(mockCreateDrop).not.toHaveBeenCalled();
    expect(mockPatchDrop).not.toHaveBeenCalled();
    mockPending = false;
    view.rerender(<AdminDropRequestDetailPage />);
    expect(saveButton().textContent).toBe("Save draft");
    expect(saveButton().disabled).toBe(false);
    expect(field("title").value).toBe("Spring Drop");
  });

  function renderOpenTicket() {
    container = renderWithProviders(<AdminDropRequestDetailPage />, {
      route: "/admin/requests/req-1",
      path: "/admin/requests/:requestId",
    }).container;
  }

  it("prefills the draft from the request and does not save", () => {
    mockUseAdminDropRequest.mockReturnValue({
      data: {
        ...openTicket,
        title: "Fall Cold Brew",
        product: "Cans",
        location: "Bay Area",
        campaignHashtag: "FallBrew",
        orgCount: 8,
        unitsPerOrg: 24,
      },
      isPending: false,
      isError: false,
    });
    renderOpenTicket();

    const prefill = container.querySelector(
      '[data-testid="prefill-from-request"]',
    ) as HTMLButtonElement;
    expect(prefill).toBeTruthy();
    act(() => {
      prefill.click();
    });

    const value = (testId: string) =>
      (container.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | HTMLTextAreaElement)
        .value;
    expect(value("draft-title")).toBe("Fall Cold Brew");
    expect(value("draft-description")).toBe("");
    expect(value("draft-location")).toBe("Bay Area");
    expect(value("draft-hashtag")).toBe("FallBrew");
    expect(value("draft-capacity")).toBe("8");
    expect(value("draft-units")).toBe("192");
    expect(mockCreateDrop).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Nothing is saved until you save the draft");
  });

  it("leaves capacity and units alone when the request has no scale", () => {
    renderOpenTicket();
    const prefill = container.querySelector(
      '[data-testid="prefill-from-request"]',
    ) as HTMLButtonElement;
    act(() => {
      prefill.click();
    });
    const capacity = container.querySelector(
      '[data-testid="draft-capacity"]',
    ) as HTMLInputElement;
    const units = container.querySelector(
      '[data-testid="draft-units"]',
    ) as HTMLInputElement;
    expect(capacity.value).toBe("10");
    expect(units.value).toBe("");
    expect(
      (container.querySelector('[data-testid="draft-description"]') as HTMLTextAreaElement)
        .value,
    ).toBe("");
    expect(mockCreateDrop).not.toHaveBeenCalled();
  });
});
