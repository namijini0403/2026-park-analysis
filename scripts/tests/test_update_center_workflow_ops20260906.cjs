"use strict";

// update_center/review_cli.cjs 워크플로 단독 테스트 (2026-09-06 운영 태스크)
// 실행: node scripts/tests/test_update_center_workflow_ops20260906.cjs
// 임시 디렉터리(UPDATE_CENTER_HOME)에서 stage → diff → reject → approve → rollback 전체 사이클과
// 품질 차단·무결성·악성 경로 처리를 검증한다. 외부 네트워크 호출 없음.

const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const CLI = path.join(PROJECT_ROOT, "update_center", "review_cli.cjs");
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "uc_test_"));
// 반입 입력은 작업 공간 안에 있어야 하므로 임시 입력은 프로젝트 하위가 아닌 워크스페이스 안에 만들 수 없다.
// → 워크스페이스 루트 하위의 임시 폴더를 쓰고 종료 시 삭제한다.
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "..");
const INPUT_DIR = fs.mkdtempSync(path.join(WORKSPACE_ROOT, "uc_test_input_"));

let passed = 0;
function ok(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

function run(args, { expectFail = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], {
      env: { ...process.env, UPDATE_CENTER_HOME: HOME },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (expectFail) throw new Error(`실패해야 하는 명령이 성공함: ${args.join(" ")}`);
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    if (err.status === undefined) throw err;
    if (!expectFail) {
      throw new Error(`명령 실패(${err.status}): ${args.join(" ")}\n${err.stderr || err.stdout}`);
    }
    return { code: err.status, stdout: String(err.stdout || ""), stderr: String(err.stderr || "") };
  }
}

function firstJson(stdout) {
  const match = stdout.match(/^\{[\s\S]*?^\}/m);
  assert.ok(match, `stdout 에서 JSON 을 찾지 못함:\n${stdout}`);
  return JSON.parse(match[0]);
}

function writeInput(name, content) {
  const p = path.join(INPUT_DIR, name);
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

const FACILITY_HEADER = "source_record_id,facility_name,facility_type,address,latitude,longitude,coordinate_status,business_status,source_url,retrieved_at";

function facilityCsv(rows) {
  return [FACILITY_HEADER, ...rows].join("\n") + "\n";
}

function main() {
  console.log(`임시 검토 홈: ${HOME}`);

  console.log("[1] 정상 시설 데이터 stage (도서지역 좌표 포함)");
  const goodV1 = writeInput("facility_v1.csv", facilityCsv([
    'F001,노래클럽A,유흥주점영업,"인천 미추홀구 어딘가",37.4563,126.7052,transformed,영업/정상,https://example.go.kr/src,2026-09-06',
    'F002,주점B,단란주점영업,"인천 옹진군 백령면",37.9660,124.6300,transformed,영업/정상,https://example.go.kr/src,2026-09-06',
    'F003,주점C,유흥주점영업,"인천 영종구 주소",,,missing_or_invalid,영업/정상,https://example.go.kr/src,2026-09-06',
  ]));
  const stage1 = firstJson(run(["stage", goodV1, "--as", "facility_context.csv", "--label", "baseline"]).stdout);
  ok("스냅샷 ID 형식", /^snap_\d{8}T\d{6}_[0-9a-f]{6}$/.test(stage1.id));
  ok("품질 상태 ok (백령도 좌표가 bbox 에서 거부되지 않음)", stage1.overall_status === "ok");
  ok("계약 감지 = facility", stage1.files[0].contract === "facility");
  ok("행수 3", stage1.files[0].records === 3);
  const baselineId = stage1.id;

  console.log("[2] 품질 실패 데이터: 잘못된 좌표 / 좌표 없음+상태 미표기 / 출처 누락");
  const badCsv = writeInput("facility_bad.csv", facilityCsv([
    'F001,업소A,유흥주점영업,"주소",99.9,300.1,transformed,영업/정상,https://example.go.kr/src,2026-09-06',
    'F002,업소B,유흥주점영업,"주소",,,,영업/정상,https://example.go.kr/src,2026-09-06',
    ',업소C,유흥주점영업,"주소",37.45,126.70,transformed,영업/정상,,',
  ]));
  const badRun = run(["stage", badCsv, "--label", "bad-quality"], { expectFail: true });
  ok("품질 실패 시 종료 코드 2", badRun.code === 2);
  const badStage = firstJson(badRun.stdout);
  ok("overall_status=fail", badStage.overall_status === "fail");
  const badCodes = badStage.files[0].issues.map((i) => i.code);
  ok("좌표 범위 검사 검출", badCodes.includes("facility_invalid_coordinates"));
  ok("좌표 공백 상태 미표기 검출(0건 위장 차단)", badCodes.includes("facility_coord_missing_without_status"));
  ok("ID 누락 검출", badCodes.includes("facility_missing_id"));

  console.log("[3] 품질 실패 스냅샷은 approve 불가");
  const blockedApprove = run(["approve", badStage.id, "--note", "억지 승인 시도"], { expectFail: true });
  ok("승인 차단 종료 코드 1", blockedApprove.code === 1);
  ok("차단 사유에 품질검사 명시", blockedApprove.stderr.includes("품질검사 실패"));

  console.log("[4] 깨진 JSON / 비허용 확장자 / 비밀 의심 문자열");
  const brokenJson = writeInput("broken.json", '{"records": [ {"a": 1}, ');
  const brokenRun = run(["stage", brokenJson], { expectFail: true });
  ok("깨진 JSON 은 fail", firstJson(brokenRun.stdout).overall_status === "fail");
  const exe = writeInput("evil.exe.csv.txt", "x");
  const extRun = run(["stage", exe], { expectFail: true });
  ok("허용 확장자 외 반입 거부", extRun.code === 1 && extRun.stderr.includes("허용 확장자"));
  const secretFile = writeInput("leaky.json", JSON.stringify({ note: "key sk-abcdefghijklmnop1234567890" }));
  const secretRun = run(["stage", secretFile], { expectFail: true });
  ok("API 키 의심 문자열 반입 차단", firstJson(secretRun.stdout).files[0].issues.some((i) => i.code === "possible_secret_content"));

  console.log("[5] 스냅샷 무결성(불변성): 반입 후 변경 감지");
  const tamperTarget = path.join(HOME, "staging", baselineId, "files", "facility_context.csv");
  fs.chmodSync(tamperTarget, 0o666);
  const original = fs.readFileSync(tamperTarget, "utf-8");
  fs.writeFileSync(tamperTarget, original + "FZZZ,위조업소,유흥주점영업,주소,37.4,126.7,transformed,영업/정상,https://x,2026-09-06\n", "utf-8");
  const verifyTampered = run(["verify", baselineId], { expectFail: true });
  ok("변조된 스냅샷 verify 실패(코드 2)", verifyTampered.code === 2);
  ok("sha256 불일치 보고", verifyTampered.stderr.includes("sha256_mismatch"));
  const approveTampered = run(["approve", baselineId, "--note", "변조본 승인 시도"], { expectFail: true });
  ok("변조된 스냅샷 approve 거부", approveTampered.code === 1 && approveTampered.stderr.includes("무결성"));
  fs.writeFileSync(tamperTarget, original, "utf-8");
  fs.chmodSync(tamperTarget, 0o444);
  run(["verify", baselineId]);
  ok("원복 후 verify 통과", true);

  console.log("[6] 후보 v2 stage + diff");
  const goodV2 = writeInput("facility_v2.csv", facilityCsv([
    'F001,노래클럽A,유흥주점영업,"인천 미추홀구 어딘가",37.4563,126.7052,transformed,영업/정상,https://example.go.kr/src,2026-09-07',
    'F002,주점B,단란주점영업,"인천 옹진군 백령면",37.9660,124.6300,transformed,폐업,https://example.go.kr/src,2026-09-07',
    'F003,주점C,유흥주점영업,"인천 영종구 주소",37.4900,126.4900,transformed,영업/정상,https://example.go.kr/src,2026-09-07',
    'F004,신규D,유흥주점영업,"인천 계양구 주소",37.5400,126.7300,transformed,영업/정상,https://example.go.kr/src,2026-09-07',
  ]));
  const stage2 = firstJson(run(["stage", goodV2, "--as", "facility_context.csv", "--label", "candidate-v2"]).stdout);
  const candidateId = stage2.id;
  const diff = firstJson(run(["diff", baselineId, candidateId]).stdout);
  ok("diff 변경 파일 1건", diff.changed.length === 1);
  ok("행수 증가 3→4", diff.changed[0].records_before === 3 && diff.changed[0].records_after === 4);
  ok("diff 리포트 파일 생성", fs.existsSync(path.join(HOME, "reviews", `diff_${candidateId}_vs_${baselineId}.json`)));

  console.log("[7] reject 기록");
  run(["reject", candidateId, "--note", "좌표 검증 재확인 필요(데모 반려)"]);
  const decisions = fs.readFileSync(path.join(HOME, "reviews", "decisions.jsonl"), "utf-8");
  ok("반려가 결정 로그에 기록됨", decisions.includes('"rejected"') && decisions.includes(candidateId));

  console.log("[8] approve → 버전 승격(스테이징 전용, data_processed 미접촉)");
  const approve1 = firstJson(run(["approve", baselineId, "--note", "baseline 승인(테스트)"]).stdout);
  ok("v001 생성·활성화", approve1.version === "v001" && approve1.active_version === "v001");
  const approve2 = firstJson(run(["approve", candidateId, "--note", "v2 승인(테스트)"]).stdout);
  ok("v002 생성·활성화", approve2.version === "v002" && approve2.active_version === "v002");
  ok("관리 산출물이 update_center 관리 영역에만 존재", fs.existsSync(path.join(HOME, "managed", "versions", "v002", "files", "facility_context.csv")));

  console.log("[9] rollback: 정확한 해시 일치 시에만 허용");
  const rollback = firstJson(run(["rollback", "v001"]).stdout);
  ok("v001 로 롤백", rollback.active_version === "v001");
  ok("롤백 해시 = 승인 시점 해시", rollback.content_hash === approve1.content_hash);
  const managedFile = path.join(HOME, "managed", "versions", "v002", "files", "facility_context.csv");
  fs.chmodSync(managedFile, 0o666);
  fs.appendFileSync(managedFile, "tampered\n", "utf-8");
  const badRollback = run(["rollback", "v002"], { expectFail: true });
  ok("변조된 버전으로의 롤백 거부", badRollback.code === 1 && badRollback.stderr.includes("해시"));

  console.log("[10] 악성 경로/ID 처리");
  ok("경로 탈출형 snapshot id 거부", run(["verify", "../../managed/state"], { expectFail: true }).code === 1);
  ok("경로 탈출형 approve id 거부", run(["approve", "..\\..\\x", "--note", "x"], { expectFail: true }).code === 1);
  ok("이상한 버전명 rollback 거부", run(["rollback", "v1; rm -rf /"], { expectFail: true }).code === 1);
  const outside = path.join(os.tmpdir(), "uc_outside.csv");
  fs.writeFileSync(outside, "a,b\n1,2\n");
  ok("작업 공간 밖 파일 반입 거부", run(["stage", outside], { expectFail: true }).stderr.includes("작업 공간"));
  const dotfile = path.join(INPUT_DIR, ".env.json");
  fs.writeFileSync(dotfile, "{}");
  ok("숨김/비밀 파일 반입 거부", run(["stage", dotfile], { expectFail: true }).code === 1);
  ok("note 없는 approve 거부", run(["approve", baselineId], { expectFail: true }).stderr.includes("--note"));

  console.log("[11] 대시보드: 읽기 전용, 원본 내용/비밀 미노출, CLI 명령 안내");
  run(["dashboard"]);
  const dashboard = fs.readFileSync(path.join(HOME, "public", "dashboard.html"), "utf-8");
  ok("대시보드 생성", dashboard.includes("update_center 로컬 검토 대시보드"));
  ok("CLI 명령 안내 포함(가짜 버튼 없음)", dashboard.includes("review_cli.cjs stage") && !dashboard.includes("<button"));
  ok("스냅샷/버전 이력 표시", dashboard.includes(baselineId) && dashboard.includes("v001"));
  ok("원본 레코드 내용 미포함", !dashboard.includes("노래클럽A") && !dashboard.includes("백령면"));
  ok("비밀 의심 문자열 미포함", !/sk-[A-Za-z0-9_-]{16,}/.test(dashboard));
  ok("로컬 파일 검토 MVP 임을 명시(외부 감시 주장 없음)", dashboard.includes("외부 원본 자동 감시 기능이 아니"));

  console.log("[12] 리뷰 1차 P1 회귀: manifest 메타데이터만 고쳐도 승인 불가 (내용 재검사)");
  const badAgain = writeInput("facility_bad2.csv", facilityCsv([
    'F001,업소A,유흥주점영업,"주소",99.9,300.1,transformed,영업/정상,https://example.go.kr/src,2026-09-06',
  ]));
  const badAgainRun = run(["stage", badAgain, "--label", "metadata-tamper-target"], { expectFail: true });
  const badAgainId = firstJson(badAgainRun.stdout).id;
  const manifestPath = path.join(HOME, "staging", badAgainId, "snapshot.json");
  fs.chmodSync(manifestPath, 0o666);
  const tamperedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  tamperedManifest.overall_status = "ok";
  for (const f of tamperedManifest.files) { f.status = "ok"; f.issues = []; }
  fs.writeFileSync(manifestPath, JSON.stringify(tamperedManifest, null, 2) + "\n", "utf-8");
  const metaTamperApprove = run(["approve", badAgainId, "--note", "메타데이터 위조 승인 시도"], { expectFail: true });
  ok("overall_status=ok 위조 후에도 approve 거부(내용 재검사)", metaTamperApprove.code === 1);
  ok("거부 사유가 재검사 결과임을 명시", metaTamperApprove.stderr.includes("재검사"));

  console.log("[13] 리뷰 1차 P1 회귀: 비정형/불완전 데이터의 generic 통과 차단");
  const nullJson = writeInput("null.json", "null");
  ok("null JSON 은 fail", firstJson(run(["stage", nullJson], { expectFail: true }).stdout).files[0].issues.some((i) => i.code === "json_not_record_data"));
  const scalarJson = writeInput("scalar.json", "7");
  ok("스칼라 JSON(7) 은 fail", firstJson(run(["stage", scalarJson], { expectFail: true }).stdout).overall_status === "fail");
  const emptyJson = writeInput("empty.json", "[]");
  ok("빈 배열은 fail(0건 위장 금지)", firstJson(run(["stage", emptyJson], { expectFail: true }).stdout).files[0].issues.some((i) => i.code === "json_zero_records"));
  const partialCsv = writeInput("partial.csv", "source_record_id,facility_name\na,x\n");
  const partialOut = firstJson(run(["stage", partialCsv], { expectFail: true }).stdout);
  ok("좌표 열 없는 시설 계열 CSV 는 fail(불완전 계약)", partialOut.files[0].issues.some((i) => i.code === "facility_missing_required_columns"));
  const malformedGeo = writeInput("malformed.geojson", '{"type":"FeatureCollection","features":[{}]}');
  ok("feature {} 인 GeoJSON 은 fail", firstJson(run(["stage", malformedGeo], { expectFail: true }).stdout).files[0].issues.some((i) => i.code === "geojson_invalid_feature"));
  const genericJson = writeInput("generic.json", JSON.stringify({ items: [{ foo: 1 }, { foo: 2 }] }));
  const genericRun = run(["stage", genericJson], { expectFail: true });
  const genericOut = firstJson(genericRun.stdout);
  ok("미인식 계약은 unsupported(검토 전용) + 비정상 종료", genericOut.overall_status === "unsupported" && genericRun.code === 2);
  const genericApprove = run(["approve", genericOut.id, "--note", "미지원 계약 승인 시도"], { expectFail: true });
  ok("unsupported 스냅샷 approve 거부", genericApprove.code === 1);

  console.log("[14] 리뷰 1차 P2 회귀: 실제 파이프라인 산출 계약 지원");
  const pipelineDesignation = writeInput("school_designations_shape.json", JSON.stringify({
    records: [{
      designation_id: "desig_x", school_name: "픽스처초등학교", school_level: "초등학교",
      designation_type: "연구학교", program_name: "AI·디지털 활용", school_year: 2026,
      period_status: "current", verification_status: "official_roster",
      match: { school_id: null, matching_status: "matched" },
      source: { url: "https://example.go.kr/src", published_date: "2025-12-30", retrieved_at: "2026-09-06" },
    }],
  }));
  const pipeDesig = firstJson(run(["stage", pipelineDesignation, "--label", "builder 산출 형태"]).stdout);
  ok("school_year+중첩 source.url 지정학교 JSON 이 ok", pipeDesig.overall_status === "ok" && pipeDesig.files[0].contract === "designation");
  const manifestFixture = writeInput("context_manifest_shape.json", JSON.stringify({
    data_as_of: "2026-09-06", generated_by: "scripts/build_context_layers.py",
    layers: { entertainment_establishments: { status: "unavailable", label_ko: "유흥시설" }, school_designations: { status: "available", record_count: 73 } },
  }));
  const pipeManifest = firstJson(run(["stage", manifestFixture]).stdout);
  ok("컨텍스트 manifest 계약 ok", pipeManifest.overall_status === "ok" && pipeManifest.files[0].contract === "context_manifest");
  const summaryGood = writeInput("summary_good.json", JSON.stringify({
    data_as_of: "2026-09-06",
    schools: {
      B000000001: {
        school_name: "픽스처초", gu: "연수구",
        nightlife: { status: "partial", observed_count: 1, total_count: null, records: [{ facility_id: "f1", distance_m: 434.3 }], within_m: 500 },
        construction: { status: "unknown", observed_count: null, total_count: null },
        designations: { status: "available", current: [], historical: [] },
      },
      B000000002: {
        school_name: "영건초", gu: "미추홀구",
        nightlife: { status: "partial", observed_count: 0, total_count: null, records: [] },
        parks_complete: { status: "available", observed_count: 3, total_count: 3 },
        designations: { status: "available", current: [{ designation_id: "d1" }], historical: [] },
      },
    },
  }));
  ok("v2 요약 계약 ok (partial 하한 0 관측·unknown null·available 전수·gu 문자열 허용)", firstJson(run(["stage", summaryGood]).stdout).overall_status === "ok");
  const summaryBad = writeInput("summary_bad_v2.json", JSON.stringify({
    data_as_of: "2026-09-06",
    schools: {
      S1: { school_name: "가초", zone: { status: "unknown", observed_count: 0, total_count: null } },
      S2: { school_name: "나초", zone: { status: "partial", observed_count: 2, total_count: 5 } },
      S3: { school_name: "다초", zone: { status: "partial", observed_count: "3", total_count: null } },
      S4: { school_name: "라초", zone: { status: "available", observed_count: 2, total_count: null } },
      S5: { school_name: "마초", zone: { status: "available", observed_count: 5, total_count: 3 } },
      S6: { school_name: "바초", zone: { status: "partial", observed_count: 2, total_count: null, records: [{ id: 1 }] } },
      S7: { school_name: "사초", zone: { status: "collecting", observed_count: 1, total_count: null } },
      S8: { school_name: "아초", designations: { status: "available", current: "not-array", historical: [] } },
    },
  }));
  const summaryBadOut = firstJson(run(["stage", summaryBad], { expectFail: true }).stdout);
  const badV2Codes = summaryBadOut.files[0].issues.map((i) => i.code);
  ok("unknown 인데 observed_count=0 은 fail(미수집 0건 위장)", badV2Codes.includes("summary_unknown_nonnull_counts"));
  ok("partial 인데 total_count 비-null 은 fail", badV2Codes.includes("summary_partial_nonnull_total"));
  ok("partial 의 문자열/비정수 observed_count fail", badV2Codes.includes("summary_partial_bad_observed"));
  ok("available 인데 total null·관측>전수 fail", badV2Codes.includes("summary_available_bad_counts"));
  ok("records 길이 ≠ observed_count fail", badV2Codes.includes("summary_records_count_mismatch"));
  ok("허용 enum 밖 status fail", badV2Codes.includes("summary_unsupported_status"));
  ok("designations current 비배열 fail", badV2Codes.includes("summary_designations_bad_arrays"));

  console.log("[14b] 실제 최종 컨텍스트 산출물(schema_version 2) 수용 확인");
  const realContextDir = path.join(PROJECT_ROOT, "data_processed", "context");
  if (fs.existsSync(path.join(realContextDir, "context_layers_manifest.json"))) {
    const realOut = firstJson(run(["stage", realContextDir, "--label", "실데이터 v2 회귀(테스트 격리 홈)"]).stdout);
    ok("실제 v2 컨텍스트 디렉터리 전체가 ok 로 통과", realOut.overall_status === "ok");
    ok("5개 파일(마니페스트·요약·지정학교·GeoJSON 2종) 반입", realOut.files.length === 5);
  } else {
    console.log("  SKIP data_processed/context 미존재 — 실데이터 회귀 생략");
  }

  console.log("[15] 리뷰 1차 P2 회귀: 손상 스냅샷으로 diff 보고서 생성 금지");
  const diffA = firstJson(run(["stage", writeInput("diff_a.csv", facilityCsv(['F001,업소,유흥주점영업,"주소",37.45,126.70,transformed,영업/정상,https://example.go.kr/src,2026-09-06'])), "--as", "diff_target.csv"]).stdout);
  const diffB = firstJson(run(["stage", writeInput("diff_b.csv", facilityCsv(['F001,업소,유흥주점영업,"주소",37.45,126.70,transformed,폐업,https://example.go.kr/src,2026-09-07'])), "--as", "diff_target.csv"]).stdout);
  const diffTamperFile = path.join(HOME, "staging", diffB.id, "files", "diff_target.csv");
  fs.chmodSync(diffTamperFile, 0o666);
  fs.appendFileSync(diffTamperFile, "tampered\n", "utf-8");
  const tamperedDiff = run(["diff", diffA.id, diffB.id], { expectFail: true });
  ok("변조된 candidate 로 diff 실패", tamperedDiff.code === 1 && tamperedDiff.stderr.includes("무결성"));
  ok("변조 상태에서 diff 보고서 미생성", !fs.existsSync(path.join(HOME, "reviews", `diff_${diffB.id}_vs_${diffA.id}.json`)));
  const extraFile = path.join(HOME, "staging", diffA.id, "files", "extra.csv");
  fs.writeFileSync(extraFile, "a,b\n1,2\n", "utf-8");
  const extraVerify = run(["verify", diffA.id], { expectFail: true });
  ok("manifest 밖 파일 추가도 무결성 위반으로 검출", extraVerify.code === 2 && extraVerify.stderr.includes("unexpected_extra_file"));

  console.log(`\n총 ${passed}개 검증 통과`);
}

try {
  main();
} catch (err) {
  console.error("FAIL:", err && err.message ? err.message : err);
  process.exitCode = 1;
} finally {
  try { fs.rmSync(INPUT_DIR, { recursive: true, force: true }); } catch { /* 정리 실패 무시 */ }
  try { fs.rmSync(HOME, { recursive: true, force: true }); } catch { /* 정리 실패 무시 */ }
  try { fs.rmSync(path.join(os.tmpdir(), "uc_outside.csv"), { force: true }); } catch { /* 정리 실패 무시 */ }
}
