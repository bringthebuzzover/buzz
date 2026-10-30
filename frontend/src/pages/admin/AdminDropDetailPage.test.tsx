/**
 * AdminDropDetailPage — Config is default for drafts; applicants for published.
 */
import { act } from "react";
import { renderWithProviders } from "../../testUtils";
import AdminDropDetailPage from "./AdminDropDetailPage";

const idleMutation = () => ({
  mutate: jest.fn(),
  mutateAsync: jest.fn().mockResolvedValue({}),
  isPending: false,
});

const mockUseAdminDrop = jest.fn();
const mockDecide = jest.fn().mockResolvedValue({});
const mockSetWrapped = jest.fn();
const mockPatch = jest.fn().mockResolvedValue({});

jest.mock("../../api/hooks/useAdminHooks", () => ({
  useAdminDrop: (...args: unknown[]) => mockUseAdminDrop(...args),
  usePatchAdminDropConfig: () => ({ ...idleMutation(), mutateAsync: mockPatch }),
  usePublishDrop: () => idleMutation(),
  useAddApplicantShipment: () => idleMutation(),
  useDeleteApplicantShipment: () => idleMutation(),
  useSetAdminSeatDecision: () => ({ ...idleMutation(), mutateAsync: mockDecide }),
  useSendAdminDecisions: () => idleMutation(),
  useSetDropWrapped: () => ({ ...idleMutation(), mutateAsync: mockSetWrapped }),
  useHideDrop: () => idleMutation(),
  useDeleteSeat: () => idleMutation(),
  useCancelDrop: () => idleMutation(),
  useSetApplicantDelivered: () => idleMutation(),
  useUnhideDrop: () => idleMutation(),
  useAdminOrgs: () => ({ data: [], isPending: false, isError: false }),
  useAddOrgToDrop: () => idleMutation(),
  useSyncAndAutolink: () => idleMutation(),
}));

const now = Date.now();

function adminDrop(overrides: Record<string, unknown> = {}) {
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
    applyOpenAt: now,
    applyCloseAt: now + 7 * 24 * 60 * 60 * 1000,
    stage: "draft",
    needsTracking: false,
    totalProductUnits: null,
    campaignHashtag: null,
    wrappedAt: null,
    publishedAt: null,
    hiddenAt: null,
    dropRequestId: null,
    createdAt: now,
    allocatedUnits: 0,
    linkedPostCount: 0,
    pendingSuggestionCount: 0,
    applicants: [],
    intents: [],
    trackerEvents: [],
    brandCanEditCreative: false,
    ...overrides,
  };
}

