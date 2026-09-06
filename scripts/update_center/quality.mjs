// scripts/update_center/quality.mjs
//
// 품질 검사 규칙 (rules ported from the file-review MVP in the sibling branch:
// 2026-park-analysis/update_center/review_cli.cjs). Only the RULES are brought
// over — that MVP's separate staging/managed store is NOT duplicated here; the
// update-center keeps using its own store.mjs + versions directory.
//
// Ported rules:
//   - empty file / zero records  (수집 실패를 "0건"으로 위장하는 것을 차단)
//   - CSV ragged rows, unterminated quotes, missing header
//   - coordinate bounds for lat/lng columns (한반도 광역 bbox, 도서 포함)
//   - facility contract   (source_record_id / coordinate_status / source_url)
//   - designation contract (school_name / designation_type / year / source_url)
//   - GeoJSON contract     (FeatureCollection, Feature 구조, null geometry 상태표기)
//   - context v2 null semantics (unknown/unavailable → count must be null,
//     partial → observed_count 정수 + total_count null, available → 둘 다 정수)
//   - possible secret content (sk-...)
//   - unrecognised contract → "unsupported" (검토 전용, 승인 불가)
//
// Added here (not in the MVP):
//   - required-column check driven by the per-dataset adapter
//   - schema diff against the currently-applied local file
//   - record-level diff by primary key (added/removed/changed + examples)
//
// Severity → gate:  fail | unsupported  → 승인 차단(red).  warn → yellow.  ok → green.

import fs from "node:fs";

// 도서지역(백령도 등) 포함을 위한 넓은 한반도 좌표 상한. 시내 bbox로 섬을 걸러내지 않는다.
export const KOREA_BOUNDS = { latMin: 33.0, latMax: 39.6, lngMin: 124.0, lngMax: 132.5 };

const COVERAGE_STATUS_ENUM = new Set(["available", "partial", "unknown", "unavailable"]);

// 좌표 컬럼으로 인식하는 이름들(한글 CSV와 영문 CSV 병존).
const LAT_KEYS = ["latitude", "lat", "위도", "y"];
const LNG_KEYS = ["longitude", "lng", "lon", "경도", "x"];

export function issue(level, code, message) {
  return { level, code, message };
}

export function inKoreaBounds(lat, lng) {
  return (
    lat >= KOREA_BOUNDS.latMin &&
    lat <= KOREA_BOUNDS.latMax &&
    lng >= KOREA_BOUNDS.lngMin &&
    lng <= KOREA_BOUNDS.lngMax
  );
}

// ---------------------------------------------------------------------------
// CSV (RFC4180-ish; same dialect as scan.mjs/reanalyze.mjs's parsers, plus an
// explicit unterminated-quote error like the review MVP's parser)
// ---------------------------------------------------------------------------

export function parseCsvRows(text) {
  const src = String(text).replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  if (inQuotes) throw new Error("닫히지 않은 따옴표가 있는 CSV");
  return rows;
}

export function rowsToRecords(rows) {
  const [header, ...body] = rows;
  const cols = (header || []).map((c) => String(c).trim());
  return body.map((row) => {
    const rec = {};
    cols.forEach((col, idx) => {
      rec[col] = row[idx];
    });
    return rec;
  });
}

// ---------------------------------------------------------------------------
// contract checks
// ---------------------------------------------------------------------------

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
      const status = String(rec.coordinate_status ?? rec.geocode_status ?? "").trim();
      if (!status) missingCoordNoStatus += 1;
    }
    if (!String(rec.source_url ?? "").trim() || !String(rec.retrieved_at ?? "").trim()) missingSource += 1;
  }
  const dupCount = [...ids.values()].filter((n) => n > 1).length;
  const noIdCount = records.length - [...ids.values()].reduce((a, b) => a + b, 0);
  if (noIdCount > 0) issues.push(issue("fail", "facility_missing_id", `source_record_id 누락 ${noIdCount}건`));
  if (dupCount > 0) {
    issues.push(issue("warn", "facility_duplicate_id", `중복 source_record_id ${dupCount}종 — 중복 업소 검토 필요`));
  }
  if (invalidCoords > 0) {
    issues.push(
      issue(
        "fail",
        "facility_invalid_coordinates",
        `유효 범위(한반도 광역, 도서 포함) 밖이거나 짝이 맞지 않는 좌표 ${invalidCoords}건`
      )
    );
  }
  if (missingCoordNoStatus > 0) {
    issues.push(
      issue(
        "fail",
        "facility_coord_missing_without_status",
        `좌표 없음인데 coordinate_status 미표기 ${missingCoordNoStatus}건 — 커버리지 공백을 0건처럼 보이게 하므로 차단`
      )
    );
  }
  if (missingSource > 0) {
    issues.push(issue("warn", "facility_source_metadata_gap", `source_url/retrieved_at 누락 ${missingSource}건`));
  }
}

