"use strict";

// scripts/tests/test_update_center_core.cjs
//
// 업데이트 센터 코어 회귀 테스트. 네트워크 호출 없음(fetch 는 전부 주입 mock).
// 실행: node scripts/tests/test_update_center_core.cjs
//
// 모든 경로는 임시 디렉터리로 격리된다 — data_sources.yaml, modules/, data_processed/,
// vercel_public/, store, scanner state 어느 것도 실제 리포 파일을 건드리지 않는다.
//
// 커버리지
//   [1] json_api 전 페이지 수집(perPage/totalCount 존중, 상한 도달 시 truncated)
//   [2] 품질검사 규칙 (fail/unsupported 는 승인 차단, 정상 계약은 통과)
//   [3] 기본키 기준 레코드 diff (added/removed/changed + 예시)
//   [4] 원자적 반영 + 버전 생성 + 해시 검증 롤백 (+ 변조 시 롤백 거부)
//   [5] never_auto_apply 확인 플래그 게이트 / 품질 fail 후보 반영 차단
//   [6] 자동 감시 스케줄 on/off + 겹침 방지
//   [7] 온보딩 답변 병합 → 계약 통과 → 등록(모듈 YAML + data_sources 항목 + 스니펫)

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

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "uc_core_"));
const APPLY_ROOT = path.join(TMP, "root");
const MODULES_DIR = path.join(APPLY_ROOT, "modules");
const SOURCES_PATH = path.join(APPLY_ROOT, "data_sources.yaml");

fs.mkdirSync(path.join(APPLY_ROOT, "data_processed"), { recursive: true });
fs.mkdirSync(path.join(APPLY_ROOT, "vercel_public", "data_processed"), { recursive: true });
fs.mkdirSync(MODULES_DIR, { recursive: true });

delete process.env.DATABASE_URL;
process.env.UPDATE_CENTER_APPLY_ROOT = APPLY_ROOT;
process.env.UPDATE_CENTER_HOME = path.join(TMP, "uc_home");
process.env.UPDATE_CENTER_STORE_PATH = path.join(TMP, "store.json");
process.env.UPDATE_CENTER_STATE_PATH = path.join(TMP, "state.json");
process.env.UPDATE_CENTER_SOURCES_PATH = SOURCES_PATH;
process.env.UPDATE_CENTER_MODULES_DIR = MODULES_DIR;
process.env.UPDATE_CENTER_SKIP_REBUILD = "1";
delete process.env.UPDATE_CENTER_SCAN_INTERVAL_MIN;

const ROOT = path.resolve(__dirname, "..", "..");
const mod = (rel) => require("node:url").pathToFileURL(path.join(ROOT, rel)).href;

const FACILITY_HEADER =
  "source_record_id,facility_name,latitude,longitude,coordinate_status,source_url,retrieved_at";
function facilityCsv(rows) {
  return [FACILITY_HEADER, ...rows].join("\r\n") + "\r\n";
}

const BASELINE_CSV = facilityCsv([
  "F001,업소A,37.4563,126.7052,transformed,https://example.go.kr/src,2026-09-06",
  "F002,업소B,37.4700,126.6300,transformed,https://example.go.kr/src,2026-09-06",
  "F003,업소C,,,missing_or_invalid,https://example.go.kr/src,2026-09-06",
]);
const CANDIDATE_CSV = facilityCsv([
  "F001,업소A,37.4563,126.7052,transformed,https://example.go.kr/src,2026-09-06",
  "F002,업소B-이름변경,37.4700,126.6300,transformed,https://example.go.kr/src,2026-09-07",
  "F004,업소D,37.5000,126.7000,transformed,https://example.go.kr/src,2026-09-07",
]);

function writeSourcesYaml(extra = "") {
  fs.writeFileSync(
    SOURCES_PATH,
    [
      "version: 1",
      "sources:",
      "  - dataset: testset",
      "    local_file: data_processed/testset.csv",
      "    provider: 테스트",
      "    update_cycle: 수시",
      "    source_url: https://example.go.kr/testset",
      "    check:",
      "      type: manual",
      "    search_keywords:",
      "      - 테스트",
      "  - dataset: lockedset",
      "    local_file: data_processed/lockedset.csv",
      "    never_auto_apply: true",
      "    provider: 테스트",
      "    update_cycle: 수시",
      "    check:",
      "      type: manual",
      "    search_keywords:",
      "      - 잠금",
      extra,
    ].join("\n") + "\n",
    "utf-8"
  );
}

