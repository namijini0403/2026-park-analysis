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
const crypto = require("node:crypto");
const yaml = require("js-yaml");

const REPO_ROOT = path.join(__dirname, "..");
const SOURCES_PATH = path.join(REPO_ROOT, "data_sources.yaml");
const STATE_PATH = path.join(REPO_ROOT, "data", "update_center_state.json");

const TOKEN_HEADER = "x-update-center-token";
const ACTOR = "web-admin";

if (!process.env.UPDATE_CENTER_TOKEN) {
  console.warn("[update-center] UPDATE_CENTER_TOKEN 미설정 — 시연용 기본 토큰 '2026' 사용 중");
}

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
      // P5 Task 1: reuse the single-source-of-truth module contract checker
      // (checkModuleDoc/POLICY_ACTION_ENUM) for the onboarding endpoint below,
      // instead of duplicating the 7-action enum / required-field list here.
      import("../scripts/validate_module_contract.mjs"),
    ]).then(([storeMod, scanMod, reanalyzeMod, contractMod]) => ({ storeMod, scanMod, reanalyzeMod, contractMod }));
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

function parseLimit(raw, fallback, max = 500) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
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
// Never throws — always resolves to { note, source } where source is
// "openai" (a real Responses API call produced text) or "fallback"
// (no API key, a failed/empty call, or an exception — deterministicNote()).
async function buildAiNote(event) {
  if (!process.env.OPENAI_API_KEY) return { note: deterministicNote(event), source: "fallback" };
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
    if (!response.ok) return { note: deterministicNote(event), source: "fallback" };
    const data = await response.json();
    const text = extractText(data).trim();
    if (!text) return { note: deterministicNote(event), source: "fallback" };
    return { note: `${text} (해설은 참고용입니다)`, source: "openai" };
  } catch {
    return { note: deterministicNote(event), source: "fallback" };
  }
}

// ---------------------------------------------------------------------------
// 온보딩 에이전트 (P5 Task 1)
//
// POST /api/update-center/onboarding — 담당자 자연어 요청 -> 설계안 + 모듈 YAML
// 초안(yaml_draft) 생성 -> scripts/validate_module_contract.mjs의
// checkModuleDoc()으로 기계 검사(등록되지 않은 신규 모듈이므로 registryBlock은
// 생략해 LAYER_REGISTRY parity 검사는 건너뜀) -> data_events(kind=
// onboarding_proposal, risk=yellow)에 제안으로만 저장. modules/ 디렉토리나
// data_processed/에는 이 경로에서 절대 쓰지 않는다 — 승인 전 운영 미반영 원칙.
// ---------------------------------------------------------------------------

const ONBOARDING_TEXT_MIN = 10;
const ONBOARDING_TEXT_MAX = 2000;
const ONBOARDING_MODEL = AI_MODEL; // same AI_EXPLAINER_MODEL env var as the ai_note pattern above
const ONBOARDING_MAX_OUTPUT_TOKENS = 1600;

// 철학 체크리스트: 항상 고정 3항목, 항상 "human 검토 필요" — AI가 자체 통과를
// 선언할 수 없다(Global Constraints). LLM의 참고 의견은 philosophy_notes로
// 별도 반환.
const PHILOSOPHY_CHECKLIST = [
  { id: "walk_network", text: "도달성 지표는 직선이 아닌 도보 네트워크 기준인가" },
  { id: "target_leakage", text: "격차 유형·권고에 target leakage 요소가 없는가" },
  { id: "stigma", text: "학교 서열화·낙인 효과를 유발하는 표시가 없는가" },
];

function onboardingSlug(requestText) {
  // ASCII-safe placeholder id derived from the request text — deterministic
  // (same request -> same slug) but not a real registry id. Registry parity
  // is skipped for onboarding proposals (registryBlock omitted below), so a
  // placeholder is fine; a human picks the real layer.id before merging.
  const hash = crypto.createHash("sha1").update(requestText).digest("hex").slice(0, 8);
  return `new_module_${hash}`;
}

const ONBOARDING_STOPWORDS = new Set([
  "그리고", "합니다", "싶어요", "분석", "하고", "위한", "관련", "대한", "것을", "해서",
  "하는", "있는", "위해", "에서", "으로", "해주세요", "해줘", "같아요", "대해", "대해서",
]);

// Deterministic keyword extraction for the fallback path's suggested_datasets
// (no network call — just tokenizes the request text). Real portal search is
// out of scope for this prototype either way (see docs/update_center.md 한계).
function extractKeywords(requestText, max = 5) {
  const tokens = requestText
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !ONBOARDING_STOPWORDS.has(t));
  const seen = new Set();
  const out = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