function checkDesignationRecords(records, issues) {
  let badName = 0;
  let badYear = 0;
  let missingSource = 0;
  for (const rec of records) {
    if (!String(rec.school_name ?? "").trim()) badName += 1;
    const year = Number(rec.school_year ?? rec.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) badYear += 1;
    const sourceUrl = rec.source_url ?? (rec.source && typeof rec.source === "object" ? rec.source.url : undefined);
    if (!String(sourceUrl ?? "").trim()) missingSource += 1;
  }
  if (badName > 0) issues.push(issue("fail", "designation_missing_school_name", `school_name 누락 ${badName}건`));
  if (badYear > 0) issues.push(issue("fail", "designation_invalid_year", `연도(school_year/year) 비정상 ${badYear}건`));
  if (missingSource > 0) {
    issues.push(
      issue(
        "fail",
        "designation_missing_source_url",
        `출처 URL(source_url 또는 source.url) 누락 ${missingSource}건 — 출처 없는 지정 명단은 승인 불가`
      )
    );
  }
}

function checkContextManifest(parsed, issues) {
  if (!String(parsed.data_as_of ?? "").trim()) {
    issues.push(issue("fail", "manifest_missing_data_as_of", "data_as_of 누락"));
  }
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
  if (badStatus > 0) {
    issues.push(
      issue("fail", "manifest_layer_missing_status", `status 없는 레이어 ${badStatus}건 — 커버리지 상태 불명 승격 금지`)
    );
  }
  if (badEnum > 0) {
    issues.push(
      issue(
        "fail",
        "manifest_unsupported_status",
        `허용 enum(available/partial/unknown/unavailable) 밖 status 레이어 ${badEnum}건`
      )
    );
  }
  return names.length;
}

function isNonNegInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// data_processed/context/school_context_summary.json 계약 (schema_version 2)
// null 의미론: unknown/unavailable → count 는 반드시 null (미수집을 0으로 표기 금지),
// partial → observed_count 는 하한 관측치(0 이상 정수) + total_count 는 null,
// available → 둘 다 정수이고 observed_count ≤ total_count.
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
    if (!school || typeof school !== "object") {
      counters.summary_missing_school_name += 1;
      continue;
    }
    if (!String(school.school_name ?? "").trim()) counters.summary_missing_school_name += 1;
    for (const [key, layer] of Object.entries(school)) {
      if (key === "school_name" || key === "gu" || layer === null || typeof layer !== "object" || Array.isArray(layer)) {
        continue;
      }
      const status = String(layer.status ?? "").trim();
      if (!status) {
        counters.summary_layer_missing_status += 1;
        continue;
      }
      if (!COVERAGE_STATUS_ENUM.has(status)) {
        counters.summary_unsupported_status += 1;
        continue;
      }
      const isDesignations = "current" in layer || "historical" in layer;
      const isFacilityCounts = "observed_count" in layer || "total_count" in layer;
      if (isDesignations) {
        if (!Array.isArray(layer.current) || !Array.isArray(layer.historical)) counters.summary_designations_bad_arrays += 1;
        continue;
      }
      if (!isFacilityCounts) {
        counters.summary_layer_unrecognized_shape += 1;
        continue;
      }
      const observed = layer.observed_count;
      const total = layer.total_count;
      if (status === "unknown" || status === "unavailable") {
        if (observed !== null || total !== null) counters.summary_unknown_nonnull_counts += 1;
      } else if (status === "partial") {
        if (!isNonNegInt(observed)) counters.summary_partial_bad_observed += 1;
        if (total !== null && total !== undefined) counters.summary_partial_nonnull_total += 1;
      } else {
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

function checkGeoJson(parsed, issues) {
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    issues.push(issue("fail", "geojson_not_featurecollection", "FeatureCollection 형식이 아님"));
    return 0;
  }
  if (parsed.features.length === 0) {
    issues.push(
      issue("fail", "geojson_zero_features", "feature 0건 — 실제 0건인지 수집 실패인지 구분 불가, 커버리지 증빙 없이 승격 금지")
    );
    return 0;
  }
  let malformed = 0;
  let invalidCoords = 0;
  let nullGeomNoStatus = 0;
  for (const feature of parsed.features) {
    if (!feature || typeof feature !== "object" || feature.type !== "Feature" || !("geometry" in feature)) {
      malformed += 1;
      continue;
    }
    const geom = feature.geometry;
    if (geom === null) {
      const props = feature.properties;
      const status =
        props && typeof props === "object" ? String(props.coordinate_status ?? props.geocode_status ?? "").trim() : "";
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
  if (malformed > 0) {
    issues.push(issue("fail", "geojson_invalid_feature", `Feature 구조/geometry 필수값이 없는 feature ${malformed}건`));
  }
  if (invalidCoords > 0) {
    issues.push(issue("fail", "geojson_invalid_point_coordinates", `유효 범위 밖 Point 좌표 ${invalidCoords}건`));
  }
  if (nullGeomNoStatus > 0) {
    issues.push(
      issue(
        "fail",
        "geojson_null_geometry_without_status",
        `geometry=null 인데 좌표 결측 상태 미표기 feature ${nullGeomNoStatus}건`
      )
    );
  }
  return parsed.features.length;
}

// 계약 감지. 부분 일치(알려진 계열인데 필수열 누락)는 generic 우회가 아니라 명시적 fail 로 처리한다.
export function detectContract(columns, issues = []) {
  const cols = new Set(columns.map((c) => String(c).toLowerCase()));
  if (cols.has("latitude") && cols.has("longitude") && (cols.has("source_record_id") || cols.has("facility_name"))) {
    return "facility";
  }
  if ((cols.has("source_record_id") || cols.has("facility_name")) && (!cols.has("latitude") || !cols.has("longitude"))) {
    issues.push(
      issue("fail", "facility_missing_required_columns", "시설 계열로 보이나 latitude/longitude 열이 없음 — 불완전 계약은 승인 불가")
    );
    return "facility_incomplete";
  }
  if (cols.has("school_name") && cols.has("designation_type")) return "designation";
  if (cols.has("school_name") && !cols.has("designation_type") && (cols.has("year") || cols.has("school_year") || cols.has("program_name"))) {
    issues.push(
      issue(
        "fail",
        "designation_missing_required_columns",
        "지정학교 계열로 보이나 designation_type 열이 없음 — 불완전 계약은 승인 불가"
      )
    );
    return "designation_incomplete";
  }
  return "generic";
}

// 좌표 컬럼이 있는 임의 CSV(어댑터 정규화 산출물 포함)에 대한 범위 검사.
function checkCoordinateColumns(columns, records, issues) {
  const lower = columns.map((c) => String(c).toLowerCase());
  const latIdx = lower.findIndex((c) => LAT_KEYS.includes(c));
  const lngIdx = lower.findIndex((c) => LNG_KEYS.includes(c));
  if (latIdx === -1 || lngIdx === -1) return false;
  const latCol = columns[latIdx];
  const lngCol = columns[lngIdx];
  let outOfBounds = 0;
  let unpaired = 0;
  for (const rec of records) {
    const latRaw = rec[latCol];
    const lngRaw = rec[lngCol];
    const hasLat = latRaw !== null && latRaw !== undefined && String(latRaw).trim() !== "";
    const hasLng = lngRaw !== null && lngRaw !== undefined && String(lngRaw).trim() !== "";
    if (hasLat !== hasLng) {
      unpaired += 1;
      continue;
    }
    if (!hasLat) continue; // 결측 좌표 자체는 여기서 판정하지 않는다(시설 계약이 상태표기로 판정).
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKoreaBounds(lat, lng)) outOfBounds += 1;
  }
  if (unpaired > 0) {
    issues.push(issue("fail", "coordinate_pair_incomplete", `위/경도 중 한쪽만 있는 행 ${unpaired}건 (${latCol}/${lngCol})`));
  }
  if (outOfBounds > 0) {
    issues.push(
      issue(
        "fail",
        "coordinate_out_of_bounds",
        `한반도 광역 범위(위 ${KOREA_BOUNDS.latMin}~${KOREA_BOUNDS.latMax} / 경 ${KOREA_BOUNDS.lngMin}~${KOREA_BOUNDS.lngMax}) 밖 좌표 ${outOfBounds}건 (${latCol}/${lngCol})`
      )
    );
  }
  return true;
}

function analyzeRecordArray(records, columns, issues, options) {
  const contract = detectContract(columns, issues);
  const objects = records.filter((x) => x && typeof x === "object");
  if (contract === "facility") checkFacilityRecords(objects, issues);
  else if (contract === "designation") checkDesignationRecords(objects, issues);
  const hadCoordColumns = checkCoordinateColumns(columns, objects, issues);
  // 어댑터가 필수 컬럼을 선언했으면, 알려진 계약이 아니어도 그 자체가 계약이다.
  const required = (options && options.requiredColumns) || [];
  if (required.length) {
    const missing = required.filter((c) => !columns.includes(c));
    if (missing.length) {
      issues.push(
        issue("fail", "required_columns_missing", `어댑터가 요구하는 필수 컬럼 누락: ${missing.join(", ")}`)
      );
    }
  }
  return { contract, hadCoordColumns };
}

/**
 * 한 파일(버퍼)의 품질 검사.
 *
 * @param {Buffer|string} content
 * @param {string} name           파일명 (.csv/.json/.geojson 로 형식 판정)
 * @param {{requiredColumns?: string[], adapterContract?: string}} [options]
 * @returns {{records:number, columns:string[], contract:string, issues:object[], status:"ok"|"warn"|"unsupported"|"fail"}}
 */
export function analyzeContent(content, name, options = {}) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf-8");
  const ext = (String(name).match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const issues = [];
  let records = 0;
  let columns = [];
  let contract = "generic";
  let recognisedByAdapter = false;
  const text = buffer.toString("utf-8");

  if (buffer.length === 0) {
    issues.push(issue("fail", "empty_file", "빈 파일"));
  } else if (ext === ".csv") {
    try {
      const rows = parseCsvRows(text);
      if (rows.length < 1) issues.push(issue("fail", "csv_no_header", "헤더가 없음"));
      else {
        columns = rows[0].map((c) => String(c).trim());
        records = rows.length - 1;
        const badWidth = rows.slice(1).filter((r) => r.length !== columns.length).length;
        if (badWidth > 0) issues.push(issue("fail", "csv_ragged_rows", `열 개수가 헤더와 다른 행 ${badWidth}건`));
        else {
          const res = analyzeRecordArray(rowsToRecords(rows), columns, issues, options);
          contract = res.contract;
          recognisedByAdapter = Boolean((options.requiredColumns || []).length);
        }
        if (records === 0) {
          issues.push(issue("fail", "csv_zero_records", "데이터 행 0건 — 실제 0건인지 수집 실패인지 구분 불가, 승격 금지"));
        }
      }
    } catch (err) {
      issues.push(issue("fail", "csv_parse_error", `CSV 파싱 실패: ${err.message}`));
    }
  } else if (ext === ".json" || ext === ".geojson") {
    let parsed;
    let parseFailed = false;
    try {
      parsed = JSON.parse(text.replace(/^﻿/, ""));
    } catch (err) {
      parseFailed = true;
      issues.push(issue("fail", "json_parse_error", `JSON 파싱 실패: ${err.message}`));
    }
    if (!parseFailed) {
      if (parsed === null || typeof parsed !== "object") {
        issues.push(
          issue("fail", "json_not_record_data", `레코드 데이터가 아닌 JSON 값(${parsed === null ? "null" : typeof parsed})`)
        );
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
          const res = analyzeRecordArray(parsed, columns, issues, options);
          contract = res.contract;
          recognisedByAdapter = Boolean((options.requiredColumns || []).length);
        }
      } else if (parsed.layers && typeof parsed.layers === "object" && "data_as_of" in parsed) {
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
            const res = analyzeRecordArray(parsed[arrayKey], columns, issues, options);
            contract = res.contract;
            recognisedByAdapter = Boolean((options.requiredColumns || []).length);
          }
        } else {
          issues.push(issue("fail", "json_no_record_array", "레코드 배열/알려진 계약 구조를 찾지 못함"));
        }
      }
    }
  } else {
    issues.push(issue("fail", "unsupported_file_type", `지원하지 않는 파일 형식: ${ext || "(확장자 없음)"}`));
  }

  if (/sk-[A-Za-z0-9_-]{16,}/.test(text)) {
    issues.push(issue("fail", "possible_secret_content", "API 키로 의심되는 문자열 포함 — 반입 차단"));
  }

  // 계약이 인식되지 않은 데이터는 "검사 통과"가 아니라 미지원(검토 전용) 상태다. 승격이 차단된다.
  // 단, 어댑터가 필수 컬럼을 선언했고 그 검사를 통과했다면 그것이 명시적 계약이다.
  if (contract === "generic" && !recognisedByAdapter && !issues.some((i) => i.level === "fail")) {
    issues.push(
      issue(
        "unsupported",
        "contract_unrecognized",
        "알려진 계약(시설/지정학교/컨텍스트 manifest/학교 요약/GeoJSON/어댑터 필수컬럼)에 해당하지 않음 — 검토 전용, 승인 불가"
      )
    );
  }

  const status = issues.some((i) => i.level === "fail")
    ? "fail"
    : issues.some((i) => i.level === "unsupported")
      ? "unsupported"
      : issues.some((i) => i.level === "warn")
        ? "warn"
        : "ok";
  return { records, columns, contract, issues, status };
}

