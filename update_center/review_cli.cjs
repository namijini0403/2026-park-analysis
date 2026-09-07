#!/usr/bin/env node
"use strict";

// update_center 로컬 검토 CLI (2026-09-06 MVP)
// 대상: 신규 컨텍스트 레이어 산출물(JSON/CSV/GeoJSON)의 로컬 파일 변경 검토.
// 봉인된 레거시 파이프라인(data_processed/ 재계산)은 범위 밖이며, 승인 결과도
// data_processed/ 가 아니라 update_center/managed/ 에만 기록한다(운영 자동 반영 없음).
//
// 사용법:
//   node update_center/review_cli.cjs stage <파일|디렉터리> [--as <저장이름>] [--label <설명>]
//   node update_center/review_cli.cjs verify <snapshot_id>
//   node update_center/review_cli.cjs diff <baseline_id> <candidate_id>
//   node update_center/review_cli.cjs approve <snapshot_id> --note "<승인 메모>"
//   node update_center/review_cli.cjs reject <snapshot_id> --note "<반려 사유>"
//   node update_center/review_cli.cjs rollback <버전 vNNN>
//   node update_center/review_cli.cjs dashboard
//   node update_center/review_cli.cjs list
// 테스트용: 환경변수 UPDATE_CENTER_HOME 으로 작업 디렉터리를 격리할 수 있다.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, ".."); // 공모전 루트(원자료 outputs/source_research_* 반입 허용 상한)
const HOME = path.resolve(process.env.UPDATE_CENTER_HOME || __dirname);
const DIRS = {
  staging: path.join(HOME, "staging"),
  reviews: path.join(HOME, "reviews"),
  managed: path.join(HOME, "managed"),
  versions: path.join(HOME, "managed", "versions"),
  public: path.join(HOME, "public"),
};
const STATE_PATH = path.join(DIRS.managed, "state.json");
const DECISIONS_PATH = path.join(DIRS.reviews, "decisions.jsonl");

const INPUT_EXT_ALLOWED = new Set([".json", ".csv", ".geojson"]);
const SNAPSHOT_ID_RE = /^snap_[0-9]{8}T[0-9]{6}_[0-9a-f]{6}$/;
const VERSION_RE = /^v[0-9]{3}$/;
// 도서지역(백령도 등) 포함을 위한 넓은 한반도 좌표 상한. 시내 bbox로 섬을 걸러내지 않는다.
const KOREA_BOUNDS = { latMin: 33.0, latMax: 39.6, lngMin: 124.0, lngMax: 132.5 };

// ---------------------------------------------------------------- 공통 유틸

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function ensureDirs() {
  for (const dir of Object.values(DIRS)) fs.mkdirSync(dir, { recursive: true });
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

function assertSnapshotId(id) {
  if (!SNAPSHOT_ID_RE.test(String(id || ""))) fail(`잘못된 snapshot id 형식입니다: ${id}`);
  return id;
}

function assertVersion(version) {
  if (!VERSION_RE.test(String(version || ""))) fail(`잘못된 버전 형식입니다(vNNN): ${version}`);
  return version;
}

function safeStoredName(name) {
  const base = path.basename(String(name || ""));
  if (!base || base.startsWith(".") || /[\\/]/.test(base) || base.includes("..")) {
    fail(`저장 이름이 안전하지 않습니다: ${name}`);
  }
  if (!INPUT_EXT_ALLOWED.has(path.extname(base).toLowerCase())) {
    fail(`허용 확장자(.json/.csv/.geojson)가 아닙니다: ${base}`);
  }
  return base;
}

// ------------------------------------------------------------ CSV 최소 파서

function parseCsv(text) {
  const src = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
  if (inQuotes) throw new Error("닫히지 않은 따옴표가 있는 CSV");
  return rows;
}

// -------------------------------------------------------------- 품질 검사
// 한계(문서화): 이 검사는 알려진 계약(시설/지정학교/GeoJSON)에 맞춘 구조·좌표·출처 메타데이터
// 검증이며, 값의 사실 여부(실제 시설 존재 등)는 검증하지 않는다. 신규 컨텍스트 레이어의
// data_processed/ 계약이 확정되면 해당 스키마 검사를 추가해야 한다.

function issue(level, code, message) {
  return { level, code, message };
}

function inKoreaBounds(lat, lng) {
  return lat >= KOREA_BOUNDS.latMin && lat <= KOREA_BOUNDS.latMax && lng >= KOREA_BOUNDS.lngMin && lng <= KOREA_BOUNDS.lngMax;
}

function checkFacilityRecords(records, issues) {
  const ids = new Map();
  let invalidCoords = 0;
  let missingCoordNoStatus = 0;
  let missingSource = 0;
  for (const rec of records) {
    const id = String(rec.source_record_id ?? "").trim();
    if (id) ids.set(id, (ids.get(id) || 0) + 1);
    const latRaw = rec.latitude;
    const lngRaw = rec.longitude;
    const hasLat = latRaw !== null && latRaw !== undefined && String(latRaw).trim() !== "";
    const hasLng = lngRaw !== null && lngRaw !== undefined && String(lngRaw).trim() !== "";
    if (hasLat !== hasLng) invalidCoords += 1;
    else if (hasLat && hasLng) {
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKoreaBounds(lat, lng)) invalidCoords += 1;
    } else {
      // 실계약 병존: incheon_entertainment_geocoded.csv 는 coordinate_status,
      // entertainment_facilities_normalized.csv 는 geocode_status 를 쓴다. 둘 다 인정한다.
      const status = String(rec.coordinate_status ?? rec.geocode_status ?? "").trim();
      if (!status) missingCoordNoStatus += 1;
    }
    if (!String(rec.source_url ?? "").trim() || !String(rec.retrieved_at ?? "").trim()) missingSource += 1;
  }
  const dupCount = [...ids.values()].filter((n) => n > 1).length;
  const noIdCount = records.length - [...ids.values()].reduce((a, b) => a + b, 0);
  if (noIdCount > 0) issues.push(issue("fail", "facility_missing_id", `source_record_id 누락 ${noIdCount}건`));
  if (dupCount > 0) issues.push(issue("warn", "facility_duplicate_id", `중복 source_record_id ${dupCount}종 — 중복 업소 검토 필요`));
  if (invalidCoords > 0) issues.push(issue("fail", "facility_invalid_coordinates", `유효 범위(한반도 광역, 도서 포함) 밖이거나 짝이 맞지 않는 좌표 ${invalidCoords}건`));
  if (missingCoordNoStatus > 0) issues.push(issue("fail", "facility_coord_missing_without_status", `좌표 없음인데 coordinate_status 미표기 ${missingCoordNoStatus}건 — 커버리지 공백을 0건처럼 보이게 하므로 차단`));
  if (missingSource > 0) issues.push(issue("warn", "facility_source_metadata_gap", `source_url/retrieved_at 누락 ${missingSource}건`));
}

