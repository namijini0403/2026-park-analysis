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

  // 1) 질문 본문의 강한 주제 신호를 question_type보다 먼저 본다.
  //    custom 질문은 question_type이 case_reason으로 고정되므로, KNN·후보지 같은
  //    디테일 질문이 case 주제로 잘못 라우팅되어 근거 chunk를 못 찾는 문제를 막는다.
  //    단, 특정 Case 번호를 명시하거나 Case 전체기준·거리검증을 묻는 질문은
  //    녹지비율·최근접 같은 지표 단어가 섞여 있어도 case 주제로 본다.
  if (/case ?[1-4]|케이스 ?[1-4]/.test(question) || isCaseOverviewQuestion(payload) || isCaseDistanceCheckQuestion(payload)) return "case";
  if (/shap|기여|예측근거/.test(question)) return "shap";
  if (/knn|유사학교|유사조건|비교군|벤치마크|활동규모|공원 ?기능|기능 ?등급|등시권|등시선|hitl|human ?in/.test(question)) return "glossary";
  if (/후보지|후보군|격자|추천|pareto|파레토|top ?5|안정성|가중치|슬라이더|필터|견고|우선순위/.test(question)) return "decision";
  if (/놀이터|녹지비율|최근접|미래 ?수요|잠재 ?수요|지표/.test(question)) return "metrics";

  // 2) question_type 기반 신호
  if (questionType.includes("shap")) return "shap";
  if (questionType.includes("limitation")) return "limitation";
  if (questionType.includes("metric") || questionType.includes("indicator")) return "metrics";
  if (questionType.includes("candidate")) return "decision";
  if (questionType.includes("case")) return "case";

  // 3) 질문 본문의 case / 한계 신호 (약한 신호)
  if (/case|케이스|분류|즉시|우선|모니터링|유지/.test(question)) return "case";
  if (/한계|주의|비식별|실제 설치|설치 가능성|현장 조사|대체할 수|답하면 안|선택된 학교가 없어도|근거 문서|답변/.test(question)) {
    return "limitation";
  }
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

const CASE_POLICY_LABELS = {
  1: "Case 1 (즉시 개선 대상)",
  2: "Case 2 (우선 검토 대상)",
  3: "Case 3 (모니터링 대상)",
  4: "Case 4 (유지·관리 대상)",
};

// 선택된 학교의 확정 Case 번호를 case_label/case_status_label/case_type에서 도출한다.
// 라벨 텍스트("즉시 개선 대상" 등)에는 "case N" 패턴이 없으므로 정책 라벨 표현도 함께 매칭한다.
function resolveSchoolCaseNumber(payload) {
  const school = payload.school_context || {};
  const text = normalizeText(`${school.case_label || ""} ${school.case_status_label || ""} ${school.case_type || ""}`);
  const explicit = text.match(/(?:case|케이스)\s*([1-4])/);
  if (explicit) return Number(explicit[1]);
  if (/즉시\s*개선/.test(text)) return 1;
  if (/우선\s*검토/.test(text)) return 2;
  if (/모니터링/.test(text)) return 3;
  if (/유지|관리/.test(text)) return 4;
  return null;
}

