/**
 * Railway deployment server.
 *
 * - POST/OPTIONS /api/ai-explainer-v2  -> delegates to the Vercel-style handler
 *   in api/ai-explainer-v2.js (JSON body pre-parsed into req.body, UTF-8).
 * - /api/update-center/*               -> delegates to api/update-center.js
 *   (P4 update-center admin API: events/audit/versions/scan/approve/hold/rollback).
 * - GET/HEAD /update-center            -> serves update-center.html from the repo
 *   root directly (no-cache), so the admin page works in dev without a build step
 *   too; also copied into vercel_public/ by build_vercel_static.mjs for prod.
 * - Everything else                    -> static files from vercel_public/
 *   (built by `npm run build:vercel`), index.html as directory default.
 *
 * Zero external dependencies (node:http only). Node >= 20.
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const aiExplainerHandler = require("./api/ai-explainer-v2.js");
const updateCenterHandler = require("./api/update-center.js");

const PORT = Number(process.env.PORT || 3000);
const HOST = "0.0.0.0";
const STATIC_ROOT = path.join(__dirname, "vercel_public");
const MAX_BODY_BYTES = 1024 * 1024; // 1 MB, API payloads are small

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".wasm": "application/wasm",
};

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("Payload too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.statusCode = 400;
    throw error;
  }
}

async function handleApi(req, res) {
  try {
    if (req.method === "POST") {
      // Vercel parses JSON bodies into req.body; reproduce that here.
      req.body = await readJsonBody(req);
    }
    await aiExplainerHandler(req, res);
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    if (!res.headersSent) {
      sendJson(res, statusCode, {
        answerable: false,
        blocked_reason:
          statusCode === 400
            ? "요청 본문(JSON)을 해석할 수 없습니다."
            : statusCode === 413
              ? "요청 본문이 너무 큽니다."
              : "서버 내부 오류가 발생했습니다.",
      });
    } else {
      res.end();
    }
    if (statusCode >= 500) console.error("[api] handler error:", error);
  }
}

async function handleUpdateCenter(req, res) {
  try {
    if (req.method === "POST") {
      req.body = await readJsonBody(req);
    }
    await updateCenterHandler(req, res);
  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    if (!res.headersSent) {
      sendJson(res, statusCode, {
        error:
          statusCode === 400
            ? "요청 본문(JSON)을 해석할 수 없습니다."
            : statusCode === 413
              ? "요청 본문이 너무 큽니다."
              : "서버 내부 오류가 발생했습니다.",
      });
    } else {
      res.end();
    }
    if (statusCode >= 500) console.error("[api] update-center handler error:", error);
  }
}

function cacheControlFor(urlPath) {
  // Mirror vercel.json header rules.
  if (/^\/ui-preview\/dist\/assets\//.test(urlPath)) {
    return "public, max-age=31536000, immutable";
  }
  if (/^\/data_processed\//.test(urlPath)) {
    return "public, max-age=300";
  }
  return null;
}

function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }

  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.statusCode = 400;
    res.end("Bad Request");
    return;
  }

  let filePath = path.normalize(path.join(STATIC_ROOT, urlPath));
  if (filePath !== STATIC_ROOT && !filePath.startsWith(STATIC_ROOT + path.sep)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      stats = fs.statSync(filePath);
    }
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
  res.setHeader("Content-Length", stats.size);
  const cacheControl = cacheControlFor(urlPath);
  if (cacheControl) res.setHeader("Cache-Control", cacheControl);

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  stream.pipe(res);
}

function serveUpdateCenterPage(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.end("Method Not Allowed");
    return;
  }
  const filePath = path.join(__dirname, "update-center.html");
  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.setHeader("Content-Length", stats.size);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = fs.createReadStream(filePath);
  stream.on("error", () => {
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/api/ai-explainer-v2") {
    handleApi(req, res);
    return;
  }
  if (pathname.startsWith("/api/update-center/")) {
    handleUpdateCenter(req, res);
    return;
  }
  if (pathname === "/update-center") {
    serveUpdateCenterPage(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  console.log(`Static root: ${STATIC_ROOT}`);
});