function checkDesignationRecords(records, issues) {
  let badName = 0;
  let badYear = 0;
  let missingSource = 0;
  for (const rec of records) {
    if (!String(rec.school_name ?? "").trim()) badName += 1;
    // 실계약 병존: 정규화 CSV 는 year+source_url(평면), 파이프라인 산출 JSON
    // (data_processed/context/school_designations.json)은 school_year+source.url(중첩)을 쓴다.
    const year = Number(rec.school_year ?? rec.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) badYear += 1;
    const sourceUrl = rec.source_url ?? (rec.source && typeof rec.source === "object" ? rec.source.url : undefined);
    if (!String(sourceUrl ?? "").trim()) missingSource += 1;
  }
  if (badName > 0) issues.push(issue("fail", "designation_missing_school_name", `school_name 누락 ${badName}건`));
  if (badYear > 0) issues.push(issue("fail", "designation_invalid_year", `연도(school_year/year) 비정상 ${badYear}건`));
  if (missingSource > 0) issues.push(issue("fail", "designation_missing_source_url", `출처 URL(source_url 또는 source.url) 누락 ${missingSource}건 — 출처 없는 지정 명단은 승인 불가`));
}

// 허용 커버리지 상태 enum (schema_version 2 기준)
const COVERAGE_STATUS_ENUM = new Set(["available", "partial", "unknown", "unavailable"]);

// data_processed/context/context_layers_manifest.json 계약
function checkContextManifest(parsed, issues) {
  if (!String(parsed.data_as_of ?? "").trim()) issues.push(issue("fail", "manifest_missing_data_as_of", "data_as_of 누락"));
  const layers = parsed.layers;
  const names = layers && typeof layers === "object" ? Object.keys(layers) : [];
  if (names.length === 0) {
    issues.push(issue("fail", "manifest_no_layers", "layers 가 비어 있거나 객체가 아님"));
    return 0;
  }
  let badStatus = 0;
  let badEnum = 0;
  for (const name of names) {
    const layer = layers[name];
    const status = layer && typeof layer === "object" ? String(layer.status ?? "").trim() : "";
    if (!status) badStatus += 1;
    else if (!COVERAGE_STATUS_ENUM.has(status)) badEnum += 1;
  }
  if (badStatus > 0) issues.push(issue("fail", "manifest_layer_missing_status", `status 없는 레이어 ${badStatus}건 — 커버리지 상태 불명 승격 금지`));
  if (badEnum > 0) issues.push(issue("fail", "manifest_unsupported_status", `허용 enum(available/partial/unknown/unavailable) 밖 status 레이어 ${badEnum}건`));
  return names.length;
}

function isNonNegInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// data_processed/context/school_context_summary.json 계약 (schema_version 2)
// 학교 항목: school_name(문자열)·gu(문자열, 레이어 아님)·레이어 객체들.
// 시설 레이어(observed_count/total_count) 상태별 의미:
//   unknown/unavailable → 두 count 모두 null 이어야 함 (미수집을 0으로 표기 금지)
//   partial            → observed_count 는 0 이상 정수(하한 관측치, 0이어도 "완전 0건" 아님), total_count 는 null
//   available          → 두 count 모두 0 이상 정수이고 observed_count ≤ total_count
// records 배열이 있으면 길이가 observed_count 와 일치해야 한다.
// designations 레이어는 current/historical 배열 계약이며 시설 count 를 요구하지 않는다.
function checkSchoolContextSummary(parsed, issues) {
  if (!String(parsed.data_as_of ?? "").trim()) issues.push(issue("fail", "summary_missing_data_as_of", "data_as_of 누락"));
  const schools = parsed.schools;
  const ids = schools && typeof schools === "object" ? Object.keys(schools) : [];
  if (ids.length === 0) {
    issues.push(issue("fail", "summary_no_schools", "schools 가 비어 있거나 객체가 아님"));
    return 0;
  }
  const counters = {
    summary_missing_school_name: 0,
    summary_layer_missing_status: 0,
    summary_unsupported_status: 0,
    summary_designations_bad_arrays: 0,
    summary_unknown_nonnull_counts: 0,
    summary_partial_bad_observed: 0,
    summary_partial_nonnull_total: 0,
    summary_available_bad_counts: 0,
    summary_records_count_mismatch: 0,
    summary_layer_unrecognized_shape: 0,
  };
  for (const id of ids) {
    const school = schools[id];
    if (!school || typeof school !== "object") { counters.summary_missing_school_name += 1; continue; }
    if (!String(school.school_name ?? "").trim()) counters.summary_missing_school_name += 1;
    for (const [key, layer] of Object.entries(school)) {
      if (key === "school_name" || key === "gu" || layer === null || typeof layer !== "object" || Array.isArray(layer)) continue;
      const status = String(layer.status ?? "").trim();
      if (!status) { counters.summary_layer_missing_status += 1; continue; }
      if (!COVERAGE_STATUS_ENUM.has(status)) { counters.summary_unsupported_status += 1; continue; }

      const isDesignations = "current" in layer || "historical" in layer;
      const isFacilityCounts = "observed_count" in layer || "total_count" in layer;
      if (isDesignations) {
        if (!Array.isArray(layer.current) || !Array.isArray(layer.historical)) counters.summary_designations_bad_arrays += 1;
        continue;
      }
      if (!isFacilityCounts) { counters.summary_layer_unrecognized_shape += 1; continue; }

      const observed = layer.observed_count;
      const total = layer.total_count;
      if (status === "unknown" || status === "unavailable") {
        if (observed !== null || total !== null) counters.summary_unknown_nonnull_counts += 1;
      } else if (status === "partial") {
        if (!isNonNegInt(observed)) counters.summary_partial_bad_observed += 1;
        if (total !== null && total !== undefined) counters.summary_partial_nonnull_total += 1;
      } else { // available: 완전 커버리지 주장 — 두 count 모두 정수 + 일관성
        if (!isNonNegInt(observed) || !isNonNegInt(total) || observed > total) counters.summary_available_bad_counts += 1;
      }
      if (Array.isArray(layer.records) && isNonNegInt(observed) && layer.records.length !== observed) {
        counters.summary_records_count_mismatch += 1;
      }
    }
  }
  const messages = {
    summary_missing_school_name: "school_name 누락 학교",
    summary_layer_missing_status: "status 없는 레이어 항목",
    summary_unsupported_status: "허용 enum(available/partial/unknown/unavailable) 밖 status 항목",
    summary_designations_bad_arrays: "current/historical 이 배열이 아닌 designations 항목",
    summary_unknown_nonnull_counts: "unknown/unavailable 인데 count 가 null 이 아닌 항목 (미수집의 0건 위장 차단)",
    summary_partial_bad_observed: "partial 인데 observed_count 가 0 이상 정수가 아닌 항목",
    summary_partial_nonnull_total: "partial 인데 total_count 가 null 이 아닌 항목 (부분 관측을 전수처럼 표기 금지)",
    summary_available_bad_counts: "available 인데 observed/total count 누락·비정수·음수·관측>전수 항목",
    summary_records_count_mismatch: "records 배열 길이와 observed_count 불일치 항목",
    summary_layer_unrecognized_shape: "알려진 레이어 형태(시설 count/지정학교 배열)가 아닌 항목",
  };
  for (const [code, count] of Object.entries(counters)) {
    if (count > 0) issues.push(issue("fail", code, `${messages[code]} ${count}건`));
  }
  return ids.length;
}

// 계약 감지. 부분 일치(알려진 계열인데 필수열 누락)는 generic 우회가 아니라 명시적 fail 로 처리한다.
function detectContract(columns, issues = []) {
  const cols = new Set(columns.map((c) => String(c).toLowerCase()));
  if (cols.has("latitude") && cols.has("longitude") && (cols.has("source_record_id") || cols.has("facility_name"))) return "facility";
  if ((cols.has("source_record_id") || cols.has("facility_name")) && (!cols.has("latitude") || !cols.has("longitude"))) {
    issues.push(issue("fail", "facility_missing_required_columns", "시설 계열로 보이나 latitude/longitude 열이 없음 — 불완전 계약은 승인 불가"));
    return "facility_incomplete";
  }
  if (cols.has("school_name") && cols.has("designation_type")) return "designation";
  if (cols.has("school_name") && !cols.has("designation_type") && (cols.has("year") || cols.has("school_year") || cols.has("program_name"))) {
    issues.push(issue("fail", "designation_missing_required_columns", "지정학교 계열로 보이나 designation_type 열이 없음 — 불완전 계약은 승인 불가"));
    return "designation_incomplete";
  }
  return "generic";
}

function rowsToRecords(rows) {
  const [header, ...body] = rows;
  return body.map((row) => {
    const rec = {};
    header.forEach((col, idx) => { rec[String(col).trim()] = row[idx]; });
    return rec;
  });
}

function checkGeoJson(parsed, issues) {
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    issues.push(issue("fail", "geojson_not_featurecollection", "FeatureCollection 형식이 아님"));
    return 0;
  }
  if (parsed.features.length === 0) {
    issues.push(issue("fail", "geojson_zero_features", "feature 0건 — 실제 0건인지 수집 실패인지 구분 불가, 커버리지 증빙 없이 승격 금지"));
    return 0;
  }
  let malformed = 0;
  let invalidCoords = 0;
  let nullGeomNoStatus = 0;
  for (const feature of parsed.features) {
    // Feature 구조 자체를 검사한다. {} 같은 비정형 feature 는 건너뛰지 않고 fail 로 센다.
    if (!feature || typeof feature !== "object" || feature.type !== "Feature" || !("geometry" in feature)) {
      malformed += 1;
      continue;
    }
    const geom = feature.geometry;
    if (geom === null) {
      // 좌표 없는 feature 는 시설 계약과 동일하게 결측 상태 표기가 있어야 한다.
      const props = feature.properties;
      const status = props && typeof props === "object" ? String(props.coordinate_status ?? props.geocode_status ?? "").trim() : "";
      if (!status) nullGeomNoStatus += 1;
      continue;
    }
    if (typeof geom !== "object" || !String(geom.type ?? "").trim() || !Array.isArray(geom.coordinates)) {
      malformed += 1;
      continue;
    }
    if (geom.type === "Point") {
      const [lng, lat] = geom.coordinates.map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKoreaBounds(lat, lng)) invalidCoords += 1;
    }
  }
  if (malformed > 0) issues.push(issue("fail", "geojson_invalid_feature", `Feature 구조/geometry 필수값이 없는 feature ${malformed}건`));
  if (invalidCoords > 0) issues.push(issue("fail", "geojson_invalid_point_coordinates", `유효 범위 밖 Point 좌표 ${invalidCoords}건`));
  if (nullGeomNoStatus > 0) issues.push(issue("fail", "geojson_null_geometry_without_status", `geometry=null 인데 좌표 결측 상태 미표기 feature ${nullGeomNoStatus}건`));
  return parsed.features.length;
}

