#!/usr/bin/env node
/**
 * Rewrite build/serve.json after `craco build`.
 *
 * CRA copies public/serve.json into the build. This script sets CSP
 * connect-src from REACT_APP_API_URL (origin only). When that variable is
 * unset, the committed production origin is left alone so CI builds stay
 * valid. REACT_APP_ENV=staging adds X-Robots-Tag: noindex, nofollow and a
 * robots meta tag on build/index.html.
 *
 * Overrides (tests): SERVE_JSON_TEMPLATE, SERVE_JSON_BUILD_DIR.
 */
const fs = require("fs");
const path = require("path");

const frontendRoot = path.join(__dirname, "..");
const templatePath =
  process.env.SERVE_JSON_TEMPLATE || path.join(frontendRoot, "public", "serve.json");
const buildDir = process.env.SERVE_JSON_BUILD_DIR || path.join(frontendRoot, "build");

function apiOrigin(apiUrl) {
  if (!apiUrl) return null;
  let parsed;
  try {
    parsed = new URL(apiUrl);
  } catch {
    console.error(`REACT_APP_API_URL is not a valid URL: ${apiUrl}`);
    process.exit(1);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    console.error(`REACT_APP_API_URL must be http(s): ${apiUrl}`);
    process.exit(1);
  }
  if (!parsed.host) {
    console.error(`REACT_APP_API_URL is missing a host: ${apiUrl}`);
    process.exit(1);
  }
  return parsed.origin;
}

function withConnectSrc(csp, origin) {
  const parts = csp
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  let found = false;
  const next = parts.map((part) => {
    if (part.startsWith("connect-src")) {
      found = true;
      return `connect-src 'self' ${origin}`;
    }
    return part;
  });
  if (!found) next.push(`connect-src 'self' ${origin}`);
  return next.join("; ");
}

function applyServeConfig(config, { apiUrl, appEnv }) {
  const next = JSON.parse(JSON.stringify(config));
  const origin = apiOrigin(apiUrl);
  const headers = next.headers || [];
  for (const block of headers) {
    for (const header of block.headers || []) {
      if (header.key === "Content-Security-Policy" && origin) {
        header.value = withConnectSrc(header.value, origin);
      }
    }
    if (appEnv === "staging") {
      const list = block.headers || [];
      const hasRobots = list.some((header) => header.key === "X-Robots-Tag");
      if (!hasRobots) {
        list.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
      }
      block.headers = list;
    }
  }
  next.headers = headers;
  return next;
}

function injectRobotsMeta(html) {
  if (/<meta\s+[^>]*name=["']robots["']/i.test(html)) return html;
  if (!html.includes("</head>")) return html;
  return html.replace(
    "</head>",
    '    <meta name="robots" content="noindex, nofollow" />\n  </head>',
  );
}

function writeServeJson() {
  const raw = fs.readFileSync(templatePath, "utf8");
  const config = applyServeConfig(JSON.parse(raw), {
    apiUrl: process.env.REACT_APP_API_URL || "",
    appEnv: process.env.REACT_APP_ENV || "",
  });
  fs.mkdirSync(buildDir, { recursive: true });
  const outPath = path.join(buildDir, "serve.json");
  fs.writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`);
  if (process.env.REACT_APP_ENV === "staging") {
    const indexPath = path.join(buildDir, "index.html");
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, "utf8");
      fs.writeFileSync(indexPath, injectRobotsMeta(html));
    }
  }
  console.log(`wrote ${outPath}`);
}

module.exports = { apiOrigin, applyServeConfig, injectRobotsMeta, withConnectSrc };

if (require.main === module) {
  writeServeJson();
}
