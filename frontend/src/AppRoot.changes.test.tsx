import { useLocation } from "react-router-dom";
import { renderWithProviders } from "./testUtils";
import AppRoot from "./AppRoot";

jest.mock("./contexts/AuthContext", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "admin-1", portalRole: "admin", status: "active" },
    logout: jest.fn(),
  }),
}));

jest.mock("./api/hooks/useAdminHooks", () => ({
  useAdminOverview: () => ({ data: { queues: [] } }),
  useAdminIgChangeRequests: () => ({ data: [] }),
  useAdminBrandIgChangeRequests: () => ({ data: [] }),
  useAdminShippingChangeRequests: () => ({ data: [] }),
}));

jest.mock("./pages/admin/AdminIgChangeRequestDetailPage", () => () => <h1>Instagram request</h1>);

function CurrentLocation() {
  const location = useLocation();
  return <output>{location.pathname}{location.search}</output>;
}

it("redirects a legacy Instagram request URL to its shared changes detail route", () => {
  renderWithProviders(<><AppRoot /><CurrentLocation /></>, {
    route: "/admin/ig-changes/request-1?status=pending",
  });
  expect(document.querySelector("output")?.textContent).toBe("/admin/changes/ig/request-1?status=pending");
  expect(document.querySelector("h1")?.textContent).toBe("Instagram request");
});

it.each([
  ["/admin/changes?type=brand&status=pending", "/admin/changes?status=pending&account=brand"],
  ["/admin/ig-changes?type=organization", "/admin/changes?account=organization"],
  ["/admin/changes?type=brand&account=organization", "/admin/changes?account=organization"],
])("translates the legacy account filter at %s", (route, expected) => {
  renderWithProviders(<><AppRoot /><CurrentLocation /></>, { route });
  expect(document.querySelector("output")?.textContent).toBe(expected);
  expect(document.querySelector("h1")?.textContent).toBe("Changes");
});