function analyzeRecordArray(records, columns, issues) {
  const contract = detectContract(columns, issues);
  const objects = records.filter((x) => x && typeof x === "object");
  if (contract === "facility") checkFacilityRecords(objects, issues);
  else if (contract === "designation") checkDesignationRecords(objects, issues);
  return contract;
}

function analyzeFile(buffer, storedName) {
  const ext = path.extname(storedName).toLowerCase();
  const issues = [];
  let records = 0;
  let columns = [];
  let contract = "generic";
  const text = buffer.toString("utf-8");

  if (buffer.length === 0) {
    issues.push(issue("fail", "empty_file", "빈 파일"));
  } else if (ext === ".csv") {
    try {
      const rows = parseCsv(text);
      if (rows.length < 1) issues.push(issue("fail", "csv_no_header", "헤더가 없음"));
      else {
        columns = rows[0].map((c) => String(c).trim());
        records = rows.length - 1;
        const badWidth = rows.slice(1).filter((r) => r.length !== columns.length).length;
        if (badWidth > 0) issues.push(issue("fail", "csv_ragged_rows", `열 개수가 헤더와 다른 행 ${badWidth}건`));
        else contract = analyzeRecordArray(rowsToRecords(rows), columns, issues);
        if (records === 0) issues.push(issue("fail", "csv_zero_records", "데이터 행 0건 — 실제 0건인지 수집 실패인지 구분 불가, 승격 금지"));
      }
    } catch (err) {
      issues.push(issue("fail", "csv_parse_error", `CSV 파싱 실패: ${err.message}`));
    }
  } else if (ext === ".json" || ext === ".geojson") {
    let parsed;
    try {
      parsed = JSON.parse(text.replace(/^﻿/, ""));
    } catch (err) {
      issues.push(issue("fail", "json_parse_error", `JSON 파싱 실패: ${err.message}`));
    }
    if (parsed !== undefined && !issues.some((i) => i.code === "json_parse_error")) {
      if (parsed === null || typeof parsed !== "object") {
        // null, 숫자, 문자열 스칼라는 레코드 데이터가 아니다 — generic 통과로 위장 금지
        issues.push(issue("fail", "json_not_record_data", `레코드 데이터가 아닌 JSON 값(${parsed === null ? "null" : typeof parsed})`));
      } else if (ext === ".geojson" || parsed.type === "FeatureCollection") {
        records = checkGeoJson(parsed, issues);
        contract = "geojson";
      } else if (Array.isArray(parsed)) {
        records = parsed.length;
        if (records === 0) {
          issues.push(issue("fail", "json_zero_records", "레코드 0건 — 실제 0건인지 수집 실패인지 구분 불가, 승격 금지"));
        } else {
          const first = parsed.find((x) => x && typeof x === "object");
          columns = first ? Object.keys(first) : [];
          contract = analyzeRecordArray(parsed, columns, issues);
        }
      } else {
        // 객체: 실제 파이프라인 산출 계약(컨텍스트 manifest, 학교 요약) 우선 감지
        if (parsed.layers && typeof parsed.layers === "object" && "data_as_of" in parsed) {
          contract = "context_manifest";
          records = checkContextManifest(parsed, issues);
        } else if (parsed.schools && typeof parsed.schools === "object" && "data_as_of" in parsed) {
          contract = "school_context_summary";
          records = checkSchoolContextSummary(parsed, issues);
        } else {
          const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
          if (arrayKey) {
            records = parsed[arrayKey].length;
            if (records === 0) {
              issues.push(issue("fail", "json_zero_records", "레코드 0건 — 실제 0건인지 수집 실패인지 구분 불가, 승격 금지"));
            } else {
              const first = parsed[arrayKey].find((x) => x && typeof x === "object");
              columns = first ? Object.keys(first) : [];
              contract = analyzeRecordArray(parsed[arrayKey], columns, issues);
            }
          } else {
            issues.push(issue("fail", "json_no_record_array", "레코드 배열/알려진 계약 구조를 찾지 못함"));
          }
        }
      }
    }
  }

  if (/sk-[A-Za-z0-9_-]{16,}/.test(text)) {
    issues.push(issue("fail", "possible_secret_content", "API 키로 의심되는 문자열 포함 — 반입 차단"));
  }

  // 계약이 인식되지 않은 데이터는 "검사 통과"가 아니라 미지원(검토 전용) 상태다. 승격이 차단된다.
  if (contract === "generic" && !issues.some((i) => i.level === "fail")) {
    issues.push(issue("unsupported", "contract_unrecognized", "알려진 계약(시설/지정학교/컨텍스트 manifest/학교 요약/GeoJSON)에 해당하지 않음 — 검토 전용, 승인 불가"));
  }

  const status = issues.some((i) => i.level === "fail") ? "fail"
    : issues.some((i) => i.level === "unsupported") ? "unsupported"
    : issues.some((i) => i.level === "warn") ? "warn" : "ok";
  return { records, columns, contract, issues, status };
}

// ---------------------------------------------------------------- stage

function collectInputFiles(inputAbs) {
  const stat = fs.statSync(inputAbs);
  if (stat.isFile()) return [inputAbs];
  if (!stat.isDirectory()) fail("파일 또는 디렉터리만 반입할 수 있습니다.");
  return fs.readdirSync(inputAbs)
    .filter((name) => !name.startsWith(".") && INPUT_EXT_ALLOWED.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(inputAbs, name))
    .filter((p) => fs.statSync(p).isFile());
}