export function overallStatus(fileResults) {
  if (fileResults.some((f) => f.status === "fail")) return "fail";
  if (fileResults.some((f) => f.status === "unsupported")) return "unsupported";
  if (fileResults.some((f) => f.status === "warn")) return "warn";
  return "ok";
}

/** overall 품질 상태 → 이벤트 risk 등급 (fail/unsupported 는 승인 차단 = red). */
export function riskFromStatus(status) {
  if (status === "fail" || status === "unsupported") return "red";
  if (status === "warn") return "yellow";
  return "green";
}

export function approvalBlocked(status) {
  return status === "fail" || status === "unsupported";
}

// ---------------------------------------------------------------------------
// schema diff against the currently-applied local file
// ---------------------------------------------------------------------------

function readColumnsFromFile(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const text = fs.readFileSync(absPath, "utf-8");
  if (/\.(json|geojson)$/i.test(absPath)) {
    try {
      const parsed = JSON.parse(text.replace(/^﻿/, ""));
      if (Array.isArray(parsed)) {
        const first = parsed.find((x) => x && typeof x === "object");
        return first ? Object.keys(first) : [];
      }
      if (parsed && parsed.type === "FeatureCollection" && Array.isArray(parsed.features)) {
        const first = parsed.features.find((f) => f && f.properties && typeof f.properties === "object");
        return first ? Object.keys(first.properties) : [];
      }
      return null;
    } catch {
      return null;
    }
  }
  try {
    const rows = parseCsvRows(text);
    return rows.length ? rows[0].map((c) => String(c).trim()) : [];
  } catch {
    return null;
  }
}