describe("AdminDropDetailPage", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockUseAdminDrop.mockReset();
  });

  function renderAt(path: string) {
    container = renderWithProviders(<AdminDropDetailPage />, {
      route: path,
      path: "/admin/drops/:dropId",
    }).container;
  }

  it("defaults to Config for an unpublished draft and shows who-can-edit", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: null }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(
      container.querySelector('[data-testid="tab-config"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="tab-tracker"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="drop-wrap"]')).toBeNull();
    expect(container.textContent).toContain("Campaign");
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeTruthy();
    expect(
      container.querySelector('[data-testid="save-drop-config"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeFalsy();
    const hero = container.querySelector(
      'img[src="https://cdn.example.test/hero.png"]',
    );
    expect(hero?.parentElement?.className).toContain("aspect-video");
    expect(container.querySelector("#drop-config-description")).toBeTruthy();
  });

  it("drafts a per-seat decision on Applicants", async () => {
    mockDecide.mockClear();
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        stage: "selecting",
        applyCloseAt: now - 60_000,
        applicants: [
          {
            id: "app-1",
            orgId: "org-1",
            userId: "user-1",
            orgName: "Theta",
            university: "Cornell",
            instagramHandle: "theta",
            followerCount: 10,
            deliveryAddress: null,
            shippingCity: null,
            shippingState: null,
            accountErased: false,
            decision: "applied",
            allocatedUnits: null,
            pitch: null,
            shipments: [],
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: null,
            decisionSentAt: null,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    const select = container.querySelector(
      '[data-testid="decision-app-1"]',
    ) as HTMLSelectElement;
    expect(select.value).toBe("applied");
    await act(async () => {
      select.value = "accepted";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(mockDecide).toHaveBeenCalledWith({
      applicationId: "app-1",
      decision: "accepted",
      allocatedUnits: null,
    });
    expect(
      (container.querySelector('[data-testid="send-decisions"]') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("marks an unsent acceptance and holds tracking until it is sent", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        stage: "selecting",
        applicants: [
          {
            id: "app-1",
            orgId: "org-1",
            userId: "user-1",
            orgName: "Theta",
            university: "Cornell",
            instagramHandle: "theta",
            followerCount: 10,
            deliveryAddress: null,
            shippingCity: null,
            shippingState: null,
            accountErased: false,
            decision: "accepted",
            allocatedUnits: null,
            pitch: null,
            shipments: [],
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: now,
            decisionSentAt: null,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");
    expect(container.textContent).toContain("Not sent");
    expect(container.textContent).toContain("Ready to send: accept 1 · deny 0");
    expect(container.textContent).toContain("Address pending");
    expect(container.querySelector('[data-testid="shipping-app-1"]')).toBeNull();
    expect(
      (container.querySelector('[data-testid="send-decisions"]') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("defaults to Applicants for a published drop; Config holds the checkbox", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "selecting" }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(
      container.querySelector('[data-testid="tab-applicants"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="add-org-open"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="send-decisions"]')).toBeTruthy();
    expect(container.textContent).toContain("Signup intents (not applicants)");
    expect(container.querySelector('[data-testid="copy-public-drop-url"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeNull();

    const configTab = container.querySelector(
      '[data-testid="tab-config"]',
    ) as HTMLButtonElement;
    expect(configTab).toBeTruthy();
    act(() => {
      configTab.click();
    });
    expect(
      container.querySelector('[data-testid="brand-can-edit-creative"]'),
    ).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop-confirm"]')).toBeNull();
    expect(container.querySelector('[data-testid="drop-unhide"]')).toBeFalsy();

    const trackerTab = container.querySelector(
      '[data-testid="tab-tracker"]',
    ) as HTMLButtonElement;
    act(() => {
      trackerTab.click();
    });
    expect(container.querySelector('[data-testid="drop-wrap"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="drop-unwrap"]')).toBeNull();

    // The wrap confirm says who gets emailed.
    act(() => {
      (container.querySelector('[data-testid="drop-wrap"]') as HTMLButtonElement).click();
    });
    expect(document.body.textContent).toContain('emailed "not selected"');
  });

  it("keeps a failed wrap in the dialog and closes after retry", async () => {
    mockSetWrapped.mockRejectedValueOnce(new Error("Internal failure")).mockResolvedValueOnce({});
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "live" }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=tracker");
    act(() => (container.querySelector('[data-testid="drop-wrap"]') as HTMLButtonElement).click());
    await act(async () => {
      (document.querySelector('[data-testid="drop-wrap-confirm"]') as HTMLButtonElement).click();
    });
    expect(document.querySelector('[role="dialog"] [role="alert"]')?.textContent)
      .toBe("Could not update the drop.");
    await act(async () => {
      (document.querySelector('[data-testid="drop-wrap-confirm"]') as HTMLButtonElement).click();
    });
    expect(mockSetWrapped).toHaveBeenLastCalledWith(true);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows follower count and city/state, with the full address in the shipments modal", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        applicants: [
          {
            id: "app-1",
            orgId: "org-1",
            userId: "user-1",
            orgName: "Theta",
            university: "Berkeley",
            instagramHandle: "theta",
            followerCount: 1262,
            deliveryAddress: "2301 Bancroft Way, Berkeley, CA 94720",
            shippingCity: "Berkeley",
            shippingState: "CA",
            accountErased: false,
            decision: "accepted",
            allocatedUnits: 2,
            pitch: null,
            shipments: [],
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: now,
            decisionSentAt: now,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(container.textContent).toContain("Followers");
    expect(container.textContent).toContain("1.3K");
    expect(container.textContent).toContain("Berkeley, CA");
    expect(container.textContent).not.toContain("2301 Bancroft Way");
    expect(container.querySelector('[data-testid="add-shipment-app-1"]')).toBeNull();

    act(() => {
      (container.querySelector('[data-testid="shipping-app-1"]') as HTMLButtonElement).click();
    });
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.textContent).toContain("Shipments · Theta");
    expect(dialog.textContent).toContain("2301 Bancroft Way");
    const add = document.querySelector('[data-testid="add-shipment-app-1"]') as HTMLButtonElement;
    expect(add.disabled).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows an erased org as a frozen participant with delete only", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        applicants: [
          {
            id: "app-2",
            orgId: "org-2",
            userId: "user-2",
            orgName: "Deleted organization",
            university: "",
            metricsFrozenAt: now,
            instagramHandle: null,
            followerCount: 100,
            deliveryAddress: null,
            shippingCity: null,
            shippingState: null,
            accountErased: true,
            decision: "denied",
            allocatedUnits: null,
            pitch: null,
            shipments: [],
            linkedPostCount: 0,
            appliedAt: now,
            decisionAt: now,
            decisionSentAt: now,
          },
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(container.textContent).toContain("Deleted organization");
    expect(container.textContent).toContain("Metrics frozen");
    expect(container.textContent).not.toContain("Cornell University");
    expect(container.textContent).not.toContain("Account deleted");
    expect(container.querySelector('[data-testid="delete-seat-app-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="end-seat-app-2"]')).toBeNull();
  });

  function seat(overrides: Record<string, unknown> = {}) {
    return {
      id: "app-3",
      orgId: "org-3",
      userId: "user-3",
      orgName: "Kappa",
      university: "Duke",
      instagramHandle: "kappa",
      followerCount: 10,
      deliveryAddress: null,
      shippingCity: null,
      shippingState: null,
      accountErased: false,
      decision: "accepted",
      allocatedUnits: null,
      pitch: null,
      shipments: [],
      linkedPostCount: 0,
      appliedAt: now,
      decisionAt: now,
      decisionSentAt: now,
      addedBy: "apply",
      deliveredAt: null,
      endReason: null,
      ...overrides,
    };
  }

  it("ends a seat with a reason, and shows ended seats as read-only", async () => {
    mockDecide.mockClear();
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({
        publishedAt: now,
        stage: "live",
        applicants: [
          seat({ addedBy: "late_add" }),
          seat({ id: "app-4", decision: "removed", endReason: "No posts" }),
        ],
      }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    expect(container.textContent).toContain("Late add");
    expect(container.querySelector('[data-testid="decision-app-4"]')).toBeNull();
    expect(container.textContent).toContain("No posts");
    expect(container.querySelector('[data-testid="end-seat-app-4"]')).toBeNull();
    expect(container.querySelector('[data-testid="shipping-app-3"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="shipping-app-4"]')).toBeNull();

    act(() => {
      (container.querySelector('[data-testid="end-seat-app-3"]') as HTMLButtonElement).click();
    });
    const reason = document.querySelector(
      '[data-testid="end-reason-app-3"]',
    ) as HTMLTextAreaElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(reason, "Missed the deadline");
      reason.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      (
        document.querySelector('[data-testid="end-seat-submit-app-3"]') as HTMLButtonElement
      ).click();
    });
    expect(mockDecide).toHaveBeenCalledWith({
      applicationId: "app-3",
      decision: "removed",
      allocatedUnits: null,
      reason: "Missed the deadline",
    });
  });

  const pkg = (id: string) => ({ id, trackingNumber: id, carrier: "ups", trackUrl: null });
  it.each([
    [{}, "Not shipped"],
    [{ shipments: [pkg("s1")] }, "Shipped · 1 package"],
    [{ shipments: [pkg("s1"), pkg("s2")] }, "Shipped · 2 packages"],
    [{ deliveredAt: now }, "Delivered ·"],
  ])("shows the live seat's shipping chip (%#)", (overrides, label) => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "live", applicants: [seat(overrides)] }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");
    const chip = container.querySelector('[data-testid="shipping-app-3"]') as HTMLButtonElement;
    expect(chip.textContent).toContain(label);
    // The accessible name starts with the visible label (label-in-name).
    expect(chip.getAttribute("aria-label")).toMatch(new RegExp(`^${label}.* – shipments for Kappa$`));
  });

  it("offers cancel on a running drop and shows a canceled drop as final", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "live" }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=tracker");
    expect(container.querySelector('[data-testid="drop-cancel"]')).toBeTruthy();

    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "canceled", canceledAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=tracker");
    expect(container.querySelector('[data-testid="drop-canceled"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="drop-cancel"]')).toBeNull();
    expect(container.querySelector('[data-testid="drop-wrap"]')).toBeNull();
  });

  it("opens a hide dialog that asks the admin to type the drop title", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    const trigger = container.querySelector(
      '[data-testid="hide-drop"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    const input = document.querySelector(
      '[data-testid="hide-drop-confirm"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(document.body.textContent).toContain("Type the drop title to confirm");
    const submit = document.querySelector(
      '[data-testid="hide-drop-submit"]',
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const setValue = (value: string) => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    act(() => {
      setValue("hide");
    });
    expect(submit.disabled).toBe(true);
    act(() => {
      setValue("  Spring Drop  ");
    });
    expect(submit.disabled).toBe(false);
  });

  it("clears the brand-email checkbox when the hide dialog is dismissed", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");

    const trigger = container.querySelector(
      '[data-testid="hide-drop"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    const box = document.querySelector(
      '[data-testid="hide-drop-notify-brand"]',
    ) as HTMLInputElement;
    expect(box.checked).toBe(false);
    act(() => {
      box.click();
    });
    expect(box.checked).toBe(true);
    const cancel = Array.from(document.querySelectorAll("button")).find(
      (el) => el.textContent === "Cancel",
    ) as HTMLButtonElement;
    act(() => {
      cancel.click();
    });
    act(() => {
      trigger.click();
    });
    const reopened = document.querySelector(
      '[data-testid="hide-drop-notify-brand"]',
    ) as HTMLInputElement;
    expect(reopened.checked).toBe(false);
  });

  it("shows unhide when the drop is hidden", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, hiddenAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");
    expect(container.querySelector('[data-testid="drop-unhide"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="hide-drop"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="add-org-open"]')).toBeFalsy();
  });

  it("shows sync-and-autolink on a live drop", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "live" }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=attribution");
    expect(
      container.querySelector('[data-testid="sync-and-autolink"]'),
    ).toBeTruthy();
  });

  it("shows sync-and-autolink on a wrapped drop", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "wrapped", wrappedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=attribution");
    expect(
      container.querySelector('[data-testid="sync-and-autolink"]'),
    ).toBeTruthy();
  });

  it("keeps late-add on a wrapped drop and offers unwrap", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "wrapped", wrappedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1");
    expect(container.querySelector('[data-testid="add-org-open"]')).toBeTruthy();
    act(() => {
      (container.querySelector('[data-testid="tab-tracker"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="drop-unwrap"]')).toBeTruthy();
  });

  it("leaves only the copy editable on a wrapped drop", () => {
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, stage: "wrapped", wrappedAt: now }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=config");
    expect(container.textContent).toContain("only the copy and location can change");
    const disabled = (id: string) =>
      (container.querySelector(`#${id}`) as HTMLInputElement | null)?.disabled;
    expect(disabled("drop-config-title")).toBe(false);
    expect(disabled("drop-config-location")).toBe(false);
    expect(disabled("drop-config-capacity")).toBe(true);
    expect(disabled("drop-config-hashtag")).toBe(true);
    expect(disabled("drop-config-close-at")).toBe(true);
  });

  const typeInto = (input: HTMLInputElement, value: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  it.each([
    ["only the changed field", {}, ["drop-config-title", "New title"], { title: "New title" }],
    [
      "only the edited date",
      {},
      ["drop-config-close-at", "2030-01-02T10:00"],
      { applyCloseAt: new Date("2030-01-02T10:00").getTime() },
    ],
    ["null when units are cleared", { totalProductUnits: 40 }, null, { totalProductUnits: null }],
  ] as const)("Config save sends %s", async (_name, overrides, edit, expected) => {
    mockPatch.mockClear();
    mockUseAdminDrop.mockReturnValue({
      data: adminDrop({ publishedAt: now, ...overrides }),
      isPending: false,
      isError: false,
    });
    renderAt("/admin/drops/drop-1?tab=config");
    act(() => {
      if (edit) {
        typeInto(container.querySelector(`#${edit[0]}`) as HTMLInputElement, edit[1]);
      } else {
        const clear = [...container.querySelectorAll("label")].find((l) =>
          l.textContent?.includes("Clear to spot-only"),
        );
        clear?.querySelector("input")?.click();
      }
    });
    await act(async () =>
      (container.querySelector('[data-testid="save-drop-config"]') as HTMLButtonElement).click(),
    );
    expect(mockPatch).toHaveBeenCalledWith(expected);
  });

  it("does not patch when nothing changed", async () => {
    mockPatch.mockClear();
    mockUseAdminDrop.mockReturnValue({ data: adminDrop(), isPending: false, isError: false });
    renderAt("/admin/drops/drop-1?tab=config");
    await act(async () =>
      (container.querySelector('[data-testid="save-drop-config"]') as HTMLButtonElement).click(),
    );
    expect(mockPatch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("No changes to save.");
  });
});
