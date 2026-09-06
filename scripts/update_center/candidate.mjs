// scripts/update_center/candidate.mjs
//
// "실제 수집 → 후보(staged candidate)" 단계.
//
//   1) json_api 소스는 totalCount 에 도달할 때까지 모든 페이지를 가져온다(perPage 존중,
//      상한 초과 시 잘라내고 사실을 보고한다 — 조용히 일부만 쓰지 않는다).
//   2) 데이터셋 어댑터(adapters/<dataset>.mjs)로 정규화한다.
//   3) data/update_center/staging/<event_id>/ 에 파일 + 파일별 sha256 을 기록한다.
//   4) quality.mjs 의 품질검사(review MVP 규칙 이식본)를 돌린다.
//   5) 현재 적용본과의 스키마 diff + 기본키 기준 레코드 diff 를 계산한다.
//   6) 재분석 모듈이 있는 데이터셋(libraries)은 영향 학교 수까지 계산한다.
//
// 네트워크는 전부 주입 가능한 fetchImpl 로 통과시키므로 테스트는 네트워크 없이 돌린다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { getAdapter, hasDedicatedAdapter } from "./adapters/index.mjs";
import {
  analyzeContent,
  overallStatus,
  riskFromStatus,
  approvalBlocked,
  schemaDiffAgainstCurrent,
  recordDiffByKey,
  csvToRecords,
} from "./quality.mjs";
import { applyRoot, stagingDir, ensureDir, assertSafeRelPath } from "./paths.mjs";

const DEFAULT_MAX_PAGES = 50;
const DEFAULT_PER_PAGE = 1000;
const FETCH_TIMEOUT_MS = Number(process.env.UPDATE_CENTER_FETCH_TIMEOUT_MS || 15000);

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0.0.0 Safari/537.36 ParkRailwayUpdateCenter/1.0";

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function defaultFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    ...opts,
    signal: controller.signal,
    headers: { "User-Agent": USER_AGENT, ...(opts.headers || {}) },
  }).finally(() => clearTimeout(timer));
}

function setQueryParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, String(value));
  return u.toString();
}

function getQueryParam(url, key) {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.result && Array.isArray(payload.result.data)) return payload.result.data;
  const arrayValue = Object.values(payload).find((v) => Array.isArray(v));
  return arrayValue || [];
}

function extractTotalCount(payload, fallback) {
  if (!payload || typeof payload !== "object") return fallback;
  if (Number.isFinite(Number(payload.totalCount))) return Number(payload.totalCount);
  if (payload.result && Number.isFinite(Number(payload.result.totalCount))) return Number(payload.result.totalCount);
  if (Number.isFinite(Number(payload.matchCount))) return Number(payload.matchCount);
  return fallback;
}

/**
 * json_api 소스의 전 페이지 수집.
 *
 * @param {object} params
 * @param {string} params.url          1페이지 URL (page/perPage 쿼리 포함)
 * @param {number} [params.maxPages]   상한 (초과 시 truncated=true)
 * @param {Function} [params.fetchImpl]
 * @param {Function} [params.log]
 * @returns {Promise<{records:object[], totalCount:number|null, perPage:number, pagesFetched:number,
 *                    truncated:boolean, pagesExpected:number|null, errors:string[]}>}
 */
export async function fetchAllPages({ url, maxPages, fetchImpl, log = () => {} }) {
  const doFetch = fetchImpl || defaultFetch;
  const cap = Number(maxPages || process.env.UPDATE_CENTER_MAX_PAGES || DEFAULT_MAX_PAGES);
  const perPage = Number(getQueryParam(url, "perPage") || getQueryParam(url, "numOfRows") || DEFAULT_PER_PAGE);
  const records = [];
  const errors = [];
  let totalCount = null;
  let page = 1;
  let pagesFetched = 0;
  let truncated = false;

  for (;;) {
    if (pagesFetched >= cap) {
      truncated = true;
      log(`[candidate] 페이지 상한 ${cap} 도달 — 수집을 중단하고 잘린 사실을 이벤트에 기록합니다.`);
      break;
    }
    const pageUrl = setQueryParam(url, "page", page);
    let response;
    try {
      response = await doFetch(pageUrl);
    } catch (err) {
      errors.push(`page=${page} 요청 실패: ${err.message}`);
      break;
    }
    if (!response.ok) {
      errors.push(`page=${page} HTTP ${response.status}`);
      break;
    }
    let payload;
    try {
      payload = await response.json();
    } catch (err) {
      errors.push(`page=${page} JSON 파싱 실패: ${err.message}`);
      break;
    }
    const rows = extractRows(payload);
    totalCount = extractTotalCount(payload, totalCount);
    records.push(...rows);
    pagesFetched += 1;
    log(`[candidate] page=${page} rows=${rows.length} 누적=${records.length}/${totalCount ?? "?"}`);
    if (rows.length === 0) break;
    if (totalCount !== null && records.length >= totalCount) break;
    if (rows.length < perPage) break;
    page += 1;
  }

  const pagesExpected = totalCount !== null && perPage > 0 ? Math.ceil(totalCount / perPage) : null;
  return { records, totalCount, perPage, pagesFetched, truncated, pagesExpected, errors };
}

