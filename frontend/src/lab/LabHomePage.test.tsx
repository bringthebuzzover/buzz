import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../contexts/AuthContext";
import LabShell from "./LabShell";

function renderAt(path: string): string {
  const queryClient = new QueryClient();
  return renderToString(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <LabShell />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("LabShell", () => {
  it("lands the directory on / and /lab", () => {
    for (const path of ["/", "/lab"]) {
      const html = renderAt(path);
      expect(html).toContain("Design preview");
      expect(html).toContain("BUZZ Lab");
      expect(html).toContain("Pulse 2");
      expect(html).toContain("Frozen");
      expect(html).toContain("Mockup");
      expect(html).toContain("/lab/drop-editor/?mode=brand");
      expect(html).toContain('href="/pulse2"');
      expect(html).not.toContain("pages.dev/pulse2");
      expect(html).not.toContain("404s");
      expect(html).toContain("https://github.com/bringthebuzzover/buzz/pull/20");
      expect(html).not.toContain("Our College Network");
    }
  });

  it("keeps other routes on the app and still shows the badge", () => {
    const html = renderAt("/inspo");
    expect(html).toContain("Design preview");
    expect(html).toContain("Tap into Gen Z");
    expect(html).not.toContain("lab-grid");
  });

  it("serves /pulse2 from the app", () => {
    const html = renderAt("/pulse2");
    expect(html).toContain("Design preview");
    expect(html).toContain("pulse2-display");
    expect(html).not.toContain("lab-grid");
  });
});
