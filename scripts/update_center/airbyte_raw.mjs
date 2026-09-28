// airbyte_raw.mjs — Airbyte 수집 계층(원자료 저장소) 읽기 + check.type "airbyte_catalog"
//
// 역할 분리(2026-09-28, 범정부 출품작 설계):
//   Airbyte(모두의 AI 실험실 개발지원도구) = ② 자료 수집·적재 계층.
//     공공데이터포털 카탈로그 JSON(schema.org Dataset)을 예약 수집해 원자료 테이블에 쌓는다.
//     (커넥터 정의: airbyte/source-datagokr-catalog.yaml)
//   이 모듈 = 그 원자료 테이블을 읽어 "변경 감지 신호"로 바꾸는 판단 계층의 입구.
//     수정일(dateModified)·버전명(alternateName)·형식(encodingFormat)·URL 변화를 이벤트로 올린다.
//
// 절대 하지 않는 것:
//   - 원자료 본문 파일을 자동 반영하지 않는다(카탈로그는 메타데이터다). 이벤트는 항상 담당자 확인용이며
//     실제 파일은 ② 파일 업로드(수동 후보) → 품질검사 → 승인 절차를 그대로 거친다.
//   - "동기화 성공"을 "자료 최신"이나 "분석 검증 완료"로 표시하지 않는다.
//   - Airbyte 이력이 없으면 확인 불가(skipped, 판단 보류)로 남기고 red 이벤트를 만들지 않는다.
//
// 저장소 위치(환경변수):
//   AIRBYTE_RAW_DATABASE_URL  (없으면 DATABASE_URL) — Airbyte Postgres destination 이 쓰는 DB
//   AIRBYTE_RAW_SCHEMA        기본 "airbyte_raw"   — destination 의 Default Schema
//   AIRBYTE_RAW_STREAM        기본 "datagokr_catalog"
//   AIRBYTE_RAW_FILE          (테스트·로컬용) JSON 배열 파일. 설정되면 DB 대신 파일을 읽는다.
//   AIRBYTE_RAW_MAX_AGE_HOURS 기본 72 — 마지막 수집이 이보다 오래되면 stale 로 표시(yellow 1회)
//   PGSSL_NO_VERIFY=1         store.mjs 와 동일한 TLS 옵션

import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_SCHEMA = "airbyte_raw";
const DEFAULT_STREAM = "datagokr_catalog";
const DEFAULT_MAX_AGE_HOURS = 72;

// 비교 대상 필드(카탈로그 메타데이터). 이 조합이 바뀌면 "원자료 변경 가능성" 이벤트를 낸다.
export const CATALOG_SIGNAL_FIELDS = ["dateModified", "alternateName", "encodingFormat", "url", "datasetTimeInterval"];

function nowIso() {
  return new Date().toISOString();
}

function sha256(str) {
  return crypto.createHash("sha256").update(str).digest("hex");
}

function isoOrNull(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// Airbyte destination 컬럼은 대소문자를 그대로 인용(quoted)해 만들거나 소문자로 만들 수 있다.
// 어느 쪽이든 읽을 수 있도록 키를 소문자 기준으로 맞춘다.
const FIELD_ALIASES = {
  portal_pk: ["portal_pk"],
  catalog_kind: ["catalog_kind"],
  collected_at: ["collected_at"],
  name: ["name"],
  alternateName: ["alternatename", "alternate_name"],
  url: ["url"],
  keywords: ["keywords"],
  license: ["license"],
  dateCreated: ["datecreated", "date_created"],
  dateModified: ["datemodified", "date_modified"],
  datePublished: ["datepublished", "date_published"],
  creator: ["creator"],
  additionalType: ["additionaltype", "additional_type"],
  datasetTimeInterval: ["datasettimeinterval", "dataset_time_interval"],
  encodingFormat: ["encodingformat", "encoding_format"],
  legislation: ["legislation"],
  _airbyte_extracted_at: ["_airbyte_extracted_at"],
  _airbyte_raw_id: ["_airbyte_raw_id"],
};

export function normalizeCatalogRow(row) {
  if (!row || typeof row !== "object") return null;
  // raw 테이블(_airbyte_data jsonb) 형태도 지원
  let data = row;
  if (row._airbyte_data && typeof row._airbyte_data === "object") {
    data = { ...row._airbyte_data, _airbyte_extracted_at: row._airbyte_extracted_at, _airbyte_raw_id: row._airbyte_raw_id };
  } else if (typeof row._airbyte_data === "string") {
    try {
      data = { ...JSON.parse(row._airbyte_data), _airbyte_extracted_at: row._airbyte_extracted_at, _airbyte_raw_id: row._airbyte_raw_id };
    } catch {
      data = row;
    }
  }
  const lower = {};
  for (const [k, v] of Object.entries(data)) lower[String(k).toLowerCase()] = v;
  const out = {};
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
    let val;
    for (const a of aliases) {
      if (lower[a] !== undefined) {
        val = lower[a];
        break;
      }
    }
    out[canonical] = val === undefined ? null : val;
  }
  if (out.creator && typeof out.creator === "string") {
    try {
      out.creator = JSON.parse(out.creator);
    } catch {
      /* 문자열 그대로 둔다 */
    }
  }
  out.portal_pk = out.portal_pk === null ? null : String(out.portal_pk);
  out._airbyte_extracted_at = isoOrNull(out._airbyte_extracted_at) || isoOrNull(out.collected_at);
  return out;
}

