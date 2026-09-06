#!/usr/bin/env node
// scripts/update_center/store.mjs
// Storage layer for the P4 update-center: dual backend (Postgres via `pg`, or a local JSON file).
//
// Both backends expose the same 11-method async interface:
//   recordEvent(e), listEvents(limit), getEvent(id), updateEventStatus(id, status, actor),
//   setEventAiNote(id, note), saveVersion(v), listVersions(dataset, limit), getVersion(id),
//   markVersionRolledBack(id), appendAudit(a), listAudit(limit)
// plus getMeta(key)/setMeta(key, value) (operational key/value state) and, since
// 2026-09-07, the durable-version methods below.
//
// --- 버전 파일 영속화 (Postgres = 진실, 디스크 = 캐시) ---------------------
//   putVersionFiles(versionId, files, manifest)  버전 디렉터리 전체(파일 + previous + manifest)를
//                                                DB 에 저장. files[] = {rel_path, sha256, size_bytes, content(base64)}
//                                                rel_path 는 버전 디렉터리 기준 상대 경로
//                                                ("files/x.csv", "previous/x.csv", "manifest.json").
//   getVersionFiles(versionId)                   위 저장분을 그대로 돌려준다({version_id, manifest, files[]}).
//   listVersionFileMeta(versionId)               내용(BYTEA) 없이 이름/해시/크기만.
//   getVersionFileCounts(versionIds)             {versionId: 보존된 파일 수} (목록 화면용, 쿼리 1회).
//   getActiveVersions()                          활성 버전 포인터({active:{dataset:{version_id,version_dir,updated_at}}}).
//   setActiveVersion(dataset, versionId, info)   활성 포인터 갱신(versionId=null 이면 해당 데이터셋 제거).
//   putStagedFiles(stagingId, files, manifest)   승인 대기 후보(staging)를 DB 에 보존 — 재배포 후에도 승인 가능.
//   getStagedFiles(stagingId)                    위 저장분({staging_id, manifest, files[]}) 또는 null.
//
// 용량 가드: 단일 파일 25MB, 버전 합계 60MB 를 넘으면 저장을 거부하고 명확한 오류를 던진다
// (현재 최대 데이터 파일 ~4MB). 상한은 UPDATE_CENTER_MAX_FILE_BYTES /
// UPDATE_CENTER_MAX_VERSION_BYTES 로 조정 가능.
//
// store.backend 속성은 "postgres" | "file" 로, 기동 로그에서 어떤 백엔드가 쓰였는지
// 확인할 수 있게 한다.
//
// markVersionRolledBack(id) is the one mutation allowed on a data_versions row
// after creation: it flips rolled_back to true (idempotently) and returns the
// updated row, or null if no row with that id exists. Added for P4 Task 4's
// rollbackVersion() so the stored version reflects rollback state, not just
// the audit_log entry.
//
// setEventAiNote(id, note) is the one mutation allowed on a data_events row's
// ai_note column outside of recordEvent's initial value: it overwrites ai_note
// (does NOT touch status/actor/updated_at) and returns the updated row, or null
// if no row with that id exists. Added for P4 Task 3 so api/update-center.js can
// attach an AI-generated (or deterministic fallback) change annotation both when
// scan.mjs detects an event and again after approve applies it.
//
// Backend selection: if process.env.DATABASE_URL is set, use the Postgres backend
// (pg Pool, TLS verification ON by default; schema.sql applied on init).
// Otherwise fall back to a JSON file at data/update_center_store.json (directory and
// file created on first use).
//
// TLS: Railway managed Postgres normally presents a certificate that verifies fine.
// If a given Railway deployment uses a self-signed chain (e.g. private-network
// *.railway.internal routing) and connections fail with a cert-verification error,
// set PGSSL_NO_VERIFY=1 on the service's environment variables to explicitly opt
// into `rejectUnauthorized: false`. The default is verification ON.
//
// snapshot handling: callers always pass/receive `snapshot` as a base64 string.
// The Postgres backend converts base64 <-> Buffer (BYTEA) at the interface boundary;
// the file backend stores the base64 string as-is.
//
// Regression gate: `node scripts/update_center/store.mjs --selftest` exercises the
// file backend end-to-end and prints "OK" on success (non-zero exit + message on failure).

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { storeFilePath } from "./paths.mjs";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
// 파일 백엔드 경로는 호출 시점에 해석한다 — paths.mjs 가 UPDATE_CENTER_STORE_PATH 환경변수
// 오버라이드를 지원하므로, 테스트가 임시 디렉터리로 store 를 격리할 수 있다.
const FILE_STORE_PATH = () => storeFilePath();

function nowIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return { events: [], versions: [], audit: [], meta: {}, version_files: {} };
}

// ---------------------------------------------------------------------------
// 버전 파일 영속화 공통 규칙 (두 백엔드가 같은 상수/검증을 쓴다)
// ---------------------------------------------------------------------------

/** 단일 파일 상한. 현재 리포 최대 데이터 파일은 ~4MB 이므로 넉넉한 가드다. */
export const MAX_PERSIST_FILE_BYTES = Number(process.env.UPDATE_CENTER_MAX_FILE_BYTES || 25 * 1024 * 1024);
/** 버전(또는 staging) 한 건의 합계 상한. */
export const MAX_PERSIST_VERSION_BYTES = Number(process.env.UPDATE_CENTER_MAX_VERSION_BYTES || 60 * 1024 * 1024);

