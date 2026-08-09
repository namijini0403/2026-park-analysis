#!/usr/bin/env node
// scripts/update_center/store.mjs
// Storage layer for the P4 update-center: dual backend (Postgres via `pg`, or a local JSON file).
//
// Both backends expose the same 9-method async interface:
//   recordEvent(e), listEvents(limit), getEvent(id), updateEventStatus(id, status, actor),
//   saveVersion(v), listVersions(dataset), getVersion(id),
//   appendAudit(a), listAudit(limit)
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

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");
const FILE_STORE_PATH = path.join(REPO_ROOT, "data", "update_center_store.json");

function nowIso() {
  return new Date().toISOString();
}

function emptyDb() {
  return { events: [], versions: [], audit: [] };
}

// ---------------------------------------------------------------------------
// File backend
// ---------------------------------------------------------------------------

function ensureDataDir() {
  const dir = path.dirname(FILE_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadDb() {
  ensureDataDir();
  if (!fs.existsSync(FILE_STORE_PATH)) return emptyDb();
  const raw = fs.readFileSync(FILE_STORE_PATH, "utf-8").trim();
  if (!raw) return emptyDb();
  try {
    const parsed = JSON.parse(raw);
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      versions: Array.isArray(parsed.versions) ? parsed.versions : [],
      audit: Array.isArray(parsed.audit) ? parsed.audit : [],
    };
  } catch (err) {
    throw new Error(`update_center store: failed to parse ${FILE_STORE_PATH}: ${err.message}`);
  }
}

function saveDb(db) {
  ensureDataDir();
  fs.writeFileSync(FILE_STORE_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function createFileStore() {
  return {
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
      };
      db.versions.push(version);
      saveDb(db);
      return version;
    },

    async listVersions(dataset) {
      const db = loadDb();
      const filtered = dataset ? db.versions.filter((v) => v.dataset === dataset) : db.versions;
      return [...filtered].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },

    async getVersion(id) {
      const db = loadDb();
      return db.versions.find((v) => v.id === id) ?? null;
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
  };
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

  function mapAuditRow(row) {
    if (!row) return null;
    return {
      ...row,
      at: isoOrNull(row.at),
    };
  }

  return {
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

    async saveVersion(v) {
      const id = crypto.randomUUID();
      const createdAt = v.created_at || nowIso();
      const { rows } = await pool.query(
        `INSERT INTO data_versions (id, dataset, created_at, content_hash, row_count, snapshot, source_event_id, applied, rolled_back)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
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
        ]
      );
      return mapVersionRow(rows[0]);
    },

    async listVersions(dataset) {
      const { rows } = await pool.query(
        dataset
          ? `SELECT * FROM data_versions WHERE dataset = $1 ORDER BY created_at DESC`
          : `SELECT * FROM data_versions ORDER BY created_at DESC`,
        dataset ? [dataset] : []
      );
      return rows.map(mapVersionRow);
    },

    async getVersion(id) {
      const { rows } = await pool.query(`SELECT * FROM data_versions WHERE id = $1`, [id]);
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
  };
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
