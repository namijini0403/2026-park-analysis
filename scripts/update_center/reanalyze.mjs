#!/usr/bin/env node
// scripts/update_center/reanalyze.mjs
// P4 Task 4: lightweight reanalysis for the libraries dataset in the update-center.
//
// reanalyzeLibraries(newCsvText) recomputes, per school, the same isochrone-based
// reachability figures that scripts/reading_module/build_library_layer.py computes
// (point-in-polygon against data_processed/school_isochrone_500m.geojson; haversine
// distance is a reference figure only, never promoted to "reachability" -- see
// Global Constraints in docs/superpowers/plans/2026-08-09-p4-update-center.md),
// then diffs the result against the currently-committed
// data_processed/school_library_access.csv.
//
// applyLibrariesUpdate() snapshots the current libraries.csv + school_library_access.csv,
// writes the new libraries.csv, and patches ONLY the iso_/nearest_ columns of
// school_library_access.csv -- every other column (reading_gap_type, external_shortage,
// internal_shortage, demand_high, reading_gap_reason, matched, 장서수, ...) is left
// byte-identical, because those are derived by the Python pipeline and this module
// intentionally does not attempt to reproduce that logic. Re-deriving them requires
// re-running, in order:
//   scripts/reading_module/build_library_layer.py
//   -> scripts/reading_module/apply_reading_gap_types.py
//   -> scripts/reading_module/build_policy_cards.py
// (documented in the applied audit entry and in docs/update_center.md).
//
// SNAPSHOT FORMAT: a single combined snapshot per version row, not two saveVersion
// calls -- {files: {"data_processed/libraries.csv": base64, "data_processed/school_library_access.csv": base64}},
// itself base64-encoded into data_versions.snapshot. Chosen over two separate
// saveVersion calls so one version id == one atomic restore point for rollback,
// and so the store's 11-method interface (no "link these two versions together"
// method) doesn't need to be extended. Documented here per the Task 4 brief's
// "choose one, document" instruction.
//
// SEALED VALUE GUARD: output/sealed_nearest_park_dist.json holds the
// manually-verified nearest-park distances (수동 검증 실측값) that must never be
// silently overwritten by automated recalculation (Global Constraints). sealedGuard() is called from
// applyLibrariesUpdate() on every apply, unconditionally -- even though the
// libraries dataset has nothing to do with parks -- so the guard is structurally
// present on the code path rather than assumed absent, and the audit log always
// records that it ran (0 schools protected for a libraries apply, by design).
//
// CLI test mode:
//   node scripts/update_center/reanalyze.mjs --dry-run <libraries csv path>

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const SCHOOLS_PATH = path.join(REPO_ROOT, "data_processed", "schools.csv");
const ISOCHRONE_PATH = path.join(REPO_ROOT, "data_processed", "school_isochrone_500m.geojson");
const LIBRARIES_PATH = path.join(REPO_ROOT, "data_processed", "libraries.csv");
const ACCESS_PATH = path.join(REPO_ROOT, "data_processed", "school_library_access.csv");
const SEALED_PARKS_PATH = path.join(REPO_ROOT, "output", "sealed_nearest_park_dist.json");

const LIBRARIES_REL = "data_processed/libraries.csv";
const ACCESS_REL = "data_processed/school_library_access.csv";

// SEALED_FILES: 자동 반영이 절대 덮어써서는 안 되는 파일들(수동 검증 실측값).
// sealedGuard()가 학교 단위 보호 목록을 돌려주는 것과 짝을 이루는 "파일 단위" 목록으로,
// scripts/update_center/apply.mjs 가 반영/롤백 직전에 이 목록을 확인한다.
// 새 봉인 파일이 생기면 여기에 상대경로를 추가하면 apply 경로 전체에 즉시 적용된다.
export const SEALED_FILES = ["output/sealed_nearest_park_dist.json"];

// Same set as build_library_layer.py's PUBLIC_TYPES (already-mapped 유형 values
// as they appear in libraries.csv, not the raw LBRRY_SE codes).
const PUBLIC_TYPES = new Set(["공공", "어린이"]);

