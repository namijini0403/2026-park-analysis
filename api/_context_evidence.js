"use strict";

// schema_version 2 컨텍스트 산출물(data_processed/context/)을 AI 해설 검색 근거로 변환하는 헬퍼.
// 서버 로컬 파일만 읽으며, 클라이언트가 보낸 수치·지정 정보는 절대 신뢰하지 않는다
// (school_id / 정확히 일치하는 유일한 school_name 만 조회 키로 사용).
// 파일명이 _ 로 시작하므로 Vercel 이 API 엔드포인트로 노출하지 않는다.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONTEXT_DIR = path.join(__dirname, "..", "data_processed", "context");

// 유흥/단란/공사/지정학교 계열 질문 감지. 이 주제일 때만 학교별 컨텍스트 chunk 를 만든다.
const CONTEXT_TOPIC_PATTERN =
  /유흥|단란|주점|노래(?:방|클럽)|공사장?|착공|건축|연구\s*학교|선도\s*학교|(?:ai|에이아이)\s*중점|중점학교|디지털\s*튜터|특별\s*(?:지원|지정)|지정\s*(?:학교|사업|현황|여부)/i;

let cache = null;
let cacheDir = null;

function loadContextData(contextDir) {
  const dir = contextDir || process.env.AI_CONTEXT_DIR || DEFAULT_CONTEXT_DIR;
  if (cache && cacheDir === dir) return cache;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "context_layers_manifest.json"), "utf-8"));
    const summary = JSON.parse(fs.readFileSync(path.join(dir, "school_context_summary.json"), "utf-8"));
    const nameIndex = new Map();
    for (const [schoolId, school] of Object.entries(summary.schools || {})) {
      const name = String(school.school_name || "").trim();
      if (!name) continue;
      if (!nameIndex.has(name)) nameIndex.set(name, []);
      nameIndex.get(name).push(schoolId);
    }
    cache = { manifest, summary, nameIndex };
    cacheDir = dir;
    return cache;
  } catch {
    return null; // 파일 부재/손상 시 근거 없음으로 처리(임의 생성 금지). 다음 요청에서 재시도.
  }
}

function isContextTopicQuestion(question) {
  return CONTEXT_TOPIC_PATTERN.test(String(question || ""));
}

// 권위 있는 해석: school_id 우선, 없으면 "정확히 일치하고 유일한" school_name.
// 미상·모호(동명 학교)는 null — 임의 학교로 해석하지 않는다.
function resolveSchool(schoolContext, contextDir) {
  const data = loadContextData(contextDir);
  if (!data) return null;
  const ctx = schoolContext || {};
  const schoolId = String(ctx.school_id || "").trim();
  if (schoolId) {
    const school = data.summary.schools[schoolId];
    return school ? { schoolId, school } : null;
  }
  const name = String(ctx.school_name || "").trim();
  if (!name || name.includes("전체")) return null;
  const ids = data.nameIndex.get(name) || [];
  if (ids.length !== 1) return null; // 미일치 또는 동명 모호 → 해석 거부
  return { schoolId: ids[0], school: data.summary.schools[ids[0]] };
}

function fmtCount(value) {
  return typeof value === "number" ? value.toLocaleString("ko-KR") : String(value);
}

function nightlifeSection(school, manifest) {
  const layer = school.nightlife || {};
  const m = (manifest.layers || {}).nightlife_permits || {};
  if (layer.status === "partial" || layer.status === "available") {
    const observed = layer.observed_count;
    let text = `유흥·단란주점 인허가 — 반경 ${layer.within_m || 500}m 직선거리 내 좌표 확보 레코드 기준 최소 관측 ${fmtCount(observed)}건`;
    if (typeof layer.nearest_observed_m === "number") text += `(최근접 관측 약 ${Math.round(layer.nearest_observed_m)}m)`;
    text += `. 전수 아님: 인천 전체 영업 ${fmtCount(m.record_count ?? "미상")}건 중 좌표 확보 ${fmtCount(m.located_record_count ?? "미상")}건만 공간 집계, total 미상`;
    return text;
  }
  return "유흥·단란주점 인허가 — 해당 학교 자료 미수집(0건 아님·미상)";
}

function constructionSection(school, manifest) {
  const layer = school.construction || {};
  const m = (manifest.layers || {}).construction_records || {};
  if (layer.status === "partial" || layer.status === "available") {
    return `공사장(착공신고 행정기록, 현재 공사 진행 여부 아님) — 반경 내 좌표 추정 기준 관측 ${fmtCount(layer.observed_count)}건. ` +
      `부분 수집(${(m.coverage_regions || []).join("·") || "일부 구"}, 원자료 ${fmtCount(m.record_count ?? "미상")}건 중 좌표 추정 ${fmtCount(m.located_record_count ?? "미상")}건), 좌표는 상가주소 기반 추정`;
  }
  return `공사장(착공신고 행정기록, 현재 공사 진행 여부 아님) — 해당 구 자료 미수집(${(m.coverage_regions || []).join("·") || "연수구"}만 부분 수집). 0건 확정이 아니라 미상`;
}