// Fallback yaml_draft: every REQUIRED field from validate_module_contract.mjs
// present, policy_actions a valid non-empty subset of POLICY_ACTION_ENUM,
// location.file exactly "추가 확인 필요" (the sentinel checkModuleDoc's
// existsSync check skips), layer.id the ASCII placeholder slug. Built via
// yaml.dump (not string concatenation) so Korean text with colons/quotes is
// always emitted as syntactically valid YAML.
function buildFallbackYamlDraft(requestText, slug) {
  const doc = {
    module: slug,
    resource_type: `추가 확인 필요 — 요청 원문: ${requestText}`,
    location: {
      file: "추가 확인 필요",
      lat_key: "추가 확인 필요",
      lng_key: "추가 확인 필요",
      name_key: "추가 확인 필요",
    },
    external_supply: [{ metric: "추가 확인 필요", source: "추가 확인 필요" }],
    demand_unit: "추가 확인 필요",
    policy_actions: ["access_route_improvement", "maintain_monitor"],
    reference_date: new Date().toISOString().slice(0, 10),
    source: [{ name: "추가 확인 필요", provider: "추가 확인 필요" }],
    layer: {
      id: slug,
      button_label: "추가 확인 필요",
      panel_label: "추가 확인 필요",
      color: "#6B7280",
    },
  };
  return yaml.dump(doc, { schema: yaml.CORE_SCHEMA, lineWidth: -1 });
}

function buildFallbackProposal(requestText) {
  const slug = onboardingSlug(requestText);
  const snippet = requestText.length > 60 ? `${requestText.slice(0, 60)}...` : requestText;
  return {
    design_summary:
      `[AI 미사용 폴백] "${snippet}" 요청에 대한 자동 초안입니다. 자원 종류·데이터 출처·지표는 ` +
      `모두 "추가 확인 필요"로 채워졌으며, 담당자가 실제 값으로 채워 넣어야 합니다. ` +
      `policy_actions는 임시로 access_route_improvement·maintain_monitor를 지정했으니 ` +
      `실제 정책 방향에 맞게 재검토가 필요합니다. layer.id도 임시 slug(${slug})이므로 ` +
      `실제 등록 시 사람이 최종 id를 정해야 합니다.`,
    yaml_draft: buildFallbackYamlDraft(requestText, slug),
    suggested_datasets: extractKeywords(requestText),
    philosophy_notes: [
      "[AI 미사용 폴백] 도보 네트워크 기준 도달성 지표를 확보할 수 있는 원천 데이터인지 사람이 직접 확인해야 합니다.",
      "[AI 미사용 폴백] 격차 유형·권고 로직에 결과를 미리 아는 변수(target leakage)가 섞이지 않는지 사람이 직접 확인해야 합니다.",
    ],
    ai_source: "fallback",
    slug,
  };
}

function buildOnboardingSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["design_summary", "yaml_draft", "suggested_datasets", "philosophy_notes"],
    properties: {
      design_summary: { type: "string" },
      yaml_draft: { type: "string" },
      suggested_datasets: { type: "array", items: { type: "string" } },
      philosophy_notes: { type: "array", items: { type: "string" } },
    },
  };
}

