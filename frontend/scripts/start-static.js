#!/usr/bin/env node
/**
 * Production static server.
 *
 * STAGING_BASIC_AUTH unset: `serve -s build -l $PORT` (unchanged production).
 * STAGING_BASIC_AUTH=user:password: HTTP Basic on every path except /healthz.
 * Credentials are read from the environment only — nothing is hardcoded.
 *
 * STAGING_STATIC_ROOT overrides the build directory (tests).
 */
const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");

const frontendRoot = path.join(__dirname, "..");
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function gateCredentials(raw) {
  const value = (raw || "").trim();
  if (!value) return null;
  const colon = value.indexOf(":");
  if (colon <= 0 || colon === value.length - 1) {
    console.error("STAGING_BASIC_AUTH must be user:password");
    process.exit(1);
  }
  return value;
}

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    crypto.timingSafeEqual(left, left);
    return false;
  }
  return crypto.timingSafeEqual(left, right);
}

function credentialsMatch(authorization, expected) {
  if (!expected) return true;
  if (!authorization || typeof authorization !== "string") return false;
  const match = /^Basic\s+([A-Za-z0-9+/]+=*)\s*$/i.exec(authorization);
  if (!match) return false;
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  return safeEqual(decoded, expected);
}

function loadHeaderBlocks(root) {
  const servePath = path.join(root, "serve.json");
  if (!fs.existsSync(servePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(servePath, "utf8"));
    return Array.isArray(parsed.headers) ? parsed.headers : [];
  } catch (err) {
    console.error(`failed to read ${servePath}: ${err.message}`);
    return [];
  }
}

function applyHeaders(res, blocks) {
  for (const block of blocks) {
    for (const header of block.headers || []) {
      if (header.key && header.value) res.setHeader(header.key, header.value);
    }
  }
}

function resolvePath(root, urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split("?")[0]);
  } catch {
    return null;
  }
  const rel = pathname.replace(/^[/\\]+/, "");
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

function createGatedServer({ root, auth, headerBlocks }) {
  return http.createServer((req, res) => {
    const urlPath = (req.url || "/").split("?")[0];
    applyHeaders(res, headerBlocks);
    if (urlPath === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("ok\n");
      return;
    }
    if (!credentialsMatch(req.headers.authorization, auth)) {
      res.writeHead(401, {
        "Content-Type": "text/plain; charset=utf-8",
        "WWW-Authenticate": 'Basic realm="staging"',
      });
      res.end("Authentication required\n");
      return;
    }
    const full = resolvePath(root, urlPath);
    if (!full) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad request\n");
      return;
    }
    let filePath = full;
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) {
      filePath = path.join(full, "index.html");
    }
    const ext = path.extname(filePath);
    const missing = !fs.existsSync(filePath) || !fs.statSync(filePath).isFile();
    if (missing && ext && ext !== ".html") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }
    if (missing) filePath = path.join(root, "index.html");
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found\n");
      return;
    }
    const type = MIME[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

function execServe(port) {
  const bin = path.join(frontendRoot, "node_modules", ".bin", "serve");
  const child = spawn(bin, ["-s", "build", "-l", String(port)], {
    cwd: frontendRoot,
    stdio: "inherit",
  });
  const forward = (signal) => {
    child.kill(signal);
  };
  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code == null ? 1 : code);
  });
}

function main() {
  const port = process.env.PORT || "3000";
  const auth = gateCredentials(process.env.STAGING_BASIC_AUTH);
  if (!auth) {
    execServe(port);
    return;
  }
  const root = process.env.STAGING_STATIC_ROOT
    ? path.resolve(process.env.STAGING_STATIC_ROOT)
    : path.join(frontendRoot, "build");
  const server = createGatedServer({
    root,
    auth,
    headerBlocks: loadHeaderBlocks(root),
  });
  server.listen(Number(port), "0.0.0.0", () => {
    console.log(`staging static server listening on ${port}`);
  });
}

module.exports = {
  createGatedServer,
  credentialsMatch,
  gateCredentials,
  loadHeaderBlocks,
};

if (require.main === module) {
  main();
}
