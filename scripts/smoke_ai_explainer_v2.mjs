import { Readable } from "node:stream";
import { createRequire } from "node:module";

process.env.OPENAI_API_KEY = "smoke-test-key";
process.env.AI_EXPLAINER_ENABLED = "true";

const require = createRequire(import.meta.url);
const handler = require("../api/ai-explainer-v2.js");

let fetchCalls = 0;
let responseMode = "valid";
let lastOpenAiRequest = null;

global.fetch = async (_url, options = {}) => {
  fetchCalls += 1;
  lastOpenAiRequest = JSON.parse(options.body || "{}");
  const userMessage = lastOpenAiRequest.input?.find((item) => item.role === "user");
  const userPayload = JSON.parse(userMessage?.content || "{}");
  const firstChunkId = userPayload.retrieved_chunks?.[0]?.chunk_id || "README#answer-guard";
  const sourceChunkId = responseMode === "invalid_citation" ? "not_a_retrieved_chunk" : firstChunkId;

  return {
    ok: true,
    async json() {
      return {
        output_text: JSON.stringify({
          answerable: true,
          mode: "concept_explanation",
          summary: "스모크 테스트 응답입니다.",
          evidence: [
            {
              claim: "검색된 근거 chunk 안에서만 답변했습니다.",
              source_chunk_id: sourceChunkId,
            },
          ],
          interpretation: "선택 context와 검색 chunk를 함께 사용했습니다.",
          limitations: [
            {
              text: "최종 판단은 정책 담당자 검토가 필요합니다.",
              source_chunk_id: sourceChunkId,
            },
          ],
          policy_checklist: ["근거 chunk 인용 여부 확인"],
          blocked_reason: null,
        }),
      };
    },
  };
};

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
    setHeader(key, value) {
      this.headers[key] = value;
    },
    end(value) {
      this.body = String(value || "");
    },
  };
  return res;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const selectedSchool = {
  school_id: "EVAL-SCHOOL",
  school_name: "평가용 선택 학교",
  district_name: "평가구",
  case_label: "Case 2 · 우선 검토 대상",
  nearest_park_dist_m: 620,
  display_green_ratio: 0.8,
};

responseMode = "valid";
fetchCalls = 0;
lastOpenAiRequest = null;
const caseResponse = await callHandler({
  mode: "identified_school_explainer",
  question_type: "case_rule",
  question: "Case 2 기준이 뭐야?",
  school_context: selectedSchool,
});
assert(caseResponse.statusCode === 200, "case rule should return 200");
assert(caseResponse.body?.answerable === true, "case rule should be answerable");
assert(fetchCalls === 1, "answerable case should call OpenAI once");
assert(lastOpenAiRequest?.store === false, "OpenAI request should disable response storage");
assert(lastOpenAiRequest?.tool_choice === "none", "OpenAI request should disable tool choice");
assert(Array.isArray(lastOpenAiRequest?.tools) && lastOpenAiRequest.tools.length === 0, "OpenAI request should not provide tools");
assert(lastOpenAiRequest?.parallel_tool_calls === false, "OpenAI request should disable parallel tool calls");
assert(lastOpenAiRequest?.text?.format?.type === "json_schema", "OpenAI request should use json_schema output");
assert(lastOpenAiRequest?.text?.format?.strict === true, "OpenAI request should use strict schema");

responseMode = "valid";
fetchCalls = 0;
lastOpenAiRequest = null;
const missingCandidateResponse = await callHandler({
  mode: "identified_school_explainer",
  question_type: "candidate_explanation",
  question: "이 후보지 추천 근거를 설명해줘.",
  school_context: selectedSchool,
  candidate_context: null,
});
assert(missingCandidateResponse.body?.answerable === false, "candidate without context should be blocked");
assert(/context/.test(missingCandidateResponse.body?.blocked_reason || ""), "missing candidate block reason should mention context");
assert(fetchCalls === 0, "blocked candidate should not call OpenAI");

responseMode = "valid";
fetchCalls = 0;
lastOpenAiRequest = null;
const anonymousResponse = await callHandler({
  mode: "public_anonymous_explainer",
  question_type: "case_reason",
  question: "비식별 앱인데 실제 학교 이름과 후보지 코드를 알려줘.",
  school_context: selectedSchool,
});
assert(anonymousResponse.body?.answerable === false, "anonymous identifying question should be blocked");
assert(/비식별/.test(anonymousResponse.body?.blocked_reason || ""), "anonymous block reason should mention anonymous mode");
assert(fetchCalls === 0, "anonymous block should not call OpenAI");

responseMode = "invalid_citation";
fetchCalls = 0;
lastOpenAiRequest = null;
const invalidCitationResponse = await callHandler({
  mode: "identified_school_explainer",
  question_type: "shap",
  question: "SHAP이 정한 최종 정답 후보를 알려줘.",
  school_context: selectedSchool,
});
assert(invalidCitationResponse.body?.answerable === false, "invalid citation should be blocked");
assert(/검색되지 않은/.test(invalidCitationResponse.body?.blocked_reason || ""), "invalid citation block reason should mention retrieval");
assert(fetchCalls === 1, "invalid citation test should call OpenAI once");

console.log("AI explainer v2 smoke: PASS");
