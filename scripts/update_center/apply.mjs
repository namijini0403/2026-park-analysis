// scripts/update_center/apply.mjs
//
// 승인 → 원자적 반영 → 불변 버전 디렉터리 → 롤백.
//
// 규칙
//   - 승인 직전에 staging 파일 sha256 을 재검증하고, 저장된 판정이 아니라 파일 "내용"으로
//     품질검사를 다시 돌린다. fail/unsupported 면 반영하지 않는다(review MVP 규칙 이식).
//   - 반영은 임시 파일에 쓴 뒤 rename 으로 교체한다. 대상은 data_processed/ 와,
//     vercel_public/ 이 있으면 vercel_public/data_processed/ 두 곳 — 지도 앱과 AI 서버가
//     재빌드 없이 같은 버전을 읽게 한다.
//   - 반영 전 원본은 같은 버전 디렉터리의 previous/ 에 보존된다. 롤백은 저장된 해시와
//     현재 파일 해시를 다시 확인하고, 하나라도 어긋나면 아무것도 쓰지 않고 거부한다.
//   - 봉인값(reanalyze.mjs 의 SEALED_FILES)은 어떤 경로로도 덮어쓰지 않는다.
//   - data_sources.yaml 의 never_auto_apply: true 인 소스는 confirm 플래그 없이는 승인되지 않는다.
//   - rebuild_command 가 있으면 반영 후 실행하고 stdout/stderr 를 감사 로그에 남긴다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import {
  applyRoot,
  applyTargetRoots,
  versionsDir,
  activePointerPath,
  stagingDir,
  ensureDir,
  assertSafeRelPath,
} from "./paths.mjs";
import { analyzeContent, overallStatus, approvalBlocked } from "./quality.mjs";
import { getAdapter } from "./adapters/index.mjs";
import { verifyStaging, loadStagingManifest } from "./candidate.mjs";
import { SEALED_FILES } from "./reanalyze.mjs";

const REBUILD_TIMEOUT_MS = Number(process.env.UPDATE_CENTER_REBUILD_TIMEOUT_MS || 600000);
// rebuild_command 는 리포의 YAML 에서 오는 문자열이다. 임의 명령 실행이 되지 않도록
// 실행 파일 이름을 명시적 allowlist 로 제한한다.
const REBUILD_ALLOWED_BINARIES = new Set(["python", "python3", "py", "node", "npm"]);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

export function isSealedTarget(relPath) {
  const normalised = String(relPath).split(path.sep).join("/");
  return SEALED_FILES.some((sealed) => sealed === normalised);
}

// ---------------------------------------------------------------------------
// version directory helpers
// ---------------------------------------------------------------------------

const VERSION_RE = /^v\d{3,}$/;

export function listVersionDirs() {
  const dir = versionsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => VERSION_RE.test(n))
    .sort();
}

function nextVersionName() {
  const existing = listVersionDirs();
  if (!existing.length) return "v001";
  const last = existing[existing.length - 1];
  return `v${String(Number(last.slice(1)) + 1).padStart(3, "0")}`;
}

