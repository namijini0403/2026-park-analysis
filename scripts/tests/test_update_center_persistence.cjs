"use strict";

// scripts/tests/test_update_center_persistence.cjs
//
// 업데이트 센터 "버전 영속화" 회귀 테스트. 네트워크 없음, 실제 Postgres 없음
// (파일 백엔드로 두 백엔드 공통 계약을 검증한다 — Postgres 백엔드는 같은 인터페이스를
//  구현하고 store.mjs 의 normaliseFilePayload/활성 포인터 헬퍼를 공유한다).
//
// 실행: node scripts/tests/test_update_center_persistence.cjs
//
// 모든 경로는 임시 디렉터리로 격리된다 — 실제 리포 파일을 건드리지 않는다.
//
// 커버리지
//   [1] 새 store 메서드 라운드트립(버전 파일 · 활성 포인터 · staging 보존)
//   [2] 승인 → 버전 파일/매니페스트/활성 포인터가 store 에 보존됨
//   [3] 버전 디렉터리 삭제(재배포 모사) → store 보존본에서 롤백 성공
//   [4] staging 디렉터리 삭제(재배포 모사) → 승인 시 store 에서 되살려 반영
//   [5] 기동 복원: 달라진 파일만 재적용, 동일한 파일은 건너뜀, 버전 캐시/active.json 재구성
//   [6] 용량 가드(단일 파일 25MB · 한 건 합계 60MB 초과 거부)

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

let passed = 0;
function ok(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}
function eq(name, actual, expected) {
  assert.deepStrictEqual(actual, expected, `${name} (actual=${JSON.stringify(actual)})`);
  passed += 1;
  console.log(`  PASS ${name}`);
}

// --------------------------------------------------------------------------
// 격리 환경
// --------------------------------------------------------------------------

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "uc_persist_"));
const APPLY_ROOT = path.join(TMP, "root");
const SOURCES_PATH = path.join(APPLY_ROOT, "data_sources.yaml");
const UC_HOME = path.join(TMP, "uc_home");

fs.mkdirSync(path.join(APPLY_ROOT, "data_processed"), { recursive: true });
fs.mkdirSync(path.join(APPLY_ROOT, "vercel_public", "data_processed"), { recursive: true });

delete process.env.DATABASE_URL;
process.env.UPDATE_CENTER_APPLY_ROOT = APPLY_ROOT;
process.env.UPDATE_CENTER_HOME = UC_HOME;
process.env.UPDATE_CENTER_STORE_PATH = path.join(TMP, "store.json");
process.env.UPDATE_CENTER_STATE_PATH = path.join(TMP, "state.json");
process.env.UPDATE_CENTER_SOURCES_PATH = SOURCES_PATH;
process.env.UPDATE_CENTER_MODULES_DIR = path.join(APPLY_ROOT, "modules");
process.env.UPDATE_CENTER_SKIP_REBUILD = "1";
delete process.env.UPDATE_CENTER_RESTORE_RUN_REBUILD;

const ROOT = path.resolve(__dirname, "..", "..");
const mod = (rel) => require("node:url").pathToFileURL(path.join(ROOT, rel)).href;

const TARGET_REL = "data_processed/testset.csv";
const repoTarget = path.join(APPLY_ROOT, TARGET_REL);
const vercelTarget = path.join(APPLY_ROOT, "vercel_public", TARGET_REL);
const versionsRoot = path.join(UC_HOME, "versions");
const stagingRoot = path.join(UC_HOME, "staging");
const activeJson = path.join(UC_HOME, "active.json");

const FACILITY_HEADER =
  "source_record_id,facility_name,latitude,longitude,coordinate_status,source_url,retrieved_at";
const facilityCsv = (rows) => [FACILITY_HEADER, ...rows].join("\r\n") + "\r\n";

const BASELINE_CSV = facilityCsv([
  "F001,업소A,37.4563,126.7052,transformed,https://example.go.kr/src,2026-09-06",
  "F002,업소B,37.4700,126.6300,transformed,https://example.go.kr/src,2026-09-06",
]);
const CANDIDATE_CSV = facilityCsv([
  "F001,업소A,37.4563,126.7052,transformed,https://example.go.kr/src,2026-09-07",
  "F002,업소B-이름변경,37.4700,126.6300,transformed,https://example.go.kr/src,2026-09-07",
  "F004,업소D,37.5000,126.7000,transformed,https://example.go.kr/src,2026-09-07",
]);
const SECOND_CANDIDATE_CSV = facilityCsv([
  "F001,업소A,37.4563,126.7052,transformed,https://example.go.kr/src,2026-09-08",
  "F005,업소E,37.4800,126.6900,transformed,https://example.go.kr/src,2026-09-08",
]);

