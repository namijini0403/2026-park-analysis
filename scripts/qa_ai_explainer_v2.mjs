import { Readable } from "node:stream";
import { createRequire } from "node:module";

const liveMode = process.argv.includes("--live") || process.env.AI_EXPLAINER_LIVE === "1";
const require = createRequire(import.meta.url);

if (!liveMode) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || "qa-mock-key";
}
process.env.AI_EXPLAINER_ENABLED = "true";

const handler = require("../api/ai-explainer-v2.js");

const selectedSchool = {
  context_scope: "selected_school",
  school_id: "EVAL-SCHOOL",
  school_name: "평가용 선택 학교",
  district_name: "평가구",
  case_type: "case2",
  case_label: "Case 2 · 우선 검토 대상",
  case_status_label: "우선 검토 대상",
  nearest_park_dist_m: 620,
  iso_green_ratio: 0.8,
  display_green_ratio: 0.8,
  iso_playground_count: 1,
};

const qaCases = [
  {
    id: "manual-case-overview",
    question_type: "case_rule",
    question: "Case 1부터 Case 4까지 분류 기준을 설명해줘",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#case-overview"],
    expected_summary_pattern: /Case 1.*Case 2.*Case 3.*Case 4/,
  },
  {
    id: "manual-case2",
    question_type: "case_rule",
    question: "Case 2 기준이 뭐야?",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#case2"],
  },
  {
    id: "manual-case1-distance-check",
    question_type: "case_rule",
    question: "도보 500m 안에 공원이 없으면 녹지비율도 0%일 텐데, 왜 Case 1에 최근접 공원거리 500m 조건을 또 붙여?",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#case1-distance-check"],
  },
  {
    id: "manual-boundary-5",
    question_type: "case_rule",
    question: "녹지비율 5%면 Case4야?",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#case3", "02_case_rules#case4"],
  },
  {
    id: "manual-sealed-value",
    question_type: "case_rule",
    question: "봉인값이면 녹지면적도 검증된 거야?",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#sealed-values"],
  },
  {
    id: "manual-island-bundle",
    question_type: "case_rule",
    question: "강화·옹진은 왜 본류 Case에서 빠져?",
    expected: "answerable",
    expected_chunk_ids: ["02_case_rules#special-bundle"],
  },
  {
    id: "manual-policy-block",
    question_type: "policy_check",
    question: "이 학교는 무조건 예산을 배정해야 하지?",
    expected: "blocked",
    expected_block_pattern: /정책 판단|예산 배정|설치 확정/,
  },
];

const expectedByQuestion = new Map(qaCases.map((item) => [item.question, item]));
const realFetch = global.fetch;

if (!liveMode) {
  global.fetch = async (_url, options = {}) => {
    const body = JSON.parse(options.body || "{}");
    const userMessage = body.input?.find((item) => item.role === "user");
    const userPayload = JSON.parse(userMessage?.content || "{}");
    const qaCase = expectedByQuestion.get(userPayload.question) || {};
    const retrieved = userPayload.retrieved_chunks || [];
    const targetChunkId =
      (qaCase.expected_chunk_ids || []).find((id) => retrieved.some((chunk) => chunk.chunk_id === id)) ||
      retrieved[0]?.chunk_id ||
      "README#answer-guard";

    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            answerable: true,
            mode: "concept_explanation",
            summary: `${userPayload.question}에 대한 QA mock 응답입니다.`,
            evidence: [
              {
                claim: "검색된 근거 chunk를 사용했습니다.",
                source_chunk_id: targetChunkId,
              },
            ],
            interpretation: "실제 문장은 --live 모드에서 확인합니다.",
            limitations: [
              {
                text: "mock 모드는 schema, gate, citation 연결만 검증합니다.",
                source_chunk_id: targetChunkId,
              },
            ],
            policy_checklist: ["source_chunk_id가 검색 결과 안에 있는지 확인"],
            blocked_reason: null,
          }),
        };
      },
    };
  };
}

function createReq(payload) {
  const req = Readable.from([JSON.stringify(payload)]);
  req.method = "POST";
  req.headers = { origin: "http://localhost:5173" };
  return req;
}

function createRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value) {
      this.body = String(value || "");
    },
  };
}

async function callHandler(payload) {
  const req = createReq(payload);
  const res = createRes();
  await handler(req, res);
  return {
    statusCode: res.statusCode,
    body: res.body ? JSON.parse(res.body) : null,
  };
}

function collectSourceIds(answer) {
  const ids = [];
  for (const item of answer?.evidence || []) ids.push(item?.source_chunk_id);
  for (const item of answer?.limitations || []) ids.push(item?.source_chunk_id);
  return ids.filter(Boolean);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const results = [];

for (const qaCase of qaCases) {
  const response = await callHandler({
    mode: "identified_school_explainer",
    question_type: qaCase.question_type,
    question: qaCase.question,
    school_context: selectedSchool,
    candidate_context: null,
  });
  const answer = response.body;
  const actual = answer?.answerable === true ? "answerable" : "blocked";
  const sourceIds = collectSourceIds(answer);

  assert(response.statusCode === 200, `${qaCase.id}: expected HTTP 200, got ${response.statusCode}`);
  assert(actual === qaCase.expected, `${qaCase.id}: expected ${qaCase.expected}, got ${actual}`);

  if (qaCase.expected === "answerable") {
    assert(sourceIds.length > 0, `${qaCase.id}: answerable response must cite source_chunk_id`);
    assert(
      qaCase.expected_chunk_ids.some((id) => sourceIds.includes(id)),
      `${qaCase.id}: expected one of [${qaCase.expected_chunk_ids.join(", ")}], got [${sourceIds.join(", ")}]`,
    );
    if (qaCase.expected_summary_pattern) {
      assert(
        qaCase.expected_summary_pattern.test(answer?.summary || ""),
        `${qaCase.id}: summary did not match ${qaCase.expected_summary_pattern}`,
      );
    }
  } else if (qaCase.expected_block_pattern) {
    assert(
      qaCase.expected_block_pattern.test(answer?.blocked_reason || ""),
      `${qaCase.id}: blocked_reason did not match ${qaCase.expected_block_pattern}`,
    );
  }

  results.push({
    id: qaCase.id,
    actual,
    sourceIds,
    summary: answer?.summary,
    blocked_reason: answer?.blocked_reason,
  });
}

if (!liveMode) global.fetch = realFetch;

console.log(`AI explainer v2 manual QA: PASS (${liveMode ? "live" : "mock"})`);
for (const result of results) {
  const sourceText = result.sourceIds.length ? ` sources=${result.sourceIds.join(",")}` : "";
  const blockText = result.blocked_reason ? ` blocked="${result.blocked_reason}"` : "";
  console.log(`- ${result.id}: ${result.actual}${sourceText}${blockText}`);
}
