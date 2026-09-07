#!/usr/bin/env node
"use strict";

// 로컬 검토용 데모 서버 (개발자 도구, 운영 인증 구현 아님)
// - 127.0.0.1 전용 바인딩, 허용목록 기반 정적 파일 서빙
// - POST /api/ai-explainer-v2 를 기존 핸들러(api/ai-explainer-v2.js)로 라우팅
// - 기본값은 오프라인 강제: OpenAI 실호출 없음(.env 키가 있어도 사용하지 않음)
// - 사용법: node scripts/local_review_server.cjs [--port 8899] [--live]

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const API_MODULE_PATH = path.join(PROJECT_ROOT, "api", "ai-explainer-v2.js");
const HOST = "127.0.0.1";
const DEFAULT_PORT = 8899;

// 실제 키와 절대 겹치지 않는 통제된 더미 값. require 시점의 .env 자동 로딩을 차단하는 용도로만 쓰고
// require 직후 삭제하므로 요청 처리 시점에는 키가 존재하지 않는다. 어떤 경로로도 로그에 남기지 않는다.
const OFFLINE_DUMMY_KEY = "sk-local-offline-neutralized-not-a-real-key";

// 정적으로 공개해도 되는 경로만 나열한다. 그 외(스크립트, pipeline, .env, reports 등)는 전부 거부.
const EXACT_ALLOWED = new Set(["/index.html", "/logo.png"]);
const PREFIX_ALLOWED = [
  "/assets/",
  "/data_processed/",
  "/ui-preview/dist/",
  "/outputs/robust_xai/",
  "/update_center/public/",
];
const EXT_ALLOWED = new Set([
  ".html", ".htm", ".js", ".mjs", ".css", ".json", ".geojson", ".csv",
  ".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico", ".gif",
  ".txt", ".md", ".woff", ".woff2", ".ttf", ".map",
]);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".geojson": "application/geo+json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
};

let explainerHandler = null;
let serverMode = null; // "offline" | "live"

// 기존 api 파일은 다른 에이전트 소유이므로 수정하지 않고, 지원되는 환경변수 경로만으로 무력화한다.
// 검증된 동작(api/ai-explainer-v2.js 기준):
//  1) loadLocalEnvForDevelopment()는 require 시점에 실행되며 OPENAI_API_KEY가 이미 있으면
//     즉시 return 하므로 상위 .env 파일을 아예 읽지 않는다. → require 전에 더미 키를 넣는다.
//  2) 요청 처리 시 `if (!process.env.OPENAI_API_KEY)` 이면 buildRetrievalFallback(근거 chunk
//     요약 기반의 유용한 오프라인 해설)로 응답한다. → require 직후 더미 키를 삭제한다.
//  3) AI_EXPLAINER_ENABLED=false 는 503 "비활성화" 차단만 반환해 데모에 무의미하므로 쓰지 않는다.
//  4) 심층 방어: 오프라인 모드에서는 localhost 외부로 나가는 fetch 를 프로세스 차원에서 차단한다.
function loadExplainer(mode) {
  if (explainerHandler) {
    if (mode !== serverMode) {
      throw new Error(`이 프로세스는 이미 ${serverMode} 모드로 초기화되었습니다. 모드 변경은 새 프로세스로 실행하세요.`);
    }
    return explainerHandler;
  }
  serverMode = mode;
  if (mode === "offline") {
    process.env.OPENAI_API_KEY = OFFLINE_DUMMY_KEY;
  }
  explainerHandler = require(API_MODULE_PATH);
  if (mode === "offline") {
    delete process.env.OPENAI_API_KEY;
    installLocalOnlyFetchGuard();
  }
  return explainerHandler;
}

function isLoopbackHostname(hostname) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function installLocalOnlyFetchGuard() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async function localOnlyFetch(input, init) {
    let hostname = "";
    try {
      const url = typeof input === "string" || input instanceof URL ? new URL(String(input)) : new URL(input.url);
      hostname = url.hostname;
    } catch {
      throw new Error("offline mode: unparseable fetch target blocked");
    }
    if (!isLoopbackHostname(hostname)) {
      throw new Error(`offline mode: outbound fetch blocked (host=${hostname})`);
    }
    // 리다이렉트 미추적 강제: localhost 302가 외부/다른 loopback 으로 우회하는 것을 막는다.
    // 호출자가 init.redirect 를 넣어도 마지막에 덮어써서 무력화되지 않게 한다.
    return realFetch(input, { ...(init || {}), redirect: "error" });
  };
}