function writeSourcesYaml() {
  fs.writeFileSync(
    SOURCES_PATH,
    [
      "version: 1",
      "sources:",
      "  - dataset: testset",
      `    local_file: ${TARGET_REL}`,
      "    provider: 테스트",
      "    update_cycle: 수시",
      "    source_url: https://example.go.kr/testset",
      "    check:",
      "      type: manual",
      "    search_keywords:",
      "      - 테스트",
      "",
    ].join("\n"),
    "utf-8"
  );
}

const b64 = (text) => Buffer.from(text, "utf-8").toString("base64");
const readUtf8 = (p) => fs.readFileSync(p, "utf-8");

async function main() {
  console.log(`임시 작업 공간: ${TMP}`);
  writeSourcesYaml();

  const storeMod = await import(mod("scripts/update_center/store.mjs"));
  const applyMod = await import(mod("scripts/update_center/apply.mjs"));
  const candidateMod = await import(mod("scripts/update_center/candidate.mjs"));
  const restoreMod = await import(mod("scripts/update_center/restore.mjs"));
  const yaml = require("js-yaml");

  const store = await storeMod.createStore();
  const entry = yaml.load(readUtf8(SOURCES_PATH)).sources.find((s) => s.dataset === "testset");

  // ------------------------------------------------------------------ [1]
  console.log("[1] 새 store 메서드 라운드트립 (파일 백엔드)");
  eq("store 백엔드 표식", store.backend, "file");
  ok(
    "기존 11 메서드가 그대로 존재",
    [
      "recordEvent",
      "listEvents",
      "getEvent",
      "updateEventStatus",
      "setEventAiNote",
      "saveVersion",
      "listVersions",
      "getVersion",
      "markVersionRolledBack",
      "appendAudit",
      "listAudit",
    ].every((m) => typeof store[m] === "function")
  );
  ok(
    "새 메서드 8종 존재",
    [
      "putVersionFiles",
      "getVersionFiles",
      "listVersionFileMeta",
      "getVersionFileCounts",
      "getActiveVersions",
      "setActiveVersion",
      "putStagedFiles",
      "getStagedFiles",
    ].every((m) => typeof store[m] === "function")
  );

  const probeVersion = await store.saveVersion({ dataset: "probe", version_dir: "v900" });
  eq("saveVersion 이 version_dir 를 보존", probeVersion.version_dir, "v900");
  const putResult = await store.putVersionFiles(
    probeVersion.id,
    [
      { rel_path: "files/probe.csv", content: b64("a,b\r\n1,2\r\n") },
      { rel_path: "previous/probe.csv", content: b64("a,b\r\n0,0\r\n") },
      { rel_path: "manifest.json", content: b64(JSON.stringify({ version: "v900" })) },
    ],
    { version: "v900", dataset: "probe" }
  );
  eq("putVersionFiles 파일 수", putResult.file_count, 3);
  const gotFiles = await store.getVersionFiles(probeVersion.id);
  eq("getVersionFiles 파일 수", gotFiles.files.length, 3);
  eq(
    "내용 라운드트립(base64)",
    Buffer.from(gotFiles.files.find((f) => f.rel_path === "files/probe.csv").content, "base64").toString("utf-8"),
    "a,b\r\n1,2\r\n"
  );
  eq("매니페스트 라운드트립", gotFiles.manifest.version, "v900");
  ok(
    "sha256/size 가 자동 계산되어 저장됨",
    gotFiles.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256) && f.size_bytes > 0)
  );
  const fileMeta = await store.listVersionFileMeta(probeVersion.id);
  ok("listVersionFileMeta 는 내용을 싣지 않는다", fileMeta.length === 3 && fileMeta.every((f) => !("content" in f)));
  const fileCounts = await store.getVersionFileCounts([probeVersion.id, "nonexistent"]);
  eq("getVersionFileCounts", fileCounts[probeVersion.id], 3);
  eq("보존본 없는 id 는 0", fileCounts.nonexistent, 0);
  eq("보존본 없는 버전은 null", await store.getVersionFiles("nonexistent"), null);

  await store.setActiveVersion("probe", probeVersion.id, { version_dir: "v900" });
  const pointer = await store.getActiveVersions();
  eq("활성 포인터 version_id", pointer.active.probe.version_id, probeVersion.id);
  eq("활성 포인터 version_dir", pointer.active.probe.version_dir, "v900");
  await store.setActiveVersion("probe", null, {});
  ok("versionId=null 이면 해당 데이터셋 제거", !(await store.getActiveVersions()).active.probe);

  await store.putStagedFiles("probe_stage", [{ rel_path: "files/probe.csv", content: b64("staged\r\n") }], {
    staging_id: "probe_stage",
  });
  const stagedGot = await store.getStagedFiles("probe_stage");
  eq(
    "staging 라운드트립",
    Buffer.from(stagedGot.files[0].content, "base64").toString("utf-8"),
    "staged\r\n"
  );
  eq("staging 매니페스트 라운드트립", stagedGot.manifest.staging_id, "probe_stage");
  eq("없는 staging 은 null", await store.getStagedFiles("probe_missing"), null);

  // ------------------------------------------------------------------ [2]
  console.log("[2] 승인 → 버전 파일/매니페스트/활성 포인터 DB 보존");
  fs.writeFileSync(repoTarget, BASELINE_CSV, "utf-8");
  fs.writeFileSync(vercelTarget, BASELINE_CSV, "utf-8");

  candidateMod.stageCandidate("stage_a", [{ name: "testset.csv", content: CANDIDATE_CSV, target: TARGET_REL }]);
  const persistStaged = await candidateMod.persistStagedCandidate(store, "stage_a");
  ok("stageCandidate 결과를 store 에 보존", persistStaged.ok === true && persistStaged.file_count === 2);

  const appliedV1 = await applyMod.applyStagedCandidate({
    entry,
    stagingId: "stage_a",
    store,
    eventId: "evt-1",
    actor: "test",
  });
  eq("첫 버전", appliedV1.version, "v001");
  eq("반영된 내용", readUtf8(repoTarget), CANDIDATE_CSV);
  ok("DB 보존 결과 반환", appliedV1.persisted && appliedV1.persisted.file_count === 3);
  eq("보존 실패 없음", appliedV1.persist_error, null);

  const storedV1 = await store.getVersionFiles(appliedV1.versionId);
  const relPaths = storedV1.files.map((f) => f.rel_path).sort();
  eq("보존된 rel_path 목록", relPaths, ["files/testset.csv", "manifest.json", "previous/testset.csv"]);
  eq("보존된 매니페스트의 버전", storedV1.manifest.version, "v001");
  eq(
    "보존된 반영 파일 내용",
    Buffer.from(storedV1.files.find((f) => f.rel_path === "files/testset.csv").content, "base64").toString("utf-8"),
    CANDIDATE_CSV
  );
  eq(
    "보존된 반영 전 원본 내용",
    Buffer.from(storedV1.files.find((f) => f.rel_path === "previous/testset.csv").content, "base64").toString("utf-8"),
    BASELINE_CSV
  );

  const activeAfterApply = await store.getActiveVersions();
  eq("활성 포인터 갱신", activeAfterApply.active.testset.version_dir, "v001");
  eq("활성 포인터 version_id", activeAfterApply.active.testset.version_id, appliedV1.versionId);
  const versionRow = await store.getVersion(appliedV1.versionId);
  eq("version 행에 version_dir 컬럼", versionRow.version_dir, "v001");
  ok(
    "감사 로그에 version_persisted",
    (await store.listAudit()).some((a) => a.action === "version_persisted")
  );

  // ------------------------------------------------------------------ [3]
  console.log("[3] 버전 디렉터리 삭제(재배포 모사) → store 보존본에서 롤백");
  fs.rmSync(path.join(versionsRoot, "v001"), { recursive: true, force: true });
  ok("버전 디렉터리가 사라진 상태", !fs.existsSync(path.join(versionsRoot, "v001")));
  eq("로컬 매니페스트도 없음", applyMod.readVersionManifest("v001"), null);

  const rolled = await applyMod.rollbackVersionDir({ versionName: "v001", entry, store, actor: "test" });
  ok("store 보존본에서 복원했다고 보고", rolled.restored_from_store === true);
  eq("롤백 후 리포 파일 원복", readUtf8(repoTarget), BASELINE_CSV);
  eq("롤백 후 vercel 사본 원복", readUtf8(vercelTarget), BASELINE_CSV);
  ok("버전 디렉터리가 다시 생김(캐시 재구성)", fs.existsSync(path.join(versionsRoot, "v001", "manifest.json")));
  ok(
    "감사 로그에 version_dir_restored",
    (await store.listAudit()).some((a) => a.action === "version_dir_restored")
  );
  ok("직전 버전이 없으므로 활성 포인터 해제", !(await store.getActiveVersions()).active.testset);

  // ------------------------------------------------------------------ [4]
  console.log("[4] staging 디렉터리 삭제(재배포 모사) → 승인 시 store 에서 되살림");
  const built = await candidateMod.buildStagedCandidate({
    entry,
    rawText: SECOND_CANDIDATE_CSV,
    stagingId: "stage_b",
    store,
  });
  eq("buildStagedCandidate 가 staging 을 보존", built.persisted_files, 2);
  eq("보존 오류 없음", built.persist_error, null);

  fs.rmSync(path.join(stagingRoot, "stage_b"), { recursive: true, force: true });
  ok("staging 디렉터리가 사라진 상태", candidateMod.loadStagingManifest("stage_b") === null);

  const appliedV2 = await applyMod.applyStagedCandidate({
    entry,
    stagingId: "stage_b",
    store,
    eventId: "evt-2",
    actor: "test",
  });
  eq("두 번째 버전", appliedV2.version, "v002");
  eq("staging 복원 후 반영된 내용", readUtf8(repoTarget), SECOND_CANDIDATE_CSV);
  eq("vercel 사본도 같은 내용", readUtf8(vercelTarget), SECOND_CANDIDATE_CSV);
  ok(
    "감사 로그에 staging_restored",
    (await store.listAudit()).some((a) => a.action === "staging_restored")
  );

  let missingStagingError = null;
  try {
    await applyMod.applyStagedCandidate({ entry, stagingId: "stage_never", store, eventId: "evt-x", actor: "test" });
  } catch (err) {
    missingStagingError = err;
  }
  ok(
    "보존본도 없는 staging 은 여전히 거부",
    missingStagingError !== null && /무결성/.test(missingStagingError.message)
  );

  // ------------------------------------------------------------------ [5]
  console.log("[5] 기동 복원 — 달라진 파일만 재적용");
  // 재배포 모사: 컨테이너 파일시스템이 git 배포본으로 초기화된다.
  fs.writeFileSync(repoTarget, BASELINE_CSV, "utf-8");
  fs.writeFileSync(vercelTarget, BASELINE_CSV, "utf-8");
  fs.rmSync(versionsRoot, { recursive: true, force: true });
  fs.rmSync(activeJson, { force: true });

  const logs = [];
  const summary = await restoreMod.restoreActiveVersions({ store, log: (line) => logs.push(line) });
  eq("복원한 데이터셋 수", summary.datasets, 1);
  eq("재적용한 파일 수(리포 + vercel)", summary.files_reapplied, 2);
  eq("복원한 버전 캐시 수", summary.version_dirs_restored, 1);
  eq("복원 오류 없음", summary.errors, []);
  eq("복원 후 리포 파일", readUtf8(repoTarget), SECOND_CANDIDATE_CSV);
  eq("복원 후 vercel 사본", readUtf8(vercelTarget), SECOND_CANDIDATE_CSV);
  ok("버전 디렉터리 캐시 재구성", fs.existsSync(path.join(versionsRoot, "v002", "manifest.json")));
  eq("active.json 재작성", JSON.parse(readUtf8(activeJson)).active.testset, "v002");
  ok(
    "한 줄 요약 로그 형식",
    logs.some((l) => /\[update-center\] 활성 버전 복원: 1개 데이터셋, 2개 파일 재적용/.test(l))
  );
  ok(
    "감사 로그에 active_version_restored",
    (await store.listAudit()).some((a) => a.action === "active_version_restored")
  );
  const lastRestore = await store.getMeta(storeMod.LAST_RESTORE_META_KEY);
  ok("복원 요약이 meta 에 저장", lastRestore && lastRestore.files_reapplied === 2);
  ok("rebuild_command 는 기본적으로 실행하지 않음", summary.rebuild.length === 0);

  // 두 번째 실행: 이미 같은 내용이므로 아무것도 다시 쓰지 않는다.
  const secondRun = await restoreMod.restoreActiveVersions({ store, log: () => {} });
  eq("동일한 파일은 재적용하지 않음", secondRun.files_reapplied, 0);
  eq("동일 파일로 집계", secondRun.files_unchanged, 2);
  eq("이미 있는 버전 캐시는 다시 만들지 않음", secondRun.version_dirs_restored, 0);

  // 한쪽만 어긋난 경우 — 그 파일만 다시 쓴다.
  fs.writeFileSync(vercelTarget, "손상된 내용\r\n", "utf-8");
  const partial = await restoreMod.restoreActiveVersions({ store, log: () => {} });
  eq("어긋난 파일 1개만 재적용", partial.files_reapplied, 1);
  eq("나머지 1개는 동일", partial.files_unchanged, 1);
  eq("손상된 사본이 원복", readUtf8(vercelTarget), SECOND_CANDIDATE_CSV);

  // 활성 포인터가 없으면 아무 파일도 건드리지 않는다.
  await store.setActiveVersion("testset", null, {});
  const emptyRestore = await restoreMod.restoreActiveVersions({ store, log: () => {} });
  eq("활성 버전이 없으면 재적용 0", emptyRestore.files_reapplied, 0);
  eq("검사한 데이터셋 0", emptyRestore.datasets_checked, 0);
  await store.setActiveVersion("testset", appliedV2.versionId, { version_dir: "v002" });

  // ------------------------------------------------------------------ [6]
  console.log("[6] 용량 가드");
  eq("단일 파일 상한 25MB", storeMod.MAX_PERSIST_FILE_BYTES, 25 * 1024 * 1024);
  eq("한 건 합계 상한 60MB", storeMod.MAX_PERSIST_VERSION_BYTES, 60 * 1024 * 1024);

  const oversizeFile = Buffer.alloc(26 * 1024 * 1024, 0x41);
  let sizeError = null;
  try {
    await store.putVersionFiles("size_guard", [{ rel_path: "files/big.csv", content: oversizeFile }]);
  } catch (err) {
    sizeError = err;
  }
  ok("25MB 초과 단일 파일 거부", sizeError !== null && /단일 파일 상한/.test(sizeError.message));
  eq("거부된 버전은 저장되지 않음", await store.getVersionFiles("size_guard"), null);

  const chunk = Buffer.alloc(21 * 1024 * 1024, 0x42);
  let totalError = null;
  try {
    await store.putVersionFiles("size_guard_total", [
      { rel_path: "files/a.csv", content: chunk },
      { rel_path: "files/b.csv", content: chunk },
      { rel_path: "files/c.csv", content: chunk },
    ]);
  } catch (err) {
    totalError = err;
  }
  ok("합계 60MB 초과 거부", totalError !== null && /한 건 상한/.test(totalError.message));
  eq("거부된 합계도 저장되지 않음", await store.getVersionFiles("size_guard_total"), null);

  let stagedSizeError = null;
  try {
    await store.putStagedFiles("size_guard_stage", [{ rel_path: "files/big.csv", content: oversizeFile }]);
  } catch (err) {
    stagedSizeError = err;
  }
  ok("staging 보존도 같은 가드 적용", stagedSizeError !== null && /단일 파일 상한/.test(stagedSizeError.message));

  let hashError = null;
  try {
    await store.putVersionFiles("hash_guard", [
      { rel_path: "files/a.csv", content: b64("hello"), sha256: "0".repeat(64) },
    ]);
  } catch (err) {
    hashError = err;
  }
  ok("내용과 다른 sha256 은 거부", hashError !== null && /sha256/.test(hashError.message));

  console.log(`\n전체 통과: ${passed}건`);
}

main()
  .then(() => {
    try {
      fs.rmSync(TMP, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
    console.log("OK");
  })
  .catch((err) => {
    console.error(`\nFAILED: ${err.stack || err.message}`);
    console.error(`(임시 작업 공간 보존: ${TMP})`);
    process.exitCode = 1;
  });
