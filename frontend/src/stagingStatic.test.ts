/**
 * Post-build serve.json rewrite and the staging basic-auth static server.
 */
import { spawn, spawnSync, type ChildProcess } from "child_process";
import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

const frontendRoot = path.join(__dirname, "..");

function httpGet(
  port: number,
  urlPath: string,
  headers?: http.OutgoingHttpHeaders,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path: urlPath, method: "GET", headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function waitFor(port: number): Promise<void> {
  let last = "";
  for (let i = 0; i < 40; i += 1) {
    try {
      await httpGet(port, "/healthz");
      return;
    } catch (err) {
      last = String(err);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error(`server did not start: ${last}`);
}

describe("write-serve-json", () => {
  it("sets connect-src from REACT_APP_API_URL and noindex on staging", () => {
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

describe("start-static basic auth", () => {
  let child: ChildProcess | undefined;
  const port = 39000 + Math.floor(Math.random() * 1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "buzz-static-"));

  beforeAll(async () => {
    fs.writeFileSync(path.join(dir, "index.html"), "STAGING_PAGE");
    fs.writeFileSync(
      path.join(dir, "serve.json"),
      JSON.stringify({
        headers: [
          {
            source: "/**",
            headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
          },
        ],
      }),
    );
    child = spawn("node", ["scripts/start-static.js"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        PORT: String(port),
        STAGING_BASIC_AUTH: "sample:sample-pass",
        STAGING_STATIC_ROOT: dir,
      },
      stdio: "ignore",
    });
    await waitFor(port);
  });

  afterAll(() => {
    child?.kill("SIGTERM");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serves /healthz without credentials and gates every other path", async () => {
    const health = await httpGet(port, "/healthz");
    expect(health.status).toBe(200);
    expect(health.body).toContain("ok");
    expect(String(health.headers["x-robots-tag"])).toContain("noindex");

    const blocked = await httpGet(port, "/");
    expect(blocked.status).toBe(401);
    expect(String(blocked.headers["www-authenticate"])).toMatch(/basic/i);
    expect(String(blocked.headers["x-robots-tag"])).toContain("noindex");
    expect(blocked.body).not.toContain("STAGING_PAGE");

    const token = Buffer.from("sample:sample-pass").toString("base64");
    const page = await httpGet(port, "/brand/login", { Authorization: `Basic ${token}` });
    expect(page.status).toBe(200);
    expect(page.body).toContain("STAGING_PAGE");

    const wrong = await httpGet(port, "/", {
      Authorization: `Basic ${Buffer.from("sample:nope").toString("base64")}`,
    });
    expect(wrong.status).toBe(401);
  });

  it("returns 400 when the path is not valid percent-encoding", async () => {
    const token = Buffer.from("sample:sample-pass").toString("base64");
    const bad = await httpGet(port, "/%ZZ", { Authorization: `Basic ${token}` });
    expect(bad.status).toBe(400);
    expect(bad.body).not.toContain("STAGING_PAGE");
  });
});