// URL 경로 → 허용된 절대 파일 경로. 허용되지 않으면 null.
function resolveStaticFile(rawUrlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawUrlPath.split("?")[0]);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\") || decoded.includes("..")) return null;
  let p = path.posix.normalize(decoded);
  if (!p.startsWith("/")) return null;
  if (p === "/") p = "/index.html";
  // 숨김/비밀 파일: 어떤 세그먼트도 "."으로 시작할 수 없다 (.env, .git 등)
  if (p.split("/").some((seg) => seg.startsWith(".") && seg !== "")) return null;
  const allowed = EXACT_ALLOWED.has(p) || PREFIX_ALLOWED.some((prefix) => p.startsWith(prefix));
  if (!allowed) return null;
  if (!EXT_ALLOWED.has(path.posix.extname(p).toLowerCase())) return null;
  const abs = path.resolve(PROJECT_ROOT, "." + p);
  if (abs !== PROJECT_ROOT && !abs.startsWith(PROJECT_ROOT + path.sep)) return null;
  // 어휘적 검사만으로는 허용 디렉터리 안의 symlink/junction 이 밖의 파일을 노출할 수 있다.
  // 실제 경로(realpath)를 해석해 프로젝트 루트 포함 + 허용목록 재검사를 통과해야만 서빙한다.
  let realAbs;
  try {
    realAbs = fs.realpathSync.native(abs);
  } catch {
    return null; // 존재하지 않거나 해석 불가 → 404 처리
  }
  const realRoot = getRealProjectRoot();
  if (realAbs !== realRoot && !realAbs.startsWith(realRoot + path.sep)) return null;
  const realRel = "/" + path.relative(realRoot, realAbs).split(path.sep).join("/");
  if (realRel.split("/").some((seg) => seg.startsWith(".") && seg !== "")) return null;
  if (!(EXACT_ALLOWED.has(realRel) || PREFIX_ALLOWED.some((prefix) => realRel.startsWith(prefix)))) return null;
  if (!EXT_ALLOWED.has(path.posix.extname(realRel).toLowerCase())) return null;
  return realAbs;
}

let cachedRealProjectRoot = null;
function getRealProjectRoot() {
  if (!cachedRealProjectRoot) cachedRealProjectRoot = fs.realpathSync.native(PROJECT_ROOT);
  return cachedRealProjectRoot;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function createAppServer({ mode = "offline" } = {}) {
  const handler = loadExplainer(mode);

  const server = http.createServer(async (req, res) => {
    const urlPath = (req.url || "/").split("?")[0];

    if (urlPath === "/api/ai-explainer-v2") {
      if (req.method === "POST" || req.method === "OPTIONS") {
        try {
          await handler(req, res);
        } catch {
          if (!res.writableEnded) sendJson(res, 500, { error: "internal error" });
        }
      } else {
        res.setHeader("Allow", "POST, OPTIONS");
        sendJson(res, 405, { error: "POST 요청만 지원합니다." });
      }
      logRequest(req, res);
      return;
    }

    // 로컬 상태 확인용(디버그): 모드와 키 존재 여부(불리언)만 노출. 값은 절대 노출하지 않는다.
    if (urlPath === "/__status") {
      sendJson(res, 200, {
        mode: serverMode,
        openai_key_present: Boolean(process.env.OPENAI_API_KEY),
        note: "로컬 검토용 개발 서버입니다. 운영 인증/배포 용도가 아닙니다.",
      });
      logRequest(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      sendJson(res, 405, { error: "정적 자산은 GET/HEAD만 지원합니다." });
      logRequest(req, res);
      return;
    }

    const filePath = resolveStaticFile(urlPath);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      // 존재하지 않는 파일과 허용되지 않은 경로를 구분하지 않는다(경로 탐색 방지)
      sendJson(res, 404, { error: "not found" });
      logRequest(req, res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "HEAD") {
      res.setHeader("Content-Length", fs.statSync(filePath).size);
      res.end();
    } else {
      fs.createReadStream(filePath).pipe(res);
    }
    logRequest(req, res);
  });

  return server;
}

function logRequest(req, res) {
  // 헤더/본문/환경변수는 로그에 남기지 않는다.
  console.log(`[local-review-server] ${req.method} ${(req.url || "").split("?")[0]} -> ${res.statusCode}`);
}

function parseArgs(argv) {
  const args = { port: DEFAULT_PORT, live: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--port") {
      args.port = Number(argv[i + 1]);
      i += 1;
    } else if (argv[i] === "--live") {
      args.live = true;
    }
  }
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    throw new Error("--port 는 0~65535 정수여야 합니다.");
  }
  return args;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.live ? "live" : "offline";
  const server = createAppServer({ mode });
  server.listen(args.port, HOST, () => {
    const actualPort = server.address().port;
    console.log(`[local-review-server] listening http://${HOST}:${actualPort} mode=${mode}`);
    if (mode === "offline") {
      console.log("[local-review-server] 오프라인 강제 모드: OpenAI 실호출 없음, .env 키 미사용, 외부 fetch 차단");
    } else {
      console.log("[local-review-server] live 모드: 기존 핸들러의 자체 환경 설정을 그대로 사용합니다 (키 값은 출력하지 않음)");
    }
  });
}

module.exports = { createAppServer, resolveStaticFile, parseArgs, PROJECT_ROOT, HOST };