// 여러 동기화 회차가 append 되어 있으므로 pk 별 최신 1건만 남긴다.
export function latestByPortalPk(rows) {
  const latest = new Map();
  for (const raw of rows || []) {
    const r = normalizeCatalogRow(raw);
    if (!r || !r.portal_pk) continue;
    const prev = latest.get(r.portal_pk);
    if (!prev || String(r._airbyte_extracted_at || "") > String(prev._airbyte_extracted_at || "")) latest.set(r.portal_pk, r);
  }
  return latest;
}

export function getAirbyteRawConfig(env = process.env) {
  const file = env.AIRBYTE_RAW_FILE || null;
  const databaseUrl = env.AIRBYTE_RAW_DATABASE_URL || env.DATABASE_URL || null;
  return {
    file,
    databaseUrl,
    schema: env.AIRBYTE_RAW_SCHEMA || DEFAULT_SCHEMA,
    stream: env.AIRBYTE_RAW_STREAM || DEFAULT_STREAM,
    maxAgeHours: Number(env.AIRBYTE_RAW_MAX_AGE_HOURS || DEFAULT_MAX_AGE_HOURS),
    configured: Boolean(file || databaseUrl),
    backend: file ? "file" : databaseUrl ? "postgres" : "none",
  };
}

function quoteIdent(name) {
  return '"' + String(name).replace(/"/g, '""') + '"';
}

// 원자료 저장소에서 전체 행을 읽는다. 결과: { ok, rows, table, error }
export async function readCatalogRows(config = getAirbyteRawConfig()) {
  if (!config.configured) return { ok: false, rows: [], table: null, error: "Airbyte 원자료 저장소 미설정 (AIRBYTE_RAW_DATABASE_URL/DATABASE_URL/AIRBYTE_RAW_FILE 없음)" };
  if (config.file) {
    try {
      const parsed = JSON.parse(fs.readFileSync(config.file, "utf-8"));
      const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];
      return { ok: true, rows, table: `file:${config.file}` };
    } catch (err) {
      return { ok: false, rows: [], table: `file:${config.file}`, error: err.message };
    }
  }
  const ssl = process.env.PGSSL_NO_VERIFY === "1" ? { rejectUnauthorized: false } : { rejectUnauthorized: true };
  const pool = new Pool({ connectionString: config.databaseUrl, ssl, max: 2 });
  pool.on("error", () => {});
  const finalTable = `${quoteIdent(config.schema)}.${quoteIdent(config.stream)}`;
  // Destinations V2 raw 테이블 이름 규칙: airbyte_internal.<schema>_raw__stream_<stream>
  const rawTable = `${quoteIdent("airbyte_internal")}.${quoteIdent(`${config.schema}_raw__stream_${config.stream}`)}`;
  try {
    try {
      const { rows } = await pool.query(`SELECT * FROM ${finalTable}`);
      return { ok: true, rows, table: `${config.schema}.${config.stream}` };
    } catch (finalErr) {
      // 최종(typed) 테이블이 없으면 raw 테이블로 폴백
      if (!/does not exist|relation/i.test(finalErr.message)) throw finalErr;
      const { rows } = await pool.query(`SELECT _airbyte_raw_id, _airbyte_extracted_at, _airbyte_data FROM ${rawTable}`);
      return { ok: true, rows, table: `airbyte_internal.${config.schema}_raw__stream_${config.stream}` };
    }
  } catch (err) {
    return { ok: false, rows: [], table: `${config.schema}.${config.stream}`, error: err.message };
  } finally {
    await pool.end().catch(() => {});
  }
}