function cmdStage(inputPath, options) {
  if (!inputPath) fail("stage <파일|디렉터리> 가 필요합니다.");
  const inputAbs = path.resolve(process.cwd(), inputPath);
  if (!inputAbs.startsWith(WORKSPACE_ROOT + path.sep) && inputAbs !== WORKSPACE_ROOT) {
    fail(`작업 공간(${WORKSPACE_ROOT}) 밖의 경로는 반입할 수 없습니다.`);
  }
  if (path.basename(inputAbs).startsWith(".")) fail("숨김/비밀 파일은 반입할 수 없습니다.");
  if (!fs.existsSync(inputAbs)) fail(`경로가 존재하지 않습니다: ${inputPath}`);

  const inputFiles = collectInputFiles(inputAbs);
  if (inputFiles.length === 0) fail("반입 가능한 .json/.csv/.geojson 파일이 없습니다.");
  if (inputFiles.length > 1 && options.as) fail("--as 는 단일 파일 반입에서만 사용할 수 있습니다.");

  ensureDirs();
  const stamp = nowIso().replace(/[-:]/g, "").replace(/\..*$/, "").replace(/Z?$/, "");
  const id = `snap_${stamp.slice(0, 15)}_${crypto.randomBytes(3).toString("hex")}`;
  const snapDir = path.join(DIRS.staging, id);
  const filesDir = path.join(snapDir, "files");
  fs.mkdirSync(filesDir, { recursive: true });

  const manifestFiles = [];
  for (const src of inputFiles) {
    const storedName = safeStoredName(options.as || path.basename(src));
    if (fs.statSync(src).size > 200 * 1024 * 1024) fail(`200MB 초과 파일은 반입하지 않습니다: ${storedName}`);
    const buffer = fs.readFileSync(src);
    const dest = path.join(filesDir, storedName);
    fs.writeFileSync(dest, buffer);
    try { fs.chmodSync(dest, 0o444); } catch { /* 읽기전용 표시는 best-effort */ }
    const analysis = analyzeFile(buffer, storedName);
    manifestFiles.push({
      name: storedName,
      source_path: path.relative(WORKSPACE_ROOT, src).split(path.sep).join("/"),
      bytes: buffer.length,
      sha256: sha256(buffer),
      ...analysis,
    });
  }

  const overall = overallFromFiles(manifestFiles);
  const manifest = {
    id,
    label: options.label || null,
    created_at: nowIso(),
    overall_status: overall,
    files: manifestFiles,
  };
  writeJson(path.join(snapDir, "snapshot.json"), manifest);
  try { fs.chmodSync(path.join(snapDir, "snapshot.json"), 0o444); } catch { /* best-effort */ }

  console.log(JSON.stringify({ id, overall_status: overall, files: manifestFiles.map((f) => ({ name: f.name, records: f.records, contract: f.contract, status: f.status, sha256: f.sha256.slice(0, 12), issues: f.issues })) }, null, 2));
  if (overall === "fail" || overall === "unsupported") {
    console.error(overall === "fail"
      ? "품질검사 실패: 이 스냅샷은 승인(approve)할 수 없습니다."
      : "미지원 계약: 검토 전용 스냅샷이며 승인(approve)할 수 없습니다.");
    process.exitCode = 2;
  }
  return id;
}

function overallFromFiles(files) {
  if (files.some((f) => f.status === "fail")) return "fail";
  if (files.some((f) => f.status === "unsupported")) return "unsupported";
  if (files.some((f) => f.status === "warn")) return "warn";
  return "ok";
}

// ---------------------------------------------------------------- verify

function loadSnapshot(id) {
  assertSnapshotId(id);
  const manifest = readJson(path.join(DIRS.staging, id, "snapshot.json"));
  if (!manifest) fail(`스냅샷을 찾을 수 없습니다: ${id}`);
  return manifest;
}

function verifySnapshotHashes(id) {
  const manifest = loadSnapshot(id);
  const mismatches = [];
  for (const file of manifest.files) {
    const filePath = path.join(DIRS.staging, id, "files", safeStoredName(file.name));
    if (!fs.existsSync(filePath)) { mismatches.push({ name: file.name, reason: "missing" }); continue; }
    const actual = sha256(fs.readFileSync(filePath));
    if (actual !== file.sha256) mismatches.push({ name: file.name, reason: "sha256_mismatch", expected: file.sha256, actual });
  }
  // manifest 파일 목록 밖의 파일이 끼어든 것도 파일 셋 변조로 본다.
  const filesDir = path.join(DIRS.staging, id, "files");
  if (fs.existsSync(filesDir)) {
    const known = new Set(manifest.files.map((f) => f.name));
    for (const name of fs.readdirSync(filesDir)) {
      if (!known.has(name)) mismatches.push({ name, reason: "unexpected_extra_file" });
    }
  }
  return { manifest, mismatches };
}

// 승인 시점에 파일 "내용"으로 품질검사를 다시 실행한다.
// staging/snapshot.json 은 로컬에서 수정 가능한 메타데이터이므로 승인 게이트의 근거로 신뢰하지 않는다.
function revalidateSnapshotContent(id) {
  const manifest = loadSnapshot(id);
  const files = manifest.files.map((file) => {
    const buffer = fs.readFileSync(path.join(DIRS.staging, id, "files", safeStoredName(file.name)));
    return { name: file.name, ...analyzeFile(buffer, file.name) };
  });
  return { files, overall: overallFromFiles(files) };
}

function cmdVerify(id) {
  const { manifest, mismatches } = verifySnapshotHashes(id);
  if (mismatches.length > 0) {
    console.error(JSON.stringify({ id, verified: false, mismatches }, null, 2));
    process.exit(2);
  }
  console.log(JSON.stringify({ id, verified: true, overall_status: manifest.overall_status, files: manifest.files.length }, null, 2));
}

// ---------------------------------------------------------------- diff

