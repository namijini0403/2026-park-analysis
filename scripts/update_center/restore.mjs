// scripts/update_center/restore.mjs
//
// 기동 시 활성 버전 복원 (Postgres = 진실, 컨테이너 디스크 = 캐시).
//
// Railway 컨테이너 파일시스템은 재배포마다 git 내용으로 초기화된다. 승인으로 반영한
// data_processed/*.csv 와 불변 버전 디렉터리(data/update_center/versions/vNNN/)는
// 그때 사라진다. 이 모듈은 서버가 listen 한 직후 실행되어
//
//   1) store 의 활성 포인터(meta: active_versions)를 읽고
//   2) 데이터셋별 활성 버전의 파일들을 store 에서 가져와
//   3) 각 반영 대상 루트(data_processed/, vercel_public/data_processed/)의 현재 파일과
//      sha256 을 비교해, 다르거나 없는 파일만 원자적으로 다시 쓰고
//   4) 로컬 버전 디렉터리 캐시와 active.json 을 재구성한다.
//
// 절대 서버를 죽이지 않는다 — 실패는 로그 + 감사 로그로만 보고한다.
//
// rebuild_command 는 기본적으로 실행하지 않는다. 승인 당시 rebuild_command 가
// 만들어낸 산출물도 그 자체가 반영 대상 파일이면 버전에 포함되어 함께 복원되기
// 때문이고, 재빌드는 수 분이 걸려 기동을 붙잡기 때문이다. 파생 산출물이 버전에
// 포함되지 않는 소스가 있어 재빌드가 필요하면 UPDATE_CENTER_RESTORE_RUN_REBUILD=1
// 을 설정한다.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  applyRoot,
  applyTargetRoots,
  versionsDir,
  activePointerPath,
  ensureDir,
  assertSafeRelPath,
  sourcesPath,
} from "./paths.mjs";
import { writeFileAtomic, isSealedTarget, materializePayload, runRebuildCommand } from "./apply.mjs";
import { LAST_RESTORE_META_KEY } from "./store.mjs";

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}

function fileSha256(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    return sha256(fs.readFileSync(absPath));
  } catch {
    return null;
  }
}

/** rebuild_command 실행이 필요할 때만 data_sources.yaml 을 읽는다. */
async function loadSourceEntry(dataset) {
  try {
    const yaml = (await import("js-yaml")).default;
    const doc = yaml.load(fs.readFileSync(sourcesPath(), "utf-8"));
    const sources = Array.isArray(doc?.sources) ? doc.sources : [];
    return sources.find((s) => s && s.dataset === dataset) || null;
  } catch {
    return null;
  }
}

/**
 * 활성 버전을 store 에서 디스크로 복원한다.
 *
 * @param {object} params
 * @param {object} params.store
 * @param {Function} [params.log]
 * @param {boolean} [params.runRebuild] 기본값은 UPDATE_CENTER_RESTORE_RUN_REBUILD === "1"
 * @returns {Promise<object>} 요약 (meta: last_restore 에 저장되는 것과 동일한 객체)
 */