// The only columns this module is allowed to touch in school_library_access.csv.
const ISO_NEAREST_COLUMNS = [
  "iso_library_count",
  "iso_public_library_count",
  "nearest_library_name",
  "nearest_library_euclid_m",
  "nearest_library_type",
  "nearest_library_coord_source",
];

const REQUIRED_LIBRARY_COLUMNS = [
  "도서관명",
  "유형",
  "구",
  "위도",
  "경도",
  "장서수",
  "열람좌석수",
  "평일운영",
  "휴관일",
  "기준일",
  "좌표출처",
];

// ---------------------------------------------------------------------------
// CSV parse/serialize
//
// Matches the dialect pandas.to_csv() writes for these files: comma-delimited,
// QUOTE_MINIMAL (only quote a field that contains a comma/quote/newline,
// doubling embedded quotes), CRLF line endings. Not a general-purpose CSV
// library -- prototype-grade, same approach as scan.mjs's parseCsv().
// ---------------------------------------------------------------------------

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
      // skip; \n (or end of input) below closes the row
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

function csvField(value) {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function serializeCsv(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(csvField).join(","));
  return lines.join("\r\n") + "\r\n";
}

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf-8").digest("hex");
}

// ---------------------------------------------------------------------------
// Geometry: point-in-polygon (ray casting) + haversine
//
// Deliberately the same algorithm as build_library_layer.py's pure-Python
// fallback (point_in_geometry_raw / _point_in_ring), operating on GeoJSON
// [lng, lat] coordinate order, Polygon (outer ring + holes) and MultiPolygon
// (array of polygons). Kept bit-for-bit equivalent so the consistency check
// (unchanged input -> 0 affected schools) holds exactly.
// ---------------------------------------------------------------------------

function pointInRing(x, y, ring) {
  let inside = false;
  const n = ring.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (yi > y !== yj > y) {
      const denom = yj - yi || 1e-15;
      const xIntersect = ((xj - xi) * (y - yi)) / denom + xi;
      if (x < xIntersect) inside = !inside;
    }
    j = i;
  }
  return inside;
}

function pointInPolygonCoords(x, y, coords) {
  if (!coords || coords.length === 0) return false;
  if (!pointInRing(x, y, coords[0])) return false;
  for (let k = 1; k < coords.length; k++) {
    if (pointInRing(x, y, coords[k])) return false;
  }
  return true;
}

function pointInGeometry(x, y, geometry) {
  if (!geometry) return false;
  const gtype = geometry.type;
  const coords = geometry.coordinates;
  if (gtype === "Polygon") return pointInPolygonCoords(x, y, coords);
  if (gtype === "MultiPolygon") return coords.some((poly) => pointInPolygonCoords(x, y, poly));
  return false;
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000.0;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1.0, a)));
}