export function readVersionManifest(versionName) {
  const file = path.join(versionsDir(), versionName, "manifest.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

export function readActivePointer() {
  const file = activePointerPath();
  if (!fs.existsSync(file)) return { active: {}, updated_at: null };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    return { active: parsed.active && typeof parsed.active === "object" ? parsed.active : {}, updated_at: parsed.updated_at || null };
  } catch {
    return { active: {}, updated_at: null };
  }
}

function writeActivePointer(dataset, versionName) {
  const current = readActivePointer();
  current.active[dataset] = versionName;
  current.updated_at = nowIso();
  ensureDir(path.dirname(activePointerPath()));
  writeFileAtomic(activePointerPath(), Buffer.from(JSON.stringify(current, null, 2), "utf-8"));
  return current;
}

// ---------------------------------------------------------------------------
// atomic write
// ---------------------------------------------------------------------------

export function writeFileAtomic(absPath, buffer) {
  ensureDir(path.dirname(absPath));
  const tmp = `${absPath}.uctmp-${crypto.randomBytes(6).toString("hex")}`;
  fs.writeFileSync(tmp, buffer);
  try {
    fs.renameSync(tmp, absPath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* best effort */
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// store 영속화 (Postgres = 진실, 컨테이너 디스크 = 캐시)
//
// Railway 컨테이너 파일시스템은 재배포마다 초기화된다. 그래서 버전 디렉터리와
// 승인 대기 후보(staging)의 실제 바이트를 store 에 함께 저장하고, 디스크에 없으면
// store 에서 되살린다. rel_path 는 해당 디렉터리 기준 상대 경로다.
// ---------------------------------------------------------------------------

/** 디렉터리를 재귀적으로 훑어 {rel_path, sha256, size_bytes, content(base64)} 목록을 만든다. */
export function collectDirPayload(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (current, prefix) => {
    for (const name of fs.readdirSync(current).sort()) {
      const abs = path.join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) {
        walk(abs, rel);
        continue;
      }
      if (!stat.isFile()) continue;
      const buffer = fs.readFileSync(abs);
      out.push({
        rel_path: rel,
        sha256: sha256(buffer),
        size_bytes: buffer.length,
        content: buffer.toString("base64"),
      });
    }
  };
  walk(dir, "");
  return out;
}

/**
 * store 에서 받은 payload 를 디렉터리로 되살린다. 파일마다 저장된 sha256 을
 * 다시 확인하고, 하나라도 어긋나면 아무것도 쓰지 않고 거부한다.
 */
export function materializePayload(destDir, files, { label = "복원" } = {}) {
  const mismatches = [];
  for (const file of files || []) {
    const buffer = Buffer.from(file.content, "base64");
    const actual = sha256(buffer);
    if (file.sha256 && actual !== file.sha256) {
      mismatches.push({ name: file.rel_path, reason: "store_sha256_mismatch", expected: file.sha256, actual });
    }
  }
  if (mismatches.length) {
    throw new Error(`${label} 거부 — DB 에 저장된 해시와 내용이 다릅니다: ${JSON.stringify(mismatches)}`);
  }
  const written = [];
  for (const file of files || []) {
    const rel = assertSafeRelPath(file.rel_path);
    const abs = path.join(destDir, rel);
    writeFileAtomic(abs, Buffer.from(file.content, "base64"));
    written.push(rel);
  }
  return written;
}

/** 버전 디렉터리 전체(files/ + previous/ + manifest.json)를 store 에 보존한다. */
export async function persistVersionToStore({ store, versionId, versionName, manifest, log = () => {} }) {
  if (!store || typeof store.putVersionFiles !== "function") return null;
  const payload = collectDirPayload(path.join(versionsDir(), versionName));
  if (!payload.length) return null;
  const result = await store.putVersionFiles(versionId, payload, manifest || null);
  log(`[apply] 버전 ${versionName} DB 보존 — ${result.file_count}개 파일 / ${result.total_bytes}B`);
  return result;
}

/** store 에 보존된 버전을 로컬 버전 디렉터리로 되살린다. */
export async function materializeVersionDirFromStore({ store, versionId, versionName, log = () => {} }) {
  if (!store || typeof store.getVersionFiles !== "function") return null;
  const stored = await store.getVersionFiles(versionId);
  if (!stored || !stored.files || !stored.files.length) return null;
  const dir = ensureDir(path.join(versionsDir(), versionName));
  const written = materializePayload(dir, stored.files, { label: `버전 ${versionName} 복원` });
  log(`[apply] 버전 ${versionName} 을 DB 에서 복원했습니다 — ${written.length}개 파일`);
  return { manifest: stored.manifest || readVersionManifest(versionName), files: stored.files, written };
}

/** store 에 보존된 승인 대기 후보(staging)를 로컬 staging 디렉터리로 되살린다. */
export async function materializeStagingFromStore({ store, stagingId, log = () => {} }) {
  if (!store || typeof store.getStagedFiles !== "function") return null;
  const stored = await store.getStagedFiles(stagingId);
  if (!stored || !stored.files || !stored.files.length) return null;
  const dir = ensureDir(path.join(stagingDir(), String(stagingId)));
  const written = materializePayload(dir, stored.files, { label: `후보 ${stagingId} 복원` });
  log(`[apply] 후보 ${stagingId} 를 DB 에서 복원했습니다 — ${written.length}개 파일`);
  return { manifest: stored.manifest, files: stored.files, written };
}

/** 버전 디렉터리 이름(vNNN)으로 store 의 version 행 id 를 찾는다(신규 컬럼 → 구 snapshot 순). */
export async function findStoreVersionIdByDir(store, dataset, versionName) {
  if (!store || typeof store.listVersions !== "function") return null;
  const rows = await store.listVersions(dataset || undefined);
  for (const row of rows) {
    if (row.version_dir === versionName) return row.id;
  }
  for (const row of rows) {
    if (versionDirFromStoreRow(row) === versionName) return row.id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// rebuild_command
// ---------------------------------------------------------------------------

export function runRebuildCommand(command, log = () => {}) {
  if (!command) return null;
  if (process.env.UPDATE_CENTER_SKIP_REBUILD === "1") {
    return { skipped: true, reason: "UPDATE_CENTER_SKIP_REBUILD=1", command };
  }
  const parts = String(command).trim().split(/\s+/);
  const binary = path.basename(parts[0]).replace(/\.exe$/i, "");
  if (!REBUILD_ALLOWED_BINARIES.has(binary)) {
    return {
      skipped: true,
      command,
      reason: `허용되지 않은 실행 파일: ${binary} (허용: ${[...REBUILD_ALLOWED_BINARIES].join(", ")})`,
    };
  }
  log(`[apply] rebuild_command 실행: ${command}`);
  const result = spawnSync(parts[0], parts.slice(1), {
    cwd: applyRoot(),
    encoding: "utf-8",
    timeout: REBUILD_TIMEOUT_MS,
    shell: false,
  });
  return {
    skipped: false,
    command,
    status: result.status,
    ok: result.status === 0,
    timed_out: Boolean(result.error && result.error.code === "ETIMEDOUT"),
    error: result.error ? result.error.message : null,
    stdout: String(result.stdout || "").slice(-4000),
    stderr: String(result.stderr || "").slice(-4000),
  };
}

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

/**
 * staged 후보를 실제 데이터 경로에 원자적으로 반영하고 불변 버전을 만든다.
 *
 * @param {object} params
 * @param {object} params.entry       data_sources.yaml 소스 항목
 * @param {string} params.stagingId
 * @param {object} params.store
 * @param {string} params.eventId
 * @param {string} params.actor
 * @param {boolean} [params.confirm]  never_auto_apply 소스 승인용 확인 플래그
 * @param {Function} [params.log]
 * @returns {Promise<{version:string, versionId:string, manifest:object, rebuild:object|null}>}
 */
export async function applyStagedCandidate({ entry, stagingId, store, eventId, actor, confirm = false, log = () => {} }) {
  const dataset = entry.dataset;

  // 0) staging 디렉터리가 없으면(재배포로 컨테이너 파일시스템이 초기화된 경우)
  //    store 에 보존된 후보를 먼저 되살린다 — 그래야 재배포 전에 감지된 대기 이벤트를
  //    그대로 승인할 수 있다. 되살린 뒤에도 아래 무결성/품질 재검사는 똑같이 통과해야 한다.
  if (!loadStagingManifest(stagingId)) {
    const restored = await materializeStagingFromStore({ store, stagingId, log });
    if (restored) {
      log(`[apply] staging 디렉터리가 없어 DB 에서 복원했습니다: ${stagingId}`);
      if (store) {
        await store.appendAudit({
          actor,
          action: "staging_restored",
          dataset,
          event_id: eventId,
          detail: `staging 디렉터리 부재 — DB 보존본에서 ${restored.written.length}개 파일 복원 후 승인 계속`,
        });
      }
    }
  }

  // 1) staging 무결성 — 반입 이후 변경되었으면 승인 자체를 거부한다.
  const verified = verifyStaging(stagingId);
  if (!verified.verified) {
    throw new Error(
      `staging 무결성 검증 실패 — 반입 이후 변경됨: ${JSON.stringify(verified.mismatches)} (아무것도 쓰지 않았습니다)`
    );
  }
  const stagingManifest = verified.manifest;
  const files = stagingManifest.files || [];
  if (!files.length) throw new Error("staging 에 반영할 파일이 없습니다.");

  // 2) 내용 재검사 — 저장된 판정이 아니라 실제 바이트로 다시 판정한다.
  const adapter = getAdapter(dataset);
  const filesDir = path.join(stagingDir(), String(stagingId), "files");
  const reanalysed = files.map((f) => {
    const buffer = fs.readFileSync(path.join(filesDir, path.basename(f.name)));
    return { name: f.name, buffer, ...analyzeContent(buffer, f.name, { requiredColumns: adapter.requiredColumns || [] }) };
  });
  const overall = overallStatus(reanalysed);
  if (approvalBlocked(overall)) {
    const detail = reanalysed
      .filter((f) => f.status === "fail" || f.status === "unsupported")
      .map((f) => `${f.name}: ${f.issues.map((i) => i.code).join(",")}`)
      .join(" / ");
    throw new Error(`품질검사 ${overall} — 승인할 수 없습니다 [${detail}]`);
  }

  // 3) never_auto_apply 게이트
  if (entry.never_auto_apply === true && confirm !== true) {
    throw new Error(
      `소스 "${dataset}" 는 data_sources.yaml 에서 never_auto_apply: true 로 표시되어 있습니다 — ` +
        "확인 플래그(confirm: true) 없이는 반영할 수 없습니다."
    );
  }

  // 4) 봉인값 가드 — 봉인 파일은 어떤 경로로도 덮어쓰지 않는다.
  const targets = files.map((f) => assertSafeRelPath(f.target || entry.local_file));
  for (const target of targets) {
    if (isSealedTarget(target)) {
      throw new Error(`봉인값 파일은 자동 반영 대상이 아닙니다: ${target} (수동 검증 실측값 보호)`);
    }
  }

  // 5) 불변 버전 디렉터리 생성 (previous/ 에 반영 전 원본 보존)
  const versionName = nextVersionName();
  const versionDir = ensureDir(path.join(versionsDir(), versionName));
  const versionFilesDir = ensureDir(path.join(versionDir, "files"));
  const versionPrevDir = ensureDir(path.join(versionDir, "previous"));
  const roots = applyTargetRoots();

  const fileEntries = [];
  const previousEntries = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const target = targets[i];
    const name = path.basename(f.name);
    const buffer = reanalysed[i].buffer;
    fs.writeFileSync(path.join(versionFilesDir, name), buffer);
    fileEntries.push({ name, target, bytes: buffer.length, sha256: sha256(buffer), records: reanalysed[i].records });

    const currentAbs = path.join(applyRoot(), target);
    if (fs.existsSync(currentAbs)) {
      const prevBuffer = fs.readFileSync(currentAbs);
      fs.writeFileSync(path.join(versionPrevDir, name), prevBuffer);
      previousEntries.push({ name, target, bytes: prevBuffer.length, sha256: sha256(prevBuffer), existed: true });
    } else {
      previousEntries.push({ name, target, bytes: 0, sha256: null, existed: false });
    }
  }

  // 6) 원자적 반영 (temp write + rename), 대상 루트마다
  const written = [];
  for (let i = 0; i < files.length; i += 1) {
    const target = targets[i];
    const buffer = reanalysed[i].buffer;
    for (const root of roots) {
      const abs = path.join(root, target);
      // vercel_public 사본은 원본이 이미 있을 때만 갱신한다(빌드 산출물 디렉터리에
      // 새 파일 트리를 만들어내지 않기 위해). 리포 루트는 항상 쓴다.
      if (root !== applyRoot() && !fs.existsSync(abs)) continue;
      writeFileAtomic(abs, buffer);
      written.push(path.relative(applyRoot(), abs).split(path.sep).join("/"));
    }
  }

  // 7) rebuild_command
  let rebuild = null;
  if (entry.rebuild_command) {
    rebuild = runRebuildCommand(entry.rebuild_command, log);
  }

  const manifest = {
    version: versionName,
    dataset,
    created_at: nowIso(),
    actor: actor || null,
    source_event_id: eventId || null,
    staging_id: String(stagingId),
    quality_status: overall,
    files: fileEntries,
    previous: previousEntries,
    written_paths: written,
    apply_roots: roots.map((r) => path.relative(applyRoot(), r).split(path.sep).join("/") || "."),
    rebuild,
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(versionDir, "manifest.json"), manifestText, "utf-8");
  const contentHash = sha256(Buffer.from(manifestText, "utf-8"));

  // 8) active 포인터
  writeActivePointer(dataset, versionName);

  // 9) store 버전 행 (기존 ④ 버전 기록 UI 와 롤백 라우팅에 사용)
  const snapshotPayload = { update_center_version_dir: versionName, dataset, files: fileEntries.map((f) => f.target) };
  const version = await store.saveVersion({
    dataset,
    content_hash: contentHash,
    row_count: fileEntries.reduce((sum, f) => sum + (Number(f.records) || 0), 0),
    snapshot: Buffer.from(JSON.stringify(snapshotPayload), "utf-8").toString("base64"),
    source_event_id: eventId || null,
    applied: true,
    rolled_back: false,
    version_dir: versionName,
  });

  // 10) 버전 파일 + manifest + 활성 포인터를 store 에 보존한다.
  //     DB 가 진실이고 디스크는 캐시다 — 재배포로 디렉터리가 사라져도 복원/롤백이 가능해진다.
  //     보존 실패는 반영 자체를 되돌리지 않는다(파일은 이미 원자적으로 교체됨).
  //     대신 감사 로그에 실패 사실을 남겨 "보존된 척"하지 않는다.
  let persisted = null;
  let persistError = null;
  try {
    persisted = await persistVersionToStore({ store, versionId: version.id, versionName, manifest, log });
    if (store && typeof store.setActiveVersion === "function") {
      await store.setActiveVersion(dataset, version.id, { version_dir: versionName });
    }
  } catch (err) {
    persistError = err;
    log(`[apply] 경고 — 버전 ${versionName} DB 보존 실패: ${err.message}`);
  }

  if (store) {
    await store.appendAudit({
      actor,
      action: persistError ? "version_persist_failed" : "version_persisted",
      dataset,
      event_id: eventId,
      detail: persistError
        ? `버전 ${versionName} DB 보존 실패 — ${persistError.message} (파일 반영 자체는 완료됨, 재배포 시 이 버전은 디스크에서 사라집니다)`
        : `버전 ${versionName} DB 보존 완료 — ${persisted ? persisted.file_count : 0}개 파일 / ` +
          `${persisted ? persisted.total_bytes : 0}B, 활성 포인터 갱신(${dataset} → ${versionName})`,
    });
  }

  if (store) {
    await store.appendAudit({
      actor,
      action: "files_applied",
      dataset,
      event_id: eventId,
      detail:
        `버전 ${versionName} 생성 및 원자적 반영 완료 — 파일: ${written.join(", ")} / ` +
        `품질=${overall} / manifest sha256=${contentHash}` +
        (rebuild
          ? ` / rebuild_command(${rebuild.command}) ${rebuild.skipped ? `건너뜀(${rebuild.reason})` : rebuild.ok ? "성공" : `실패(status=${rebuild.status})`}`
          : ""),
    });
    if (rebuild && !rebuild.skipped) {
      await store.appendAudit({
        actor,
        action: "rebuild_command_output",
        dataset,
        event_id: eventId,
        detail: `stdout: ${rebuild.stdout || "(없음)"} | stderr: ${rebuild.stderr || "(없음)"}`,
      });
    }
  }

  return {
    version: versionName,
    versionId: version.id,
    versionDir,
    manifest,
    rebuild,
    contentHash,
    written,
    persisted,
    persist_error: persistError ? persistError.message : null,
  };
}

// ---------------------------------------------------------------------------
// rollback
// ---------------------------------------------------------------------------

/**
 * 버전 디렉터리 기준 롤백. previous/ 에 보존된 반영 전 원본을 해시 재검증 후 복원한다.
 * 해시가 하나라도 어긋나면 아무 파일도 쓰지 않고 거부한다.
 */
export async function rollbackVersionDir({ versionName, entry, store, actor, versionId = null, log = () => {} }) {
  let manifest = readVersionManifest(versionName);
  let restoredFromStore = false;

  // 버전 디렉터리가 로컬에 없으면(재배포로 초기화) store 보존본에서 되살린다.
  // 되살린 뒤에도 아래 해시 재검증은 똑같이 통과해야 롤백이 진행된다.
  if (!manifest && store) {
    const id = versionId || (await findStoreVersionIdByDir(store, entry ? entry.dataset : null, versionName));
    if (id) {
      const materialized = await materializeVersionDirFromStore({ store, versionId: id, versionName, log });
      if (materialized) {
        manifest = readVersionManifest(versionName) || materialized.manifest;
        restoredFromStore = true;
        await store.appendAudit({
          actor,
          action: "version_dir_restored",
          dataset: manifest ? manifest.dataset : entry && entry.dataset,
          event_id: manifest ? manifest.source_event_id : null,
          detail: `버전 ${versionName} 디렉터리 부재 — DB 보존본에서 ${materialized.written.length}개 파일 복원 후 롤백 계속`,
        });
      }
    }
  }
  if (!manifest) {
    throw new Error(
      `버전 매니페스트를 찾을 수 없습니다: ${versionName} (로컬 디렉터리에도, DB 보존본에도 없습니다)`
    );
  }

  const versionDir = path.join(versionsDir(), versionName);
  const prevDir = path.join(versionDir, "previous");

  // 1) 해시 재검증 (복원 대상 + 현재 적용본이 이 버전의 산출물인지)
  const mismatches = [];
  for (const prev of manifest.previous || []) {
    if (!prev.existed) continue;
    const abs = path.join(prevDir, path.basename(prev.name));
    if (!fs.existsSync(abs)) {
      mismatches.push({ name: prev.name, reason: "missing_previous_file" });
      continue;
    }
    const actual = sha256(fs.readFileSync(abs));
    if (actual !== prev.sha256) {
      mismatches.push({ name: prev.name, reason: "previous_sha256_mismatch", expected: prev.sha256, actual });
    }
  }
  for (const file of manifest.files || []) {
    const abs = path.join(versionDir, "files", path.basename(file.name));
    if (!fs.existsSync(abs)) {
      mismatches.push({ name: file.name, reason: "missing_version_file" });
      continue;
    }
    const actual = sha256(fs.readFileSync(abs));
    if (actual !== file.sha256) {
      mismatches.push({ name: file.name, reason: "version_sha256_mismatch", expected: file.sha256, actual });
    }
  }
  if (mismatches.length) {
    if (store) {
      await store.appendAudit({
        actor,
        action: "rollback_integrity_failed",
        dataset: manifest.dataset,
        event_id: manifest.source_event_id,
        detail: `버전 ${versionName} 롤백 중단 — 해시 불일치: ${JSON.stringify(mismatches)} (파일에 아무것도 쓰지 않음)`,
      });
    }
    throw new Error(`버전 ${versionName} 롤백 거부 — 저장된 해시와 현재 내용이 다릅니다: ${JSON.stringify(mismatches)}`);
  }

  // 2) 복원
  const roots = applyTargetRoots();
  const restored = [];
  const removed = [];
  for (const prev of manifest.previous || []) {
    const target = assertSafeRelPath(prev.target);
    if (isSealedTarget(target)) throw new Error(`봉인값 파일은 롤백 대상이 아닙니다: ${target}`);
    if (prev.existed) {
      const buffer = fs.readFileSync(path.join(prevDir, path.basename(prev.name)));
      for (const root of roots) {
        const abs = path.join(root, target);
        if (root !== applyRoot() && !fs.existsSync(abs)) continue;
        writeFileAtomic(abs, buffer);
        restored.push(path.relative(applyRoot(), abs).split(path.sep).join("/"));
      }
    } else {
      // 반영 전에 없던 파일 — 롤백은 그 상태(부재)로 되돌린다.
      for (const root of roots) {
        const abs = path.join(root, target);
        if (fs.existsSync(abs)) {
          fs.unlinkSync(abs);
          removed.push(path.relative(applyRoot(), abs).split(path.sep).join("/"));
        }
      }
    }
  }

  // 3) rebuild_command 재실행 (파생 산출물 정합성)
  let rebuild = null;
  if (entry && entry.rebuild_command) rebuild = runRebuildCommand(entry.rebuild_command, log);

  // 4) active 포인터를 직전 버전으로
  const all = listVersionDirs().filter((v) => {
    const m = readVersionManifest(v);
    return m && m.dataset === manifest.dataset;
  });
  const idx = all.indexOf(versionName);
  const previousVersion = idx > 0 ? all[idx - 1] : null;
  const pointer = readActivePointer();
  if (previousVersion) pointer.active[manifest.dataset] = previousVersion;
  else delete pointer.active[manifest.dataset];
  pointer.updated_at = nowIso();
  writeFileAtomic(activePointerPath(), Buffer.from(JSON.stringify(pointer, null, 2), "utf-8"));

  // 활성 포인터는 store 에도 반영한다(재배포 후 기동 복원이 읽는 곳이 여기다).
  if (store && typeof store.setActiveVersion === "function") {
    const previousVersionId = previousVersion
      ? await findStoreVersionIdByDir(store, manifest.dataset, previousVersion)
      : null;
    await store.setActiveVersion(
      manifest.dataset,
      previousVersionId,
      previousVersion ? { version_dir: previousVersion } : {}
    );
  }

  if (store) {
    await store.appendAudit({
      actor,
      action: "rollback",
      dataset: manifest.dataset,
      event_id: manifest.source_event_id,
      detail:
        `버전 ${versionName} 롤백 완료(해시 재검증 통과) — 복원: ${restored.join(", ") || "(없음)"} / ` +
        `삭제: ${removed.join(", ") || "(없음)"} / active=${previousVersion || "(없음)"}` +
        (rebuild ? ` / rebuild ${rebuild.skipped ? "건너뜀" : rebuild.ok ? "성공" : "실패"}` : ""),
    });
  }

  return {
    version: versionName,
    restoredFiles: restored,
    removedFiles: removed,
    activeVersion: previousVersion,
    rebuild,
    restored_from_store: restoredFromStore,
  };
}

/** store 의 version 행이 새 버전 디렉터리 방식인지 판별하고, 그렇다면 디렉터리 이름을 돌려준다. */
export function versionDirFromStoreRow(versionRow) {
  if (!versionRow || !versionRow.snapshot) return null;
  try {
    const parsed = JSON.parse(Buffer.from(versionRow.snapshot, "base64").toString("utf-8"));
    return parsed && typeof parsed.update_center_version_dir === "string" ? parsed.update_center_version_dir : null;
  } catch {
    return null;
  }
}