function cmdDiff(baselineId, candidateId) {
  // 손상된 스냅샷으로 비교 보고서를 만들면 승인 직전 판단 근거가 오염되므로, 양쪽 무결성을 먼저 검증한다.
  const baseCheck = verifySnapshotHashes(baselineId);
  if (baseCheck.mismatches.length > 0) fail(`diff 중단 — baseline 스냅샷 무결성 불일치: ${JSON.stringify(baseCheck.mismatches)}`);
  const candCheck = verifySnapshotHashes(candidateId);
  if (candCheck.mismatches.length > 0) fail(`diff 중단 — candidate 스냅샷 무결성 불일치: ${JSON.stringify(candCheck.mismatches)}`);
  const baseline = baseCheck.manifest;
  const candidate = candCheck.manifest;
  const baseByName = new Map(baseline.files.map((f) => [f.name, f]));
  const candByName = new Map(candidate.files.map((f) => [f.name, f]));

  const added = [...candByName.keys()].filter((n) => !baseByName.has(n));
  const removed = [...baseByName.keys()].filter((n) => !candByName.has(n));
  const changed = [];
  const unchanged = [];
  for (const [name, candFile] of candByName) {
    const baseFile = baseByName.get(name);
    if (!baseFile) continue;
    if (baseFile.sha256 === candFile.sha256) { unchanged.push(name); continue; }
    changed.push({
      name,
      records_before: baseFile.records,
      records_after: candFile.records,
      records_delta: candFile.records - baseFile.records,
      columns_added: candFile.columns.filter((c) => !baseFile.columns.includes(c)),
      columns_removed: baseFile.columns.filter((c) => !candFile.columns.includes(c)),
      status_before: baseFile.status,
      status_after: candFile.status,
      sha256_before: baseFile.sha256,
      sha256_after: candFile.sha256,
    });
  }

  ensureDirs();
  const report = {
    type: "update_center_diff",
    created_at: nowIso(),
    baseline: { id: baseline.id, label: baseline.label, overall_status: baseline.overall_status },
    candidate: { id: candidate.id, label: candidate.label, overall_status: candidate.overall_status },
    integrity_verified: true,
    added, removed, changed, unchanged,
  };
  const reportPath = path.join(DIRS.reviews, `diff_${candidate.id}_vs_${baseline.id}.json`);
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
  console.log(`리뷰 리포트 저장: ${path.relative(HOME, reportPath).split(path.sep).join("/")}`);
  regenerateDashboard();
}

// ------------------------------------------------------------ 승인/반려/롤백

function appendDecision(entry) {
  ensureDirs();
  fs.appendFileSync(DECISIONS_PATH, JSON.stringify(entry) + "\n", "utf-8");
}

function loadState() {
  return readJson(STATE_PATH, { active_version: null, history: [] });
}

function versionContentHash(versionDir) {
  const manifest = readJson(path.join(versionDir, "snapshot.json"));
  if (!manifest) return null;
  const fileHashes = [];
  for (const file of [...manifest.files].sort((a, b) => a.name.localeCompare(b.name))) {
    const filePath = path.join(versionDir, "files", safeStoredName(file.name));
    if (!fs.existsSync(filePath)) return null;
    fileHashes.push(`${file.name}:${sha256(fs.readFileSync(filePath))}`);
  }
  return sha256(Buffer.from(fileHashes.join("\n"), "utf-8"));
}

function cmdApprove(id, options) {
  if (!options.note) fail("approve 에는 --note \"승인 메모\" 가 필요합니다.");
  const { manifest, mismatches } = verifySnapshotHashes(id);
  if (mismatches.length > 0) fail(`스냅샷 무결성 검증 실패 — 반입 이후 변경됨: ${JSON.stringify(mismatches)}`);
  // manifest 의 overall_status 는 참고용일 뿐, 승인 판정은 파일 내용 재검사 결과로만 한다.
  const revalidated = revalidateSnapshotContent(id);
  if (revalidated.overall === "fail" || revalidated.overall === "unsupported") {
    const detail = revalidated.files
      .filter((f) => f.status === "fail" || f.status === "unsupported")
      .map((f) => `${f.name}: ${f.issues.map((i) => i.code).join(",")}`).join(" / ");
    fail(`품질검사 실패(내용 재검사 결과 ${revalidated.overall}) — 승인할 수 없습니다: ${id} [${detail}]`);
  }
  if (manifest.overall_status !== revalidated.overall) {
    console.error(`주의: manifest 기록(${manifest.overall_status})과 재검사 결과(${revalidated.overall})가 다릅니다. 재검사 결과를 기준으로 진행합니다.`);
  }

  ensureDirs();
  const existing = fs.readdirSync(DIRS.versions).filter((n) => VERSION_RE.test(n)).sort();
  const next = `v${String(existing.length ? Number(existing[existing.length - 1].slice(1)) + 1 : 1).padStart(3, "0")}`;
  const versionDir = path.join(DIRS.versions, next);
  fs.mkdirSync(path.join(versionDir, "files"), { recursive: true });
  for (const file of manifest.files) {
    fs.copyFileSync(
      path.join(DIRS.staging, id, "files", safeStoredName(file.name)),
      path.join(versionDir, "files", safeStoredName(file.name)),
    );
  }
  fs.copyFileSync(path.join(DIRS.staging, id, "snapshot.json"), path.join(versionDir, "snapshot.json"));
  const contentHash = versionContentHash(versionDir);

  const state = loadState();
  const entry = {
    version: next,
    snapshot_id: id,
    label: manifest.label,
    note: options.note,
    approved_at: nowIso(),
    overall_status: revalidated.overall,
    revalidated_on_approve: true,
    content_hash: contentHash,
    action: "approve",
  };
  state.active_version = next;
  state.history.push(entry);
  writeJson(STATE_PATH, state);
  appendDecision({ at: entry.approved_at, snapshot_id: id, decision: "approved", version: next, note: options.note });
  console.log(JSON.stringify({ approved: true, version: next, active_version: next, content_hash: contentHash }, null, 2));
  regenerateDashboard();
}