// Python's round() on a float is round-half-to-even (banker's rounding),
// evaluated against the exact double value -- NOT Math.round's round-half-up.
// build_library_layer.py does `int(round(best_dist))`; replicate exactly so
// nearest_library_euclid_m matches bit-for-bit (ties are effectively
// impossible for computed haversine distances, but match the rule anyway).
function pyRoundInt(x) {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

// ---------------------------------------------------------------------------
// Loading fixed inputs (schools + isochrones never come from the update CSV)
// ---------------------------------------------------------------------------

function loadSchools() {
  const text = fs.readFileSync(SCHOOLS_PATH, "utf-8");
  const { header, rows } = parseCsv(text);
  const idSid = header.indexOf("학교ID");
  const idName = header.indexOf("학교명");
  const idLat = header.indexOf("위도");
  const idLon = header.indexOf("경도");
  if (idSid === -1 || idName === -1 || idLat === -1 || idLon === -1) {
    throw new Error(`reanalyze.mjs: schools.csv에 필요한 컬럼(학교ID/학교명/위도/경도)이 없습니다 (header: ${header.join(",")})`);
  }
  return rows.map((r) => ({
    학교ID: r[idSid],
    학교명: r[idName],
    lat: parseFloat(r[idLat]),
    lon: parseFloat(r[idLon]),
  }));
}

function loadIsochrones() {
  const geo = JSON.parse(fs.readFileSync(ISOCHRONE_PATH, "utf-8"));
  const map = new Map();
  for (const feat of geo.features || []) {
    const sid = feat.properties && feat.properties["학교ID"];
    if (sid === undefined) continue;
    map.set(sid, feat.geometry);
  }
  return map;
}

function parseLibrariesCsv(csvText) {
  const { header, rows } = parseCsv(csvText);
  const idx = {};
  for (const col of REQUIRED_LIBRARY_COLUMNS) {
    const i = header.indexOf(col);
    if (i === -1) {
      throw new Error(`reanalyzeLibraries: 새 CSV에 필수 컬럼 "${col}"이 없습니다 (header: ${header.join(",")})`);
    }
    idx[col] = i;
  }
  return rows.map((r) => ({
    도서관명: r[idx["도서관명"]],
    유형: r[idx["유형"]],
    lat: parseFloat(r[idx["위도"]]),
    lon: parseFloat(r[idx["경도"]]),
    좌표출처: r[idx["좌표출처"]],
  }));
}

// ---------------------------------------------------------------------------
// Core recompute
// ---------------------------------------------------------------------------

function computePerSchool(libraries, schools, isoMap) {
  const perSchool = new Map();
  for (const s of schools) {
    const geom = isoMap.get(s.학교ID) || null;
    let countAll = 0;
    let countPublic = 0;
    let bestDist = null;
    let bestName = null;
    let bestType = null;
    let bestCoordSource = null;
    for (const lib of libraries) {
      if (pointInGeometry(lib.lon, lib.lat, geom)) {
        countAll++;
        if (PUBLIC_TYPES.has(lib.유형)) countPublic++;
      }
      const d = haversineM(s.lat, s.lon, lib.lat, lib.lon);
      if (bestDist === null || d < bestDist) {
        bestDist = d;
        bestName = lib.도서관명;
        bestType = lib.유형;
        bestCoordSource = lib.좌표출처;
      }
    }
    perSchool.set(s.학교ID, {
      학교ID: s.학교ID,
      학교명: s.학교명,
      iso_library_count: countAll,
      iso_public_library_count: countPublic,
      nearest_library_name: bestName,
      nearest_library_euclid_m: bestDist === null ? null : pyRoundInt(bestDist),
      nearest_library_type: bestType,
      nearest_library_coord_source: bestCoordSource,
    });
  }
  return perSchool;
}

/**
 * Recompute per-school library-reachability figures from a candidate new
 * libraries.csv text, and diff them against the currently-committed
 * data_processed/school_library_access.csv.
 *
 * @param {string} newCsvText - full text of a candidate libraries.csv
 * @returns {{ perSchool: Map<string, object>, diff: {
 *   affected_school_count: number,
 *   external_shortage_before: number,
 *   external_shortage_after: number,
 *   changed_schools: Array<{학교ID: string, 학교명: string, field: string, before: string, after: string}>
 * } }}
 */
export function reanalyzeLibraries(newCsvText) {
  const libraries = parseLibrariesCsv(newCsvText);
  const schools = loadSchools();
  const isoMap = loadIsochrones();
  const perSchool = computePerSchool(libraries, schools, isoMap);

  const currentAccessText = fs.readFileSync(ACCESS_PATH, "utf-8");
  const { header, rows } = parseCsv(currentAccessText);
  const idxSid = header.indexOf("학교ID");
  const idxName = header.indexOf("학교명");
  const idxExtShortage = header.indexOf("external_shortage");
  const idxPublicCount = header.indexOf("iso_public_library_count");
  if (idxSid === -1 || idxExtShortage === -1 || idxPublicCount === -1) {
    throw new Error(
      `reanalyzeLibraries: school_library_access.csv에 필요한 컬럼(학교ID/external_shortage/iso_public_library_count)이 없습니다`
    );
  }

  const affected = new Set();
  const changedSchools = [];
  let externalShortageBefore = 0;
  let externalShortageAfter = 0;

  for (const row of rows) {
    const sid = row[idxSid];
    const after = perSchool.get(sid);
    if (!after) continue; // school in access.csv but not in schools.csv/geojson -- shouldn't happen in this dataset

    if (row[idxExtShortage] === "True") externalShortageBefore++;
    if (after.iso_public_library_count === 0) externalShortageAfter++;

    let rowChanged = false;
    for (const field of ISO_NEAREST_COLUMNS) {
      const i = header.indexOf(field);
      if (i === -1) continue;
      const beforeVal = row[i];
      const afterRaw = after[field];
      const afterVal = afterRaw === null || afterRaw === undefined ? "" : String(afterRaw);
      if (beforeVal !== afterVal) {
        rowChanged = true;
        changedSchools.push({
          학교ID: sid,
          학교명: row[idxName],
          field,
          before: beforeVal,
          after: afterVal,
        });
      }
    }
    if (rowChanged) affected.add(sid);
  }

  return {
    perSchool,
    diff: {
      affected_school_count: affected.size,
      external_shortage_before: externalShortageBefore,
      external_shortage_after: externalShortageAfter,
      changed_schools: changedSchools.slice(0, 20),
    },
  };
}

/**
 * dataset === "parks": returns the list of 학교ID protected by
 * output/sealed_nearest_park_dist.json (never auto-overwrite these).
 * dataset === "libraries" (or anything else): returns [] -- the libraries
 * dataset has no relationship to the sealed park distances.
 */
export function sealedGuard(dataset) {
  if (dataset !== "parks") return [];
  if (!fs.existsSync(SEALED_PARKS_PATH)) return [];
  const sealed = JSON.parse(fs.readFileSync(SEALED_PARKS_PATH, "utf-8"));
  return Object.keys(sealed);
}

/**
 * approve flow: snapshot current libraries.csv + school_library_access.csv
 * into a single data_versions row, write the new libraries.csv, patch only
 * the iso_/nearest_ columns of school_library_access.csv, and audit every step.
 */
export async function applyLibrariesUpdate(newCsvText, store, eventId, actor) {
  // Sealed-value guard: structurally present on every apply path (see file
  // header comment). For libraries this is always a documented no-op.
  const sealedSchools = sealedGuard("libraries");
  await store.appendAudit({
    actor,
    action: "sealed_guard_check",
    dataset: "libraries",
    event_id: eventId,
    detail: `봉인값 보호 대상 0건(도서관 재분석은 봉인값과 무관) — sealedGuard("libraries") 반환 ${sealedSchools.length}건`,
  });

  const { perSchool, diff } = reanalyzeLibraries(newCsvText);

  // --- snapshot pre-apply state (single combined version row) ---
  const librariesBefore = fs.readFileSync(LIBRARIES_PATH);
  const accessBeforeBuf = fs.readFileSync(ACCESS_PATH);
  const accessBeforeText = accessBeforeBuf.toString("utf-8");
  const { header: accessHeader, rows: accessRowsBefore } = parseCsv(accessBeforeText);

  const snapshotPayload = {
    files: {
      [LIBRARIES_REL]: librariesBefore.toString("base64"),
      [ACCESS_REL]: accessBeforeBuf.toString("base64"),
    },
  };
  const snapshotJsonText = JSON.stringify(snapshotPayload);
  const contentHash = sha256(snapshotJsonText);

  const version = await store.saveVersion({
    dataset: "libraries",
    content_hash: contentHash,
    row_count: accessRowsBefore.length,
    snapshot: Buffer.from(snapshotJsonText, "utf-8").toString("base64"),
    source_event_id: eventId,
    applied: true,
    rolled_back: false,
  });

  await store.appendAudit({
    actor,
    action: "snapshot_saved",
    dataset: "libraries",
    event_id: eventId,
    detail: `적용 전 스냅샷 저장 (version=${version.id}, libraries.csv+school_library_access.csv 결합 스냅샷, sha256=${contentHash}, row_count=${accessRowsBefore.length})`,
  });

  // --- patch ONLY iso_/nearest_ columns in school_library_access.csv (built
  // up-front, in memory, so the write below is the only thing that can fail) ---
  const idxSid = accessHeader.indexOf("학교ID");
  const fieldColIdx = ISO_NEAREST_COLUMNS.map((f) => accessHeader.indexOf(f));
  const newRows = accessRowsBefore.map((row) => {
    const sid = row[idxSid];
    const after = perSchool.get(sid);
    if (!after) return row;
    const newRow = row.slice();
    ISO_NEAREST_COLUMNS.forEach((field, k) => {
      const i = fieldColIdx[k];
      if (i === -1) return;
      const v = after[field];
      newRow[i] = v === null || v === undefined ? "" : String(v);
    });
    return newRow;
  });
  const newAccessCsv = serializeCsv(accessHeader, newRows);

  // --- write both files. Not a real transaction (plain fs writes, no atomic
  // rename-swap in this prototype) -- if the second write fails after the
  // first succeeded, the two files would be left inconsistent (new
  // libraries.csv paired with the OLD school_library_access.csv). Guard
  // against that: on any write failure, audit exactly which file(s) made it
  // to disk plus the versionId needed for manual recovery, best-effort
  // auto-restore libraries.csv from the in-memory pre-apply snapshot, audit
  // that attempt's outcome, then rethrow a clean error. This does not
  // guarantee atomicity, but it guarantees the failure is never silent and a
  // human always has what they need (versionId + which files to check) to
  // finish the recovery via rollbackVersion() if the auto-restore itself fails.
  let librariesWritten = false;
  let accessWritten = false;
  try {
    fs.writeFileSync(LIBRARIES_PATH, newCsvText, "utf-8");
    librariesWritten = true;
    fs.writeFileSync(ACCESS_PATH, newAccessCsv, "utf-8");
    accessWritten = true;
  } catch (err) {
    const writtenFiles = [];
    if (librariesWritten) writtenFiles.push(LIBRARIES_REL);
    if (accessWritten) writtenFiles.push(ACCESS_REL);
    await store.appendAudit({
      actor,
      action: "apply_failed_partial",
      dataset: "libraries",
      event_id: eventId,
      detail:
        `apply 중 오류 발생 — 실제로 기록된 파일: ${writtenFiles.join(", ") || "(없음)"} / ` +
        `복구용 versionId=${version.id} (rollbackVersion으로 수동 복구 가능) / 오류: ${err.message}`,
    });

    if (librariesWritten && !accessWritten) {
      // libraries.csv was overwritten but school_library_access.csv wasn't
      // touched yet -- the two files are now inconsistent. Best-effort put
      // libraries.csv back so at least that inconsistency window closes
      // without requiring a manual rollback for the common case.
      try {
        fs.writeFileSync(LIBRARIES_PATH, librariesBefore);
        await store.appendAudit({
          actor,
          action: "auto_restore_attempted",
          dataset: "libraries",
          event_id: eventId,
          detail: `libraries.csv 자동 복구 성공 (version=${version.id} 스냅샷 사용)`,
        });
      } catch (restoreErr) {
        await store.appendAudit({
          actor,
          action: "auto_restore_attempted",
          dataset: "libraries",
          event_id: eventId,
          detail: `libraries.csv 자동 복구 실패: ${restoreErr.message} — 수동 복구 필요 (rollbackVersion, versionId=${version.id})`,
        });
      }
    }

    throw new Error(`applyLibrariesUpdate: 파일 적용 중 오류 발생 (versionId=${version.id}): ${err.message}`);
  }

  await store.appendAudit({
    actor,
    action: "files_applied",
    dataset: "libraries",
    event_id: eventId,
    detail:
      `libraries.csv 교체 + school_library_access.csv의 iso_/nearest_ 컬럼 갱신 완료 ` +
      `(영향 학교 ${diff.affected_school_count}건, external_shortage ${diff.external_shortage_before}->${diff.external_shortage_after}). ` +
      `격차 유형(reading_gap_type) 재산출은 Python 파이프라인 재실행 필요: ` +
      `build_library_layer.py → apply_reading_gap_types.py → build_policy_cards.py`,
  });

  return { versionId: version.id, diff };
}

/**
 * rollback: verify the snapshot's integrity, restore its files, mark the
 * version rolled_back in the store, and audit the action.
 *
 * Integrity check: the snapshot's decoded JSON text is re-hashed (sha256) and
 * compared against the version row's stored content_hash *before* any file
 * is touched. A mismatch means the stored snapshot is not what was recorded
 * at apply time (corruption, manual tampering, a bug elsewhere) -- restoring
 * it would silently apply unknown content, so this aborts with no writes
 * instead.
 */
export async function rollbackVersion(versionId, store, actor) {
  const version = await store.getVersion(versionId);
  if (!version) {
    throw new Error(`rollbackVersion: version ${versionId}를 찾을 수 없습니다`);
  }
  if (version.dataset !== "libraries") {
    throw new Error(`rollbackVersion: reanalyze.mjs는 dataset="libraries" 버전만 처리합니다 (received "${version.dataset}")`);
  }

  const snapshotJsonText = Buffer.from(version.snapshot, "base64").toString("utf-8");
  const recomputedHash = sha256(snapshotJsonText);
  if (version.content_hash && recomputedHash !== version.content_hash) {
    await store.appendAudit({
      actor,
      action: "rollback_integrity_failed",
      dataset: "libraries",
      event_id: version.source_event_id,
      detail:
        `버전 ${versionId} 롤백 중단 — 저장된 content_hash(${version.content_hash})와 ` +
        `스냅샷 재해시(${recomputedHash})가 일치하지 않습니다. 파일에 아무것도 쓰지 않았습니다.`,
    });
    throw new Error(
      `rollbackVersion: 버전 ${versionId}의 스냅샷 무결성 검증 실패 (content_hash 불일치) — 복원 중단`
    );
  }

  const snapshotJson = JSON.parse(snapshotJsonText);
  const files = snapshotJson.files || {};
  const restored = [];
  for (const [relPath, contentB64] of Object.entries(files)) {
    const abs = path.join(REPO_ROOT, relPath);
    fs.writeFileSync(abs, Buffer.from(contentB64, "base64"));
    restored.push(relPath);
  }

  await store.markVersionRolledBack(versionId);

  await store.appendAudit({
    actor,
    action: "rollback",
    dataset: "libraries",
    event_id: version.source_event_id,
    detail: `버전 ${versionId} 롤백 완료 (무결성 검증 통과, sha256=${recomputedHash}) — 복원 파일: ${restored.join(", ") || "(없음)"}`,
  });

  return { versionId, restoredFiles: restored };
}

// ---------------------------------------------------------------------------
// CLI: --dry-run <csv path>
// ---------------------------------------------------------------------------

function printDiff(csvPathArg, diff) {
  console.log(`=== reanalyze.mjs --dry-run ${csvPathArg} ===`);
  console.log(`affected_school_count: ${diff.affected_school_count}`);
  console.log(`external_shortage_before: ${diff.external_shortage_before}`);
  console.log(`external_shortage_after: ${diff.external_shortage_after}`);
  console.log(`changed_schools (top ${diff.changed_schools.length} of up to 20 shown):`);
  if (diff.changed_schools.length === 0) {
    console.log("  (없음)");
  } else {
    for (const c of diff.changed_schools) {
      console.log(`  - ${c.학교ID} ${c.학교명} | ${c.field}: ${c.before} -> ${c.after}`);
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRunIdx = argv.indexOf("--dry-run");
  if (dryRunIdx === -1) {
    console.log("Usage: node scripts/update_center/reanalyze.mjs --dry-run <libraries csv path>");
    return;
  }
  const csvPathArg = argv[dryRunIdx + 1];
  if (!csvPathArg) {
    console.error("reanalyze.mjs --dry-run: CSV 경로가 필요합니다");
    process.exitCode = 1;
    return;
  }
  const abs = path.isAbsolute(csvPathArg) ? csvPathArg : path.join(process.cwd(), csvPathArg);
  const text = fs.readFileSync(abs, "utf-8");
  const { diff } = reanalyzeLibraries(text);
  printDiff(csvPathArg, diff);
}

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main().catch((err) => {
    console.error(`reanalyze.mjs failed: ${err.stack || err.message}`);
    process.exitCode = 1;
  });
}
