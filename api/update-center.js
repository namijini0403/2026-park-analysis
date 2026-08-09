// api/update-center.js
// P4 Task 3: server API for the update-center prototype (CDC events, audit log,
// scan trigger, approve/hold/rollback) + AI change annotation.
//
// CommonJS (matches server.js's require() style — see api/ai-explainer-v2.js).
// The update_center modules are ESM (.mjs); they are loaded via dynamic
// import() and cached, since a CommonJS module cannot require() an ESM file.
//
// Token gate: every request (GET and POST alike) must carry header
// x-update-center-token equal to process.env.UPDATE_CENTER_TOKEN || "2026" —
// demo-grade, same trust level as the app's existing ACCESS_CODE gate
// (see docs/superpowers/plans/2026-08-09-p4-update-center.md Global Constraints).
//
// Every mutating action (scan/approve/hold/rollback) appends an audit_log entry
// with actor="web-admin" (scan.mjs's own internal audit calls, e.g.
// "record_event" for each detected change, get actor="web-admin" passed through
// too when triggered from this API — see runScan's `actor` option).
//
// AI 해설 (ai_note): on every event a scan produces, and again after approve
// applies a change, this module calls OpenAI's Responses API (mirroring
// api/ai-explainer-v2.js's endpoint/model-env/retry pattern) for a short
// Korean summary of diff_json. No OPENAI_API_KEY, or a failed call, falls back
// to a deterministic string built from diff_json — either way the AI/fallback
// text ends with "해설은 참고용입니다" (AI는 해설만, 판단은 코드, 반영은 사람 승인).

const fs = require("node:fs");
const path = require("node:path");
const yaml = require("js-yaml");

const REPO_ROOT = path.join(__dirname, "..");
const SOURCES_PATH = path.join(REPO_ROOT, "data_sources.yaml");
const STATE_PATH = path.join(REPO_ROOT, "data", "update_center_state.json");

const TOKEN_HEADER = "x-update-center-token";
const ACTOR = "web-admin";

const AI_MODEL = process.env.AI_EXPLAINER_MODEL || "gpt-5.4-mini";
const AI_TIMEOUT_MS = 10000;
const AI_MAX_OUTPUT_TOKENS = 300;

// ---------------------------------------------------------------------------
// ESM module loading (cached) + store instance (cached — avoids opening a new
// pg Pool on every request when DATABASE_URL is set)
// ---------------------------------------------------------------------------

let modulesPromise = null;
function loadModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import("../scripts/update_center/store.mjs"),
      import("../scripts/update_center/scan.mjs"),
      import("../scripts/update_center/reanalyze.mjs"),
    ]).then(([storeMod, scanMod, reanalyzeMod]) => ({ storeMod, scanMod, reanalyzeMod }));
  }
  return modulesPromise;
}

let storePromise = null;
async function getStore() {
  if (!storePromise) {
    const { storeMod } = await loadModules();
    storePromise = storeMod.createStore();
  }
  return storePromise;
}

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function parseLimit(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// ---------------------------------------------------------------------------
// AI 해설 (mirrors api/ai-explainer-v2.js's OpenAI Responses API request
// pattern: same endpoint, same model-env-var name, 1 retry on transient
// status codes with a 350ms backoff. Adds an explicit AbortController timeout
// since ai-explainer-v2.js relies on the platform's own request timeout and
// this server (node:http) has none configured.)
// ---------------------------------------------------------------------------

function shouldRetryOpenAiStatus(status) {
  return [408, 409, 429, 500, 502, 503, 504].includes(Number(status));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenAiWithTimeout(requestBody) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOpenAiResponse(requestBody) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchOpenAiWithTimeout(requestBody);
      if (response.ok || !shouldRetryOpenAiStatus(response.status) || attempt === 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    }
    await wait(350);
  }
  throw lastError || new Error("OpenAI response request failed");
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
      if (typeof part.text === "string") return part.text;
    }
  }
  return "";
}

