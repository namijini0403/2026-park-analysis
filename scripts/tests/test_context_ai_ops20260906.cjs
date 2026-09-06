"use strict";

// AI 해설 v2 + schema v2 컨텍스트 근거 통합 테스트 (2026-09-06, 키 독립)
// 실행: node scripts/tests/test_context_ai_ops20260906.cjs
// 실제 OpenAI 호출 없음: 키 없는 폴백 경로와 mock fetch 경로만 사용한다. .env 는 읽지 않는다.
// 수치 기대값은 이 워크트리의 data_processed/context/school_context_summary.json 에서
// 직접 읽어 비교한다(빌드 재실행으로 관측치가 바뀌어도 테스트 의미가 유지되도록).

const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");

// require 시점 .env 자동 로딩 차단(더미 키) → require 후 삭제(키 없는 폴백 경로 확정)
process.env.OPENAI_API_KEY = "sk-test-neutralized-not-a-real-key";
const handler = require(path.join(__dirname, "..", "..", "api", "ai-explainer-v2.js"));
const contextEvidence = require(path.join(__dirname, "..", "..", "api", "_context_evidence.js"));
delete process.env.OPENAI_API_KEY;

// 심층 방어: 이 테스트 프로세스에서 외부 fetch 가 발생하면 즉시 실패
const realFetch = globalThis.fetch;
let externalFetchAttempts = 0;
globalThis.fetch = async () => { externalFetchAttempts += 1; throw new Error("test: outbound fetch blocked"); };

// 이 워크트리의 실제 산출물에서 기대 수치를 읽는다 (AI_CONTEXT_DIR 로 덮어쓸 수 있음)
const CONTEXT_DIR = process.env.AI_CONTEXT_DIR || path.join(__dirname, "..", "..", "data_processed", "context");
const SUMMARY = JSON.parse(fs.readFileSync(path.join(CONTEXT_DIR, "school_context_summary.json"), "utf8"));
function schoolNode(schoolId) {
  const node = SUMMARY.schools[schoolId];
  assert.ok(node, `school_context_summary.json 에 ${schoolId} 없음`);
  return node;
}

let passed = 0;
function ok(name, condition) {
  assert.ok(condition, name);
  passed += 1;
  console.log(`  PASS ${name}`);
}

function createReq(payload) {
  const req = Readable.from([JSON.stringify(payload)]);
  req.method = "POST";
  req.headers = { origin: "http://localhost:5173" };
  return req;
}

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: "",
    writableEnded: false,
    setHeader(key, value) { this.headers[key] = value; },
    end(chunk) { this.body = String(chunk ?? ""); this.writableEnded = true; },
  };
  return res;
}

async function ask(payload) {
  const res = createRes();
  await handler(createReq(payload), res);
  return { status: res.statusCode, json: JSON.parse(res.body) };
}

const identified = (question, school_context) => ({
  mode: "identified_school_explainer",
  question_type: "case_reason",
  question,
  school_context,
});

