import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const chunksPath = path.join(root, "api", "ai_explainer_chunks.json");
const evalPath = path.join(root, "docs", "ai_explainer", "evaluation_questions.json");
const minRetrievalScore = Number(process.env.AI_EXPLAINER_V2_MIN_SCORE || 8);

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s#_-]/gu, " ");
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
    .filter((item) => item.score >= minRetrievalScore)
    .sort((left, right) => right.score - left.score);

  const hasDesiredTopic = ranked.some((item) => topicForChunk(item.chunk) === desiredTopic);
  if (!hasDesiredTopic) return [];
  return ranked.slice(0, 5);
}

function hasSelectedSchoolContext(payload) {
  const school = payload.school_context || {};
  return Boolean(
    school.school_id ||
      (school.school_name && !String(school.school_name).includes("전체")),
  );
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

function gate(payload, selected) {
  if (!selected.length) return "no_retrieval";
  if (payload.mode === "public_anonymous_explainer" && containsIdentifyingQuestion(payload)) return "anonymous_identity";
  if (payload.mode !== "identified_school_explainer" && payload.mode !== "public_anonymous_explainer") return "unsupported_mode";
  if (containsPolicyCommitmentQuestion(payload)) return "policy_commitment";
  if (!hasRequiredContext(payload)) return "missing_specific_context";
  return null;
}

function buildPayload(item, defaults) {
  const payload = {
    mode: item.mode,
    question_type: item.question_type,
    question: item.question,
    school_context: null,
    candidate_context: null,
  };

  for (const key of item.use_context || []) {
    if (key === "selected_school") payload.school_context = defaults.selected_school;
    if (key === "selected_candidate") payload.candidate_context = defaults.selected_candidate;
  }

  return payload;
}

const chunksPayload = JSON.parse(fs.readFileSync(chunksPath, "utf-8"));
const chunks = Array.isArray(chunksPayload.chunks) ? chunksPayload.chunks : [];
const evalPayload = JSON.parse(fs.readFileSync(evalPath, "utf-8"));
const questions = Array.isArray(evalPayload.questions) ? evalPayload.questions : [];

const failures = [];
const categoryCounts = new Map();

for (const item of questions) {
  categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1);
  const payload = buildPayload(item, evalPayload.default_contexts || {});
  const selected = selectChunks(payload, chunks);
  const selectedIds = selected.map((entry) => entry.chunk.id);
  const gateReason = gate(payload, selected);
  const actual = gateReason ? "blocked" : "answerable";
  const expectedIds = item.expected_chunk_ids || [];
  const hasExpectedChunk = expectedIds.length === 0 || expectedIds.some((id) => selectedIds.includes(id));

  if (actual !== item.expected) {
    failures.push(`${item.id}: expected ${item.expected}, got ${actual} (${gateReason || "answerable"})`);
    continue;
  }
  if (item.expected === "answerable" && !hasExpectedChunk) {
    failures.push(`${item.id}: expected one of [${expectedIds.join(", ")}], got [${selectedIds.join(", ")}]`);
  }
  if (item.expected === "blocked" && item.expected_block && gateReason !== item.expected_block) {
    failures.push(`${item.id}: expected block ${item.expected_block}, got ${gateReason || "none"}`);
  }
}

const expectedCounts = evalPayload.counts || {};
for (const [category, expected] of Object.entries(expectedCounts)) {
  const actual = categoryCounts.get(category) || 0;
  if (actual !== expected) failures.push(`category ${category}: expected ${expected}, got ${actual}`);
}

console.log(`AI explainer retrieval eval: ${questions.length} questions`);
console.log(`Chunks loaded: ${chunks.length}`);
console.log(`Threshold: ${minRetrievalScore}`);

if (failures.length) {
  console.error("FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("PASS");
}