/**
 * 현재 적용본 파일과 후보의 컬럼 집합 diff.
 * 추가/이름변경 후보에 대해서는 결정론적 매핑 제안(added↔removed 유사도)을 붙인다.
 */
export function schemaDiffAgainstCurrent(candidateColumns, currentAbsPath) {
  const currentColumns = readColumnsFromFile(currentAbsPath);
  if (currentColumns === null) {
    return { baseline_available: false, added: [], removed: [], mapping_suggestions: [] };
  }
  const currentSet = new Set(currentColumns);
  const candidateSet = new Set(candidateColumns);
  const added = candidateColumns.filter((c) => !currentSet.has(c));
  const removed = currentColumns.filter((c) => !candidateSet.has(c));
  return {
    baseline_available: true,
    current_columns: currentColumns,
    candidate_columns: candidateColumns,
    added,
    removed,
    mapping_suggestions: suggestColumnMapping(added, removed),
  };
}

function normaliseName(name) {
  return String(name).toLowerCase().replace(/[\s_\-().]/g, "");
}

function similarity(a, b) {
  const x = normaliseName(a);
  const y = normaliseName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const shorter = x.length <= y.length ? x : y;
  const longer = x.length <= y.length ? y : x;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // 문자 다중집합 겹침 비율 — 외부 의존성 없는 결정론적 근사치.
  const counts = new Map();
  for (const ch of longer) counts.set(ch, (counts.get(ch) || 0) + 1);
  let overlap = 0;
  for (const ch of shorter) {
    const n = counts.get(ch) || 0;
    if (n > 0) {
      overlap += 1;
      counts.set(ch, n - 1);
    }
  }
  return overlap / longer.length;
}