async function main() {
  console.log(`임시 작업 공간: ${TMP}`);
  writeSourcesYaml();

  const candidateMod = await import(mod("scripts/update_center/candidate.mjs"));
  const qualityMod = await import(mod("scripts/update_center/quality.mjs"));
  const applyMod = await import(mod("scripts/update_center/apply.mjs"));
  const schedulerMod = await import(mod("scripts/update_center/scheduler.mjs"));
  const onboardingMod = await import(mod("scripts/update_center/onboarding.mjs"));
  const storeMod = await import(mod("scripts/update_center/store.mjs"));
  const contractMod = await import(mod("scripts/validate_module_contract.mjs"));
  const yaml = require("js-yaml");

  // ------------------------------------------------------------------ [1]
  console.log("[1] json_api 전 페이지 수집");
  const pages = {
    1: { totalCount: 5, data: [{ id: 1 }, { id: 2 }] },
    2: { totalCount: 5, data: [{ id: 3 }, { id: 4 }] },
    3: { totalCount: 5, data: [{ id: 5 }] },
  };
  const requested = [];
  const mockFetch = async (url) => {
    const page = Number(new URL(url).searchParams.get("page") || 1);
    requested.push(page);
    if (!pages[page]) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => pages[page] };
  };
  const baseUrl = "https://example.go.kr/standard.json?publicDataPk=1&perPage=2&page=1";
  const paged = await candidateMod.fetchAllPages({ url: baseUrl, fetchImpl: mockFetch });
  eq("전체 레코드 수집(totalCount 도달까지)", paged.records.length, 5);
  eq("요청한 페이지 번호", requested, [1, 2, 3]);
  eq("perPage 인식", paged.perPage, 2);
  eq("예상 페이지 수", paged.pagesExpected, 3);
  ok("잘리지 않음", paged.truncated === false);

  const capped = await candidateMod.fetchAllPages({ url: baseUrl, maxPages: 2, fetchImpl: mockFetch });
  ok("페이지 상한 도달 시 truncated=true", capped.truncated === true);
  eq("상한까지만 수집", capped.records.length, 4);

  const failing = await candidateMod.fetchAllPages({
    url: baseUrl,
    fetchImpl: async () => {
      throw new Error("network blocked");
    },
  });
  ok("네트워크 실패는 예외가 아니라 errors 로 보고", failing.errors.length === 1 && failing.records.length === 0);

  // ------------------------------------------------------------------ [2]
  console.log("[2] 품질검사 규칙");
  const good = qualityMod.analyzeContent(BASELINE_CSV, "testset.csv");
  eq("정상 시설 CSV 계약 감지", good.contract, "facility");
  eq("정상 시설 CSV 상태", good.status, "ok");
  eq("행 수", good.records, 3);

  const badCoords = qualityMod.analyzeContent(
    facilityCsv(["F001,업소A,99.9,300.1,transformed,https://example.go.kr/src,2026-09-06"]),
    "bad.csv"
  );
  eq("범위 밖 좌표는 fail", badCoords.status, "fail");
  ok(
    "좌표 범위 코드 검출",
    badCoords.issues.some((i) => i.code === "facility_invalid_coordinates" || i.code === "coordinate_out_of_bounds")
  );
  ok("fail 은 승인 차단", qualityMod.approvalBlocked(badCoords.status) === true);
  eq("fail → red 등급", qualityMod.riskFromStatus(badCoords.status), "red");

  const noStatus = qualityMod.analyzeContent(
    facilityCsv(["F001,업소A,,,,https://example.go.kr/src,2026-09-06"]),
    "nostatus.csv"
  );
  ok(
    "좌표 결측 + 상태 미표기는 fail (0건 위장 차단)",
    noStatus.issues.some((i) => i.code === "facility_coord_missing_without_status")
  );

  const empty = qualityMod.analyzeContent("", "empty.csv");
  ok("빈 파일은 fail", empty.status === "fail" && empty.issues.some((i) => i.code === "empty_file"));

  const zeroRows = qualityMod.analyzeContent(FACILITY_HEADER + "\r\n", "zero.csv");
  ok("데이터 0행은 fail", zeroRows.issues.some((i) => i.code === "csv_zero_records"));

  const unknown = qualityMod.analyzeContent("a,b\n1,2\n", "unknown.csv");
  eq("알 수 없는 계약은 unsupported", unknown.status, "unsupported");
  ok("unsupported 도 승인 차단", qualityMod.approvalBlocked(unknown.status) === true);

  const secret = qualityMod.analyzeContent(
    JSON.stringify([{ note: "key sk-abcdefghijklmnop1234567890" }]),
    "leak.json"
  );
  ok("API 키 의심 문자열 차단", secret.issues.some((i) => i.code === "possible_secret_content"));

  // 컨텍스트 v2 null 의미론
  const summaryBad = qualityMod.analyzeContent(
    JSON.stringify({
      data_as_of: "2026-09-06",
      schools: { S1: { school_name: "가상초", nightlife: { status: "unknown", observed_count: 0, total_count: 0 } } },
    }),
    "school_context_summary.json"
  );
  ok(
    "unknown 인데 count 가 0 이면 fail (미수집의 0건 위장 차단)",
    summaryBad.issues.some((i) => i.code === "summary_unknown_nonnull_counts")
  );
  const summaryOk = qualityMod.analyzeContent(
    JSON.stringify({
      data_as_of: "2026-09-06",
      schools: {
        S1: { school_name: "가상초", nightlife: { status: "partial", observed_count: 3, total_count: null } },
      },
    }),
    "school_context_summary.json"
  );
  eq("partial + 하한 관측치는 통과", summaryOk.status, "ok");

  // ------------------------------------------------------------------ [3]
  console.log("[3] 레코드 단위 diff");
  const before = qualityMod.csvToRecords(BASELINE_CSV);
  const after = qualityMod.csvToRecords(CANDIDATE_CSV);
  const rdiff = qualityMod.recordDiffByKey(before, after, ["source_record_id"]);
  eq("추가된 레코드", rdiff.added, 1);
  eq("삭제된 레코드", rdiff.removed, 1);
  eq("변경된 레코드", rdiff.changed, 1);
  eq("동일 레코드", rdiff.unchanged, 1);
  ok("예시는 20건 이하", rdiff.examples.length <= 20 && rdiff.examples.length === 3);
  ok(
    "변경 예시에 필드 단위 before/after",
    rdiff.examples.some((e) => e.change === "changed" && e.fields.some((f) => f.field === "facility_name"))
  );

  const schemaDiff = qualityMod.schemaDiffAgainstCurrent(
    ["source_record_id", "facility_nm", "latitude", "longitude"],
    null
  );
  ok("기준 파일이 없으면 baseline_available=false", schemaDiff.baseline_available === false);
  const mapping = qualityMod.suggestColumnMapping(["facility_nm"], ["facility_name"]);
  ok(
    "이름 변경 매핑 제안(결정론적)",
    mapping.length === 1 && mapping[0].from === "facility_name" && mapping[0].to === "facility_nm"
  );

  // ------------------------------------------------------------------ [4]
  console.log("[4] 원자적 반영 + 버전 + 롤백");
  const targetRel = "data_processed/testset.csv";
  const repoTarget = path.join(APPLY_ROOT, targetRel);
  const vercelTarget = path.join(APPLY_ROOT, "vercel_public", targetRel);
  fs.writeFileSync(repoTarget, BASELINE_CSV, "utf-8");
  fs.writeFileSync(vercelTarget, BASELINE_CSV, "utf-8");

  const store = await storeMod.createStore();
  const entry = yaml.load(fs.readFileSync(SOURCES_PATH, "utf-8")).sources.find((s) => s.dataset === "testset");

  const staged = candidateMod.stageCandidate("stage_ok", [
    { name: "testset.csv", content: CANDIDATE_CSV, target: targetRel },
  ]);
  ok("staging manifest 에 파일별 sha256", Boolean(staged.manifest.files[0].sha256));
  ok("staging 무결성 검증 통과", candidateMod.verifyStaging("stage_ok").verified === true);

  const evaluation = await candidateMod.evaluateCandidate(entry, CANDIDATE_CSV, "testset.csv");
  eq("현재 적용본 대비 스키마 변화 없음", evaluation.schema_diff.added, []);
  ok("승인 차단 아님", evaluation.approval_blocked === false);

  const applied = await applyMod.applyStagedCandidate({
    entry,
    stagingId: "stage_ok",
    store,
    eventId: "evt-1",
    actor: "test",
  });
  eq("첫 버전 이름", applied.version, "v001");
  eq("리포 data_processed 반영", fs.readFileSync(repoTarget, "utf-8"), CANDIDATE_CSV);
  eq("vercel_public 사본도 같은 내용", fs.readFileSync(vercelTarget, "utf-8"), CANDIDATE_CSV);
  ok("두 경로 모두 기록됨", applied.written.length === 2);
  ok("임시 파일이 남지 않음", fs.readdirSync(path.dirname(repoTarget)).every((n) => !n.includes(".uctmp-")));

  const vmanifest = applyMod.readVersionManifest("v001");
  ok("버전 매니페스트에 반영 전 원본 해시", vmanifest.previous[0].sha256 && vmanifest.previous[0].existed === true);
  eq("active 포인터", applyMod.readActivePointer().active.testset, "v001");

  // 변조 → 롤백 거부
  const prevFile = path.join(process.env.UPDATE_CENTER_HOME, "versions", "v001", "previous", "testset.csv");
  const prevOriginal = fs.readFileSync(prevFile);
  fs.writeFileSync(prevFile, Buffer.concat([prevOriginal, Buffer.from("TAMPERED\n")]));
  let rollbackError = null;
  try {
    await applyMod.rollbackVersionDir({ versionName: "v001", entry, store, actor: "test" });
  } catch (err) {
    rollbackError = err;
  }
  ok("해시 불일치 시 롤백 거부", rollbackError !== null && /해시|롤백 거부/.test(rollbackError.message));
  eq("롤백 거부 시 파일 변경 없음", fs.readFileSync(repoTarget, "utf-8"), CANDIDATE_CSV);

  // 복구 → 롤백 성공
  fs.writeFileSync(prevFile, prevOriginal);
  const rolled = await applyMod.rollbackVersionDir({ versionName: "v001", entry, store, actor: "test" });
  eq("롤백 후 리포 파일 원복", fs.readFileSync(repoTarget, "utf-8"), BASELINE_CSV);
  eq("롤백 후 vercel 사본 원복", fs.readFileSync(vercelTarget, "utf-8"), BASELINE_CSV);
  ok("복원 파일 2건", rolled.restoredFiles.length === 2);

  // ------------------------------------------------------------------ [5]
  console.log("[5] 승인 게이트 (품질 fail / never_auto_apply)");
  candidateMod.stageCandidate("stage_bad", [
    { name: "testset.csv", content: facilityCsv(["F001,업소A,99.9,300.1,transformed,https://x,2026-09-06"]), target: targetRel },
  ]);
  let applyError = null;
  try {
    await applyMod.applyStagedCandidate({ entry, stagingId: "stage_bad", store, eventId: "evt-2", actor: "test" });
  } catch (err) {
    applyError = err;
  }
  ok("품질 fail 후보는 반영 거부", applyError !== null && /품질검사/.test(applyError.message));
  eq("거부 시 파일 그대로", fs.readFileSync(repoTarget, "utf-8"), BASELINE_CSV);

  const lockedEntry = yaml.load(fs.readFileSync(SOURCES_PATH, "utf-8")).sources.find((s) => s.dataset === "lockedset");
  fs.writeFileSync(path.join(APPLY_ROOT, "data_processed", "lockedset.csv"), BASELINE_CSV, "utf-8");
  candidateMod.stageCandidate("stage_locked", [
    { name: "lockedset.csv", content: CANDIDATE_CSV, target: "data_processed/lockedset.csv" },
  ]);
  let lockedError = null;
  try {
    await applyMod.applyStagedCandidate({
      entry: lockedEntry,
      stagingId: "stage_locked",
      store,
      eventId: "evt-3",
      actor: "test",
    });
  } catch (err) {
    lockedError = err;
  }
  ok("never_auto_apply 는 confirm 없이 거부", lockedError !== null && /never_auto_apply/.test(lockedError.message));
  const lockedApplied = await applyMod.applyStagedCandidate({
    entry: lockedEntry,
    stagingId: "stage_locked",
    store,
    eventId: "evt-3",
    actor: "test",
    confirm: true,
  });
  ok("confirm 이 있으면 반영", lockedApplied.version === "v002");

  // staging 변조 → 승인 거부
  const stagedFile = path.join(process.env.UPDATE_CENTER_HOME, "staging", "stage_ok", "files", "testset.csv");
  fs.writeFileSync(stagedFile, CANDIDATE_CSV + "F999,위조,37.4,126.7,transformed,https://x,2026-09-06\r\n");
  let tamperError = null;
  try {
    await applyMod.applyStagedCandidate({ entry, stagingId: "stage_ok", store, eventId: "evt-4", actor: "test" });
  } catch (err) {
    tamperError = err;
  }
  ok("staging 변조는 승인 거부", tamperError !== null && /무결성/.test(tamperError.message));

  // 봉인 파일 가드
  candidateMod.stageCandidate("stage_sealed", [
    { name: "sealed_nearest_park_dist.json", content: "{}", target: "output/sealed_nearest_park_dist.json" },
  ]);
  ok("봉인 대상 판정", applyMod.isSealedTarget("output/sealed_nearest_park_dist.json") === true);

  // ------------------------------------------------------------------ [6]
  console.log("[6] 자동 감시 스케줄");
  let scanCalls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const scheduler = schedulerMod.createScheduler({
    getStore: async () => store,
    runScan: async () => {
      scanCalls += 1;
      if (scanCalls === 1) await gate;
      return { mode: "scan", summary: { green: 1 }, events: [{ id: "e" }] };
    },
  });

  const initial = await scheduler.start();
  ok("환경변수 미설정이면 자동 감시 OFF", initial.enabled === false && initial.source === "off");

  const enabled = await scheduler.setSchedule({ enabled: true, interval_min: 60, actor: "test" });
  ok("자동 감시 ON 반영", enabled.enabled === true && enabled.interval_min === 60);
  const storedConfig = await store.getMeta(schedulerMod.SCHEDULE_META_KEY);
  ok("설정이 store meta 에 영속화", storedConfig.enabled === true && storedConfig.interval_min === 60);
  const statusOn = await scheduler.getStatus();
  ok("상태에 next_scan_at 표시", Boolean(statusOn.next_scan_at) && statusOn.timer_armed === true);

  // 겹침 방지: 첫 실행이 끝나기 전 두 번째 호출은 skip
  const first = scheduler.runOnce("manual");
  const second = await scheduler.runOnce("manual");
  ok("실행 중 재호출은 건너뜀", second.skipped === true && second.reason === "overlap");
  release();
  const firstResult = await first;
  ok("첫 실행은 완료", firstResult.ran === true);
  eq("스캔은 한 번만 실행됨", scanCalls, 1);

  const statusAfter = await scheduler.getStatus();
  ok("last_scan_at 기록", Boolean(statusAfter.last_scan_at) && statusAfter.last_result.ok === true);

  const disabled = await scheduler.setSchedule({ enabled: false, interval_min: 60, actor: "test" });
  ok("자동 감시 OFF 반영", disabled.enabled === false);
  ok("OFF 면 타이머 해제", (await scheduler.getStatus()).timer_armed === false);

  // 스캔 실패가 스케줄러를 죽이지 않는다
  const failingScheduler = schedulerMod.createScheduler({
    getStore: async () => store,
    runScan: async () => {
      throw new Error("포털 접속 실패(타임아웃)");
    },
  });
  await failingScheduler.start();
  const failed = await failingScheduler.runOnce("manual");
  ok("스캔 실패는 예외가 아니라 결과로", failed.ran === true && /타임아웃/.test(failed.error));
  const failStatus = await failingScheduler.getStatus();
  ok("실패 내용이 last_result 에 기록", failStatus.last_result.ok === false);
  failingScheduler.stop();
  scheduler.stop();

  // ------------------------------------------------------------------ [7]
  console.log("[7] 온보딩 답변 병합 → 계약 통과 → 등록");
  eq("질문 수", onboardingMod.QUESTIONS.length, 7);
  ok(
    "모든 질문에 id/text/options/default/required",
    onboardingMod.QUESTIONS.every(
      (q) => q.id && q.text && Array.isArray(q.options) && q.options.length && q.default && q.required === true
    )
  );

  const merged = onboardingMod.mergeAnswers(
    { layer: { id: "new_module_deadbeef" } },
    {
      slug: "sports_facility",
      resource_type: "공공 체육시설",
      source_location: "unknown",
      join_key: "coordinate",
      geometry: "point",
      usage: "gap_metric",
      refresh_cycle: "quarterly",
      coverage: "partial_gu",
      sensitivity: "no_risk",
      button_label: "🏟 체육시설",
      panel_label: "체육시설",
      color: "#2B6CB0",
      name_key: "시설명",
    }
  );
  eq("slug 반영", merged.slug, "sports_facility");
  eq("격차 지표 용도의 policy_actions", merged.doc.policy_actions, [
    "external_supply_new",
    "access_route_improvement",
    "maintain_monitor",
  ]);
  ok(
    "부분 커버리지 제약이 자동 삽입",
    merged.doc.constraints.some((c) => c.includes("unknown"))
  );
  ok("신규 소스는 never_auto_apply 기본값 true", merged.source_entry.never_auto_apply === true);

  const stigma = onboardingMod.mergeAnswers(
    { layer: { id: "x" } },
    { slug: "stigma_layer", usage: "gap_metric", sensitivity: "stigma_risk", source_location: "unknown", geometry: "point" }
  );
  eq("낙인 위험이면 참고 전용으로 강제", stigma.doc.policy_actions, ["maintain_monitor"]);
  ok("강제 사실을 보고", stigma.forced.length === 1 && /참고 맥락만/.test(stigma.forced[0]));
  ok(
    "낙인 제약 삽입",
    stigma.doc.constraints.some((c) => c.includes("낙인"))
  );

  const badAnswer = onboardingMod.normaliseAnswers({ usage: "무단값" });
  eq("enum 밖 값은 기본값으로", badAnswer.answers.usage, "reference_only");
  ok("되돌린 사실을 보고", badAnswer.corrections.length === 1);

  let slugError = null;
  try {
    onboardingMod.mergeAnswers({ layer: { id: "x" } }, { slug: "../../evil" });
  } catch (err) {
    slugError = err;
  }
  ok("잘못된 slug 거부", slugError !== null && /slug/.test(slugError.message));

  const yamlText = onboardingMod.dumpYaml(merged.doc);
  const parsedDoc = yaml.load(yamlText, { schema: yaml.CORE_SCHEMA });
  const contract = contractMod.checkModuleDoc(parsedDoc);
  eq("계약 검사 통과(실패 0건)", contract.failures, []);

  const registered = onboardingMod.registerModule({ doc: parsedDoc, sourceEntry: merged.source_entry });
  ok("모듈 YAML 기록", fs.existsSync(path.join(MODULES_DIR, "sports_facility.yaml")));
  ok("data_sources.yaml 항목 추가", registered.data_sources_appended === true);
  const reloaded = yaml.load(fs.readFileSync(SOURCES_PATH, "utf-8"));
  ok(
    "추가된 항목이 유효한 YAML 로 파싱됨",
    Array.isArray(reloaded.sources) && reloaded.sources.some((s) => s.dataset === "sports_facility")
  );
  ok("기존 항목은 보존", reloaded.sources.some((s) => s.dataset === "testset"));

  let dupError = null;
  try {
    onboardingMod.registerModule({ doc: parsedDoc, sourceEntry: merged.source_entry });
  } catch (err) {
    dupError = err;
  }
  ok("중복 등록 거부", dupError !== null);

  const snippet = onboardingMod.buildRegistrySnippet(parsedDoc, "point");
  ok('스니펫에 id 포함', snippet.includes('id: "sports_facility"'));
  ok("스니펫에 point 좌표 키 포함", snippet.includes("latKey") && snippet.includes("위도"));
  ok("실제 리포의 index.html 은 건드리지 않음", !fs.existsSync(path.join(APPLY_ROOT, "index.html")));

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