function designationSection(school) {
  const layer = school.designations || {};
  if (layer.status !== "available") return "지정·지원 사업 — 해당 학교 자료 미수집 또는 미확인(미지정 확정 아님)";
  const current = Array.isArray(layer.current) ? layer.current : [];
  const historical = Array.isArray(layer.historical) ? layer.historical : [];
  const fmt = (d) => `${d.program_name || d.designation_type}(${d.designation_type}, ${d.school_year}학년도)`;
  if (current.length === 0 && historical.length === 0) {
    return "지정·지원 사업 — 수집된 공식 명단(2026 AI·디지털 연구·선도, 2026 AI중점, 2025 디지털튜터) 기준 등재 없음. 명단 미등재는 미지정 확정이 아님";
  }
  const parts = [];
  if (current.length > 0) parts.push(`현행 ${current.map(fmt).join(", ")}`);
  if (historical.length > 0) parts.push(`과거 ${historical.map(fmt).join(", ")}`);
  return `지정·지원 사업 — ${parts.join("; ")}. 그 외 사업 미수집`;
}

function collectSourceUrls(school, manifest) {
  const urls = new Set();
  for (const layerName of ["nightlife_permits", "construction_records", "school_designations"]) {
    for (const src of ((manifest.layers || {})[layerName] || {}).sources || []) {
      if (src && src.url) urls.add(src.url);
    }
  }
  for (const d of [...(school.designations?.current || []), ...(school.designations?.historical || [])]) {
    if (d && d.source_url) urls.add(d.source_url);
  }
  return [...urls];
}

// 선택 학교의 schema v2 컨텍스트를 기존 RAG chunk 형식({id,title,tags,source,body})으로 요약한다.
// 질문이 언급한 주제를 정의 문장 앞쪽에 배치해, 인용 폴백(정의 앞 220자)에도 핵심 수치가 실리게 한다.
function buildSchoolContextChunk(schoolContext, question, contextDir) {
  const data = loadContextData(contextDir);
  if (!data) return null;
  const resolved = resolveSchool(schoolContext, contextDir);
  if (!resolved) return null;
  const { schoolId, school } = resolved;
  const manifest = data.manifest;
  const q = String(question || "");

  const sections = [
    { key: "nightlife", hit: /유흥|단란|주점|노래/.test(q), text: nightlifeSection(school, manifest) },
    { key: "construction", hit: /공사|착공|건축/.test(q), text: constructionSection(school, manifest) },
    { key: "designations", hit: /연구\s*학교|선도\s*학교|중점|튜터|지정|특별\s*지원/i.test(q), text: designationSection(school) },
  ].sort((a, b) => Number(b.hit) - Number(a.hit));

  const body =
    `정의: ${school.school_name}(ID ${schoolId}) 주변 컨텍스트 관측(산출 기준일 ${data.summary.data_as_of}, 원자료 시점은 출처별 상이): ` +
    sections.map((s, i) => `${i + 1}) ${s.text}`).join(" ") +
    "\n\n해석: 행정기록 기반 관측치다. 유흥·공사 수치는 하한 관측치이며 부분 커버리지에서 0은 '없음' 확정이 아니다. " +
    "착공신고는 현재 공사 진행 여부를 뜻하지 않고, 거리 수치는 직선거리(도보 경로 아님)다. " +
    "지정학교의 school_year 는 확정된 법적 지정 기간이 아니며, 지정 사실만으로 지원금액을 알 수 없다.\n\n" +
    `출처: ${collectSourceUrls(school, manifest).join(" , ") || "manifest 출처 참조"}. ` +
    "LOCALDATA 파일 전체 기준일은 미확인이다. " +
    ((manifest.layers?.construction_records?.sources || []).map((src) =>
      `건축 관련 출처 ${src.url}: 원자료 기준일 ${src.source_as_of || "미확인"}, 수집일 ${src.retrieved_at || "미확인"}`
    ).join("; "));

  return {
    id: `context_v2#school-${schoolId}`,
    title: `${school.school_name} 주변 컨텍스트 관측(schema v2)`,
    source: "context_v2",
    tags: ["유흥주점", "단란주점", "공사장", "착공신고", "연구학교", "선도학교", "AI중점", "디지털튜터", "지정사업", "컨텍스트"],
    body,
  };
}

module.exports = { isContextTopicQuestion, resolveSchool, buildSchoolContextChunk, loadContextData };