// 관리 화면·API 용 요약: 수집 이력 유무, 마지막 수집 시각, pk 별 최신 카탈로그.
export async function summarizeAirbyteRaw(config = getAirbyteRawConfig(), reader = readCatalogRows) {
  const base = {
    backend: config.backend,
    configured: config.configured,
    schema: config.schema,
    stream: config.stream,
    table: null,
    ok: false,
    error: null,
    total_rows: 0,
    distinct_pks: 0,
    last_extracted_at: null,
    stale: null,
    max_age_hours: config.maxAgeHours,
    latest: {},
    checked_at: nowIso(),
    note: "Airbyte 동기화 성공은 자료가 최신이라는 뜻도, 분석 검증이 끝났다는 뜻도 아니다. 카탈로그(수정일·버전명)만 수집하며 본문 파일 반영은 담당자 승인 절차를 거친다.",
  };
  if (!config.configured) return { ...base, error: "미설정" };
  const res = await reader(config);
  base.table = res.table;
  if (!res.ok) return { ...base, error: res.error };
  const latest = latestByPortalPk(res.rows);
  let lastExtracted = null;
  for (const r of latest.values()) {
    if (!lastExtracted || String(r._airbyte_extracted_at) > String(lastExtracted)) lastExtracted = r._airbyte_extracted_at;
  }
  const stale = lastExtracted ? Date.now() - Date.parse(lastExtracted) > config.maxAgeHours * 3600 * 1000 : null;
  const latestObj = {};
  for (const [pk, r] of latest.entries()) {
    latestObj[pk] = {
      name: r.name,
      alternateName: r.alternateName,
      dateModified: r.dateModified,
      encodingFormat: r.encodingFormat,
      url: r.url,
      datasetTimeInterval: r.datasetTimeInterval,
      extracted_at: r._airbyte_extracted_at,
    };
  }
  return {
    ...base,
    ok: true,
    total_rows: res.rows.length,
    distinct_pks: latest.size,
    last_extracted_at: lastExtracted,
    stale,
    latest: latestObj,
  };
}

function catalogSignal(r) {
  const sig = {};
  for (const f of CATALOG_SIGNAL_FIELDS) sig[f] = r[f] ?? null;
  return sig;
}

function describeChange(prevSig, nextSig) {
  const parts = [];
  if (prevSig.dateModified !== nextSig.dateModified) parts.push(`수정일 ${prevSig.dateModified ?? "-"} → ${nextSig.dateModified ?? "-"}`);
  if (prevSig.alternateName !== nextSig.alternateName) parts.push(`버전명 ${prevSig.alternateName ?? "-"} → ${nextSig.alternateName ?? "-"}`);
  if (prevSig.encodingFormat !== nextSig.encodingFormat) parts.push(`형식 ${prevSig.encodingFormat ?? "-"} → ${nextSig.encodingFormat ?? "-"}`);
  if (prevSig.url !== nextSig.url) parts.push(`URL 변경`);
  if (prevSig.datasetTimeInterval !== nextSig.datasetTimeInterval) parts.push(`갱신주기 ${prevSig.datasetTimeInterval ?? "-"} → ${nextSig.datasetTimeInterval ?? "-"}`);
  return parts.join(", ");
}