// Deterministic fallback: no network call, built directly from diff_json.
// Used when OPENAI_API_KEY is unset or the OpenAI call fails/returns nothing.
function deterministicNote(event) {
  const d = event.diff_json || {};
  const parts = [`[${event.dataset}] ${event.kind} 변경 감지(${event.risk} 등급).`];
  const addedCols = d.addedColumns || d.added;
  const removedCols = d.removedColumns || d.removed;
  if (Array.isArray(addedCols) && addedCols.length) parts.push(`추가 컬럼: ${addedCols.join(", ")}.`);
  if (Array.isArray(removedCols) && removedCols.length) parts.push(`삭제 컬럼: ${removedCols.join(", ")}.`);
  if (typeof d.currentRowCount === "number" && typeof d.simulatedRowCount === "number") {
    parts.push(`행수 ${d.currentRowCount} -> ${d.simulatedRowCount}.`);
  }
  if (d.prevTotalCount !== undefined && d.totalCount !== undefined) {
    parts.push(`totalCount ${d.prevTotalCount ?? "?"} -> ${d.totalCount}.`);
  }
  if (d.applyDiff) {
    parts.push(
      `승인 적용 완료 — 영향 학교 ${d.applyDiff.affected_school_count}건, ` +
        `external_shortage ${d.applyDiff.external_shortage_before}->${d.applyDiff.external_shortage_after}건.`
    );
  }
  parts.push("(결정론적 요약 — OPENAI_API_KEY 미설정 또는 호출 실패) 해설은 참고용입니다.");
  return parts.join(" ");
}

// event: needs at minimum { dataset, kind, risk, status, summary, diff_json }.
// Never throws — always resolves to a usable note string.
async function buildAiNote(event) {
  if (!process.env.OPENAI_API_KEY) return deterministicNote(event);
  try {
    const diffText = JSON.stringify(event.diff_json || {}).slice(0, 4000);
    const requestBody = {
      model: AI_MODEL,
      input: [
        {
          role: "system",
          content:
            "너는 공공데이터 업데이트 센터의 변경 이벤트 해설가다. 정책 판단, 승인 여부, 데이터 반영 여부를 결정하지 않는다. " +
            "무엇이 어떻게 바뀌었는지만 한국어 2~3문장으로 요약한다. 새로운 추천이나 근거 밖 추론을 하지 않는다.",
        },
        {
          role: "user",
          content:
            `데이터셋: ${event.dataset}\n종류: ${event.kind}\n등급: ${event.risk}\n상태: ${event.status}\n` +
            `요약: ${event.summary || ""}\ndiff_json: ${diffText}`,
        },
      ],
      store: false,
      max_output_tokens: AI_MAX_OUTPUT_TOKENS,
      reasoning: { effort: "none" },
      tools: [],
      tool_choice: "none",
      parallel_tool_calls: false,
    };
    const response = await fetchOpenAiResponse(requestBody);
    if (!response.ok) return deterministicNote(event);
    const data = await response.json();
    const text = extractText(data).trim();
    if (!text) return deterministicNote(event);
    return `${text} (해설은 참고용입니다)`;
  } catch {
    return deterministicNote(event);
  }
}

// ---------------------------------------------------------------------------
// GET handlers
// ---------------------------------------------------------------------------

async function handleGetSources(res) {
  let doc;
  try {
    doc = yaml.load(fs.readFileSync(SOURCES_PATH, "utf-8"));
  } catch (err) {
    return json(res, 500, { error: `data_sources.yaml 파싱 실패: ${err.message}` });
  }
  const sources = Array.isArray(doc?.sources) ? doc.sources : [];
  let state = {};
  if (fs.existsSync(STATE_PATH)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8") || "{}");
    } catch {
      state = {};
    }
  }
  const merged = sources.map((s) => ({ ...s, last_state: state[s.dataset] || null }));
  return json(res, 200, { sources: merged });
}

async function handleGetEvents(res, url) {
  const store = await getStore();
  const events = await store.listEvents(parseLimit(url.searchParams.get("limit"), 50));
  return json(res, 200, { events });
}

async function handleGetAudit(res, url) {
  const store = await getStore();
  const audit = await store.listAudit(parseLimit(url.searchParams.get("limit"), 100));
  return json(res, 200, { audit });
}

async function handleGetVersions(res, url) {
  const store = await getStore();
  const dataset = url.searchParams.get("dataset") || undefined;
  const versions = await store.listVersions(dataset);
  return json(res, 200, { versions });
}