function cmdReject(id, options) {
  if (!options.note) fail("reject 에는 --note \"반려 사유\" 가 필요합니다.");
  const manifest = loadSnapshot(id);
  appendDecision({ at: nowIso(), snapshot_id: manifest.id, decision: "rejected", note: options.note });
  console.log(JSON.stringify({ rejected: true, snapshot_id: manifest.id, note: options.note }, null, 2));
  regenerateDashboard();
}

function cmdRollback(version) {
  assertVersion(version);
  const state = loadState();
  const record = state.history.find((h) => h.version === version && h.action === "approve");
  if (!record) fail(`승인 이력에 없는 버전입니다: ${version}`);
  const versionDir = path.join(DIRS.versions, version);
  const actualHash = versionContentHash(versionDir);
  if (!actualHash || actualHash !== record.content_hash) {
    fail(`롤백 거부: ${version} 의 현재 내용 해시가 승인 시점 해시와 다릅니다 (expected=${record.content_hash}, actual=${actualHash}).`);
  }
  state.active_version = version;
  state.history.push({ version, action: "rollback", at: nowIso(), content_hash: actualHash });
  writeJson(STATE_PATH, state);
  appendDecision({ at: nowIso(), decision: "rollback", version });
  console.log(JSON.stringify({ rolled_back: true, active_version: version, content_hash: actualHash }, null, 2));
  regenerateDashboard();
}

// ---------------------------------------------------------------- 목록/대시보드

function listSnapshots() {
  if (!fs.existsSync(DIRS.staging)) return [];
  return fs.readdirSync(DIRS.staging)
    .filter((n) => SNAPSHOT_ID_RE.test(n))
    .map((n) => readJson(path.join(DIRS.staging, n, "snapshot.json")))
    .filter(Boolean)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

function listDecisions() {
  if (!fs.existsSync(DECISIONS_PATH)) return [];
  return fs.readFileSync(DECISIONS_PATH, "utf-8").trim().split("\n").filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);
}