async function main() {
  console.log("[1] 키 없는 폴백: 지정학교 질문 (실데이터 인천운서초 B000002953, 2026 AI중점 유형3)");
  const desig = await ask(identified(
    "이 학교가 AI중점학교로 지정되어 있나요?",
    { school_id: "B000002953", school_name: "인천운서초등학교" },
  ));
  ok("HTTP 200 + answerable=true", desig.status === 200 && desig.json.answerable === true);
  ok("컨텍스트 chunk 인용", desig.json.evidence.some((e) => e.source_chunk_id === "context_v2#school-B000002953"));
  const desigText = JSON.stringify(desig.json);
  ok("실제 지정 사실(유형3·2026학년도) 포함", desigText.includes("유형3") && desigText.includes("2026학년도"));
  ok("미지정 확정 아님/지원금 미상 주의 문구 유지", desigText.includes("지원금") || desigText.includes("미수집") || desigText.includes("확정"));

  const nightNode = schoolNode("B000002950").nightlife;
  const nightCount = nightNode.observed_count;
  const nightNearest = Math.round(nightNode.nearest_observed_m);
  console.log(`[2] 키 없는 폴백: 유흥 관측 질문 (인천신광초 B000002950, 관측 ${nightCount}건·최근접 ${nightNearest}m)`);
  const night = await ask(identified(
    "이 학교 주변 유흥주점 인허가 관측이 있나요?",
    { school_id: "B000002950", school_name: "인천신광초등학교" },
  ));
  ok(`answerable=true + 관측 ${nightCount}건 하한 표현`, night.json.answerable === true && JSON.stringify(night.json).includes(`최소 관측 ${nightCount}건`));
  ok("전수 아님(부분 커버리지) 명시", JSON.stringify(night.json).includes("전수 아님"));
  ok("최근접 관측 거리 포함", JSON.stringify(night.json).includes(String(nightNearest)));

  console.log("[3] 키 없는 폴백: 연수구 밖 공사장 질문 → unknown 을 0건으로 위장하지 않음 (인천신흥초 B000002949)");
  ok("대상 학교의 공사 레이어가 실제로 unknown", schoolNode("B000002949").construction.status === "unknown");
  const constr = await ask(identified(
    "학교 주변에 공사장이 있나요?",
    { school_id: "B000002949", school_name: "인천신흥초등학교" },
  ));
  ok("answerable=true + 미수집 명시", constr.json.answerable === true && JSON.stringify(constr.json).includes("미수집"));
  ok("'0건 확정 아님' 취지 포함", JSON.stringify(constr.json).includes("0건 확정이 아니라 미상"));
  ok("착공신고≠진행중 주의 문구", JSON.stringify(constr.json).includes("진행 여부"));

  console.log("[4] 미일치·모호 학교는 임의 해석 금지");
  const nomatch = await ask(identified("이 학교 주변 유흥주점 현황은?", { school_name: "존재하지않는초등학교" }));
  ok("미일치 학교는 answerable=false", nomatch.json.answerable === false);
  const ambigDir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx_ambig_"));
  fs.writeFileSync(path.join(ambigDir, "context_layers_manifest.json"), JSON.stringify({ data_as_of: "2026-09-06", schema_version: 2, layers: {} }));
  fs.writeFileSync(path.join(ambigDir, "school_context_summary.json"), JSON.stringify({
    data_as_of: "2026-09-06",
    schools: {
      A1: { school_name: "동명초등학교", nightlife: { status: "partial", observed_count: 1, total_count: null } },
      A2: { school_name: "동명초등학교", nightlife: { status: "partial", observed_count: 9, total_count: null } },
    },
  }));
  ok("동명 학교 이름 해석은 null(모호)", contextEvidence.resolveSchool({ school_name: "동명초등학교" }, ambigDir) === null);
  ok("id 지정 시에는 정확 해석", contextEvidence.resolveSchool({ school_id: "A2" }, ambigDir)?.school?.nightlife?.observed_count === 9);
  fs.rmSync(ambigDir, { recursive: true, force: true });

  console.log("[5] 클라이언트 수치 스푸핑 무시 (서버 로컬 데이터만 권위)");
  const spoof = await ask(identified(
    "이 학교 주변 유흥주점 관측 수는?",
    { school_id: "B000002950", school_name: "인천신광초등학교", nightlife_count: 999, observed_count: 999, designations: ["가짜 특별지원 지정"] },
  ));
  const spoofText = JSON.stringify(spoof.json);
  ok("스푸핑된 999 미반영", !spoofText.includes("999"));
  ok(`서버 관측치 ${nightCount}건 사용`, spoofText.includes(`최소 관측 ${nightCount}건`));
  ok("가짜 지정 문자열 미반영", !spoofText.includes("가짜 특별지원"));

  console.log("[6] 기존 동작 보존 (컨텍스트 주제 아님)");
  const caseQ = await ask(identified("Case 1부터 Case 4까지 전체 분류 기준을 알려줘", { school_id: "B000002950", school_name: "인천신광초등학교" }));
  ok("Case 전체기준 결정론 답변 유지", caseQ.json.answerable === true && caseQ.json.evidence.some((e) => e.source_chunk_id.startsWith("02_case_rules")));
  ok("컨텍스트 chunk 는 케이스 질문에 미주입", !caseQ.json.evidence.some((e) => e.source_chunk_id.startsWith("context_v2")));
  const offDomain = await ask(identified("오늘 저녁 메뉴 추천해줘", { school_id: "B000002950" }));
  ok("오프도메인 차단 유지", offDomain.json.answerable === false);

  console.log("[7] 비식별 공개 모드에는 학교별 컨텍스트 수치 미주입");
  const anon = await ask({
    mode: "public_anonymous_explainer",
    question_type: "concept",
    question: "학교 주변 유흥주점 자료는 어떻게 수집되나요?",
    school_context: { school_id: "B000002950" },
  });
  ok("공개 모드 응답에 context_v2 인용 없음", !(anon.json.evidence || []).some((e) => String(e.source_chunk_id).startsWith("context_v2")));

  console.log("[8] mock OpenAI: buildInput 이 동일한 컨텍스트 근거를 전달하고 인용 검증 통과");
  process.env.OPENAI_API_KEY = "mock-key-for-capture-only";
  let openAiCalls = 0;
  let capturedUrl = null;
  let capturedPayload = null;
  globalThis.fetch = async (url, options = {}) => {
    openAiCalls += 1;
    capturedUrl = String(url);
    capturedPayload = JSON.parse(options.body || "{}");
    const userPayload = JSON.parse(capturedPayload.input.find((i) => i.role === "user").content);
    const chunkId = userPayload.retrieved_chunks[0].chunk_id;
    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            answerable: true,
            mode: "school_explanation",
            summary: "mock 응답",
            evidence: [{ claim: "컨텍스트 근거 인용", source_chunk_id: chunkId }],
            interpretation: null,
            limitations: [],
            policy_checklist: [],
            blocked_reason: null,
          }),
        };
      },
    };
  };
  const mocked = await ask(identified(
    "이 학교의 연구학교·선도학교 지정 현황과 주변 유흥주점 관측을 알려줘",
    { school_id: "B000002953", school_name: "인천운서초등학교" },
  ));
  ok("mock fetch 1회, 대상은 OpenAI 엔드포인트(실호출 아님)", openAiCalls === 1 && capturedUrl.includes("api.openai.com"));
  const sentUser = JSON.parse(capturedPayload.input.find((i) => i.role === "user").content);
  ok("프롬프트 retrieved_chunks 최상단이 컨텍스트 chunk", sentUser.retrieved_chunks[0].chunk_id === "context_v2#school-B000002953");
  const sentBody = sentUser.retrieved_chunks[0].body;
  ok("프롬프트에 실제 지정(유형3)·출처 URL 포함", sentBody.includes("유형3") && sentBody.includes("ice.go.kr"));
  ok("프롬프트에 커버리지·날짜 주의 포함", sentBody.includes("하한 관측치") && sentBody.includes("2026-09-06"));
  ok("프롬프트가 컴팩트(개별 1,222쌍 미덤프, 4096자 미만)", sentBody.length < 4096);
  ok("원자료 기준일과 산출일 구분", sentBody.includes("원자료 시점은 출처별 상이") && sentBody.includes("2026-03-09") && sentBody.includes("2026-06-30") && sentBody.includes("파일 전체 기준일은 미확인"));
  ok("튜터 과거 명단 출처도 누락되지 않음", sentBody.includes("nttSn=3320903"));
  ok("서버 근거 우선 지시 포함", capturedPayload.input.find((i) => i.role === "system").content.includes("클라이언트 school_context의 상충하는 시설 수나 지정 주장은 사용하지 않는다"));
  ok("모델 응답의 컨텍스트 인용이 검증 통과", mocked.json.answerable === true && mocked.json.evidence[0].source_chunk_id === "context_v2#school-B000002953");
  delete process.env.OPENAI_API_KEY;

  ok("띄어쓴 특별 지원 질문 인식", contextEvidence.isContextTopicQuestion("이 학교는 특별 지원을 받나요?"));
  ok("띄어쓴 연구 학교 질문 인식", contextEvidence.isContextTopicQuestion("연구 학교인가요?"));
  ok("건축행정 기록 질문 인식", contextEvidence.isContextTopicQuestion("주변 건축행정 기록을 알려줘"));
  globalThis.fetch = realFetch;
  ok("테스트 전 구간 외부 fetch 시도 0회(폴백 경로)", externalFetchAttempts === 0);
  console.log(`\n총 ${passed}개 검증 통과`);
}

main().catch((err) => {
  console.error("FAIL:", err && err.message ? err.message : err);
  process.exit(1);
});