function buildOnboardingInput(requestText, slug, policyActionList) {
  const systemPrompt =
    "너는 공원·학교 접근성 분석 앱의 '신규 모듈 온보딩' 설계 보조자다. 담당자의 자연어 요청을 읽고 " +
    "이 앱의 표준 데이터 계약(모듈 YAML)을 따르는 설계안과 YAML 초안을 만든다. 너는 제안만 한다 — " +
    "최종 승인, 실제 데이터 검증, 정책 판단은 사람이 한다. yaml_draft가 계약을 통과했다고 스스로 " +
    "선언하지 않는다(별도 기계 검사가 판정한다).\n\n" +
    "표준 모듈 YAML 필수 필드: module(영문 slug), resource_type(자원 종류 설명), " +
    "location{file,lat_key,lng_key,name_key}(원천 CSV 경로 및 좌표/이름 컬럼명 — 실제 파일을 모르면 " +
    "각 값에 정확히 문자열 \"추가 확인 필요\"를 넣는다), external_supply(배열, 각 항목 {metric,source}), " +
    "demand_unit(수요 단위 설명), policy_actions(배열, 아래 7-action enum 중에서만 선택, 최소 1개), " +
    "reference_date(YYYY-MM-DD), source(배열, 각 항목 {name,provider}), " +
    `layer{id(영문 slug — 이 제안은 아직 등록되지 않은 신규 모듈이므로 반드시 "${slug}"를 그대로 사용),` +
    "button_label,panel_label,color}.\n" +
    "선택 필드: internal_supply, capacity, target_users, operating_hours, constraints(배열), " +
    "gap_type_actions(객체, 값은 policy_actions와 동일한 값 집합).\n\n" +
    `policy_actions/gap_type_actions에 쓸 수 있는 7-action enum: ${policyActionList.join(", ")}\n\n` +
    "예시 구조 — park.yaml(공원·놀이터): location.file=data_processed/parks.csv, external_supply는 " +
    "등시권 공원 수·최근접 거리·표시용 녹지비율 3개 지표, policy_actions=[external_supply_new, " +
    "access_route_improvement, maintain_monitor], layer.id=parks. reading.yaml(도서관·독서교육): " +
    "external_supply(등시권 공공도서관 수 등)와 internal_supply(장서수·좌석수·사서합계 등)를 모두 갖고, " +
    "gap_type_actions로 격차 유형별 정책 행동을 policy_actions와 동일 값 집합으로 매핑한다. layer.id=library.\n\n" +
    "yaml_draft는 위 구조를 그대로 따르는 진짜 YAML 문서 '문자열'이어야 한다(마크다운 코드블록 표시 없이). " +
    "실제 원천 데이터·컬럼명·수치를 모르면 절대 지어내지 말고 정확히 \"추가 확인 필요\"라고 쓴다. " +
    "philosophy_notes에는 이 제안이 (1)도보 네트워크 기준 도달성 지표를 쓰는지, (2)격차 유형·권고 로직에 " +
    "결과를 미리 아는 변수(target leakage)가 섞일 위험이 있는지, (3)학교 서열화나 낙인 효과로 이어질 " +
    "표시 요소가 있는지에 대한 검토 의견을 한국어 문장 배열로 적는다. 이 노트는 참고 의견이며 최종 " +
    "판정이 아니다(최종 판정은 별도 체크리스트로 사람이 한다).";

  return [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({ request_text: requestText, placeholder_layer_id: slug }),
    },
  ];
}

async function buildOpenAiOnboardingProposal(requestText, slug, policyActionList) {
  const requestBody = {
    model: ONBOARDING_MODEL,
    input: buildOnboardingInput(requestText, slug, policyActionList),
    store: false,
    max_output_tokens: ONBOARDING_MAX_OUTPUT_TOKENS,
    reasoning: { effort: "none" },
    tools: [],
    tool_choice: "none",
    parallel_tool_calls: false,
    text: {
      format: {
        type: "json_schema",
        name: "onboarding_proposal",
        strict: true,
        schema: buildOnboardingSchema(),
      },
    },
  };
  const response = await fetchOpenAiResponse(requestBody);
  if (!response.ok) return null;
  const data = await response.json();
  const text = extractText(data).trim();
  if (!text) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.design_summary !== "string" || typeof parsed.yaml_draft !== "string") return null;
  if (!Array.isArray(parsed.suggested_datasets) || !Array.isArray(parsed.philosophy_notes)) return null;
  return { ...parsed, ai_source: "openai", slug };
}

// Never throws — always resolves to a proposal object with ai_source
// "openai" or "fallback". Mirrors buildAiNote()'s never-throw contract.
async function buildOnboardingProposal(requestText, contractMod) {
  const slug = onboardingSlug(requestText);
  if (process.env.OPENAI_API_KEY) {
    try {
      const proposal = await buildOpenAiOnboardingProposal(requestText, slug, [...contractMod.POLICY_ACTION_ENUM]);
      if (proposal) return proposal;
    } catch {
      // fall through to deterministic fallback below
    }
  }
  return buildFallbackProposal(requestText);
}