function cmdList() {
  const state = loadState();
  console.log(JSON.stringify({
    active_version: state.active_version,
    snapshots: listSnapshots().map((s) => ({ id: s.id, label: s.label, created_at: s.created_at, overall_status: s.overall_status, files: s.files.length })),
    history: state.history,
  }, null, 2));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function regenerateDashboard() {
  ensureDirs();
  const state = loadState();
  const snapshots = listSnapshots();
  const decisions = listDecisions();
  const diffs = fs.existsSync(DIRS.reviews)
    ? fs.readdirSync(DIRS.reviews).filter((n) => n.startsWith("diff_") && n.endsWith(".json"))
      .map((n) => readJson(path.join(DIRS.reviews, n))).filter(Boolean)
    : [];

  const statusBadge = (s) => `<span class="badge ${escapeHtml(s)}">${escapeHtml(s)}</span>`;
  const snapshotRows = snapshots.map((s) => `<tr><td><code>${escapeHtml(s.id)}</code></td><td>${escapeHtml(s.label || "-")}</td><td>${escapeHtml(s.created_at)}</td><td>${statusBadge(s.overall_status)}</td><td>${s.files.map((f) => `${escapeHtml(f.name)} (${f.records}행, ${escapeHtml(f.contract)}, sha:${escapeHtml(f.sha256.slice(0, 12))})${f.issues.length ? `<br><small>${f.issues.map((i) => `[${escapeHtml(i.level)}] ${escapeHtml(i.message)}`).join("<br>")}</small>` : ""}`).join("<br>")}</td></tr>`).join("\n");
  const historyRows = state.history.map((h) => `<tr><td>${escapeHtml(h.version)}</td><td>${escapeHtml(h.action)}</td><td>${escapeHtml(h.approved_at || h.at || "-")}</td><td>${escapeHtml(h.note || "-")}</td><td><code>${escapeHtml(String(h.content_hash || "").slice(0, 16))}</code></td></tr>`).join("\n");
  const decisionRows = decisions.map((d) => `<tr><td>${escapeHtml(d.at)}</td><td>${escapeHtml(d.decision)}</td><td><code>${escapeHtml(d.snapshot_id || d.version || "-")}</code></td><td>${escapeHtml(d.note || "-")}</td></tr>`).join("\n");
  const diffRows = diffs.map((d) => `<tr><td><code>${escapeHtml(d.baseline.id)}</code> → <code>${escapeHtml(d.candidate.id)}</code></td><td>+${d.added.length} / -${d.removed.length} / 변경 ${d.changed.length}</td><td>${d.changed.map((c) => `${escapeHtml(c.name)}: ${c.records_before}→${c.records_after}행${c.columns_added.length ? `, 열 추가 ${c.columns_added.map(escapeHtml).join("·")}` : ""}${c.columns_removed.length ? `, 열 삭제 ${c.columns_removed.map(escapeHtml).join("·")}` : ""}`).join("<br>") || "-"}</td></tr>`).join("\n");

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>update_center 로컬 검토 대시보드</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; max-width: 1200px; margin: 24px auto; padding: 0 16px; line-height: 1.7; background: #10241c; color: #e8f2ec; }
  h1 { font-size: 20px; } h2 { font-size: 16px; margin-top: 28px; border-bottom: 1px solid #2e5d47; padding-bottom: 6px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th, td { border: 1px solid #2e5d47; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #1a3a2c; }
  code { background: #1a3a2c; padding: 1px 4px; border-radius: 3px; }
  .badge { padding: 1px 8px; border-radius: 10px; font-size: 12px; }
  .badge.ok { background: #1f6f43; } .badge.warn { background: #8a6d1a; } .badge.fail { background: #8a2626; } .badge.unsupported { background: #565672; }
  .active { background: #1f6f43; padding: 2px 10px; border-radius: 4px; }
  .cmd { background: #0b1a13; border: 1px solid #2e5d47; padding: 10px 14px; border-radius: 6px; font-size: 13px; }
  .note { color: #9fc1ad; font-size: 12px; }
  details { margin: 16px 0; border: 1px solid #2e5d47; border-radius: 12px; padding: 16px; }
  summary { cursor: pointer; font-weight: bold; }
  summary:focus-visible { outline: 3px solid #6ee7b7; outline-offset: 4px; }
  .table-scroll, pre { overflow-x: auto; }
  .overview { padding: 20px; border: 1px solid #3f916b; border-radius: 16px; background: #133326; }
</style>
</head>
<body>
<h1>데이터 갱신 검토 현황 <span class="note">(읽기 전용 · 생성 시각 ${escapeHtml(nowIso())})</span></h1>
<p class="note">이 화면은 로컬 파일 변경 검토 MVP의 상태 표시용이다. 외부 원본 자동 감시 기능이 아니며, 버튼으로 실행되는 기능은 없다.
모든 조치는 아래 CLI 명령으로만 수행한다. 승인 결과는 update_center/managed/ 에만 기록되고 data_processed/ 운영 데이터에는 자동 반영되지 않는다.</p>
<p>활성 버전: ${state.active_version ? `<span class="active">${escapeHtml(state.active_version)}</span>` : "없음"}</p>

<div class="overview"><strong>반입 → 품질 확인 → 변경 비교 → 담당자 검토</strong><p>등록된 검토 자료 ${snapshots.length}개 · 변경 비교 ${diffs.length}개</p><p class="note">품질 통과와 운영 반영은 다릅니다. 이 화면은 관리 영역의 상태를 보여주며, 운영 앱의 데이터는 자동으로 바뀌지 않습니다.</p></div>
<details><summary>갱신 작업 방법 · 로컬 명령어</summary>
<h2>조치 명령 (로컬 CLI)</h2>
<div class="cmd"><pre>node update_center/review_cli.cjs stage &lt;파일|디렉터리&gt; [--as 이름.csv] [--label 설명]   # 후보 반입+품질검사
node update_center/review_cli.cjs diff &lt;baseline_id&gt; &lt;candidate_id&gt;                       # 전후 비교 리포트
node update_center/review_cli.cjs approve &lt;snapshot_id&gt; --note "승인 메모"                 # 버전 승격(품질 fail 차단)
node update_center/review_cli.cjs reject &lt;snapshot_id&gt; --note "반려 사유"
node update_center/review_cli.cjs rollback &lt;vNNN&gt;                                          # 해시 일치 확인 후 활성 버전 되돌림
node update_center/review_cli.cjs verify &lt;snapshot_id&gt;                                     # 스냅샷 무결성 재검증</pre></div>
</details>

<details><summary>스냅샷 (staging) 펼치기</summary>
<div class="table-scroll">
<table><tr><th>ID</th><th>라벨</th><th>반입 시각</th><th>품질</th><th>파일 (행수 · 계약 · SHA-256 앞 12자리 · 품질 메모)</th></tr>
${snapshotRows || "<tr><td colspan=5>없음</td></tr>"}
</table>
</div></details>

<details><summary>전후 비교 (diff) 펼치기</summary>
<div class="table-scroll">
<table><tr><th>비교</th><th>추가/삭제/변경</th><th>변경 상세</th></tr>
${diffRows || "<tr><td colspan=3>없음</td></tr>"}
</table>
</div></details>

<details><summary>승인 버전 이력 (managed) 펼치기</summary>
<div class="table-scroll">
<table><tr><th>버전</th><th>조치</th><th>시각</th><th>메모</th><th>내용 해시</th></tr>
${historyRows || "<tr><td colspan=5>없음</td></tr>"}
</table>
</div></details>

<details><summary>결정 로그 펼치기</summary>
<div class="table-scroll">
<table><tr><th>시각</th><th>결정</th><th>대상</th><th>메모</th></tr>
${decisionRows || "<tr><td colspan=4>없음</td></tr>"}
</table>
</div></details>

<p class="note">한계: 품질검사는 알려진 계약(시설·지정학교·GeoJSON)에 대한 구조/좌표/출처 메타데이터 검증이며 사실관계 검증이 아니다.
시설·지정·맥락 자료의 구조 검증과 실제 현장 확인은 별개다. 원본 데이터 내용 자체는 이 화면에 싣지 않는다.</p>
</body>
</html>
`;
  fs.writeFileSync(path.join(DIRS.public, "dashboard.html"), html, "utf-8");
  console.log(`대시보드 갱신: ${path.join(path.relative(PROJECT_ROOT, DIRS.public), "dashboard.html").split(path.sep).join("/")}`);
}

// ---------------------------------------------------------------- main

function parseOptions(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--note") { options.note = argv[i + 1]; i += 1; }
    else if (argv[i] === "--label") { options.label = argv[i + 1]; i += 1; }
    else if (argv[i] === "--as") { options.as = argv[i + 1]; i += 1; }
    else positional.push(argv[i]);
  }
  return { options, positional };
}

if (require.main === module) {
  const [command, ...rest] = process.argv.slice(2);
  const { options, positional } = parseOptions(rest);
  ensureDirs();
  switch (command) {
    case "stage": cmdStage(positional[0], options); break;
    case "verify": cmdVerify(positional[0]); break;
    case "diff": cmdDiff(positional[0], positional[1]); break;
    case "approve": cmdApprove(positional[0], options); break;
    case "reject": cmdReject(positional[0], options); break;
    case "rollback": cmdRollback(positional[0]); break;
    case "dashboard": regenerateDashboard(); break;
    case "list": cmdList(); break;
    default:
      console.error("사용법: node update_center/review_cli.cjs <stage|verify|diff|approve|reject|rollback|dashboard|list> ...");
      process.exit(1);
  }
}

module.exports = { analyzeFile, parseCsv, detectContract, inKoreaBounds };