// ---------------------------------------------------------------------------
// staging
// ---------------------------------------------------------------------------

/**
 * 후보 파일을 data/update_center/staging/<stagingId>/ 에 기록하고 파일별 sha256 을 남긴다.
 * 반환되는 staging_dir 은 리포 기준 상대 경로(감사 로그/이벤트에 그대로 실린다).
 */
export function stageCandidate(stagingId, files, meta = {}) {
  const dir = path.join(stagingDir(), String(stagingId));
  ensureDir(dir);
  const filesDir = ensureDir(path.join(dir, "files"));
  const entries = [];
  for (const file of files) {
    const name = path.basename(String(file.name));
    const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content), "utf-8");
    const dest = path.join(filesDir, name);
    fs.writeFileSync(dest, buffer);
    entries.push({ name, bytes: buffer.length, sha256: sha256(buffer), target: file.target || null });
  }
  const manifest = {
    staging_id: String(stagingId),
    created_at: new Date().toISOString(),
    files: entries,
    ...meta,
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
  return { dir, manifest };
}

export function readStagedFile(stagingId, name) {
  const safe = path.basename(String(name));
  return fs.readFileSync(path.join(stagingDir(), String(stagingId), "files", safe));
}

export function loadStagingManifest(stagingId) {
  const file = path.join(stagingDir(), String(stagingId), "manifest.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * 승인 직전 재검증: staging 파일이 반입 이후 바뀌지 않았는지 sha256 으로 확인한다.
 * (review MVP 의 "manifest 는 참고, 판정은 내용 재검사" 규칙 이식본.)
 */
export function verifyStaging(stagingId) {
  const manifest = loadStagingManifest(stagingId);
  if (!manifest) return { verified: false, mismatches: [{ name: "(manifest)", reason: "missing" }], manifest: null };
  const filesDir = path.join(stagingDir(), String(stagingId), "files");
  const mismatches = [];
  for (const file of manifest.files || []) {
    const abs = path.join(filesDir, path.basename(file.name));
    if (!fs.existsSync(abs)) {
      mismatches.push({ name: file.name, reason: "missing" });
      continue;
    }
    const actual = sha256(fs.readFileSync(abs));
    if (actual !== file.sha256) mismatches.push({ name: file.name, reason: "sha256_mismatch", expected: file.sha256, actual });
  }
  if (fs.existsSync(filesDir)) {
    const known = new Set((manifest.files || []).map((f) => path.basename(f.name)));
    for (const name of fs.readdirSync(filesDir)) {
      if (!known.has(name)) mismatches.push({ name, reason: "unexpected_extra_file" });
    }
  }
  return { verified: mismatches.length === 0, mismatches, manifest };
}

// ---------------------------------------------------------------------------
// evaluation (quality + schema diff + record diff + affected schools)
// ---------------------------------------------------------------------------

async function computeAffectedSchools(dataset, candidateText) {
  if (dataset !== "libraries") {
    return { supported: false, note: "이 데이터셋에는 재분석 모듈이 없어 영향 학교 수를 계산하지 않았습니다." };
  }
  try {
    const reanalyze = await import("./reanalyze.mjs");
    const { diff } = reanalyze.reanalyzeLibraries(candidateText);
    return {
      supported: true,
      affected_school_count: diff.affected_school_count,
      external_shortage_before: diff.external_shortage_before,
      external_shortage_after: diff.external_shortage_after,
      changed_schools: diff.changed_schools,
    };
  } catch (err) {
    return { supported: false, note: `재분석 실패: ${err.message}` };
  }
}

/**
 * 후보 텍스트를 평가한다 (파일 기록 없음 — 순수 계산).
 *
 * @param {object} entry     data_sources.yaml 의 소스 항목
 * @param {string} candidateText
 * @param {string} fileName  품질검사 형식 판정용 파일명
 */
export async function evaluateCandidate(entry, candidateText, fileName) {
  const adapter = getAdapter(entry.dataset);
  const quality = analyzeContent(candidateText, fileName, {
    requiredColumns: adapter.requiredColumns || [],
  });
  const localRel = assertSafeRelPath(entry.local_file);
  const currentAbs = path.join(applyRoot(), localRel);
  const schemaDiff = schemaDiffAgainstCurrent(quality.columns || [], currentAbs);

  let recordDiff;
  if (/\.csv$/i.test(fileName) && fs.existsSync(currentAbs) && /\.csv$/i.test(currentAbs)) {
    const currentRecords = csvToRecords(fs.readFileSync(currentAbs, "utf-8"));
    const candidateRecords = csvToRecords(candidateText);
    recordDiff = recordDiffByKey(currentRecords, candidateRecords, adapter.primaryKey || []);
  } else {
    recordDiff = recordDiffByKey([], [], adapter.primaryKey || []);
    recordDiff.supported = false;
    recordDiff.note = "CSV 후보이면서 현재 적용본이 존재할 때만 레코드 단위 diff를 계산합니다.";
  }

  const affected = await computeAffectedSchools(entry.dataset, candidateText);

  const status = overallStatus([quality]);
  // 스키마 변화가 있으면(추가/이름변경) 최소 yellow — 품질검사가 ok 여도 사람이 봐야 한다.
  const schemaChanged =
    schemaDiff.baseline_available && (schemaDiff.added.length > 0 || schemaDiff.removed.length > 0);
  let risk = riskFromStatus(status);
  if (risk === "green" && schemaChanged) risk = schemaDiff.removed.length > 0 ? "red" : "yellow";

  return {
    adapter: hasDedicatedAdapter(entry.dataset) ? entry.dataset : "generic(passthrough)",
    quality,
    quality_status: status,
    approval_blocked: approvalBlocked(status) || (schemaDiff.baseline_available && schemaDiff.removed.length > 0),
    risk,
    schema_diff: schemaDiff,
    record_diff: recordDiff,
    affected_schools: affected,
  };
}

/**
 * 원시 레코드(또는 CSV 텍스트) → 정규화 → staging 기록 → 평가. 스캔이 쓰는 진입점.
 *
 * @returns {Promise<object>} 이벤트 diff_json 에 그대로 실리는 후보 요약
 */
export async function buildStagedCandidate({ entry, rawRecords, rawText, stagingId, fetchMeta = {}, log = () => {} }) {
  const adapter = getAdapter(entry.dataset);
  const localRel = assertSafeRelPath(entry.local_file);
  const fileName = adapter.outputName || path.basename(localRel);

  const normalised = rawText !== undefined && rawText !== null ? adapter.normalize(rawText) : adapter.normalize(rawRecords || []);
  const candidateText = normalised.text;

  const evaluation = await evaluateCandidate(entry, candidateText, fileName);
  const staged = stageCandidate(stagingId, [{ name: fileName, content: candidateText, target: localRel }], {
    dataset: entry.dataset,
    adapter: evaluation.adapter,
    normalize_note: normalised.note,
    fetch: fetchMeta,
    quality_status: evaluation.quality_status,
  });

  log(
    `[candidate] ${entry.dataset} 후보 ${fileName} (${candidateText.length}B) staged → ` +
      `품질=${evaluation.quality_status}, risk=${evaluation.risk}`
  );

  return {
    staging_id: String(stagingId),
    staging_dir: path.relative(applyRoot(), staged.dir).split(path.sep).join("/"),
    files: staged.manifest.files,
    target_file: localRel,
    adapter: evaluation.adapter,
    normalize_note: normalised.note,
    normalize_skipped: normalised.skipped,
    fetch: fetchMeta,
    quality: evaluation.quality,
    quality_status: evaluation.quality_status,
    approval_blocked: evaluation.approval_blocked,
    risk: evaluation.risk,
    schema_diff: evaluation.schema_diff,
    record_diff: evaluation.record_diff,
    affected_schools: evaluation.affected_schools,
  };
}
