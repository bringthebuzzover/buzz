/**
 * Guard: public/index.html must stay free of inline scripts so production CSP
 * (serve.json script-src 'self') does not spam the console on every load.
 * GitHub Pages spa-github-pages 404.html is gone — www is Railway serve -s.
 */
import fs from "fs";
import path from "path";

const publicDir = path.join(__dirname, "..", "public");

describe("public HTML CSP hygiene", () => {
  it("index.html has no inline <script> bodies", () => {
    const html = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
    // Blocked by script-src 'self': any <script> without a src attribute.
    const inline = html.match(/<script(?![^>]*\bsrc\s*=)[^>]*>/gi);
    expect(inline).toBeNull();
  });

  it("does not ship spa-github-pages 404.html", () => {
    expect(fs.existsSync(path.join(publicDir, "404.html"))).toBe(false);
  });
});