function collectTerms(payload) {
  const question = normalizeText(payload.question);
  const terms = [payload.question];
  const caseText = normalizeText(`${payload.question || ""} ${payload.school_context?.case_label || ""} ${payload.school_context?.case_type || ""}`);
  const caseMatch = caseText.match(/(?:case|케이스)\s*([1-4])/);
  if (caseMatch) terms.push(`case${caseMatch[1]}`);
  // 학교의 확정 Case 정의 chunk가 검색 결과에 포함되도록 실제 Case 번호를 검색어로 추가한다.
  const resolvedCase = resolveSchoolCaseNumber(payload);
  if (resolvedCase) terms.push(`case${resolvedCase}`);
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

function isCaseOverviewQuestion(payload) {
  const question = normalizeText(payload.question);
  const questionType = String(payload.question_type || "").toLowerCase();
  if (!questionType.includes("case") && !/case|케이스|분류/.test(question)) return false;
  const caseNumbers = new Set([...question.matchAll(/(?:case|케이스)\s*([1-4])/g)].map((match) => match[1]));
  if (caseNumbers.size === 1 && !/전체|1\s*(부터|에서|~|-)|case\s*1|case1/.test(question)) return false;
  return (
    /case\s*1\s*(부터|에서|~|-|부터\s*case)?\s*case?\s*4/.test(question) ||
    /case\s*1\s*4/.test(question) ||
    /case1\s*case4/.test(question) ||
    /case\s*전체|전체\s*case|전체분류|분류\s*기준|판정\s*기준/.test(question)
  );
}

function isCaseDistanceCheckQuestion(payload) {
  const question = normalizeText(payload.question);
  return /500m|500\s*m|최근접|거리|중복|또\s*붙|왜/.test(question) && /case\s*1|case1|케이스\s*1/.test(question);
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
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));

  if (desiredTopic === "case" && isCaseOverviewQuestion(payload) && !isCaseDistanceCheckQuestion(payload)) {
    return [
      "02_case_rules#case-overview",
      "02_case_rules#case1",
      "02_case_rules#case2",
      "02_case_rules#case3",
      "02_case_rules#case4",
    ].map((id) => byId.get(id)).filter(Boolean);
  }

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, terms, desiredTopic) }))
    .filter((item) => item.score >= MIN_RETRIEVAL_SCORE)
    .sort((left, right) => right.score - left.score);

  const hasDesiredTopic = ranked.some((item) => topicForChunk(item.chunk) === desiredTopic);
  if (!hasDesiredTopic) return [];

  const selected = [
    ...ranked.filter((item) => topicForChunk(item.chunk) === desiredTopic),
    ...ranked.filter((item) => topicForChunk(item.chunk) !== desiredTopic),
  ].slice(0, 5).map((item) => item.chunk);

  // case 질문에서는 선택 학교의 확정 Case 정의 chunk가 빠지지 않도록 보강한다.
  if (desiredTopic === "case") {
    const resolvedCase = resolveSchoolCaseNumber(payload);
    const resolvedChunk = resolvedCase ? byId.get(`02_case_rules#case${resolvedCase}`) : null;
    if (resolvedChunk && !selected.some((chunk) => chunk.id === resolvedChunk.id)) {
      selected.pop();
      selected.unshift(resolvedChunk);
    }
  }

  return selected;
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

  const resolvedCase = resolveSchoolCaseNumber(payload);
  const resolvedSchoolCase = resolvedCase
    ? {
        case_number: resolvedCase,
        policy_label: CASE_POLICY_LABELS[resolvedCase],
        note: "이 값은 선택된 학교의 확정된 Case 분류다. 질문에 다른 Case 용어가 나와도 학교의 실제 Case는 이 값이다.",
      }
    : null;

  return [
    {
      role: "system",
      content:
        "너는 인천 초등학교 야외활동 환경 격차 분석 앱의 RAG-lite 해설 패널이다. " +
        "최종안 기준 문서와 selected_context 안에서만 답한다. 문서에 없는 내부 구현 추정은 말하지 않는다. " +
        "새 정책 판단, 신규 추천, 법적 판단, 예산 산정, 데이터 밖 추론을 하지 않는다. " +
        "selected_context.resolved_school_case가 있으면 그것이 선택된 학교의 확정 Case다. " +
        "사용자가 '이 학교가 OO 대상이냐'처럼 특정 Case나 정책 라벨에 해당하는지 물으면, 질문에 등장한 단어가 아니라 resolved_school_case.case_number를 기준으로 판정한다. " +
        "질문 속 Case·라벨과 학교의 실제 Case가 다르면, 학교의 실제 Case(case_number와 policy_label)를 먼저 분명히 밝히고 질문의 전제가 맞지 않음을 설명한다. " +
        "질문에 특정 라벨 단어가 들어 있다는 이유로 학교를 그 Case로 재분류하지 않는다. " +
        "answerable=true라면 모든 evidence.claim과 limitations.text에 RETRIEVED_CHUNKS 안의 source_chunk_id를 붙인다. " +
        "source_chunk_id에는 retrieved_chunks의 chunk_id만 사용한다. resolved_school_case나 school_context 같은 context 필드명은 source_chunk_id로 절대 쓰지 않는다. " +
        "학교의 확정 Case를 근거로 들 때도 해당 Case 정의 chunk(예: 02_case_rules#case1)를 source_chunk_id로 단다. " +
        "질문이 retrieved_chunks 안에 명시된 수치나 기준(예: KNN 변수 개수, 후보지·격자 수, 공원 면적 임계, 임계 비율)을 직접 물으면, 그 값이 chunk에 있을 때는 answerable=true로 해당 값을 명확히 답한다. 표현이 약간 달라도 chunk에 같은 의미의 값이 있으면 근거 부족으로 차단하지 않는다. " +
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
            resolved_school_case: resolvedSchoolCase,
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

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function chunkClaim(chunk) {
  const body = String(chunk?.body || "");
  const match = body.match(/정의:\s*([\s\S]*?)(?:\n\n해석:|\n\n주의:|\n\n잘못된 해석:|$)/);
  return compactText(match ? match[1] : body).slice(0, 220);
}

// 응답 mode는 모델 자유 선택에 맡기지 않고, 질문 유형과 선택 컨텍스트로 결정론적으로 정한다.
function resolveExplanationMode(payload) {
  const questionType = String(payload.question_type || "").toLowerCase();
  // 명시적 후보지 질문(candidate_reason, shap_interpretation)
  if (questionType.includes("candidate") || questionType.includes("shap")) {
    return hasSelectedCandidateContext(payload) ? "candidate_explanation" : "concept_explanation";
  }
  // 명시적 학교 질문(case_reason, school_explanation)
  if (questionType.includes("case") || questionType.includes("school")) {
    return hasSelectedSchoolContext(payload) ? "school_explanation" : "concept_explanation";
  }
  // policy_check, limitations 등 공통 질문은 선택된 컨텍스트 기준으로 정한다.
  if (hasSelectedCandidateContext(payload)) return "candidate_explanation";
  if (hasSelectedSchoolContext(payload)) return "school_explanation";
  return "concept_explanation";
}

function buildRetrievalFallback(payload, selectedChunks) {
  const fallbackChunks = selectedChunks.slice(0, 3);
  const evidence = fallbackChunks.map((chunk) => ({
    claim: chunkClaim(chunk),
    source_chunk_id: chunk.id,
  })).filter((item) => item.claim);
  const sourceChunkId = evidence[0]?.source_chunk_id || selectedChunks[0]?.id || "README#answer-guard";
  return {
    answerable: evidence.length > 0,
    mode: evidence.length > 0 ? resolveExplanationMode(payload) : "blocked",
    summary: evidence[0]?.claim || null,
    evidence,
    interpretation: evidence.length > 0
      ? "검색된 근거 문서를 우선 요약했습니다. 새 정책 판단이나 데이터 밖 추론은 포함하지 않았습니다."
      : null,
    limitations: evidence.length > 0
      ? [{ text: "상세 문장 생성 대신 근거 chunk 요약만 제공하므로, 선택 학교·후보지의 세부 수치는 화면 지표와 함께 확인해야 합니다.", source_chunk_id: sourceChunkId }]
      : [],
    policy_checklist: evidence.length > 0
      ? ["선택된 학교·후보지 지표와 함께 확인", "필터·가중치·현장 조건을 별도로 검토"]
      : [],
    blocked_reason: evidence.length > 0 ? null : "관련 근거 chunk가 충분하지 않아 답변하지 않습니다.",
  };
}

function buildCaseOverviewAnswer(selectedChunks) {
  const allowed = new Set(selectedChunks.map((chunk) => chunk.id));
  const source = (id) => allowed.has(id) ? id : "02_case_rules#case-overview";
  return {
    answerable: true,
    mode: "concept_explanation",
    summary:
      "Case 1은 도보권 녹지비율 0%이면서 최근접 공원 도보거리 500m 이상, " +
      "Case 2는 Case 1을 제외하고 최종 표시용 도보권 녹지비율 1% 미만, " +
      "Case 3은 1% 이상 5% 미만, Case 4는 5% 이상입니다.",
    evidence: [
      {
        claim: "Case 1은 가장 강한 공원·녹지 접근 결핍군이며 즉시 개선 대상으로 본다.",
        source_chunk_id: source("02_case_rules#case1"),
      },
      {
        claim: "Case 2는 도보권 녹지 경험이 거의 없는 우선 검토 대상이다.",
        source_chunk_id: source("02_case_rules#case2"),
      },
      {
        claim: "Case 3은 녹지량이 제한적인 모니터링 대상, Case 4는 상대적 양호군이다.",
        source_chunk_id: source("02_case_rules#case-overview"),
      },
    ],
    interpretation:
      "이 분류는 학교 생활권의 현재 공원·녹지 접근 결핍을 설명하기 위한 정책 지원 기준입니다. 낮은 Case일수록 현장 검토와 후보지 검토 우선도가 높게 해석됩니다.",
    limitations: [
      {
        text: "Case는 예산 배정이나 설치 여부를 자동 확정하지 않으며, 도서지역 별도묶음과 현장 여건은 분리해 검토해야 한다.",
        source_chunk_id: source("02_case_rules#case-overview"),
      },
    ],
    policy_checklist: [
      "Case 1~2는 접근 결핍과 녹지 부족을 우선 확인",
      "Case 3은 주변 개발 변화와 장기 보완 필요성 확인",
      "Case 4도 유지·관리, 안전, 민원 조건은 별도 확인",
    ],
    blocked_reason: null,
  };
}

function shouldRetryOpenAiStatus(status) {
  return [408, 409, 429, 500, 502, 503, 504].includes(Number(status));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOpenAiResponse(requestBody) {
  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      if (response.ok || !shouldRetryOpenAiStatus(response.status) || attempt === 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    }
    await wait(350);
  }
  throw lastError || new Error("OpenAI response request failed");
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

  let payloadForFallback = null;
  let chunksForFallback = [];
  try {
    const payload = await readBody(req);
    payloadForFallback = payload;
    const question = String(payload.question || "").trim();
    if (!question || question.length > 220) {
      return json(req, res, 400, blocked("질문은 1자 이상 220자 이하로 입력해야 합니다.", 400));
    }

    const chunks = loadChunks();
    const selectedChunks = selectChunks(payload, chunks);
    chunksForFallback = selectedChunks;
    const gateResult = answerabilityGate(payload, selectedChunks);
    if (gateResult) return json(req, res, gateResult.blocked_reason === "지원하지 않는 AI 해설 모드입니다." ? 400 : 200, gateResult);

    if (
      isCaseOverviewQuestion(payload) &&
      !isCaseDistanceCheckQuestion(payload) &&
      selectedChunks.some((chunk) => chunk.id === "02_case_rules#case-overview")
    ) {
      return json(req, res, 200, buildCaseOverviewAnswer(selectedChunks));
    }

    if (!process.env.OPENAI_API_KEY) {
      return json(req, res, 200, buildRetrievalFallback(payload, selectedChunks));
    }

    const openaiResponse = await fetchOpenAiResponse({
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
    });

    if (!openaiResponse.ok) {
      return json(req, res, 200, buildRetrievalFallback(payload, selectedChunks));
    }

    const data = await openaiResponse.json();
    const parsed = JSON.parse(extractText(data));
    const validated = validateAnswer(parsed, selectedChunks);
    // 답변 가능한 경우 mode는 모델 선택을 신뢰하지 않고 컨텍스트 기준으로 확정한다.
    if (validated.answerable === true) validated.mode = resolveExplanationMode(payload);
    return json(req, res, 200, validated.answerable === true || validated.blocked_reason ? validated : buildRetrievalFallback(payload, selectedChunks));
  } catch {
    if (payloadForFallback && chunksForFallback.length) {
      return json(req, res, 200, buildRetrievalFallback(payloadForFallback, chunksForFallback));
    }
    return json(req, res, 200, blocked("AI 해설을 안전하게 생성하지 못했습니다."));
  }
};