export async function restoreActiveVersions({ store, log = () => {}, runRebuild } = {}) {
  const startedAt = nowIso();
  const summary = {
    at: startedAt,
    backend: store && store.backend ? store.backend : "unknown",
    datasets: 0,
    datasets_checked: 0,
    files_reapplied: 0,
    files_unchanged: 0,
    version_dirs_restored: 0,
    skipped: [],
    errors: [],
    rebuild: [],
    details: [],
  };

  if (!store || typeof store.getActiveVersions !== "function" || typeof store.getVersionFiles !== "function") {
    summary.skipped.push("store 가 버전 보존을 지원하지 않습니다(구버전 store).");
    return summary;
  }

  let pointer;
  try {
    pointer = await store.getActiveVersions();
  } catch (err) {
    summary.errors.push(`활성 포인터 조회 실패: ${err.message}`);
    return summary;
  }

  const entries = Object.entries((pointer && pointer.active) || {});
  summary.datasets_checked = entries.length;
  if (!entries.length) {
    log("[update-center] 활성 버전 복원: 보존된 활성 버전이 없습니다 (git 배포본 그대로 사용).");
    await recordSummary(store, summary, log);
    return summary;
  }

  const doRebuild = runRebuild === undefined ? process.env.UPDATE_CENTER_RESTORE_RUN_REBUILD === "1" : Boolean(runRebuild);
  const roots = applyTargetRoots();
  const localActive = { active: {}, updated_at: nowIso() };

  for (const [dataset, info] of entries) {
    const versionId = info && info.version_id;
    const versionDirName = (info && info.version_dir) || null;
    const detail = { dataset, version_id: versionId, version_dir: versionDirName, reapplied: [], unchanged: [], errors: [] };

    if (!versionId) {
      detail.errors.push("활성 포인터에 version_id 가 없습니다(구 형식) — 건너뜁니다.");
      summary.details.push(detail);
      summary.skipped.push(`${dataset}: version_id 없음`);
      continue;
    }

    let stored;
    try {
      stored = await store.getVersionFiles(versionId);
    } catch (err) {
      detail.errors.push(`버전 파일 조회 실패: ${err.message}`);
      summary.errors.push(`${dataset}: ${err.message}`);
      summary.details.push(detail);
      continue;
    }
    if (!stored || !stored.files || !stored.files.length) {
      detail.errors.push("DB 에 보존된 버전 파일이 없습니다 — 건너뜁니다.");
      summary.skipped.push(`${dataset}: 보존된 파일 없음`);
      summary.details.push(detail);
      continue;
    }

    const manifest = stored.manifest;
    if (!manifest || !Array.isArray(manifest.files)) {
      detail.errors.push("버전 매니페스트가 없거나 형식이 다릅니다 — 건너뜁니다.");
      summary.skipped.push(`${dataset}: 매니페스트 없음`);
      summary.details.push(detail);
      continue;
    }

    // 1) 로컬 버전 디렉터리 캐시 재구성 (manifest.json 이 없을 때만 — 이미 있으면 그대로 둔다)
    const dirName = versionDirName || manifest.version;
    if (dirName) {
      const versionDir = path.join(versionsDir(), dirName);
      if (!fs.existsSync(path.join(versionDir, "manifest.json"))) {
        try {
          ensureDir(versionDir);
          materializePayload(versionDir, stored.files, { label: `버전 ${dirName} 복원` });
          summary.version_dirs_restored += 1;
          detail.version_dir_restored = true;
        } catch (err) {
          detail.errors.push(`버전 디렉터리 복원 실패: ${err.message}`);
          summary.errors.push(`${dataset}/${dirName}: ${err.message}`);
        }
      }
      localActive.active[dataset] = dirName;
    }

    // 2) 반영 대상 파일 비교 후 재적용
    const byRelPath = new Map(stored.files.map((f) => [f.rel_path, f]));
    let datasetTouched = false;
    for (const fileEntry of manifest.files) {
      const name = path.basename(String(fileEntry.name || ""));
      const storedFile = byRelPath.get(`files/${name}`);
      if (!storedFile) {
        detail.errors.push(`${name}: DB 보존본에 files/${name} 가 없습니다.`);
        continue;
      }
      let target;
      try {
        target = assertSafeRelPath(fileEntry.target);
      } catch (err) {
        detail.errors.push(`${name}: ${err.message}`);
        continue;
      }
      if (isSealedTarget(target)) {
        detail.errors.push(`${name}: 봉인값 파일은 복원 대상이 아닙니다.`);
        continue;
      }
      const buffer = Buffer.from(storedFile.content, "base64");
      const actualSha = sha256(buffer);
      if (storedFile.sha256 && actualSha !== storedFile.sha256) {
        detail.errors.push(`${name}: DB 보존본 해시 불일치 — 재적용하지 않았습니다.`);
        summary.errors.push(`${dataset}/${name}: store_sha256_mismatch`);
        continue;
      }

      for (const root of roots) {
        const abs = path.join(root, target);
        // vercel_public 사본은 원본이 이미 있을 때만 갱신한다(apply.mjs 와 같은 규칙).
        const isRepoRoot = root === applyRoot();
        if (!isRepoRoot && !fs.existsSync(abs)) continue;
        const currentSha = fileSha256(abs);
        const rel = path.relative(applyRoot(), abs).split(path.sep).join("/");
        if (currentSha === actualSha) {
          summary.files_unchanged += 1;
          detail.unchanged.push(rel);
          continue;
        }
        try {
          writeFileAtomic(abs, buffer);
          summary.files_reapplied += 1;
          detail.reapplied.push(rel);
          datasetTouched = true;
        } catch (err) {
          detail.errors.push(`${rel}: 쓰기 실패 ${err.message}`);
          summary.errors.push(`${dataset}/${rel}: ${err.message}`);
        }
      }
    }

    // 3) rebuild_command (기본 건너뜀)
    if (datasetTouched && doRebuild) {
      const entry = await loadSourceEntry(dataset);
      if (entry && entry.rebuild_command) {
        const result = runRebuildCommand(entry.rebuild_command, log);
        summary.rebuild.push({ dataset, command: entry.rebuild_command, ok: result ? result.ok : null, skipped: result ? result.skipped : true });
      }
    }

    if (detail.reapplied.length || detail.unchanged.length) summary.datasets += 1;
    summary.details.push(detail);
  }

  // 4) active.json 캐시 재작성 (apply.mjs 의 readActivePointer 가 읽는 형식 그대로)
  try {
    ensureDir(path.dirname(activePointerPath()));
    writeFileAtomic(activePointerPath(), Buffer.from(JSON.stringify(localActive, null, 2), "utf-8"));
  } catch (err) {
    summary.errors.push(`active.json 재작성 실패: ${err.message}`);
  }

  summary.finished_at = nowIso();
  log(
    `[update-center] 활성 버전 복원: ${summary.datasets}개 데이터셋, ${summary.files_reapplied}개 파일 재적용` +
      ` (동일 ${summary.files_unchanged}개, 버전 캐시 ${summary.version_dirs_restored}개 복원` +
      `${summary.errors.length ? `, 오류 ${summary.errors.length}건` : ""}` +
      `${doRebuild ? "" : ", rebuild_command 건너뜀"})`
  );
  if (summary.errors.length) {
    for (const err of summary.errors) log(`[update-center] 복원 경고 — ${err}`);
  }

  await recordSummary(store, summary, log);
  return summary;
}

async function recordSummary(store, summary, log) {
  try {
    if (typeof store.setMeta === "function") await store.setMeta(LAST_RESTORE_META_KEY, summary);
  } catch (err) {
    log(`[update-center] 복원 요약 저장 실패: ${err.message}`);
  }
  try {
    if (typeof store.appendAudit === "function") {
      await store.appendAudit({
        actor: "server-boot",
        action: "active_version_restored",
        dataset: null,
        detail:
          `기동 복원 — 데이터셋 ${summary.datasets}개, 파일 재적용 ${summary.files_reapplied}개, ` +
          `동일 ${summary.files_unchanged}개, 버전 캐시 ${summary.version_dirs_restored}개` +
          `${summary.skipped.length ? `, 건너뜀 ${summary.skipped.length}건(${summary.skipped.join(" / ")})` : ""}` +
          `${summary.errors.length ? `, 오류 ${summary.errors.length}건(${summary.errors.join(" / ")})` : ""}`,
      });
    }
  } catch (err) {
    log(`[update-center] 복원 감사 기록 실패: ${err.message}`);
  }
}
