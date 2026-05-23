const fs = require("node:fs");
const path = require("node:path");

const MODEL = process.env.AI_EXPLAINER_MODEL || "gpt-5.4-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.AI_EXPLAINER_MAX_OUTPUT_TOKENS || 900);
const MIN_RETRIEVAL_SCORE = Number(process.env.AI_EXPLAINER_V2_MIN_SCORE || 8);
const CHUNKS_PATH = path.join(__dirname, "ai_explainer_chunks.json");
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/2026-park-analysis\.vercel\.app$/,
  /^https:\/\/2026-park-analysis-[a-z0-9-]+-namijini0403s-projects\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
];

loadLocalEnvForDevelopment();

function loadLocalEnvForDevelopment() {
  if (process.env.OPENAI_API_KEY) return;
  const candidates = [
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", ".env"),
    path.join(__dirname, "..", "..", ".env.txt"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const raw = fs.readFileSync(filePath, "utf-8").trim();
    if (!raw) continue;
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith("OPENAI_API_KEY=")) {
        process.env.OPENAI_API_KEY = trimmed.slice("OPENAI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
      } else if (trimmed.startsWith("sk-")) {
        process.env.OPENAI_API_KEY = trimmed;
      } else if (trimmed.includes("=")) {
        const [key, ...rest] = trimmed.split("=");
        if (!process.env[key]) process.env[key] = rest.join("=").trim().replace(/^["']|["']$/g, "");
      }
    }
    if (process.env.OPENAI_API_KEY) return;
  }
}

function applyCors(req, res) {
  const origin = req.headers?.origin;
  if (!origin || origin === "null" || ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(req, res, statusCode, payload) {
  applyCors(req, res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function blocked(reason, statusCode = 200, mode = "blocked") {
  return {
    answerable: false,
    mode,
    summary: null,
    evidence: [],
    interpretation: null,
    limitations: [],
    policy_checklist: [],
    blocked_reason: reason || "현재 제공된 근거 문서와 선택 데이터만으로는 답변할 수 없습니다.",
  };
}

function loadChunks() {
  const parsed = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf-8"));
  return Array.isArray(parsed.chunks) ? parsed.chunks : [];
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#_-]/gu, " ");
}

function detectTopic(payload) {
  const questionType = String(payload.question_type || "").toLowerCase();
  const question = normalizeText(payload.question);
  if (questionType.includes("shap") || /shap|기여|예측근거/.test(question)) return "shap";
  if (questionType.includes("limitation")) return "limitation";
  if (questionType.includes("case") || /case|분류|즉시|우선|모니터링|유지/.test(question)) return "case";
  if (/한계|주의|비식별|실제 설치|설치 가능성|현장 조사|대체할 수|답하면 안|선택된 학교가 없어도|근거 문서|답변/.test(question)) {
    return "limitation";
  }
  if (questionType.includes("candidate") || /후보|추천|pareto|top5|가중치|필터/.test(question)) return "decision";
  if (/녹지|거리|놀이터|미래|수요|지표/.test(question)) return "metrics";
  return "glossary";
}

function topicForChunk(chunk) {
  const source = String(chunk.source || "");
  const id = String(chunk.id || "");
  if (source.includes("02_case_rules")) return "case";
  if (source.includes("03_metrics")) return "metrics";
  if (source.includes("04_decision_logic")) return "decision";
  if (source.includes("05_shap")) return "shap";
  if (source.includes("06_limitations") || id.includes("answer-guard") || id.includes("mode-split")) return "limitation";
  return "glossary";
}

function collectTerms(payload) {
  const question = normalizeText(payload.question);
  const terms = [payload.question];
  if (question.includes("봉인")) terms.push("봉인값");
  if (question.includes("검증")) terms.push("검증");
  if (question.includes("녹지면적")) terms.push("녹지면적");
  if (question.includes("설치") && question.includes("가능")) terms.push("설치가능성");
  if (question.includes("최종") && question.includes("정답")) terms.push("오해방지", "추천순위");
  if (question.includes("정책") && question.includes("가중치")) terms.push("정책가중치", "가중치");
  return normalizeText(terms.filter(Boolean).join(" "))
    .split(/\s+/)
    .filter((term) => term.length >= 2);
}

function scoreChunk(chunk, terms, desiredTopic) {
  const tags = Array.isArray(chunk.tags) ? chunk.tags : [];
  const haystack = normalizeText(`${chunk.id} ${chunk.title} ${tags.join(" ")} ${chunk.body}`);
  let score = topicForChunk(chunk) === desiredTopic ? 14 : 0;

  for (const term of terms) {
    if (!term) continue;
    if (haystack.includes(term)) score += 2;
    if (tags.some((tag) => normalizeText(tag).includes(term))) score += 3;
    if (normalizeText(chunk.id).includes(term)) score += 4;
  }

  return score;
}

function selectChunks(payload, chunks) {
  const desiredTopic = detectTopic(payload);
  const terms = collectTerms(payload);
  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms, desiredTopic) }))
    .filter((item) => item.score >= MIN_RETRIEVAL_SCORE)
    .sort((left, right) => right.score - left.score);

  const hasDesiredTopic = ranked.some((item) => topicForChunk(item.chunk) === desiredTopic);
  if (!hasDesiredTopic) return [];

  return ranked.slice(0, 5).map((item) => item.chunk);
}

function hasSelectedSchoolContext(payload) {
  const school = payload.school_context || {};
  return Boolean(school.school_id || school.school_name && !String(school.school_name).includes("전체"));
}

function hasSelectedCandidateContext(payload) {
  const candidate = payload.candidate_context || {};
  return Boolean(candidate.grid_id);
}

function hasRequiredContext(payload) {
  const questionType = String(payload.question_type || "").toLowerCase();
  const question = normalizeText(payload.question);
  if (questionType.includes("candidate_explanation") || /이 후보지|선택 후보지|선택한 후보지|해당 후보지/.test(question)) {
    return hasSelectedCandidateContext(payload);
  }
  if (
    questionType.includes("case_reason") ||
    questionType.includes("school_explanation") ||
    (/이 학교|선택된 학교|해당 학교/.test(question) && !/없어도|없이/.test(question))
  ) {
    return hasSelectedSchoolContext(payload);
  }
  return true;
}

function containsIdentifyingQuestion(payload) {
  const question = normalizeText(payload.question);
  return /학교명|후보지|공원명|좌표|거리|수혜|실명|어디|몇 m|몇명/.test(question);
}

function containsPolicyCommitmentQuestion(payload) {
  const question = normalizeText(payload.question);
  return /무조건|반드시|최종 확정|예산.*배정|지원해야|설치해야/.test(question);
}

function answerabilityGate(payload, selectedChunks) {
  if (!selectedChunks.length) return blocked("관련 근거 chunk가 충분하지 않아 답변하지 않습니다.");
  if (payload.mode === "public_anonymous_explainer" && containsIdentifyingQuestion(payload)) {
    return blocked("비식별 공개 모드에서는 학교명, 후보지 코드, 공원명, 좌표, 거리값, 수혜인원 값을 답변하지 않습니다.");
  }
  if (containsPolicyCommitmentQuestion(payload)) {
    return blocked("이 패널은 새 정책 판단, 예산 배정, 설치 확정을 생성하지 않고 앱에 산출된 지표와 문서화된 기준만 설명합니다.");
  }
  if (payload.mode !== "identified_school_explainer" && payload.mode !== "public_anonymous_explainer") {
    return blocked("지원하지 않는 AI 해설 모드입니다.", 400);
  }
  if (!hasRequiredContext(payload)) {
    return blocked("선택된 학교 또는 후보지 context가 없어 개별 해설을 제공하지 않습니다.");
  }
  return null;
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "answerable",
      "mode",
      "summary",
      "evidence",
      "interpretation",
      "limitations",
      "policy_checklist",
      "blocked_reason",
    ],
    properties: {
      answerable: { type: "boolean" },
      mode: {
        type: "string",
        enum: ["school_explanation", "candidate_explanation", "concept_explanation", "blocked"],
      },
      summary: { type: ["string", "null"] },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "source_chunk_id"],
          properties: {
            claim: { type: "string" },
            source_chunk_id: { type: "string" },
          },
        },
      },
      interpretation: { type: ["string", "null"] },
      limitations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "source_chunk_id"],
          properties: {
            text: { type: "string" },
            source_chunk_id: { type: "string" },
          },
        },
      },
      policy_checklist: {
        type: "array",
        items: { type: "string" },
      },
      blocked_reason: { type: ["string", "null"] },
    },
  };
}

