#!/usr/bin/env node
// scripts/update_center/scan.mjs
// CDC scanner for the P4 update-center. Reads data_sources.yaml, polls each
// source per its check.type, classifies the outcome (green/yellow/red/moved),
// records events + audit entries via the store (scripts/update_center/store.mjs),
// and persists last-known schema/hash state in data/update_center_state.json
// (gitignored — file backend runtime state, not committed).
//
// Usage:
//   node scripts/update_center/scan.mjs [--dataset <name>]
//   node scripts/update_center/scan.mjs --dataset <name> --simulate-change <path/to/new.csv>
//   node scripts/update_center/scan.mjs --dataset <name> --force-url <url>   (test hook: forces
//     the dataset's primary check URL to <url> for this run only, to exercise the
//     404/moved-detection path without editing data_sources.yaml)
//
// Classification (per plan Global Constraints):
//   schema identical + content changed -> green (kind=content)
//   columns added/renamed              -> yellow (kind=schema)
//   columns removed / fetch failure    -> red (kind=schema|error)
//   source moved (404 -> portal search)-> moved, treated as red (kind=moved)
//
// First run per dataset establishes a baseline in the state file (an audit
// entry "baseline recorded" is written, but no data_event — there is nothing
// to compare against yet).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { createStore } from "./store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const SOURCES_PATH = path.join(REPO_ROOT, "data_sources.yaml");
const STATE_PATH = path.join(REPO_ROOT, "data", "update_center_state.json");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36 ParkRailwayUpdateCenter/1.0";
const FETCH_TIMEOUT_MS = 10000;
const PORTAL_SEARCH_BASE = "https://www.data.go.kr/tcs/dss/selectDataSetList.do?keyword=";

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf-8").digest("hex");
}

async function fetchWithTimeout(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...opts,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

function loadSources() {
  const raw = fs.readFileSync(SOURCES_PATH, "utf-8");
  const doc = yaml.load(raw);
  if (!doc || !Array.isArray(doc.sources)) {
    throw new Error(`data_sources.yaml: expected top-level "sources" array`);
  }
  return doc.sources;
}

function ensureStateDir() {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadState() {
  ensureStateDir();
  if (!fs.existsSync(STATE_PATH)) return {};
  const raw = fs.readFileSync(STATE_PATH, "utf-8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`update_center scan: failed to parse ${STATE_PATH}: ${err.message}`);
  }
}

function saveState(state) {
  ensureStateDir();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}

// Minimal RFC4180-ish CSV parser (handles quoted fields with embedded commas/
// newlines/escaped quotes). Strips a leading BOM. Good enough for the
// Korean CSVs in data_processed/ — this is a prototype-grade parser, not a
// general-purpose CSV library.
function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      // skip; \n (or end) below will close the row
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  const header = nonEmpty[0] || [];
  const dataRows = nonEmpty.slice(1);
  return { header, rows: dataRows };
}

function parseCsvFile(filePath) {
  return parseCsv(fs.readFileSync(filePath, "utf-8"));
}

// sha256 of the row set, order-independent (rows sorted after stringify).
function hashRows(rows) {
  const lines = rows.map((r) => JSON.stringify(r)).sort();
  return sha256(lines.join("\n"));
}

function diffSchema(oldCols, newCols) {
  const oldSet = new Set(oldCols);
  const newSet = new Set(newCols);
  return {
    added: newCols.filter((c) => !oldSet.has(c)),
    removed: oldCols.filter((c) => !newSet.has(c)),
  };
}

function stripTags(html) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// Prototype-level scrape of data.go.kr's dataset search results page: pull
// (href, title) pairs out of the "apply-result-link" blocks. Not a general
// HTML parser — good enough for surfacing relocation candidates in an event.
function extractSearchCandidates(html, limit = 5) {
  const candidates = [];
  // Allow for an optional file-extension badge span between the wrapper div
  // and the <a> (file-type dataset results render one, standard/API results don't).
  const re = /<div class="apply-result-link">[\s\S]{0,300}?<a href="([^"]+)">([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && candidates.length < limit) {
    const href = m[1];
    const title = stripTags(m[2]);
    if (href && title) {
      candidates.push({
        title,
        url: href.startsWith("http") ? href : `https://www.data.go.kr${href}`,
      });
    }
  }
  return candidates;
}