// ---------------------------------------------------------------------------
// POST handlers
// ---------------------------------------------------------------------------

async function handlePostScan(req, res) {
  const body = req.body || {};
  const dataset = typeof body.dataset === "string" && body.dataset ? body.dataset : null;
  const simulateChangeB64 =
    typeof body.simulate_change_b64 === "string" && body.simulate_change_b64 ? body.simulate_change_b64 : null;

  const { scanMod } = await loadModules();
  const logLines = [];
  const log = (...parts) => logLines.push(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" "));

  let result;
  try {
    result = await scanMod.runScan({ dataset, simulateChangeB64, log, actor: ACTOR });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }

  const store = await getStore();
  const rawEvents = result.mode === "simulate" ? [result.event] : result.events;
  const events = [];
  for (const ev of rawEvents) {
    const note = await buildAiNote(ev);
    const updated = await store.setEventAiNote(ev.id, note);
    events.push(updated || { ...ev, ai_note: note });
  }

  return json(res, 200, {
    mode: result.mode,
    summary: result.mode === "scan" ? result.summary : null,
    events,
    log: logLines,
  });
}

async function handlePostApprove(req, res) {
  const body = req.body || {};
  const eventId = body.event_id;
  if (!eventId || typeof eventId !== "string") return json(res, 400, { error: "event_id가 필요합니다." });

  const store = await getStore();
  const event = await store.getEvent(eventId);
  if (!event) return json(res, 404, { error: `이벤트를 찾을 수 없습니다: ${eventId}` });

  // Global Constraints: red 등급은 자동 반영 금지 · 승인 버튼 비활성. moved/error
  // kinds are always risk=red already, but checked explicitly here too.
  if (event.risk === "red" || event.kind === "moved" || event.kind === "error") {
    await store.appendAudit({
      actor: ACTOR,
      action: "approve_rejected",
      dataset: event.dataset,
      event_id: event.id,
      detail: `승인 거부 — risk=${event.risk} kind=${event.kind} (red/moved/error는 자동 반영 금지)`,
    });
    return json(res, 409, { error: "red 등급 또는 moved/error 이벤트는 승인할 수 없습니다.", event });
  }

  if (event.status === "applied" || event.status === "rolled_back") {
    return json(res, 409, { error: `이미 처리된 이벤트입니다 (status=${event.status}).` });
  }

  const diff = event.diff_json || {};
  const simulateCsvB64 = diff.simulateCsvB64 || null;

  // Honest prototype boundary: real remote change events (no simulate payload
  // attached) have no automated "fetch the new remote content and reanalyze"
  // path in this prototype. Only scan.mjs's --simulate-change / simulate_change_b64
  // path attaches a payload the reanalyze module can act on.
  if (!simulateCsvB64) {
    await store.appendAudit({
      actor: ACTOR,
      action: "approve_rejected_no_payload",
      dataset: event.dataset,
      event_id: event.id,
      detail: "원격 반영 시도 거부 — 시뮬레이션 페이로드 없음(시제품 범위 밖)",
    });
    return json(res, 501, { error: "원격 반영은 시제품 범위 밖 — 시뮬레이션 페이로드 필요", event });
  }

  if (event.dataset !== "libraries") {
    await store.appendAudit({
      actor: ACTOR,
      action: "approve_rejected_unsupported_dataset",
      dataset: event.dataset,
      event_id: event.id,
      detail: `재분석 모듈이 없는 데이터셋(${event.dataset})은 시제품 범위 밖 — libraries만 지원`,
    });
    return json(res, 501, {
      error: `데이터셋 "${event.dataset}"의 재분석/반영 모듈은 시제품 범위 밖입니다 (libraries만 지원).`,
      event,
    });
  }

  await store.updateEventStatus(event.id, "approved", ACTOR);
  await store.appendAudit({
    actor: ACTOR,
    action: "approve",
    dataset: event.dataset,
    event_id: event.id,
    detail: `승인 — 시뮬레이션 CSV 재분석 후 적용 시작 (risk=${event.risk})`,
  });

  const { reanalyzeMod } = await loadModules();
  const csvText = Buffer.from(simulateCsvB64, "base64").toString("utf-8");

  let applyResult;
  try {
    applyResult = await reanalyzeMod.applyLibrariesUpdate(csvText, store, event.id, ACTOR);
  } catch (err) {
    await store.appendAudit({
      actor: ACTOR,
      action: "approve_apply_failed",
      dataset: event.dataset,
      event_id: event.id,
      detail: `적용 실패: ${err.message}`,
    });
    return json(res, 500, { error: `적용 중 오류가 발생했습니다: ${err.message}` });
  }

  await store.updateEventStatus(event.id, "applied", ACTOR);
  await store.appendAudit({
    actor: ACTOR,
    action: "applied",
    dataset: event.dataset,
    event_id: event.id,
    detail: `적용 완료 — versionId=${applyResult.versionId}, 영향 학교 ${applyResult.diff.affected_school_count}건`,
  });

  const note = await buildAiNote({
    dataset: event.dataset,
    kind: event.kind,
    risk: event.risk,
    status: "applied",
    summary: event.summary,
    diff_json: { ...diff, applied: true, applyDiff: applyResult.diff },
  });
  const finalEvent = await store.setEventAiNote(event.id, note);

  return json(res, 200, { event: finalEvent, versionId: applyResult.versionId, diff: applyResult.diff });
}