/** 활성 버전 포인터가 저장되는 meta 키. */
export const ACTIVE_VERSIONS_META_KEY = "active_versions";
/** 기동 시 복원 요약이 저장되는 meta 키. */
export const LAST_RESTORE_META_KEY = "last_restore";
/** staging manifest 가 저장되는 meta 키 접두사. */
export const STAGED_MANIFEST_META_PREFIX = "staged_manifest:";
/** Postgres 에서 staging 파일을 data_version_files 에 넣을 때 쓰는 version_id 네임스페이스. */
const STAGING_ID_PREFIX = "staging:";

function mb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

/**
 * 파일 목록을 저장 가능한 형태로 정규화하고 용량 가드를 적용한다.
 * 호출자는 content 를 base64 문자열 또는 Buffer 로 준다. sha256 을 같이 주면
 * 실제 내용과 대조하고, 주지 않으면 계산해 채운다.
 */
function normaliseFilePayload(files, label) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`${label}: 저장할 파일이 없습니다.`);
  }
  const out = [];
  const seen = new Set();
  let total = 0;
  for (const file of files) {
    const relPath = String((file && file.rel_path) || "").trim();
    if (!relPath) throw new Error(`${label}: rel_path 가 없는 항목이 있습니다.`);
    if (relPath.includes("\0") || relPath.startsWith("/") || /^[A-Za-z]:/.test(relPath) || relPath.split("/").includes("..")) {
      throw new Error(`${label}: 허용되지 않는 rel_path 입니다: ${relPath}`);
    }
    if (seen.has(relPath)) throw new Error(`${label}: rel_path 가 중복되었습니다: ${relPath}`);
    seen.add(relPath);

    let contentB64;
    if (Buffer.isBuffer(file.content)) contentB64 = file.content.toString("base64");
    else if (typeof file.content === "string") contentB64 = file.content;
    else throw new Error(`${label}: ${relPath} 의 content 는 base64 문자열이거나 Buffer 여야 합니다.`);

    const buffer = Buffer.from(contentB64, "base64");
    if (buffer.length > MAX_PERSIST_FILE_BYTES) {
      throw new Error(
        `${label}: ${relPath} 는 ${mb(buffer.length)}MB 로 단일 파일 상한 ${mb(MAX_PERSIST_FILE_BYTES)}MB 를 초과합니다 — ` +
          "DB 보존을 거부했습니다(파일은 디스크에만 남습니다)."
      );
    }
    const actualSha = crypto.createHash("sha256").update(buffer).digest("hex");
    if (file.sha256 && String(file.sha256) !== actualSha) {
      throw new Error(`${label}: ${relPath} 의 sha256 이 내용과 다릅니다 (expected=${file.sha256}, actual=${actualSha}).`);
    }
    total += buffer.length;
    out.push({ rel_path: relPath, sha256: actualSha, size_bytes: buffer.length, content: contentB64 });
  }
  if (total > MAX_PERSIST_VERSION_BYTES) {
    throw new Error(
      `${label}: 합계 ${mb(total)}MB 로 한 건 상한 ${mb(MAX_PERSIST_VERSION_BYTES)}MB 를 초과합니다 — DB 보존을 거부했습니다.`
    );
  }
  return { files: out, totalBytes: total };
}

// ---------------------------------------------------------------------------
// File backend
// ---------------------------------------------------------------------------

function ensureDataDir() {
  const dir = path.dirname(FILE_STORE_PATH());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDb() {
  ensureDataDir();
  if (!fs.existsSync(FILE_STORE_PATH())) return emptyDb();
  const raw = fs.readFileSync(FILE_STORE_PATH(), "utf-8").trim();
  if (!raw) return emptyDb();
  try {
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      meta: parsed.meta && typeof parsed.meta === "object" ? parsed.meta : {},
      // version_files: versionId(또는 "staging:<id>") -> [{rel_path, sha256, size_bytes, content(base64)}]
      // Postgres 백엔드의 data_version_files 테이블과 같은 역할. 기존 파일에 키가
      // 없으면 빈 객체로 시작한다(하위 호환).
      version_files:
        parsed.version_files && typeof parsed.version_files === "object" ? parsed.version_files : {},
    };
  } catch (err) {
    throw new Error(`update_center store: failed to parse ${FILE_STORE_PATH()}: ${err.message}`);
  }
}

function saveDb(db) {
  ensureDataDir();
  fs.writeFileSync(FILE_STORE_PATH(), JSON.stringify(db, null, 2), "utf-8");
}

