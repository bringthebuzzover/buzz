import fs from "fs";
import path from "path";
import {
  LAB_PAGES_PROJECT,
  LAB_STATUSES,
  branchAlias,
  branchPreviewUrl,
  isLabDirectoryPath,
  labEntries,
} from "./labEntries";

describe("lab directory data", () => {
  it("uses the Cloudflare branch-alias rules", () => {
    expect(branchAlias("fix/api")).toBe("fix-api");
    expect(branchAlias("cursor/pulse-yellow-black-2572")).toBe(
      "cursor-pulse-yellow-black-2572",
    );
    expect(
      branchPreviewUrl("cursor/pulse-yellow-black-2572", "/pulse2"),
    ).toBe(
      `https://cursor-pulse-yellow-black-2572.${LAB_PAGES_PROJECT}.pages.dev/pulse2`,
    );
  });

  it("lists each seeded design once, with a known status", () => {
    const ids = labEntries.map((entry) => entry.id);
    expect(ids).toEqual([
      "pulse",
      "pulse2",
      "inspo",
      "drop-editor",
      "logo-options",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of labEntries) {
      expect(LAB_STATUSES).toContain(entry.status);
      expect(entry.note.length).toBeGreaterThan(0);
      expect(entry.href.startsWith("/")).toBe(true);
    }
  });

  it("points Pulse 2 at PR 20 and the pulse branch preview", () => {
    const pulse2 = labEntries.find((entry) => entry.id === "pulse2");
    expect(pulse2?.status).toBe("Live");
    expect(pulse2?.prUrl).toBe(
      "https://github.com/bringthebuzzover/buzz/pull/20",
    );
    expect(pulse2?.branch).toBe("cursor/pulse-yellow-black-2572");
    expect(pulse2?.href).toBe("/pulse2");
  });

  it("exposes the drop editor query states", () => {
    const drop = labEntries.find((entry) => entry.id === "drop-editor");
    const hrefs = drop?.quickLinks?.map((link) => link.href);
    expect(hrefs).toEqual([
      "/lab/drop-editor/?mode=brand",
      "/lab/drop-editor/?pop=1",
      "/lab/drop-editor/?desc=1",
      "/lab/drop-editor/?edit=1",
    ]);
  });

  it("treats / and /lab as the directory", () => {
    expect(isLabDirectoryPath("/")).toBe(true);
    expect(isLabDirectoryPath("/lab")).toBe(true);
    expect(isLabDirectoryPath("/lab/")).toBe(true);
    expect(isLabDirectoryPath("/inspo")).toBe(false);
    expect(isLabDirectoryPath("/pulse2")).toBe(false);
  });

  it("keeps the drop mockup source free of the lab badge", () => {
    const html = fs.readFileSync(
      path.join(__dirname, "../../lab-static/drop-editor/index.html"),
      "utf8",
    );
    expect(html).toContain("url(a/switzer-400.woff2)");
    expect(html).toContain('src="a/buzz-logo.svg"');
    expect(html).toContain("q.get('mode')==='brand'");
    expect(html).toContain("q.get('pop')");
    expect(html).toContain("q.get('desc')");
    expect(html).toContain("q.get('edit')");
    expect(html).not.toContain("buzz-lab-badge");
    expect(html).not.toContain("noindex");
  });
});