/**
 * 삭제된 컬럼 ↔ 추가된 컬럼의 결정론적 rename 후보 매핑. AI 없이도 항상 동작하며,
 * api/update-center.js의 AI 해설은 이 결과를 참고 문장으로 덧붙일 뿐이다.
 */
export function suggestColumnMapping(added, removed, threshold = 0.5) {
  const suggestions = [];
  const usedAdded = new Set();
  for (const from of removed) {
    let best = null;
    let bestScore = 0;
    for (const to of added) {
      if (usedAdded.has(to)) continue;
      const score = similarity(from, to);
      if (score > bestScore) {
        bestScore = score;
        best = to;
      }
    }
    if (best && bestScore >= threshold) {
      usedAdded.add(best);
      suggestions.push({ from, to: best, confidence: Math.round(bestScore * 100) / 100, basis: "이름 유사도(결정론적)" });
    }
  }
  return suggestions;
}

// ---------------------------------------------------------------------------
// record-level diff by primary key
// ---------------------------------------------------------------------------

const KEY_SEP = String.fromCharCode(31); // 실데이터에 나타나지 않는 구분자
function keyOf(record, primaryKey) {
  return primaryKey.map((k) => String(record[k] ?? "").trim()).join(KEY_SEP);
}

/**
 * 기본키 기준 레코드 단위 diff.
 *
 * @param {object[]} currentRecords
 * @param {object[]} candidateRecords
 * @param {string[]} primaryKey
 * @param {number} exampleLimit
 * @returns {{primary_key:string[], added:number, removed:number, changed:number, unchanged:number,
 *            duplicate_keys:number, examples:object[]}}
 */
export function recordDiffByKey(currentRecords, candidateRecords, primaryKey, exampleLimit = 20) {
  if (!Array.isArray(primaryKey) || primaryKey.length === 0) {
    return {
      primary_key: [],
      supported: false,
      note: "어댑터가 기본키를 선언하지 않아 레코드 단위 diff를 계산하지 않았습니다.",
      added: 0,
      removed: 0,
      changed: 0,
      unchanged: 0,
      duplicate_keys: 0,
      examples: [],
    };
  }
  const currentMap = new Map();
  let duplicateKeys = 0;
  for (const rec of currentRecords) {
    const k = keyOf(rec, primaryKey);
    if (currentMap.has(k)) duplicateKeys += 1;
    else currentMap.set(k, rec);
  }
  const candidateMap = new Map();
  for (const rec of candidateRecords) {
    const k = keyOf(rec, primaryKey);
    if (candidateMap.has(k)) duplicateKeys += 1;
    else candidateMap.set(k, rec);
  }

  const examples = [];
  let added = 0;
  let removed = 0;
  let changed = 0;
  let unchanged = 0;

  for (const [k, candRec] of candidateMap) {
    const curRec = currentMap.get(k);
    if (!curRec) {
      added += 1;
      if (examples.length < exampleLimit) examples.push({ change: "added", key: k.split(KEY_SEP), after: candRec });
      continue;
    }
    const fields = new Set([...Object.keys(curRec), ...Object.keys(candRec)]);
    const fieldChanges = [];
    for (const f of fields) {
      const before = curRec[f] === undefined || curRec[f] === null ? "" : String(curRec[f]);
      const after = candRec[f] === undefined || candRec[f] === null ? "" : String(candRec[f]);
      if (before !== after) fieldChanges.push({ field: f, before, after });
    }
    if (fieldChanges.length) {
      changed += 1;
      if (examples.length < exampleLimit) {
        examples.push({ change: "changed", key: k.split(KEY_SEP), fields: fieldChanges.slice(0, 8) });
      }
    } else unchanged += 1;
  }
  for (const [k, curRec] of currentMap) {
    if (!candidateMap.has(k)) {
      removed += 1;
      if (examples.length < exampleLimit) examples.push({ change: "removed", key: k.split(KEY_SEP), before: curRec });
    }
  }

  return {
    primary_key: primaryKey,
    supported: true,
    added,
    removed,
    changed,
    unchanged,
    duplicate_keys: duplicateKeys,
    examples,
  };
}

/** CSV 텍스트 → 레코드 배열 (recordDiffByKey 입력용). 파싱 실패 시 빈 배열. */
export function csvToRecords(text) {
  try {
    return rowsToRecords(parseCsvRows(text));
  } catch {
    return [];
  }
}