function buildInput(payload, chunks) {
  const evidencePack = chunks.map((chunk) => ({
    chunk_id: chunk.id,
    title: chunk.title,
    tags: chunk.tags,
    body: chunk.body,
  }));

  return [
    {
      role: "system",
      content:
        "너는 인천 초등학교 야외활동 환경 격차 분석 앱의 RAG-lite 해설 패널이다. " +
        "최종안 기준 문서와 selected_context 안에서만 답한다. 문서에 없는 내부 구현 추정은 말하지 않는다. " +
        "새 정책 판단, 신규 추천, 법적 판단, 예산 산정, 데이터 밖 추론을 하지 않는다. " +
        "answerable=true라면 모든 evidence.claim과 limitations.text에 RETRIEVED_CHUNKS 안의 source_chunk_id를 붙인다. " +
        "근거가 부족하거나 선택 context가 부족하면 answerable=false, mode=blocked로 답한다.",
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          question: payload.question,
          question_type: payload.question_type,
          selected_context: {
            school_context: payload.school_context || null,
            candidate_context: payload.candidate_context || null,
          },
          retrieved_chunks: evidencePack,
        },
        null,
        2,
      ),
    },
  ];
}

function extractText(data) {
  if (typeof data.output_text === "string") return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
      if (typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function validateAnswer(answer, selectedChunks) {
  const allowed = new Set(selectedChunks.map((chunk) => chunk.id));
  if (!answer || typeof answer !== "object") return blocked();
  if (answer.answerable !== true) return blocked(answer.blocked_reason, 200, "blocked");
  if (!Array.isArray(answer.evidence) || answer.evidence.length === 0) return blocked("근거가 없는 답변은 표시하지 않습니다.");

  const ids = [];
  for (const item of answer.evidence) ids.push(item?.source_chunk_id);
  for (const item of answer.limitations || []) ids.push(item?.source_chunk_id);
  for (const id of ids.filter(Boolean)) {
    if (!allowed.has(id)) return blocked("검색되지 않은 근거 chunk를 인용해 답변을 차단했습니다.");
  }

  return answer;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return json(req, res, 200, {});
  if (req.method !== "POST") return json(req, res, 405, blocked("POST 요청만 지원합니다.", 405));

  if (process.env.AI_EXPLAINER_ENABLED === "false") {
    return json(req, res, 503, blocked("AI 해설 패널이 현재 비활성화되어 있습니다.", 503));
  }
  if (!process.env.OPENAI_API_KEY) {
    return json(req, res, 503, blocked("서버에 OpenAI API 키가 설정되어 있지 않습니다.", 503));
  }

  try {
    const payload = await readBody(req);
    const question = String(payload.question || "").trim();
    if (!question || question.length > 220) {
      return json(req, res, 400, blocked("질문은 1자 이상 220자 이하로 입력해야 합니다.", 400));
    }

    const chunks = loadChunks();
    const selectedChunks = selectChunks(payload, chunks);
    const gateResult = answerabilityGate(payload, selectedChunks);
    if (gateResult) return json(req, res, gateResult.blocked_reason === "지원하지 않는 AI 해설 모드입니다." ? 400 : 200, gateResult);

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildInput(payload, selectedChunks),
        store: false,
        temperature: 0,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "none" },
        tools: [],
        tool_choice: "none",
        parallel_tool_calls: false,
        text: {
          format: {
            type: "json_schema",
            name: "ai_explainer_v2_response",
            strict: true,
            schema: buildSchema(),
          },
        },
      }),
    });

    if (!openaiResponse.ok) {
      return json(req, res, 200, blocked("AI 해설을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    }

    const data = await openaiResponse.json();
    const parsed = JSON.parse(extractText(data));
    return json(req, res, 200, validateAnswer(parsed, selectedChunks));
  } catch {
    return json(req, res, 200, blocked("AI 해설을 안전하게 생성하지 못했습니다."));
  }
};
