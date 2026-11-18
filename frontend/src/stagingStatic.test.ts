/**
 * Post-build serve.json rewrite (CSP connect-src and staging noindex).
 */
import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const frontendRoot = path.join(__dirname, "..");

describe("write-serve-json", () => {
  it("sets connect-src from REACT_APP_API_URL and preserves the staging noindex header and meta tag", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buzz-serve-"));
    fs.writeFileSync(path.join(dir, "index.html"), "<html><head></head><body></body></html>");
    const result = spawnSync("node", ["scripts/write-serve-json.js"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        REACT_APP_API_URL: "https://api-staging.example.com/api",
        REACT_APP_ENV: "staging",
        SERVE_JSON_BUILD_DIR: dir,
      },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const serve = JSON.parse(fs.readFileSync(path.join(dir, "serve.json"), "utf8"));
    const headers = serve.headers[0].headers as { key: string; value: string }[];
    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toContain("connect-src 'self' https://api-staging.example.com");
    expect(csp?.value).not.toContain("https://api.bringthebuzzover.com");
    expect(headers.find((header) => header.key === "X-Robots-Tag")?.value).toBe(
      "noindex, nofollow",
    );
    const html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("leaves the production connect-src when REACT_APP_API_URL is unset", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buzz-serve-"));
    const env = { ...process.env };
    delete env.REACT_APP_API_URL;
    delete env.REACT_APP_ENV;
    const result = spawnSync("node", ["scripts/write-serve-json.js"], {
      cwd: frontendRoot,
      env: { ...env, SERVE_JSON_BUILD_DIR: dir },
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const serve = JSON.parse(fs.readFileSync(path.join(dir, "serve.json"), "utf8"));
    const headers = serve.headers[0].headers as { key: string; value: string }[];
    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toContain("https://api.bringthebuzzover.com");
    expect(headers.find((header) => header.key === "X-Robots-Tag")).toBeUndefined();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