// check.type: airbyte_catalog
//   entry.check.portal_pk (또는 entry.portal_pk / entry.airbyte.portal_pk) 로 원자료 저장소의 최신 카탈로그를 찾는다.
//   outcome: skipped | baseline | unchanged | yellow | stale
export async function checkAirbyteCatalog(entry, state, store, opts = {}, log = () => {}) {
  const dataset = entry.dataset;
  const actor = opts.actor || "scan.mjs";
  const config = opts.config || getAirbyteRawConfig();
  const pk = String(entry.check?.portal_pk || entry.airbyte?.portal_pk || entry.portal_pk || "");
  const prev = state[dataset] || null;

  const skip = (reason) => {
    state[dataset] = { ...(prev || {}), lastCheckedAt: nowIso(), lastStatus: "skipped", skipReason: reason, airbyte: { backend: config.backend } };
    log(`[${dataset}] airbyte_catalog skip — ${reason}`);
    return { outcome: "skipped", reason };
  };

  if (!pk) return skip("portal_pk 미지정 (data_sources.yaml check.portal_pk)");
  if (!config.configured) return skip("Airbyte 원자료 저장소 미설정 — 확인 불가(판단 보류)");

  const rows = opts.rows || null;
  let latest;
  if (rows) latest = latestByPortalPk(rows);
  else {
    const res = await (opts.reader || readCatalogRows)(config);
    if (!res.ok) {
      // 저장소 자체를 못 읽는 것은 수집 계층 장애다. 같은 오류를 반복해 red 로 쌓지 않고 상태에만 남긴다.
      const signature = sha256(`airbyte_raw_unreadable:${res.error}`);
      if (!(prev && prev.lastStatus === "error" && prev.lastErrorSignature === signature)) {
        await store.appendAudit({ actor, action: "airbyte_raw_unreadable", dataset, detail: `Airbyte 원자료 저장소 읽기 실패: ${res.error}` });
      }
      state[dataset] = { ...(prev || {}), lastCheckedAt: nowIso(), lastStatus: "error", error: `Airbyte 원자료 저장소 읽기 실패: ${res.error}`, lastErrorSignature: signature };
      log(`[${dataset}] airbyte raw unreadable: ${res.error}`);
      return { outcome: "error-unchanged" };
    }
    latest = latestByPortalPk(res.rows);
  }

  const rec = latest.get(pk);
  if (!rec) return skip(`Airbyte 수집 이력 없음 (portal_pk=${pk}) — 첫 동기화 전이거나 커넥터 pk 목록에 없음`);

  const nextSig = catalogSignal(rec);
  const extractedAt = rec._airbyte_extracted_at;
  const ageMs = extractedAt ? Date.now() - Date.parse(extractedAt) : null;
  const stale = ageMs !== null && ageMs > config.maxAgeHours * 3600 * 1000;
  const airbyteMeta = { backend: config.backend, extracted_at: extractedAt, raw_id: rec._airbyte_raw_id || null, stale, portal_pk: pk, name: rec.name };

  const prevSig = prev && prev.catalog ? prev.catalog : null;
  if (!prevSig) {
    state[dataset] = { lastCheckedAt: nowIso(), lastStatus: "ok", catalog: nextSig, airbyte: airbyteMeta };
    await store.appendAudit({
      actor,
      action: "baseline_recorded",
      dataset,
      detail: `Airbyte 카탈로그 기준선 기록: 수정일=${nextSig.dateModified} 버전명=${nextSig.alternateName} (수집 ${extractedAt})`,
    });
    log(`[${dataset}] airbyte baseline (dateModified=${nextSig.dateModified}, alternateName=${nextSig.alternateName})`);
    return { outcome: "baseline" };
  }

  const changed = CATALOG_SIGNAL_FIELDS.some((f) => (prevSig[f] ?? null) !== (nextSig[f] ?? null));
  if (!changed) {
    // 변경은 없지만 수집이 오래 멈췄으면 1회만 yellow 로 알린다(신호 중복 방지).
    if (stale) {
      const staleSig = sha256(`stale:${extractedAt}`);
      if (prev.lastStaleSignature !== staleSig) {
        const event = await store.recordEvent({
          dataset,
          kind: "stale",
          risk: "yellow",
          status: "pending",
          summary: `Airbyte 수집이 ${Math.floor(ageMs / 3600000)}시간 동안 없음 — 마지막 수집 ${extractedAt}. 커넥션 일정·실행 이력을 확인해 주세요.`,
          diff_json: { observation_only: true, airbyte: airbyteMeta, max_age_hours: config.maxAgeHours, action_required: "check_airbyte_connection" },
        });
        await store.appendAudit({ actor, action: "record_event", dataset, event_id: event.id, detail: event.summary });
        state[dataset] = { ...prev, lastCheckedAt: nowIso(), lastStatus: "ok", airbyte: airbyteMeta, lastStaleSignature: staleSig };
        log(`[${dataset}] YELLOW stale: ${event.summary}`);
        return { outcome: "yellow", event };
      }
    }
    state[dataset] = { ...prev, lastCheckedAt: nowIso(), lastStatus: "ok", airbyte: airbyteMeta };
    log(`[${dataset}] no change (catalog dateModified=${nextSig.dateModified})`);
    return { outcome: "unchanged" };
  }

  const summary = `공공데이터포털 카탈로그 변경 감지 (Airbyte 수집) — ${describeChange(prevSig, nextSig)}. 원본 파일을 내려받아 ② 파일 업로드로 후보 등록 후 품질검사·승인이 필요합니다.`;
  const event = await store.recordEvent({
    dataset,
    kind: "content",
    risk: "yellow",
    status: "pending",
    summary,
    diff_json: {
      observation_only: true,
      prev: prevSig,
      next: nextSig,
      airbyte: airbyteMeta,
      source_url: rec.url || entry.source_url || null,
      action_required: "manual_file_upload",
      note: "카탈로그 메타데이터 변경이다. 원자료 본문은 수집하지 않았으므로 자동 반영 대상이 아니다.",
    },
  });
  await store.appendAudit({ actor, action: "record_event", dataset, event_id: event.id, detail: summary });
  state[dataset] = { ...prev, lastCheckedAt: nowIso(), lastStatus: "ok", catalog: nextSig, airbyte: airbyteMeta };
  log(`[${dataset}] YELLOW catalog change: ${summary}`);
  return { outcome: "yellow", event };
}