// Machine check: parse yaml_draft with js-yaml CORE_SCHEMA (parse failure is
// itself reported, not thrown), then run checkModuleDoc() with registryBlock
// omitted — registry parity has no meaning for a module that isn't in
// LAYER_REGISTRY yet.
function checkYamlDraft(yamlDraft, contractMod) {
  let doc = null;
  let parseError = null;
  try {
    doc = yaml.load(yamlDraft, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    parseError = err.message;
  }
  if (parseError || doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return {
      yaml_parsed: false,
      parse_error: parseError || "yaml_draft가 YAML 객체로 파싱되지 않았습니다.",
      failures: [],
      warnings: [],
      passed: false,
    };
  }
  const { failures, warnings } = contractMod.checkModuleDoc(doc);
  return { yaml_parsed: true, parse_error: null, failures, warnings, passed: failures.length === 0 };
}

async function handlePostOnboarding(req, res) {
  const body = req.body || {};
  const requestText = typeof body.request_text === "string" ? body.request_text.trim() : "";
  if (requestText.length < ONBOARDING_TEXT_MIN || requestText.length > ONBOARDING_TEXT_MAX) {
    return json(res, 400, {
      error: `request_text는 ${ONBOARDING_TEXT_MIN}~${ONBOARDING_TEXT_MAX}자여야 합니다 (현재 ${requestText.length}자).`,
    });
  }

  const { contractMod } = await loadModules();
  const proposal = await buildOnboardingProposal(requestText, contractMod);
  const contractCheck = checkYamlDraft(proposal.yaml_draft, contractMod);
  const philosophyChecklist = PHILOSOPHY_CHECKLIST.map((item) => ({ ...item, status: "human 검토 필요" }));
  const summarySnippet = requestText.length > 80 ? `${requestText.slice(0, 80)}...` : requestText;
  const summary = `신규 모듈 온보딩 제안 — "${summarySnippet}"`;
  const dataset = `onboarding:${proposal.slug || onboardingSlug(requestText)}`;

  const store = await getStore();
  const event = await store.recordEvent({
    dataset,
    kind: "onboarding_proposal",
    risk: "yellow",
    status: "pending",
    summary,
    diff_json: {
      request_text: requestText,
      design_summary: proposal.design_summary,
      yaml_draft: proposal.yaml_draft,
      contract_check: contractCheck,
      philosophy_notes: proposal.philosophy_notes,
      ai_source: proposal.ai_source,
    },
    actor: ACTOR,
  });
  await store.appendAudit({
    actor: ACTOR,
    action: "onboarding_proposal_created",
    dataset,
    event_id: event.id,
    detail: `온보딩 제안 생성 — source=${proposal.ai_source}`,
  });

  return json(res, 200, {
    event_id: event.id,
    dataset,
    request_text: requestText,
    design_summary: proposal.design_summary,
    yaml_draft: proposal.yaml_draft,
    suggested_datasets: proposal.suggested_datasets,
    philosophy_notes: proposal.philosophy_notes,
    philosophy_checklist: philosophyChecklist,
    contract_check: contractCheck,
    ai_source: proposal.ai_source,
    notice: "이 제안은 저장만 되며 승인·파일 생성 전까지 운영에 반영되지 않습니다.",
  });
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
  const limit = parseLimit(url.searchParams.get("limit"), 20, 100);
  const versions = await store.listVersions(dataset, limit);
  // snapshot is a full base64 file blob (can be large) — the list view only
  // needs content_hash/row_count/flags. Rollback (handlePostRollback) fetches
  // the full row separately via store.getVersion(), unaffected by this.
  const trimmed = versions.map(({ snapshot, ...rest }) => rest);
  return json(res, 200, { versions: trimmed });
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
    const { note, source } = await buildAiNote(ev);
    const updated = await store.setEventAiNote(ev.id, note);
    await store.appendAudit({
      actor: ACTOR,
      action: "ai_note_generated",
      dataset: ev.dataset,
      event_id: ev.id,
      detail: `AI 해설 생성 — source=${source}`,
    });
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

  const { note, source } = await buildAiNote({
    dataset: event.dataset,
    kind: event.kind,
    risk: event.risk,
    status: "applied",
    summary: event.summary,
    diff_json: { ...diff, applied: true, applyDiff: applyResult.diff },
  });
  const finalEvent = await store.setEventAiNote(event.id, note);
  await store.appendAudit({
    actor: ACTOR,
    action: "ai_note_generated",
    dataset: event.dataset,
    event_id: event.id,
    detail: `AI 해설 생성(적용 후) — source=${source}`,
  });

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
  const existingVersion = await store.getVersion(versionId);
  if (!existingVersion) return json(res, 404, { error: `버전을 찾을 수 없습니다: ${versionId}` });
  if (existingVersion.rolled_back) {
    return json(res, 409, { error: "이미 롤백된 버전입니다.", version: existingVersion });
  }

  const { reanalyzeMod } = await loadModules();
  try {
    const result = await reanalyzeMod.rollbackVersion(versionId, store, ACTOR);
    if (existingVersion.source_event_id) {
      await store.updateEventStatus(existingVersion.source_event_id, "rolled_back", ACTOR);
    }
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
    if (req.method === "POST" && subPath === "/onboarding") return await handlePostOnboarding(req, res);
    return json(res, 404, { error: `알 수 없는 엔드포인트: ${req.method} ${subPath}` });
  } catch (err) {
    console.error("[update-center] handler error:", err);
    return json(res, 500, { error: "서버 내부 오류가 발생했습니다.", detail: err.message });
  }
};