async function handlePostHold(req, res) {
  const body = req.body || {};
  const eventId = body.event_id;
  if (!eventId || typeof eventId !== "string") return json(res, 400, { error: "event_id가 필요합니다." });

  const store = await getStore();
  const event = await store.getEvent(eventId);
  if (!event) return json(res, 404, { error: `이벤트를 찾을 수 없습니다: ${eventId}` });
  if (event.status === "applied" || event.status === "rolled_back") {
    return json(res, 409, { error: `이미 처리된 이벤트입니다 (status=${event.status}).` });
  }

  const updated = await store.updateEventStatus(event.id, "held", ACTOR);
  await store.appendAudit({
    actor: ACTOR,
    action: "hold",
    dataset: event.dataset,
    event_id: event.id,
    detail: "보류 처리",
  });
  return json(res, 200, { event: updated });
}

async function handlePostRollback(req, res) {
  const body = req.body || {};
  const versionId = body.version_id;
  if (!versionId || typeof versionId !== "string") return json(res, 400, { error: "version_id가 필요합니다." });

  const store = await getStore();
  const { reanalyzeMod } = await loadModules();
  try {
    const result = await reanalyzeMod.rollbackVersion(versionId, store, ACTOR);
    const version = await store.getVersion(versionId);
    return json(res, 200, { versionId: result.versionId, restoredFiles: result.restoredFiles, version });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

module.exports = async function handler(req, res) {
  const expectedToken = process.env.UPDATE_CENTER_TOKEN || "2026";
  const providedToken = req.headers[TOKEN_HEADER];
  if (providedToken !== expectedToken) {
    return json(res, 401, { error: `인증 실패 — ${TOKEN_HEADER} 헤더가 올바르지 않습니다.` });
  }

  let url;
  try {
    url = new URL(req.url, "http://localhost");
  } catch {
    return json(res, 400, { error: "잘못된 요청 경로입니다." });
  }
  const subPath = url.pathname.replace(/^\/api\/update-center/, "") || "/";

  try {
    if (req.method === "GET" && subPath === "/sources") return await handleGetSources(res);
    if (req.method === "GET" && subPath === "/events") return await handleGetEvents(res, url);
    if (req.method === "GET" && subPath === "/audit") return await handleGetAudit(res, url);
    if (req.method === "GET" && subPath === "/versions") return await handleGetVersions(res, url);
    if (req.method === "POST" && subPath === "/scan") return await handlePostScan(req, res);
    if (req.method === "POST" && subPath === "/approve") return await handlePostApprove(req, res);
    if (req.method === "POST" && subPath === "/hold") return await handlePostHold(req, res);
    if (req.method === "POST" && subPath === "/rollback") return await handlePostRollback(req, res);
    return json(res, 404, { error: `알 수 없는 엔드포인트: ${req.method} ${subPath}` });
  } catch (err) {
    console.error("[update-center] handler error:", err);
    return json(res, 500, { error: "서버 내부 오류가 발생했습니다.", detail: err.message });
  }
};