async function searchPortal(keywords) {
  const keyword = (keywords && keywords[0]) || "";
  const searchUrl = PORTAL_SEARCH_BASE + encodeURIComponent(keyword);
  try {
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) {
      return { searchUrl, keyword, candidates: [], note: `포털 검색 요청 실패: HTTP ${res.status}` };
    }
    const html = await res.text();
    const candidates = extractSearchCandidates(html);
    return {
      searchUrl,
      keyword,
      candidates,
      note:
        candidates.length > 0
          ? `후보 ${candidates.length}건 추출`
          : "검색은 성공했으나 파싱 가능한 후보를 찾지 못함(정규식 시제품 한계) — 수동 확인 필요",
    };
  } catch (err) {
    return { searchUrl, keyword, candidates: [], note: `포털 검색 요청 예외: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { dataset: null, simulateChange: null, forceUrl: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dataset") args.dataset = argv[++i];
    else if (a === "--simulate-change") args.simulateChange = argv[++i];
    else if (a === "--force-url") args.forceUrl = argv[++i];
  }
  return args;
}

// ---------------------------------------------------------------------------
// check: json_api (libraries)
// ---------------------------------------------------------------------------

async function checkJsonApi(entry, state, store, opts, log) {
  const dataset = entry.dataset;
  const columListUrl = entry.check.urls.columList;
  const dataUrl = opts.forceUrl || entry.check.urls.data;
  const prev = state[dataset] || null;

  // 1. columList.json -> remote schema
  let columListRes;
  try {
    columListRes = await fetchWithTimeout(columListUrl);
  } catch (err) {
    return await recordFailure(dataset, "columList.json 요청 실패(네트워크/타임아웃)", err.message, null, entry, state, store, log);
  }
  if (!columListRes.ok) {
    if (columListRes.status === 404) {
      return await recordMoved(dataset, columListUrl, entry, state, store, log, "columList.json 404");
    }
    return await recordFailure(
      dataset,
      `columList.json 요청 실패: HTTP ${columListRes.status}`,
      null,
      columListRes.status,
      entry,
      state,
      store,
      log
    );
  }
  let columListJson;
  try {
    columListJson = await columListRes.json();
  } catch (err) {
    return await recordFailure(dataset, "columList.json 파싱 실패", err.message, null, entry, state, store, log);
  }
  const remoteSchema = Array.isArray(columListJson.columList)
    ? columListJson.columList.map((c) => c.columNm || c.columCode).filter(Boolean).sort()
    : [];

  // Evaluate the schema diff now (columList already succeeded) so a subsequent
  // standard.json failure doesn't silently swallow a real schema change under
  // the generic error event — surfaced via recordFailure's extraDiff param.
  const schemaDiff = prev && prev.schema ? diffSchema(prev.schema, remoteSchema) : null;

  // 2. standard.json (first page) -> totalCount + content hash
  let dataRes;
  try {
    dataRes = await fetchWithTimeout(dataUrl);
  } catch (err) {
    return await recordFailure(
      dataset,
      "standard.json 요청 실패(네트워크/타임아웃)",
      err.message,
      null,
      entry,
      state,
      store,
      log,
      { schemaDiff }
    );
  }
  if (!dataRes.ok) {
    if (dataRes.status === 404) {
      return await recordMoved(dataset, dataUrl, entry, state, store, log, "standard.json 404");
    }
    return await recordFailure(
      dataset,
      `standard.json 요청 실패: HTTP ${dataRes.status}`,
      null,
      dataRes.status,
      entry,
      state,
      store,
      log,
      { schemaDiff }
    );
  }
  let dataJson;
  try {
    dataJson = await dataRes.json();
  } catch (err) {
    return await recordFailure(
      dataset,
      "standard.json 파싱 실패",
      err.message,
      null,
      entry,
      state,
      store,
      log,
      { schemaDiff }
    );
  }
  const rows = Array.isArray(dataJson.data)
    ? dataJson.data
    : Array.isArray(dataJson.result?.data)
    ? dataJson.result.data
    : Array.isArray(dataJson)
    ? dataJson
    : Object.values(dataJson).find((v) => Array.isArray(v)) || [];
  const totalCount = dataJson.totalCount ?? dataJson.result?.totalCount ?? rows.length;
  const contentHash = hashRows(rows);

  const nextState = {
    schema: remoteSchema,
    totalCount,
    contentHash,
    lastCheckedAt: nowIso(),
    lastStatus: "ok",
  };

  if (!prev || !prev.schema) {
    state[dataset] = nextState;
    await store.appendAudit({
      actor: "scan.mjs",
      action: "baseline_recorded",
      dataset,
      detail: `baseline recorded: schema ${remoteSchema.length}cols, totalCount=${totalCount}`,
    });
    log(`[${dataset}] baseline recorded (schema ${remoteSchema.length} cols, totalCount=${totalCount})`);
    return { outcome: "baseline" };
  }

  const { added, removed } = diffSchema(prev.schema, remoteSchema);
  if (removed.length > 0) {
    const event = await store.recordEvent({
      dataset,
      kind: "schema",
      risk: "red",
      summary: `컬럼 삭제 감지: ${removed.join(", ")}`,
      diff_json: { added, removed, prevTotalCount: prev.totalCount, totalCount },
      status: "pending",
    });
    await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: event.summary });
    state[dataset] = nextState;
    log(`[${dataset}] RED schema event: ${event.summary}`);
    return { outcome: "red", event };
  }
  if (added.length > 0) {
    const event = await store.recordEvent({
      dataset,
      kind: "schema",
      risk: "yellow",
      summary: `컬럼 추가/개명 감지: ${added.join(", ")}`,
      diff_json: { added, removed, prevTotalCount: prev.totalCount, totalCount },
      status: "pending",
    });
    await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: event.summary });
    state[dataset] = nextState;
    log(`[${dataset}] YELLOW schema event: ${event.summary}`);
    return { outcome: "yellow", event };
  }

  if (contentHash === prev.contentHash) {
    state[dataset] = { ...nextState };
    log(`[${dataset}] no change (schema+content hash identical, totalCount=${totalCount})`);
    return { outcome: "unchanged" };
  }

  const event = await store.recordEvent({
    dataset,
    kind: "content",
    risk: "green",
    summary: `내용 변경 감지: totalCount ${prev.totalCount ?? "?"} -> ${totalCount}`,
    diff_json: { prevTotalCount: prev.totalCount, totalCount, prevContentHash: prev.contentHash, contentHash },
    status: "pending",
  });
  await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: event.summary });
  state[dataset] = nextState;
  log(`[${dataset}] GREEN content event: ${event.summary}`);
  return { outcome: "green", event };
}

async function recordFailure(dataset, summary, errMessage, httpStatus, entry, state, store, log, extraDiff = {}) {
  const prev = state[dataset] || null;
  const signature = sha256(`error:${summary}:${errMessage || ""}:${httpStatus ?? ""}`);
  if (prev && prev.lastStatus === "error" && prev.lastErrorSignature === signature) {
    log(`[${dataset}] error persists (no new event): ${summary}`);
    return { outcome: "error-unchanged" };
  }
  // extraDiff carries context gathered before the failing step (e.g. a schema
  // diff already computed from a successful columList.json call) so it isn't
  // lost when a later step in the same check fails.
  const event = await store.recordEvent({
    dataset,
    kind: "error",
    risk: "red",
    summary,
    diff_json: { errMessage: errMessage || null, httpStatus: httpStatus ?? null, ...extraDiff },
    status: "pending",
  });
  await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: summary });
  state[dataset] = {
    ...(prev || {}),
    lastCheckedAt: nowIso(),
    lastStatus: "error",
    lastErrorSignature: signature,
  };
  log(`[${dataset}] RED error event: ${summary}`);
  return { outcome: "error", event };
}

async function recordMoved(dataset, attemptedUrl, entry, state, store, log, reason) {
  const prev = state[dataset] || null;
  const search = await searchPortal(entry.search_keywords || []);
  const signature = sha256(`moved:${attemptedUrl}:${JSON.stringify(search.candidates)}`);
  if (prev && prev.lastStatus === "moved" && prev.lastMovedSignature === signature) {
    log(`[${dataset}] moved state persists (no new event): ${reason}`);
    return { outcome: "moved-unchanged" };
  }
  const event = await store.recordEvent({
    dataset,
    kind: "moved",
    risk: "red",
    summary: `데이터 이동/접근 불가 감지 (${reason}) — 포털 재검색 후보 ${search.candidates.length}건`,
    diff_json: {
      attemptedUrl,
      reason,
      searchUrl: search.searchUrl,
      searchKeyword: search.keyword,
      candidates: search.candidates,
      note: search.note,
    },
    status: "pending",
  });
  await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: event.summary });
  state[dataset] = {
    ...(prev || {}),
    lastCheckedAt: nowIso(),
    lastStatus: "moved",
    lastMovedSignature: signature,
  };
  log(`[${dataset}] MOVED(red) event: ${event.summary} | candidates: ${search.candidates.map((c) => c.title).join(" / ") || "(none parsed)"}`);
  return { outcome: "moved", event };
}

// ---------------------------------------------------------------------------
// check: file_head (school_library / KESS)
// ---------------------------------------------------------------------------

async function checkFileHead(entry, state, store, opts, log) {
  const dataset = entry.dataset;
  const url = opts.forceUrl || entry.check.urls.head;
  const prev = state[dataset] || null;

  let res;
  try {
    res = await fetchWithTimeout(url, { method: "HEAD" });
  } catch (err) {
    return await recordFailure(dataset, "HEAD 요청 실패(네트워크/타임아웃)", err.message, null, entry, state, store, log);
  }
  if (!res.ok) {
    if (res.status === 404) {
      return await recordMoved(dataset, url, entry, state, store, log, "HEAD 404");
    }
    return await recordFailure(dataset, `HEAD 요청 실패: HTTP ${res.status}`, null, res.status, entry, state, store, log);
  }

  const headers = {
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    contentLength: res.headers.get("content-length"),
  };
  const nextState = { ...headers, lastCheckedAt: nowIso(), lastStatus: "ok" };

  // Baseline when no real header fields were ever recorded yet. Presence-based
  // (mirrors checkJsonApi's `!prev || !prev.schema` pattern) rather than
  // `prev.lastStatus === undefined`: a prior transient failure (recordFailure)
  // writes lastStatus:"error" with no etag/lastModified/contentLength keys at
  // all, so a status-based check would wrongly skip the baseline branch on the
  // first successful HEAD after an error and diff real headers against
  // undefined, producing a spurious "content changed" event.
  const hasPriorHeaders = prev && (prev.etag !== undefined || prev.lastModified !== undefined || prev.contentLength !== undefined);
  if (!hasPriorHeaders) {
    state[dataset] = nextState;
    await store.appendAudit({
      actor: "scan.mjs",
      action: "baseline_recorded",
      dataset,
      detail: `baseline recorded: etag=${headers.etag} lastModified=${headers.lastModified} contentLength=${headers.contentLength}`,
    });
    log(`[${dataset}] baseline recorded (etag=${headers.etag}, lastModified=${headers.lastModified}, contentLength=${headers.contentLength})`);
    return { outcome: "baseline" };
  }

  const changed =
    prev.etag !== headers.etag || prev.lastModified !== headers.lastModified || prev.contentLength !== headers.contentLength;

  if (!changed) {
    state[dataset] = nextState;
    log(`[${dataset}] no change (HTTP headers identical)`);
    return { outcome: "unchanged" };
  }

  const event = await store.recordEvent({
    dataset,
    kind: "content",
    risk: "green",
    summary: `원격 파일 헤더 변경 감지 (ETag/Last-Modified/Content-Length)`,
    diff_json: { prev: { etag: prev.etag, lastModified: prev.lastModified, contentLength: prev.contentLength }, next: headers },
    status: "pending",
  });
  await store.appendAudit({ actor: "scan.mjs", action: "record_event", dataset, event_id: event.id, detail: event.summary });
  state[dataset] = nextState;
  log(`[${dataset}] GREEN content event: ${event.summary}`);
  return { outcome: "green", event };
}

// ---------------------------------------------------------------------------
// --simulate-change (local CSV treated as "new version" of a dataset's local_file)
// ---------------------------------------------------------------------------

async function runSimulateChange(entry, simulatePath, store, log) {
  const dataset = entry.dataset;
  const currentPath = path.join(REPO_ROOT, entry.local_file);
  const absoluteSimulatePath = path.isAbsolute(simulatePath) ? simulatePath : path.join(process.cwd(), simulatePath);

  const current = parseCsvFile(currentPath);
  const simulated = parseCsvFile(absoluteSimulatePath);

  const { added, removed } = diffSchema(current.header, simulated.header);
  const currentHash = hashRows(current.rows);
  const simulatedHash = hashRows(simulated.rows);

  let risk;
  let kind;
  let summary;
  if (removed.length > 0) {
    risk = "red";
    kind = "schema";
    summary = `[시뮬레이션] 컬럼 삭제 감지: ${removed.join(", ")}`;
  } else if (added.length > 0) {
    risk = "yellow";
    kind = "schema";
    summary = `[시뮬레이션] 컬럼 추가/개명 감지: ${added.join(", ")}`;
  } else if (currentHash !== simulatedHash) {
    risk = "green";
    kind = "content";
    summary = `[시뮬레이션] 내용 변경 감지 (스키마 동일, 행수 ${current.rows.length} -> ${simulated.rows.length})`;
  } else {
    risk = "green";
    kind = "content";
    summary = `[시뮬레이션] 변경 없음(스키마·내용 동일) — 데모 목적상 이벤트로 기록`;
  }

  const event = await store.recordEvent({
    dataset,
    kind,
    risk,
    summary,
    diff_json: {
      simulated: true,
      simulateSourcePath: simulatePath,
      addedColumns: added,
      removedColumns: removed,
      currentRowCount: current.rows.length,
      simulatedRowCount: simulated.rows.length,
      currentContentHash: currentHash,
      simulatedContentHash: simulatedHash,
    },
    status: "pending",
  });
  await store.appendAudit({
    actor: "scan.mjs --simulate-change",
    action: "simulate_scan",
    dataset,
    event_id: event.id,
    detail: summary,
  });

  log(`[${dataset}] SIMULATE ${risk.toUpperCase()} ${kind} event: ${summary}`);
  log(JSON.stringify(event, null, 2));
  return event;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = (...a) => console.log(...a);

  const sources = loadSources();
  const targetEntries = args.dataset ? sources.filter((s) => s.dataset === args.dataset) : sources;
  if (args.dataset && targetEntries.length === 0) {
    console.error(`scan.mjs: unknown --dataset "${args.dataset}" (not found in data_sources.yaml)`);
    process.exitCode = 1;
    return;
  }

  const store = await createStore();

  if (args.simulateChange) {
    if (!args.dataset) {
      console.error("scan.mjs: --simulate-change requires --dataset <name>");
      process.exitCode = 1;
      return;
    }
    await runSimulateChange(targetEntries[0], args.simulateChange, store, log);
    return;
  }

  const state = loadState();
  const summary = { baseline: 0, unchanged: 0, green: 0, yellow: 0, red: 0, moved: 0, error: 0, skipped: 0 };

  for (const entry of targetEntries) {
    const type = entry.check?.type;
    let result;
    if (type === "manual") {
      summary.skipped++;
      log(`[${entry.dataset}] manual check.type — skip (수동 확인 필요, 이벤트 없음)`);
      continue;
    } else if (type === "json_api") {
      result = await checkJsonApi(entry, state, store, args, log);
    } else if (type === "file_head") {
      result = await checkFileHead(entry, state, store, args, log);
    } else {
      log(`[${entry.dataset}] unknown check.type "${type}" — skipping`);
      continue;
    }
    const outcome = result?.outcome || "unknown";
    const bucketKey = outcome.replace("-unchanged", "");
    if (outcome === "unchanged" || outcome.endsWith("-unchanged")) summary.unchanged++;
    else if (summary[bucketKey] !== undefined) summary[bucketKey]++;
  }

  saveState(state);

  log("---");
  log(`scan summary: ${JSON.stringify(summary)}`);
}

main().catch((err) => {
  console.error(`scan.mjs failed: ${err.stack || err.message}`);
  process.exitCode = 1;
});