function createFileStore() {
  return {
    // 기동 로그가 어떤 백엔드로 붙었는지 말할 수 있게 하는 표식.
    backend: "file",

    async recordEvent(e) {
      const db = loadDb();
      const now = nowIso();
      const event = {
        id: crypto.randomUUID(),
        dataset: e.dataset,
        detected_at: e.detected_at || now,
        kind: e.kind,
        risk: e.risk,
        summary: e.summary ?? null,
        diff_json: e.diff_json ?? null,
        ai_note: e.ai_note ?? null,
        status: e.status || "pending",
        actor: e.actor ?? null,
        updated_at: now,
      };
      db.events.push(event);
      saveDb(db);
      return event;
    },

    async listEvents(limit) {
      const db = loadDb();
      const sorted = [...db.events].sort((a, b) => (a.detected_at < b.detected_at ? 1 : -1));
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    async getEvent(id) {
      const db = loadDb();
      return db.events.find((ev) => ev.id === id) ?? null;
    },

    async updateEventStatus(id, status, actor) {
      const db = loadDb();
      const event = db.events.find((ev) => ev.id === id);
      if (!event) return null;
      event.status = status;
      if (actor !== undefined && actor !== null) event.actor = actor;
      event.updated_at = nowIso();
      saveDb(db);
      return event;
    },

    async setEventAiNote(id, note) {
      const db = loadDb();
      const event = db.events.find((ev) => ev.id === id);
      if (!event) return null;
      event.ai_note = note ?? null;
      saveDb(db);
      return event;
    },

    async saveVersion(v) {
      const db = loadDb();
      const version = {
        id: crypto.randomUUID(),
        dataset: v.dataset,
        created_at: v.created_at || nowIso(),
        content_hash: v.content_hash ?? null,
        row_count: v.row_count ?? null,
        snapshot: v.snapshot ?? null, // base64 string
        source_event_id: v.source_event_id ?? null,
        applied: v.applied ?? false,
        rolled_back: v.rolled_back ?? false,
        // 버전 디렉터리 이름(vNNN). snapshot 안에 묻혀 있던 값을 1급 컬럼으로 올린 것 —
        // 복원/롤백이 base64 를 디코드하지 않고 바로 찾을 수 있게 한다.
        version_dir: v.version_dir ?? null,
      };
      db.versions.push(version);
      saveDb(db);
      return version;
    },

    async listVersions(dataset, limit) {
      const db = loadDb();
      const filtered = dataset ? db.versions.filter((v) => v.dataset === dataset) : db.versions;
      const sorted = [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    async getVersion(id) {
      const db = loadDb();
      return db.versions.find((v) => v.id === id) ?? null;
    },

    async markVersionRolledBack(id) {
      const db = loadDb();
      const version = db.versions.find((v) => v.id === id);
      if (!version) return null;
      version.rolled_back = true;
      saveDb(db);
      return version;
    },

    async appendAudit(a) {
      const db = loadDb();
      const entry = {
        id: crypto.randomUUID(),
        at: a.at || nowIso(),
        actor: a.actor ?? null,
        action: a.action,
        dataset: a.dataset ?? null,
        event_id: a.event_id ?? null,
        detail: a.detail ?? null,
      };
      db.audit.push(entry);
      saveDb(db);
      return entry;
    },

    async listAudit(limit) {
      const db = loadDb();
      const sorted = [...db.audit].sort((a, b) => (a.at < b.at ? 1 : -1));
      return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
    },

    // --- meta: small key/value store for operational state that is neither an
    // event, a version, nor an audit entry (scheduler status, schedule config).
    async getMeta(key) {
      const db = loadDb();
      const row = db.meta ? db.meta[key] : undefined;
      return row === undefined ? null : row;
    },

    async setMeta(key, value) {
      const db = loadDb();
      if (!db.meta || typeof db.meta !== "object") db.meta = {};
      db.meta[key] = value;
      saveDb(db);
      return value;
    },

    // --- 버전/후보 파일 영속화 (Postgres 백엔드와 동일한 계약) --------------
    // 파일 백엔드는 기존 관례대로 base64 문자열을 JSON store 안에 그대로 담는다.

    async putVersionFiles(versionId, files, manifest = null) {
      if (!versionId) throw new Error("putVersionFiles: versionId 가 필요합니다.");
      const { files: payload, totalBytes } = normaliseFilePayload(files, `버전 ${versionId}`);
      const db = loadDb();
      if (!db.version_files || typeof db.version_files !== "object") db.version_files = {};
      db.version_files[String(versionId)] = payload;
      if (manifest !== null && manifest !== undefined) {
        const version = db.versions.find((v) => v.id === versionId);
        if (version) {
          version.manifest = manifest;
          if (!version.version_dir && manifest.version) version.version_dir = manifest.version;
        }
      }
      saveDb(db);
      return { version_id: String(versionId), file_count: payload.length, total_bytes: totalBytes };
    },

    async getVersionFiles(versionId) {
      const db = loadDb();
      const files = db.version_files ? db.version_files[String(versionId)] : null;
      if (!files) return null;
      const version = db.versions.find((v) => v.id === versionId);
      return {
        version_id: String(versionId),
        manifest: version && version.manifest ? version.manifest : manifestFromFiles(files),
        files: files.map((f) => ({ ...f })),
      };
    },

    async listVersionFileMeta(versionId) {
      const db = loadDb();
      const files = db.version_files ? db.version_files[String(versionId)] : null;
      if (!files) return [];
      return files.map(({ rel_path, sha256, size_bytes }) => ({ rel_path, sha256, size_bytes }));
    },

    async getVersionFileCounts(versionIds) {
      const db = loadDb();
      const counts = {};
      for (const id of Array.isArray(versionIds) ? versionIds : []) {
        const files = db.version_files ? db.version_files[String(id)] : null;
        counts[String(id)] = files ? files.length : 0;
      }
      return counts;
    },

    async getActiveVersions() {
      const db = loadDb();
      const raw = db.meta ? db.meta[ACTIVE_VERSIONS_META_KEY] : null;
      return normaliseActivePointer(raw);
    },

    async setActiveVersion(dataset, versionId, info = {}) {
      if (!dataset) throw new Error("setActiveVersion: dataset 이 필요합니다.");
      const db = loadDb();
      if (!db.meta || typeof db.meta !== "object") db.meta = {};
      const pointer = normaliseActivePointer(db.meta[ACTIVE_VERSIONS_META_KEY]);
      applyActivePointer(pointer, dataset, versionId, info);
      db.meta[ACTIVE_VERSIONS_META_KEY] = pointer;
      saveDb(db);
      return pointer;
    },

    async putStagedFiles(stagingId, files, manifest = null) {
      if (!stagingId) throw new Error("putStagedFiles: stagingId 가 필요합니다.");
      const { files: payload, totalBytes } = normaliseFilePayload(files, `후보 ${stagingId}`);
      const db = loadDb();
      if (!db.version_files || typeof db.version_files !== "object") db.version_files = {};
      if (!db.meta || typeof db.meta !== "object") db.meta = {};
      db.version_files[STAGING_ID_PREFIX + String(stagingId)] = payload;
      if (manifest !== null && manifest !== undefined) {
        db.meta[STAGED_MANIFEST_META_PREFIX + String(stagingId)] = manifest;
      }
      saveDb(db);
      return { staging_id: String(stagingId), file_count: payload.length, total_bytes: totalBytes };
    },

    async getStagedFiles(stagingId) {
      const db = loadDb();
      const files = db.version_files ? db.version_files[STAGING_ID_PREFIX + String(stagingId)] : null;
      if (!files) return null;
      const manifest = db.meta ? db.meta[STAGED_MANIFEST_META_PREFIX + String(stagingId)] : null;
      return {
        staging_id: String(stagingId),
        manifest: manifest ?? manifestFromFiles(files),
        files: files.map((f) => ({ ...f })),
      };
    },
  };
}

// ---------------------------------------------------------------------------
// 활성 포인터 / manifest 공통 헬퍼 (두 백엔드가 같은 모양을 돌려주도록)
// ---------------------------------------------------------------------------

function normaliseActivePointer(raw) {
  const parsed = raw && typeof raw === "object" ? raw : {};
  const active = parsed.active && typeof parsed.active === "object" ? parsed.active : {};
  const out = {};
  for (const [dataset, value] of Object.entries(active)) {
    if (!value) continue;
    // 과거 형식(문자열 = 버전 디렉터리 이름)도 읽어준다.
    out[dataset] =
      typeof value === "string"
        ? { version_id: null, version_dir: value, updated_at: parsed.updated_at || null }
        : {
            version_id: value.version_id ?? null,
            version_dir: value.version_dir ?? null,
            updated_at: value.updated_at ?? null,
          };
  }
  return { active: out, updated_at: parsed.updated_at ?? null };
}

function applyActivePointer(pointer, dataset, versionId, info = {}) {
  const now = nowIso();
  if (!versionId && !(info && info.version_dir)) {
    delete pointer.active[dataset];
  } else {
    pointer.active[dataset] = {
      version_id: versionId ?? null,
      version_dir: (info && info.version_dir) ?? null,
      updated_at: now,
    };
  }
  pointer.updated_at = now;
  return pointer;
}

/** 저장된 manifest.json 파일 행에서 매니페스트를 복원한다(별도 컬럼이 비었을 때의 폴백). */
function manifestFromFiles(files) {
  const row = (files || []).find((f) => f.rel_path === "manifest.json");
  if (!row) return null;
  try {
    return JSON.parse(Buffer.from(row.content, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------------

async function createPgStore() {
  // Railway Postgres는 자가서명 인증서를 쓰므로 PGSSL_NO_VERIFY=1을 명시적으로 설정한 경우에만 검증을 끈다.
  // 기본값은 TLS 검증 활성. 사설망(*.railway.internal) 접속이면 그대로 검증 없이도 연결이 되는지 여부와 무관하게
  // 보안 기본값을 유지한다. Railway 배포 시 자가서명 체인으로 연결이 실패하면 서비스 환경변수에
  // PGSSL_NO_VERIFY=1을 설정해야 할 수 있음.
  const ssl =
    process.env.PGSSL_NO_VERIFY === "1" ? { rejectUnauthorized: false } : { rejectUnauthorized: true };
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
  });
  // Surface pool-level connection errors (e.g. idle client errors) as a clean
  // message instead of an unhandled 'error' event crash.
  pool.on("error", (err) => {
    console.error(`update_center store: Postgres pool error: ${err.message}`);
  });

  const schemaSql = fs.readFileSync(SCHEMA_PATH, "utf-8");
  try {
    await pool.query(schemaSql);
  } catch (err) {
    await pool.end().catch(() => {});
    throw new Error(
      `update_center store: failed to connect to / initialize Postgres via DATABASE_URL: ${err.message}`
    );
  }

  function bufToBase64(buf) {
    if (buf === null || buf === undefined) return null;
    return Buffer.isBuffer(buf) ? buf.toString("base64") : buf;
  }

  function base64ToBuf(b64) {
    if (b64 === null || b64 === undefined) return null;
    return Buffer.from(b64, "base64");
  }

  function isoOrNull(value) {
    if (value === null || value === undefined) return null;
    return value instanceof Date ? value.toISOString() : value;
  }

  function mapEventRow(row) {
    if (!row) return null;
    return {
      ...row,
      detected_at: isoOrNull(row.detected_at),
      updated_at: isoOrNull(row.updated_at),
    };
  }

  function mapVersionRow(row) {
    if (!row) return null;
    return {
      ...row,
      snapshot: bufToBase64(row.snapshot),
      created_at: isoOrNull(row.created_at),
    };
  }

  // meta 접근을 함수로 빼둔다 — 아래 새 메서드들이 `this` 바인딩에 의존하지 않게
  // (store 를 구조분해해서 쓰더라도 동작이 같도록).
  async function getMetaValue(key) {
    const { rows } = await pool.query(`SELECT value FROM update_center_meta WHERE key = $1`, [key]);
    if (!rows[0]) return null;
    const value = rows[0].value;
    if (value === null || value === undefined) return null;
    if (typeof value === "string") {
      const parsed = safeJsonParse(value);
      return parsed === null ? value : parsed;
    }
    return value;
  }

  async function setMetaValue(key, value) {
    await pool.query(
      `INSERT INTO update_center_meta (key, value, updated_at) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
      [key, JSON.stringify(value ?? null), nowIso()]
    );
    return value;
  }

  function mapFileRow(row) {
    return {
      rel_path: row.rel_path,
      sha256: row.sha256,
      size_bytes: row.size_bytes,
      content: bufToBase64(row.content),
    };
  }

  function mapAuditRow(row) {
    if (!row) return null;
    return {
      ...row,
      at: isoOrNull(row.at),
    };
  }

  return {
    backend: "postgres",

    async recordEvent(e) {
      const id = crypto.randomUUID();
      const now = nowIso();
      const detectedAt = e.detected_at || now;
      const { rows } = await pool.query(
        `INSERT INTO data_events (id, dataset, detected_at, kind, risk, summary, diff_json, ai_note, status, actor, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          id,
          e.dataset,
          detectedAt,
          e.kind,
          e.risk,
          e.summary ?? null,
          e.diff_json ? JSON.stringify(e.diff_json) : null,
          e.ai_note ?? null,
          e.status || "pending",
          e.actor ?? null,
          now,
        ]
      );
      return mapEventRow(rows[0]);
    },

    async listEvents(limit) {
      const useLimit = typeof limit === "number";
      const { rows } = await pool.query(
        `SELECT * FROM data_events ORDER BY detected_at DESC${useLimit ? " LIMIT $1" : ""}`,
        useLimit ? [limit] : []
      );
      return rows.map(mapEventRow);
    },

    async getEvent(id) {
      const { rows } = await pool.query(`SELECT * FROM data_events WHERE id = $1`, [id]);
      return mapEventRow(rows[0]) ?? null;
    },

    async updateEventStatus(id, status, actor) {
      const { rows } = await pool.query(
        `UPDATE data_events SET status = $2, actor = COALESCE($3, actor), updated_at = $4 WHERE id = $1 RETURNING *`,
        [id, status, actor ?? null, nowIso()]
      );
      return mapEventRow(rows[0]) ?? null;
    },

    async setEventAiNote(id, note) {
      const { rows } = await pool.query(
        `UPDATE data_events SET ai_note = $2 WHERE id = $1 RETURNING *`,
        [id, note ?? null]
      );
      return mapEventRow(rows[0]) ?? null;
    },

    async saveVersion(v) {
      const id = crypto.randomUUID();
      const createdAt = v.created_at || nowIso();
      const { rows } = await pool.query(
        `INSERT INTO data_versions (id, dataset, created_at, content_hash, row_count, snapshot, source_event_id, applied, rolled_back, version_dir)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          id,
          v.dataset,
          createdAt,
          v.content_hash ?? null,
          v.row_count ?? null,
          base64ToBuf(v.snapshot),
          v.source_event_id ?? null,
          v.applied ?? false,
          v.rolled_back ?? false,
          v.version_dir ?? null,
        ]
      );
      return mapVersionRow(rows[0]);
    },

    async listVersions(dataset, limit) {
      const useLimit = typeof limit === "number";
      const params = [];
      if (dataset) params.push(dataset);
      let sql = dataset ? `SELECT * FROM data_versions WHERE dataset = $1` : `SELECT * FROM data_versions`;
      sql += ` ORDER BY created_at DESC`;
      if (useLimit) {
        params.push(limit);
        sql += ` LIMIT $${params.length}`;
      }
      const { rows } = await pool.query(sql, params);
      return rows.map(mapVersionRow);
    },

    async getVersion(id) {
      const { rows } = await pool.query(`SELECT * FROM data_versions WHERE id = $1`, [id]);
      return mapVersionRow(rows[0]) ?? null;
    },

    async markVersionRolledBack(id) {
      const { rows } = await pool.query(
        `UPDATE data_versions SET rolled_back = TRUE WHERE id = $1 RETURNING *`,
        [id]
      );
      return mapVersionRow(rows[0]) ?? null;
    },

    async appendAudit(a) {
      const id = crypto.randomUUID();
      const at = a.at || nowIso();
      const { rows } = await pool.query(
        `INSERT INTO audit_log (id, at, actor, action, dataset, event_id, detail)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [id, at, a.actor ?? null, a.action, a.dataset ?? null, a.event_id ?? null, a.detail ?? null]
      );
      return mapAuditRow(rows[0]);
    },

    async listAudit(limit) {
      const useLimit = typeof limit === "number";
      const { rows } = await pool.query(
        `SELECT * FROM audit_log ORDER BY at DESC${useLimit ? " LIMIT $1" : ""}`,
        useLimit ? [limit] : []
      );
      return rows.map(mapAuditRow);
    },

    // --- meta: mirrors the file backend's key/value store (update_center_meta table).
    // Values are stored as JSON text and parsed back on read, so callers see the
    // same shapes from either backend.
    async getMeta(key) {
      return getMetaValue(key);
    },

    async setMeta(key, value) {
      return setMetaValue(key, value);
    },

    // --- 버전/후보 파일 영속화 (data_version_files, BYTEA) -----------------
    // 파일 백엔드와 같은 계약: content 는 항상 base64 문자열로 주고받고,
    // BYTEA 변환은 이 경계에서만 일어난다.

    async putVersionFiles(versionId, files, manifest = null) {
      if (!versionId) throw new Error("putVersionFiles: versionId 가 필요합니다.");
      const { files: payload, totalBytes } = normaliseFilePayload(files, `버전 ${versionId}`);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM data_version_files WHERE version_id = $1`, [versionId]);
        for (const f of payload) {
          await client.query(
            `INSERT INTO data_version_files (version_id, rel_path, sha256, size_bytes, content)
             VALUES ($1,$2,$3,$4,$5)`,
            [versionId, f.rel_path, f.sha256, f.size_bytes, base64ToBuf(f.content)]
          );
        }
        if (manifest !== null && manifest !== undefined) {
          await client.query(
            `UPDATE data_versions
                SET manifest = $2,
                    version_dir = COALESCE(version_dir, $3)
              WHERE id = $1`,
            [versionId, JSON.stringify(manifest), manifest.version ?? null]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      return { version_id: String(versionId), file_count: payload.length, total_bytes: totalBytes };
    },

    async getVersionFiles(versionId) {
      const { rows } = await pool.query(
        `SELECT rel_path, sha256, size_bytes, content FROM data_version_files
          WHERE version_id = $1 ORDER BY rel_path`,
        [versionId]
      );
      if (!rows.length) return null;
      const files = rows.map(mapFileRow);
      const { rows: versionRows } = await pool.query(`SELECT manifest FROM data_versions WHERE id = $1`, [versionId]);
      const stored = versionRows[0] ? versionRows[0].manifest : null;
      const manifest = typeof stored === "string" ? safeJsonParse(stored) : (stored ?? null);
      return { version_id: String(versionId), manifest: manifest ?? manifestFromFiles(files), files };
    },

    async listVersionFileMeta(versionId) {
      const { rows } = await pool.query(
        `SELECT rel_path, sha256, size_bytes FROM data_version_files WHERE version_id = $1 ORDER BY rel_path`,
        [versionId]
      );
      return rows.map((r) => ({ rel_path: r.rel_path, sha256: r.sha256, size_bytes: r.size_bytes }));
    },

    async getVersionFileCounts(versionIds) {
      const ids = (Array.isArray(versionIds) ? versionIds : []).map(String);
      const counts = {};
      for (const id of ids) counts[id] = 0;
      if (!ids.length) return counts;
      const { rows } = await pool.query(
        `SELECT version_id, COUNT(*)::int AS n FROM data_version_files
          WHERE version_id = ANY($1::text[]) GROUP BY version_id`,
        [ids]
      );
      for (const row of rows) counts[String(row.version_id)] = Number(row.n);
      return counts;
    },

    async getActiveVersions() {
      return normaliseActivePointer(await getMetaValue(ACTIVE_VERSIONS_META_KEY));
    },

    async setActiveVersion(dataset, versionId, info = {}) {
      if (!dataset) throw new Error("setActiveVersion: dataset 이 필요합니다.");
      const pointer = normaliseActivePointer(await getMetaValue(ACTIVE_VERSIONS_META_KEY));
      applyActivePointer(pointer, dataset, versionId, info);
      await setMetaValue(ACTIVE_VERSIONS_META_KEY, pointer);
      return pointer;
    },

    async putStagedFiles(stagingId, files, manifest = null) {
      if (!stagingId) throw new Error("putStagedFiles: stagingId 가 필요합니다.");
      const { files: payload, totalBytes } = normaliseFilePayload(files, `후보 ${stagingId}`);
      const key = STAGING_ID_PREFIX + String(stagingId);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM data_version_files WHERE version_id = $1`, [key]);
        for (const f of payload) {
          await client.query(
            `INSERT INTO data_version_files (version_id, rel_path, sha256, size_bytes, content)
             VALUES ($1,$2,$3,$4,$5)`,
            [key, f.rel_path, f.sha256, f.size_bytes, base64ToBuf(f.content)]
          );
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
      if (manifest !== null && manifest !== undefined) {
        await setMetaValue(STAGED_MANIFEST_META_PREFIX + String(stagingId), manifest);
      }
      return { staging_id: String(stagingId), file_count: payload.length, total_bytes: totalBytes };
    },

    async getStagedFiles(stagingId) {
      const key = STAGING_ID_PREFIX + String(stagingId);
      const { rows } = await pool.query(
        `SELECT rel_path, sha256, size_bytes, content FROM data_version_files
          WHERE version_id = $1 ORDER BY rel_path`,
        [key]
      );
      if (!rows.length) return null;
      const files = rows.map(mapFileRow);
      const manifest = await getMetaValue(STAGED_MANIFEST_META_PREFIX + String(stagingId));
      return { staging_id: String(stagingId), manifest: manifest ?? manifestFromFiles(files), files };
    },
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export async function createStore() {
  if (process.env.DATABASE_URL) {
    return createPgStore();
  }
  return createFileStore();
}

// ---------------------------------------------------------------------------
// Self-test (file backend round trip regression gate)
// ---------------------------------------------------------------------------

async function selfTest() {
  // Force the file backend regardless of the ambient environment, since this
  // flag's job is specifically to regression-test the file backend.
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    const store = await createStore();

    const ev1 = await store.recordEvent({
      dataset: "libraries",
      kind: "content",
      risk: "green",
      summary: "selftest event 1",
    });
    const ev2 = await store.recordEvent({
      dataset: "libraries",
      kind: "schema",
      risk: "yellow",
      summary: "selftest event 2",
    });

    const updated = await store.updateEventStatus(ev2.id, "approved", "selftest-actor");
    if (!updated || updated.status !== "approved" || updated.actor !== "selftest-actor") {
      throw new Error("updateEventStatus did not persist status/actor");
    }

    const events = await store.listEvents();
    if (!events.find((e) => e.id === ev1.id) || !events.find((e) => e.id === ev2.id)) {
      throw new Error("listEvents missing recorded events");
    }
    const fetchedEvent = await store.getEvent(ev1.id);
    if (!fetchedEvent || fetchedEvent.id !== ev1.id) throw new Error("getEvent failed");

    const noted = await store.setEventAiNote(ev1.id, "selftest ai note");
    if (!noted || noted.ai_note !== "selftest ai note") {
      throw new Error("setEventAiNote did not persist ai_note");
    }
    if (noted.status !== ev1.status) throw new Error("setEventAiNote should not change status");
    const refetchedNote = await store.getEvent(ev1.id);
    if (!refetchedNote || refetchedNote.ai_note !== "selftest ai note") {
      throw new Error("getEvent after setEventAiNote did not reflect ai_note");
    }
    const missingNote = await store.setEventAiNote("nonexistent-event-id", "x");
    if (missingNote !== null) throw new Error("setEventAiNote should return null for an unknown id");

    const snapshotBytes = crypto.randomBytes(64);
    const snapshotB64 = snapshotBytes.toString("base64");
    const contentHash = crypto.createHash("sha256").update(snapshotBytes).digest("hex");
    const version = await store.saveVersion({
      dataset: "libraries",
      content_hash: contentHash,
      row_count: 1,
      snapshot: snapshotB64,
      source_event_id: ev1.id,
    });
    const fetchedVersion = await store.getVersion(version.id);
    if (!fetchedVersion || fetchedVersion.snapshot !== snapshotB64) {
      throw new Error("snapshot base64 round trip mismatch");
    }
    const roundTripHash = crypto
      .createHash("sha256")
      .update(Buffer.from(fetchedVersion.snapshot, "base64"))
      .digest("hex");
    if (roundTripHash !== contentHash) {
      throw new Error("snapshot hash mismatch after base64 round trip");
    }
    const versions = await store.listVersions("libraries");
    if (!versions.find((v) => v.id === version.id)) throw new Error("listVersions missing saved version");

    const secondVersion = await store.saveVersion({
      dataset: "libraries",
      created_at: new Date(Date.now() + 60000).toISOString(), // force strictly later than `version` for a deterministic sort order
      content_hash: crypto.createHash("sha256").update("second").digest("hex"),
      row_count: 2,
      snapshot: Buffer.from("second").toString("base64"),
      source_event_id: ev1.id,
    });
    const limitedVersions = await store.listVersions("libraries", 1);
    if (limitedVersions.length !== 1) {
      throw new Error(`listVersions with limit=1 should return exactly 1 row, got ${limitedVersions.length}`);
    }
    if (limitedVersions[0].id !== secondVersion.id) {
      throw new Error("listVersions with limit should return the most recently created version first");
    }

    if (version.rolled_back !== false) throw new Error("saved version should start with rolled_back=false");
    const rolledBack = await store.markVersionRolledBack(version.id);
    if (!rolledBack || rolledBack.rolled_back !== true) {
      throw new Error("markVersionRolledBack did not persist rolled_back=true");
    }
    const refetched = await store.getVersion(version.id);
    if (!refetched || refetched.rolled_back !== true) {
      throw new Error("getVersion after markVersionRolledBack did not reflect rolled_back=true");
    }
    const missingMark = await store.markVersionRolledBack("nonexistent-version-id");
    if (missingMark !== null) throw new Error("markVersionRolledBack should return null for an unknown id");

    await store.appendAudit({
      actor: "selftest",
      action: "record_event",
      dataset: "libraries",
      event_id: ev1.id,
      detail: "selftest audit 1",
    });
    await store.appendAudit({
      actor: "selftest",
      action: "record_event",
      dataset: "libraries",
      event_id: ev2.id,
      detail: "selftest audit 2",
    });
    await store.appendAudit({
      actor: "selftest",
      action: "approve",
      dataset: "libraries",
      event_id: ev2.id,
      detail: "selftest audit 3",
    });

    const audit = await store.listAudit();
    if (audit.length < 3) throw new Error("listAudit did not return appended entries");

    // --- 버전 파일 영속화 라운드트립 -------------------------------------
    const versionPayload = [
      { rel_path: "files/libraries.csv", content: Buffer.from("a,b\n1,2\n", "utf-8") },
      { rel_path: "previous/libraries.csv", content: Buffer.from("a,b\n0,0\n", "utf-8") },
      { rel_path: "manifest.json", content: Buffer.from(JSON.stringify({ version: "v001" }), "utf-8") },
    ];
    const put = await store.putVersionFiles(version.id, versionPayload, { version: "v001", dataset: "libraries" });
    if (put.file_count !== 3) throw new Error("putVersionFiles did not persist all files");
    const fetchedFiles = await store.getVersionFiles(version.id);
    if (!fetchedFiles || fetchedFiles.files.length !== 3) throw new Error("getVersionFiles round trip failed");
    const csvRow = fetchedFiles.files.find((f) => f.rel_path === "files/libraries.csv");
    if (Buffer.from(csvRow.content, "base64").toString("utf-8") !== "a,b\n1,2\n") {
      throw new Error("getVersionFiles content round trip mismatch");
    }
    if (!fetchedFiles.manifest || fetchedFiles.manifest.version !== "v001") {
      throw new Error("getVersionFiles did not return the stored manifest");
    }
    const meta = await store.listVersionFileMeta(version.id);
    if (meta.length !== 3 || meta.some((m) => "content" in m)) {
      throw new Error("listVersionFileMeta should return names/hashes/sizes without content");
    }
    const counts = await store.getVersionFileCounts([version.id, secondVersion.id]);
    if (counts[version.id] !== 3 || counts[secondVersion.id] !== 0) {
      throw new Error("getVersionFileCounts returned wrong counts");
    }

    // --- 활성 포인터 ------------------------------------------------------
    await store.setActiveVersion("libraries", version.id, { version_dir: "v001" });
    const activeAfterSet = await store.getActiveVersions();
    if (activeAfterSet.active.libraries.version_id !== version.id) {
      throw new Error("setActiveVersion did not persist the active pointer");
    }
    if (activeAfterSet.active.libraries.version_dir !== "v001") {
      throw new Error("setActiveVersion did not persist version_dir");
    }
    await store.setActiveVersion("libraries", null, {});
    const activeAfterClear = await store.getActiveVersions();
    if (activeAfterClear.active.libraries) throw new Error("setActiveVersion(null) should remove the dataset entry");

    // --- staging 보존 -----------------------------------------------------
    const stagedPut = await store.putStagedFiles(
      "selftest_stage",
      [{ rel_path: "files/libraries.csv", content: Buffer.from("staged\n", "utf-8") }],
      { staging_id: "selftest_stage", files: [{ name: "libraries.csv" }] }
    );
    if (stagedPut.file_count !== 1) throw new Error("putStagedFiles did not persist the staged file");
    const stagedGot = await store.getStagedFiles("selftest_stage");
    if (!stagedGot || Buffer.from(stagedGot.files[0].content, "base64").toString("utf-8") !== "staged\n") {
      throw new Error("getStagedFiles round trip mismatch");
    }
    if (!stagedGot.manifest || stagedGot.manifest.staging_id !== "selftest_stage") {
      throw new Error("getStagedFiles did not return the staged manifest");
    }
    if ((await store.getStagedFiles("selftest_missing")) !== null) {
      throw new Error("getStagedFiles should return null for an unknown staging id");
    }

    // --- 용량 가드(경로만 확인 — 실제 25MB 파일은 전용 테스트에서) --------
    let guardError = null;
    try {
      await store.putVersionFiles(version.id, [{ rel_path: "../escape.csv", content: Buffer.from("x") }]);
    } catch (err) {
      guardError = err;
    }
    if (!guardError || !/허용되지 않는 rel_path/.test(guardError.message)) {
      throw new Error("putVersionFiles should reject a path that escapes the version directory");
    }

    console.log("OK");
  } finally {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule && process.argv.includes("--selftest")) {
  selfTest().catch((err) => {
    console.error(`SELFTEST FAILED: ${err.message}`);
    process.exitCode = 1;
  });
}
