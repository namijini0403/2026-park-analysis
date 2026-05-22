const fs = require("node:fs");
const path = require("node:path");

const MODEL = process.env.AI_EXPLAINER_MODEL || "gpt-5.4-mini";
const MAX_OUTPUT_TOKENS = Number(process.env.AI_EXPLAINER_MAX_OUTPUT_TOKENS || 700);
const CHUNKS_PATH = path.join(__dirname, "ai_explainer_chunks.json");

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

function json(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function safeFailure(reason, statusCode = 200) {
  return {
    answerable: false,
    summary: null,
    evidence: [],
    interpretation: null,
    limitations: null,
    cannot_answer_reason: reason || "제공된 근거 문서 안에서 확인할 수 없습니다.",
    cited_chunk_ids: [],
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

function collectTerms(payload) {
  const terms = [
    payload.question,
    payload.question_type,
    payload.school_context?.case_label,
    payload.school_context?.case_status_label,
    payload.school_context?.school_name,
    payload.candidate_context?.grid_id,
    payload.candidate_context?.recommendation_type,
    payload.candidate_context?.shap_diagnostic_tag,
  ];

  const questionType = String(payload.question_type || "");
  if (questionType.includes("case")) terms.push("case", "분류", "최근접", "녹지", "공원");
  if (questionType.includes("candidate")) terms.push("후보지", "추천", "Pareto", "Top5", "가중치");
  if (questionType.includes("shap")) terms.push("SHAP", "설명가능성", "미래수요", "후보진단");
  if (questionType.includes("limitation")) terms.push("한계", "주의", "현장검토", "공공데이터");
  if (questionType.includes("policy")) terms.push("HITL", "정책담당자", "현장검토");

  return normalizeText(terms.filter(Boolean).join(" "))
    .split(/\s+/)
    .filter((term) => term.length >= 2);
}

function scoreChunk(chunk, terms) {
  const haystack = normalizeText(`${chunk.id} ${chunk.title} ${(chunk.tags || []).join(" ")} ${chunk.body}`);
  let score = 0;
  for (const term of terms) {
    if (!term) continue;
    if (haystack.includes(term)) score += 2;
    if ((chunk.tags || []).some((tag) => normalizeText(tag).includes(term))) score += 3;
    if (normalizeText(chunk.id).includes(term)) score += 4;
  }
  return score;
}

function selectChunks(payload, chunks) {
  const terms = collectTerms(payload);
  const fallbackIds = [
    "README#answer-guard",
    "02_case_rules#case1",
    "03_metrics#nearest-park-distance",
    "04_decision_logic#stability",
    "05_shap_explanation#role",
    "06_limitations#field-review",
  ];
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms) }))
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.score > 0)
    .map((item) => item.chunk);

  const selected = [];
  for (const chunk of ranked) {
    if (!selected.some((item) => item.id === chunk.id)) selected.push(chunk);
    if (selected.length >= 6) break;
  }
  for (const id of fallbackIds) {
    const chunk = byId.get(id);
    if (chunk && !selected.some((item) => item.id === id)) selected.push(chunk);
    if (selected.length >= 3) break;
  }
  return selected.slice(0, 6);
}

function buildSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "answerable",
      "summary",
      "evidence",
      "interpretation",
      "limitations",
      "cannot_answer_reason",
      "cited_chunk_ids",
    ],
    properties: {
      answerable: { type: "boolean" },
      summary: { type: ["string", "null"] },
      evidence: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value", "chunk_id"],
          properties: {
            label: { type: "string" },
            value: { type: "string" },
            chunk_id: { type: "string" },
          },
        },
      },
      interpretation: { type: ["string", "null"] },
      limitations: { type: ["string", "null"] },
      cannot_answer_reason: { type: ["string", "null"] },
      cited_chunk_ids: {
        type: "array",
        items: { type: "string" },
      },
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
        "너는 인천 초등학교 야외활동 환경 격차 분석 앱의 근거 기반 AI 해설 패널이다. " +
        "제공된 selected_context와 evidence_chunks 안에서만 한국어로 답한다. " +
        "정책 결정을 내리지 말고, 이미 산출된 지표와 문서 기준을 설명한다. " +
        "질문이 Case 분류 기준, SHAP의 역할, 정책 확인사항, 한계처럼 문서 기준 자체를 묻는 경우에는 학교별 수치가 없어도 evidence_chunks만으로 답할 수 있다. " +
        "다만 학교별 수치가 selected_context에 없으면 구체적인 거리, 공원명, 녹지율, 놀이터 수를 만들어내지 않는다. " +
        "근거 chunk가 부족하면 answerable=false로 답한다. " +
        "answerable=true일 때 evidence와 cited_chunk_ids에는 반드시 evidence_chunks 안의 chunk_id만 사용한다.",
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
          evidence_chunks: evidencePack,
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
  if (!answer || typeof answer !== "object") return safeFailure();
  if (answer.answerable !== true) return safeFailure(answer.cannot_answer_reason);
  if (!Array.isArray(answer.evidence) || answer.evidence.length === 0) return safeFailure();
  if (!Array.isArray(answer.cited_chunk_ids) || answer.cited_chunk_ids.length === 0) return safeFailure();

  const evidenceIds = answer.evidence.map((item) => item && item.chunk_id).filter(Boolean);
  const allIds = new Set([...answer.cited_chunk_ids, ...evidenceIds]);
  for (const id of allIds) {
    if (!allowed.has(id)) return safeFailure();
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
  if (req.method === "OPTIONS") return json(res, 200, {});
  if (req.method !== "POST") return json(res, 405, safeFailure("POST 요청만 지원합니다.", 405));

  if (process.env.AI_EXPLAINER_ENABLED === "false") {
    return json(res, 503, safeFailure("AI 해설 패널이 현재 비활성화되어 있습니다.", 503));
  }
  if (!process.env.OPENAI_API_KEY) {
    return json(res, 503, safeFailure("서버에 OpenAI API 키가 설정되어 있지 않습니다.", 503));
  }

  try {
    const payload = await readBody(req);
    const question = String(payload.question || "").trim();
    if (!question || question.length > 220) {
      return json(res, 400, safeFailure("질문은 1자 이상 220자 이하로 입력해야 합니다.", 400));
    }
    if (payload.mode !== "identified_school_explainer") {
      return json(res, 400, safeFailure("식별앱 AI 해설 모드만 지원합니다.", 400));
    }

    const chunks = loadChunks();
    const selectedChunks = selectChunks(payload, chunks);
    if (selectedChunks.length < 3) return json(res, 200, safeFailure());

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildInput(payload, selectedChunks),
        temperature: 0,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        reasoning: { effort: "none" },
        text: {
          format: {
            type: "json_schema",
            name: "ai_explainer_response",
            strict: true,
            schema: buildSchema(),
          },
        },
      }),
    });

    if (!openaiResponse.ok) {
      return json(res, 200, safeFailure("AI 해설을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요."));
    }

    const data = await openaiResponse.json();
    const rawText = extractText(data);
    const parsed = JSON.parse(rawText);
    return json(res, 200, validateAnswer(parsed, selectedChunks));
  } catch {
    return json(res, 200, safeFailure("AI 해설을 안전하게 생성하지 못했습니다."));
  }
};
