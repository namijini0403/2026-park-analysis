// 전체 통계 — 런타임 계산 모듈 (순수 함수 + 로더)
// 하드코딩 스냅샷(statisticsPreviewDataSafe.ts) 대체. 지도 앱과 같은 data_processed/ 파일을 직접 읽어
// 시·구·학교 통계와 레이어 교차 인사이트를 계산한다. 시·구 통계 규칙은
// scripts/export/generate_statistics_preview_data_safe.py(구 규칙)와 동일하게 유지.
//
// 불변식(맥락 레이어): 미수집·좌표미상 = unknown(0건으로 표기 금지), 학교별 시설 수치는 하한 관측치,
// 유흥은 "인허가 현황"(위험 판정 아님), 공사는 "행정기록·현재 공사 여부 미확인".

export type StatisticsSchoolItem = {
  rank: number;
  schoolName: string;
  districtName: string;
  casePolicyLabel: string;
  caseStatusLabel: string;
  potentialDemand2029: number;
  potentialDemand2031: number;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  currentStudentCount: number;
};

export type DistrictStatistics = {
  districtName: string;
  schoolCount: number;
  case1Count: number;
  case2Count: number;
  case3Count: number;
  case4Count: number;
  specialPolicyCount: number;
  priorityReviewCount: number;
  totalPotentialDemand2029: number;
  totalPotentialDemand2031: number;
  avgNearestParkDistanceM: number;
  avgGreenRatio: number;
  avgPlaygroundCount: number;
  topPrioritySchools: StatisticsSchoolItem[];
  topPrioritySchoolsPlaygroundFocused: StatisticsSchoolItem[];
  topPrioritySchoolsStudentFocused: StatisticsSchoolItem[];
  bestSchool: StatisticsSchoolItem;
};

export type CityStatisticsData = {
  cityName: string;
  summary: {
    schoolCount: number;
    districtCount: number;
    case1Count: number;
    case2Count: number;
    case3Count: number;
    case4Count: number;
    separateBundleCount: number;
    urgentSupportCount: number;
    priorityReviewCount: number;
    apartmentPermeabilitySchoolCount: number;
    apartmentAdjustmentCandidateCount: number;
    totalPotentialDemand2029: number;
    totalPotentialDemand2031: number;
  };
  districts: DistrictStatistics[];
  cityTopPrioritySchools: StatisticsSchoolItem[];
  cityTopPrioritySchoolsPlaygroundFocused: StatisticsSchoolItem[];
  cityTopPrioritySchoolsStudentFocused: StatisticsSchoolItem[];
  cityBestSchool: StatisticsSchoolItem;
};

// ── 레이어 교차 인사이트 ────────────────────────────────────────────────
export type LayerFlag = "park" | "read" | "night" | "constr" | "nodesig" | "grow";

export const LAYER_FLAG_ORDER: LayerFlag[] = ["park", "read", "night", "constr", "nodesig", "grow"];

export const LAYER_FLAG_META: Record<LayerFlag, { label: string; short: string; color: string; icon: string }> = {
  park: { label: "공원 도달 결핍", short: "공원", color: "#34D399", icon: "🌳" },
  read: { label: "독서 결핍(내·외부)", short: "독서", color: "#F59E0B", icon: "📚" },
  night: { label: "유흥 인허가 밀집", short: "유흥", color: "#EC4899", icon: "🍺" },
  constr: { label: "착공기록 다수", short: "공사", color: "#94A3B8", icon: "🏗" },
  nodesig: { label: "지정사업 없음", short: "지정 없음", color: "#A78BFA", icon: "🎓" },
  grow: { label: "학생 증가 전망", short: "증가", color: "#5DA8D4", icon: "📈" },
};

export const INSIGHT_THRESHOLDS = {
  nightlifeRadiusM: 300,
  nightlifeMinCount: 5,
  constructionMinOpen: 3,
};

export type InsightSchool = {
  schoolId: string;
  schoolName: string;
  districtName: string;
  caseType: number;
  casePolicyLabel: string;
  priorityRank: number;
  isSeparateBundle: boolean;
  flags: LayerFlag[];
  nightlifeWithin300: number;
  nightlifeWithin500: number;
  constructionOpen: number | null; // null = 미수집 구
  designationCount: number | null; // null = 지정 자료 없음
  designationPrograms: string[];
  readingGapType: string | null;
  currentStudents: number;
  forecast2029: number;
  parkNeed: number | null;
  readingNeed: number | null;
  primaryAction: string | null;
};

export type InsightHeadline = {
  key: "double" | "blindspot" | "environment" | "demand" | "construction";
  title: string;
  count: number;
  base: number;
  meaning: string;
  detail: string;
  flags: LayerFlag[];
  coverageNote?: string;
};

export type DistrictLayerProfile = {
  districtName: string;
  schoolCount: number;
  parkPct: number;
  readPct: number;
  nightPct: number; // 반경 300m 내 유흥 인허가 1건 이상(하한)
  designationPct: number;
  constructionCovered: boolean;
  overlap3Plus: number; // 겹침 3개 이상 학교 수
};

export type NeedMatrixCell = { parkNeed: number; readingNeed: number; count: number; priorityCount: number };

export type DesignationCaseRow = { caseLabel: string; withDesignation: number; withoutDesignation: number; welfare: number };

export type InsightData = {
  schools: InsightSchool[];
  headlines: InsightHeadline[];
  topOverlap: InsightSchool[];
  overlapHistogram: { flagCount: number; schools: number }[];
  needMatrix: NeedMatrixCell[];
  needMatrixUnknown: number;
  designationByCase: DesignationCaseRow[];
  districtProfiles: DistrictLayerProfile[];
  layerStatus: { key: string; label: string; status: string; statusLabel: string; note: string }[];
  dataAsOf: string | null;
};

export type StatisticsLiveResult = { city: CityStatisticsData; insight: InsightData };

// ── 입력 원본 ───────────────────────────────────────────────────────────
export type RawRow = Record<string, string>;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type StatisticsInputs = {
  priority: RawRow[];
  forecast: RawRow[];
  libraryAccess: RawRow[];
  apartmentAdjustment: RawRow[] | null;
  contextSummary: { data_as_of?: string; schools?: Record<string, any> } | null;
  contextManifest: { data_as_of?: string; layers?: Record<string, any> } | null;
  policyCards: { schools?: Record<string, any> } | null;
};

// ── CSV ─────────────────────────────────────────────────────────────────
export function parseCsv(text: string): RawRow[] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

const CASE_POLICY_LABELS: Record<number, string> = {
  1: "즉시 개선 대상",
  2: "우선 검토 대상",
  3: "모니터링 대상",
  4: "유지·관리 대상",
};
const SPECIAL_POLICY_LABEL = "별도 정책 적용";

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function numOr(v: unknown, fallback: number): number {
  const n = num(v);
  return Number.isNaN(n) ? fallback : n;
}
function round1(v: number): number {
  return Number.isNaN(v) ? 0 : Math.round(v * 10) / 10;
}
function mean(values: number[]): number {
  const clean = values.filter((v) => !Number.isNaN(v));
  if (!clean.length) return NaN;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
}
// pandas quantile(linear)
function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}
function cmp(a: number, b: number, asc: boolean): number {
  if (a === b) return 0;
  return asc ? (a < b ? -1 : 1) : a > b ? -1 : 1;
}
function multiSort<T>(items: T[], keys: [(t: T) => number, boolean][]): T[] {
  return [...items].sort((x, y) => {
    for (const [fn, asc] of keys) {
      const c = cmp(fn(x), fn(y), asc);
      if (c !== 0) return c;
    }
    return 0;
  });
}

// ── 학교 레코드 결합 ────────────────────────────────────────────────────
type Merged = {
  schoolId: string;
  schoolName: string;
  gu: string;
  caseType: number; // NaN → 99
  caseLabel: string;
  casePolicyLabel: string;
  priorityRank: number;
  priorityScore: number;
  forecast2029: number;
  forecast2031: number;
  currentStudents: number;
  isoParkCount: number;
  isoPlaygroundCount: number;
  nearestParkDistM: number; // NaN 허용
  greenRatio: number; // statistics_green_ratio (NaN→0)
  greenRatioRaw: number; // NaN 허용 (best 후보 판정용)
  isSeparateBundle: boolean;
  aptPermeability: boolean;
  aptAdjustmentCandidate: boolean;
};

function mergeRows(inputs: StatisticsInputs): Merged[] {
  const forecastById = new Map(inputs.forecast.map((r) => [r["학교ID"], r]));
  const aptById = new Map((inputs.apartmentAdjustment ?? []).map((r) => [r["학교ID"], r]));
  return inputs.priority.map((r) => {
    const f = forecastById.get(r["학교ID"]);
    const a = aptById.get(r["학교ID"]);
    const ct = num(r.case_type);
    const caseType = Number.isNaN(ct) ? 99 : ct;
    let green = NaN;
    for (const col of ["display_green_ratio", "corrected_green_ratio", "iso_green_ratio"]) {
      const v = num(r[col]);
      if (!Number.isNaN(v)) {
        green = v;
        break;
      }
    }
    return {
      schoolId: r["학교ID"],
      schoolName: r["학교명"],
      gu: r.gu,
      caseType,
      caseLabel: r.case_label ?? "",
      casePolicyLabel: CASE_POLICY_LABELS[caseType] ?? SPECIAL_POLICY_LABEL,
      priorityRank: numOr(r.priority_rank, 9999),
      priorityScore: numOr(r.priority_score, 0),
      forecast2029: numOr(f?.forecast_2029, 0),
      forecast2031: numOr(f?.forecast_2031, 0),
      currentStudents: numOr(f?.current_students_2025, 0),
      isoParkCount: numOr(r.iso_park_count, 9999),
      isoPlaygroundCount: numOr(r.iso_playground_count, 0),
      nearestParkDistM: num(r.nearest_park_dist_m),
      greenRatio: Number.isNaN(green) ? 0 : green,
      greenRatioRaw: green,
      isSeparateBundle: numOr(r.is_separate_bundle_tag, 0) === 1,
      aptPermeability: numOr(a?.apt_permeability_flag, 0) === 1,
      aptAdjustmentCandidate: numOr(a?.apt_adjustment_candidate, 0) === 1,
    };
  });
}

function toItem(m: Merged, rank: number): StatisticsSchoolItem {
  return {
    rank,
    schoolName: m.schoolName,
    districtName: m.gu,
    casePolicyLabel: m.casePolicyLabel,
    caseStatusLabel: m.caseLabel,
    potentialDemand2029: Math.round(m.forecast2029),
    potentialDemand2031: Math.round(m.forecast2031),
    nearestParkDistanceM: round1(m.nearestParkDistM),
    greenRatio: round1(m.greenRatio),
    playgroundCount: Math.round(m.isoPlaygroundCount),
    currentStudentCount: Math.round(m.currentStudents),
  };
}

function emptyBest(districtName: string): StatisticsSchoolItem {
  return {
    rank: 1,
    schoolName: "기준 충족 학교 없음",
    districtName,
    casePolicyLabel: "기준 미충족",
    caseStatusLabel: "200m 이내 후보 없음",
    potentialDemand2029: 0,
    potentialDemand2031: 0,
    nearestParkDistanceM: 0,
    greenRatio: 0,
    playgroundCount: 0,
    currentStudentCount: 0,
  };
}

function chooseBest(pool: Merged[]): Merged | null {
  const candidates = pool.filter(
    (m) => !Number.isNaN(m.nearestParkDistM) && !Number.isNaN(m.greenRatioRaw) && m.nearestParkDistM <= 200
  );
  if (!candidates.length) return null;
  const sorted = pool
    .map((m) => m.greenRatioRaw)
    .filter((v) => !Number.isNaN(v))
    .sort((a, b) => a - b);
  const [q1, q2, q3] = [quantile(sorted, 0.25), quantile(sorted, 0.5), quantile(sorted, 0.75)];
  const qOrder = (v: number) => (v >= q3 ? 0 : v >= q2 ? 1 : v >= q1 ? 2 : 3);
  return multiSort(candidates, [
    [(m) => qOrder(m.greenRatioRaw), true],
    [(m) => m.greenRatioRaw, false],
    [(m) => (m.isoPlaygroundCount >= 1 ? 1 : 0), false],
    [(m) => m.nearestParkDistM, true],
  ])[0];
}

function priorityLists(pool: Merged[]): [Merged[], Merged[], Merged[]] {
  const def = multiSort(pool, [
    [(m) => m.caseType, true],
    [(m) => m.priorityRank, true],
    [(m) => m.forecast2029, false],
  ]).slice(0, 5);
  const pg = multiSort(pool, [
    [(m) => m.isoParkCount, true],
    [(m) => m.greenRatio, true],
    [(m) => m.isoPlaygroundCount, true],
    [(m) => m.caseType, true],
    [(m) => m.currentStudents, false],
    [(m) => m.priorityRank, true],
  ]).slice(0, 5);
  const st = multiSort(pool, [
    [(m) => m.currentStudents, false],
    [(m) => m.caseType, true],
    [(m) => m.isoParkCount, true],
    [(m) => m.greenRatio, true],
    [(m) => m.isoPlaygroundCount, true],
    [(m) => m.priorityRank, true],
  ]).slice(0, 5);
  return [def, pg, st];
}

export function computeCityStatistics(inputs: StatisticsInputs, cityName = "인천광역시"): CityStatisticsData {
  const merged = mergeRows(inputs);
  const districtOrder: string[] = [];
  const byGu = new Map<string, Merged[]>();
  for (const m of merged) {
    if (!byGu.has(m.gu)) {
      byGu.set(m.gu, []);
      districtOrder.push(m.gu);
    }
    byGu.get(m.gu)!.push(m);
  }
  const count = (arr: Merged[], ct: number) => arr.filter((m) => m.caseType === ct).length;
  const districts: DistrictStatistics[] = districtOrder.map((gu) => {
    const rows = byGu.get(gu)!;
    const prio = rows.filter((m) => m.caseType === 1 || m.caseType === 2);
    const [def, pg, st] = priorityLists(prio);
    const best = chooseBest(rows);
    return {
      districtName: gu,
      schoolCount: rows.length,
      case1Count: count(rows, 1),
      case2Count: count(rows, 2),
      case3Count: count(rows, 3),
      case4Count: count(rows, 4),
      specialPolicyCount: rows.filter((m) => m.isSeparateBundle).length,
      priorityReviewCount: count(rows, 2),
      totalPotentialDemand2029: Math.round(rows.reduce((a, m) => a + m.forecast2029, 0)),
      totalPotentialDemand2031: Math.round(rows.reduce((a, m) => a + m.forecast2031, 0)),
      avgNearestParkDistanceM: round1(mean(rows.map((m) => m.nearestParkDistM))),
      avgGreenRatio: round1(mean(rows.map((m) => m.greenRatio))),
      avgPlaygroundCount: Math.round(mean(rows.map((m) => m.isoPlaygroundCount)) * 100) / 100,
      topPrioritySchools: def.map((m, i) => toItem(m, i + 1)),
      topPrioritySchoolsPlaygroundFocused: pg.map((m, i) => toItem(m, i + 1)),
      topPrioritySchoolsStudentFocused: st.map((m, i) => toItem(m, i + 1)),
      bestSchool: best ? toItem(best, 1) : emptyBest(gu),
    };
  });
  const case1 = merged.filter((m) => m.caseType === 1);
  const cityTop = multiSort(case1, [
    [(m) => m.priorityRank, true],
    [(m) => m.priorityScore, false],
    [(m) => m.forecast2029, false],
  ]);
  const cityPg = multiSort(case1, [
    [(m) => m.isoParkCount, true],
    [(m) => m.greenRatio, true],
    [(m) => m.isoPlaygroundCount, true],
    [(m) => m.currentStudents, false],
    [(m) => m.priorityRank, true],
  ]);
  const citySt = multiSort(case1, [
    [(m) => m.currentStudents, false],
    [(m) => m.isoParkCount, true],
    [(m) => m.greenRatio, true],
    [(m) => m.isoPlaygroundCount, true],
    [(m) => m.priorityRank, true],
  ]);
  const cityBest = chooseBest(merged);
  return {
    cityName,
    summary: {
      schoolCount: merged.length,
      districtCount: districtOrder.length,
      case1Count: count(merged, 1),
      case2Count: count(merged, 2),
      case3Count: count(merged, 3),
      case4Count: count(merged, 4),
      separateBundleCount: merged.filter((m) => m.isSeparateBundle).length,
      urgentSupportCount: count(merged, 1),
      priorityReviewCount: count(merged, 2),
      apartmentPermeabilitySchoolCount: merged.filter((m) => m.aptPermeability).length,
      apartmentAdjustmentCandidateCount: merged.filter((m) => m.aptAdjustmentCandidate).length,
      totalPotentialDemand2029: Math.round(merged.reduce((a, m) => a + m.forecast2029, 0)),
      totalPotentialDemand2031: Math.round(merged.reduce((a, m) => a + m.forecast2031, 0)),
    },
    districts,
    cityTopPrioritySchools: cityTop.map((m, i) => toItem(m, i + 1)),
    cityTopPrioritySchoolsPlaygroundFocused: cityPg.map((m, i) => toItem(m, i + 1)),
    cityTopPrioritySchoolsStudentFocused: citySt.map((m, i) => toItem(m, i + 1)),
    cityBestSchool: cityBest ? toItem(cityBest, 1) : emptyBest(cityName),
  };
}

// ── 레이어 교차 인사이트 계산 ───────────────────────────────────────────
export function computeInsights(inputs: StatisticsInputs): InsightData {
  const merged = mergeRows(inputs);
  const libById = new Map(inputs.libraryAccess.map((r) => [r["학교ID"], r]));
  const ctxSchools: Record<string, any> = inputs.contextSummary?.schools ?? {};
  const cards: Record<string, any> = inputs.policyCards?.schools ?? {};
  const T = INSIGHT_THRESHOLDS;

  const schools: InsightSchool[] = merged.map((m) => {
    const ctx = ctxSchools[m.schoolId] ?? {};
    const night = ctx.nightlife ?? {};
    const recs: { distance_m: number }[] = Array.isArray(night.records) ? night.records : [];
    const within300 = recs.filter((r) => Number(r.distance_m) <= T.nightlifeRadiusM).length;
    const constr = ctx.construction ?? {};
    const constrKnown = Boolean(constr.status) && constr.status !== "unknown";
    const constructionOpen = constrKnown
      ? Math.max(0, numOr(constr.observed_count, 0) - numOr(constr.observed_completed_count, 0))
      : null;
    const desig = ctx.designations ?? {};
    const desigKnown = desig.status === "available";
    const current: any[] = Array.isArray(desig.current) ? desig.current : [];
    const lib = libById.get(m.schoolId);
    const readingGapType = lib?.reading_gap_type ?? null;
    const card = cards[m.schoolId] ?? {};
    const parkNeedRaw = card.park_need === null || card.park_need === undefined ? NaN : Number(card.park_need);
    const readingNeedRaw = card.reading_need === null || card.reading_need === undefined ? NaN : Number(card.reading_need);

    const flags: LayerFlag[] = [];
    const isPriority = m.caseType === 1 || m.caseType === 2;
    if (isPriority) flags.push("park");
    if (readingGapType === "direct_investment_first") flags.push("read");
    if (within300 >= T.nightlifeMinCount) flags.push("night");
    if (constructionOpen !== null && constructionOpen >= T.constructionMinOpen) flags.push("constr");
    if (desigKnown && current.length === 0) flags.push("nodesig");
    if (m.currentStudents > 0 && m.forecast2029 > m.currentStudents) flags.push("grow");

    return {
      schoolId: m.schoolId,
      schoolName: m.schoolName,
      districtName: m.gu,
      caseType: m.caseType,
      casePolicyLabel: m.casePolicyLabel,
      priorityRank: m.priorityRank,
      isSeparateBundle: m.isSeparateBundle,
      flags,
      nightlifeWithin300: within300,
      nightlifeWithin500: recs.length,
      constructionOpen,
      designationCount: desigKnown ? current.length : null,
      designationPrograms: current.map((d) => String(d.program_name ?? "")).filter(Boolean),
      readingGapType,
      currentStudents: m.currentStudents,
      forecast2029: m.forecast2029,
      parkNeed: Number.isFinite(parkNeedRaw) ? parkNeedRaw : null,
      readingNeed: Number.isFinite(readingNeedRaw) ? readingNeedRaw : null,
      primaryAction: card.base?.primary_action ?? null,
    };
  });

  const prio = schools.filter((s) => s.flags.includes("park"));
  const has = (s: InsightSchool, f: LayerFlag) => s.flags.includes(f);
  const cnt = (arr: InsightSchool[], f: LayerFlag) => arr.filter((s) => has(s, f)).length;
  const case1Prio = prio.filter((s) => s.caseType === 1);
  const constrCovered = schools.filter((s) => s.constructionOpen !== null);
  const constrPrio = prio.filter((s) => s.constructionOpen !== null);
  const coveredGus = [...new Set(constrCovered.map((s) => s.districtName))];
  const coveredLabel = coveredGus.length ? coveredGus.join("·") : "수집 구 없음";

  const headlines: InsightHeadline[] = [
    {
      key: "double",
      title: "이중 결핍",
      count: cnt(prio, "read"),
      base: prio.length,
      meaning: "공원도, 학교도서관도 부족한 학교",
      detail: `공원 우선대상 ${prio.length}교 중 ${cnt(prio, "read")}교는 도보권 공공도서관 0개에 학교도서관 내부 지표까지 부족 → 한 부지에서 두 정책을 함께 풀 후보`,
      flags: ["park", "read"],
    },
    {
      key: "blindspot",
      title: "정책 사각지대",
      count: cnt(prio, "nodesig"),
      base: prio.length,
      meaning: "우선대상인데 지정·연구학교 프로그램이 0건",
      detail: `즉시 개선 ${case1Prio.length}교 중 ${cnt(case1Prio, "nodesig")}교는 2026학년도 어떤 지정사업에도 없음 → 기존 지원 채널로는 닿지 않는 학교`,
      flags: ["park", "nodesig"],
    },
    {
      key: "environment",
      title: "환경 부담 겹침",
      count: cnt(prio, "night"),
      base: prio.length,
      meaning: `녹지 부족 + 반경 ${T.nightlifeRadiusM}m 유흥 인허가 ${T.nightlifeMinCount}건 이상`,
      detail: `놀 곳은 없고 유흥업소 인허가는 밀집한 학교. 인허가 현황(하한)이며 안전 판정이 아님 → 통학환경 개선을 공원 공급과 묶어 볼 후보`,
      flags: ["park", "night"],
    },
    {
      key: "demand",
      title: "수요 역행",
      count: cnt(prio, "grow"),
      base: prio.length,
      meaning: "공급은 부족한데 2029 학생 수는 늘어나는 학교",
      detail: `시 전체 학생 증가 전망 ${cnt(schools, "grow")}교 중 ${cnt(prio, "grow")}교가 공원 우선대상 → 방치하면 격차가 커지는 곳, 선제 투자 순위 상단`,
      flags: ["park", "grow"],
    },
    {
      key: "construction",
      title: "공사 기록 겹침",
      count: cnt(constrPrio, "constr"),
      base: constrPrio.length,
      meaning: `우선대상 + 반경 500m 미완료 착공기록 ${T.constructionMinOpen}건 이상`,
      detail: `${coveredLabel} 우선대상 ${constrPrio.length}교 기준. 행정기록이라 현재 공사 여부는 미확인 → 통학로 점검·공사장 인접 놀이공간 안전 확인 후보`,
      flags: ["park", "constr"],
      coverageNote: `${coveredLabel}만 수집 · 그 외 구는 미수집(unknown)`,
    },
  ];

  const topOverlap = [...prio.filter((s) => !s.isSeparateBundle)]
    .sort((a, b) => b.flags.length - a.flags.length || a.priorityRank - b.priorityRank)
    .slice(0, 10);

  const histMap = new Map<number, number>();
  for (const s of prio) histMap.set(s.flags.length, (histMap.get(s.flags.length) ?? 0) + 1);
  const maxFlags = Math.max(1, ...prio.map((s) => s.flags.length));
  const overlapHistogram = Array.from({ length: maxFlags }, (_, i) => i + 1).map((k) => ({
    flagCount: k,
    schools: histMap.get(k) ?? 0,
  }));

  const needMatrix: NeedMatrixCell[] = [];
  let needMatrixUnknown = 0;
  for (let p = 0; p <= 3; p += 1) {
    for (let r = 0; r <= 3; r += 1) needMatrix.push({ parkNeed: p, readingNeed: r, count: 0, priorityCount: 0 });
  }
  for (const s of schools) {
    if (s.parkNeed === null || s.readingNeed === null) {
      needMatrixUnknown += 1;
      continue;
    }
    const cell = needMatrix.find((c) => c.parkNeed === s.parkNeed && c.readingNeed === s.readingNeed);
    if (cell) {
      cell.count += 1;
      if (has(s, "park")) cell.priorityCount += 1;
    }
  }

  const caseGroups: [string, (s: InsightSchool) => boolean][] = [
    ["즉시 개선", (s) => s.caseType === 1],
    ["우선 검토", (s) => s.caseType === 2],
    ["모니터링", (s) => s.caseType === 3],
    ["유지·관리", (s) => s.caseType === 4],
    ["별도 정책", (s) => ![1, 2, 3, 4].includes(s.caseType)],
  ];
  const designationByCase: DesignationCaseRow[] = caseGroups.map(([caseLabel, pred]) => {
    const rows = schools.filter(pred);
    return {
      caseLabel,
      withDesignation: rows.filter((s) => (s.designationCount ?? 0) > 0).length,
      withoutDesignation: rows.filter((s) => s.designationCount === 0).length,
      welfare: rows.filter((s) => s.designationPrograms.includes("교육복지우선지원사업")).length,
    };
  });

  const guOrder: string[] = [];
  const byGu = new Map<string, InsightSchool[]>();
  for (const s of schools) {
    if (!byGu.has(s.districtName)) {
      byGu.set(s.districtName, []);
      guOrder.push(s.districtName);
    }
    byGu.get(s.districtName)!.push(s);
  }
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);
  const districtProfiles: DistrictLayerProfile[] = guOrder.map((gu) => {
    const rows = byGu.get(gu)!;
    return {
      districtName: gu,
      schoolCount: rows.length,
      parkPct: pct(cnt(rows, "park"), rows.length),
      readPct: pct(cnt(rows, "read"), rows.length),
      nightPct: pct(rows.filter((s) => s.nightlifeWithin300 >= 1).length, rows.length),
      designationPct: pct(rows.filter((s) => (s.designationCount ?? 0) > 0).length, rows.length),
      constructionCovered: rows.some((s) => s.constructionOpen !== null),
      overlap3Plus: rows.filter((s) => s.flags.length >= 3).length,
    };
  });

  const layersMeta: Record<string, any> = inputs.contextManifest?.layers ?? {};
  const layerStatus = (
    [
      ["school_designations", "지정·연구학교(2026학년도)"],
      ["nightlife_permits", "유흥·단란주점 인허가"],
      ["construction_records", "착공·사용승인 행정기록"],
    ] as [string, string][]
  ).map(([key, label]) => {
    const layer = layersMeta[key] ?? {};
    const recs = layer.record_count ?? layer.active_record_count;
    const located = layer.located_record_count;
    const fmt = (v: unknown) => Number(v).toLocaleString("ko-KR");
    return {
      key,
      label,
      status: String(layer.status ?? "unknown"),
      statusLabel: String(layer.status_label_ko ?? "미수집"),
      note: recs !== undefined ? `${fmt(recs)}건${located !== undefined ? ` · 좌표 ${fmt(located)}` : ""}` : "",
    };
  });

  return {
    schools,
    headlines,
    topOverlap,
    overlapHistogram,
    needMatrix,
    needMatrixUnknown,
    designationByCase,
    districtProfiles,
    layerStatus,
    dataAsOf: inputs.contextManifest?.data_as_of ?? inputs.contextSummary?.data_as_of ?? null,
  };
}

export function computeStatistics(inputs: StatisticsInputs): StatisticsLiveResult {
  return { city: computeCityStatistics(inputs), insight: computeInsights(inputs) };
}

// ── 로더 (브라우저) ─────────────────────────────────────────────────────
export function resolveDataBase(pathname = typeof window !== "undefined" ? window.location.pathname : "/"): string {
  const idx = pathname.indexOf("/ui-preview/");
  return idx >= 0 ? pathname.slice(0, idx + 1) : "/";
}

export const STATISTICS_DATA_FILES = {
  priority: "data_processed/school_priority_with_functional_park_layer.csv",
  forecast: "data_processed/school_enrollment_forecast_20260418_model1.csv",
  libraryAccess: "data_processed/school_library_access.csv",
  apartmentAdjustment: "data_processed/school_walk_500m_apartment_adjustment_20260504.csv",
  contextSummary: "data_processed/context/school_context_summary.json",
  contextManifest: "data_processed/context/context_layers_manifest.json",
  policyCards: "data_processed/policy_action_cards.json",
} as const;

async function fetchText(url: string, optional = false): Promise<string | null> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    if (optional) return null;
    throw new Error(`${url} → HTTP ${res.status}`);
  }
  return res.text();
}

export async function loadStatisticsLive(base = resolveDataBase()): Promise<StatisticsLiveResult> {
  const u = (rel: string) => `${base}${rel}`;
  const [priority, forecast, libraryAccess, apt, ctxSummary, ctxManifest, cards] = await Promise.all([
    fetchText(u(STATISTICS_DATA_FILES.priority)),
    fetchText(u(STATISTICS_DATA_FILES.forecast)),
    fetchText(u(STATISTICS_DATA_FILES.libraryAccess), true),
    fetchText(u(STATISTICS_DATA_FILES.apartmentAdjustment), true),
    fetchText(u(STATISTICS_DATA_FILES.contextSummary), true),
    fetchText(u(STATISTICS_DATA_FILES.contextManifest), true),
    fetchText(u(STATISTICS_DATA_FILES.policyCards), true),
  ]);
  const safeJson = (t: string | null) => {
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  };
  return computeStatistics({
    priority: parseCsv(priority as string),
    forecast: parseCsv(forecast as string),
    libraryAccess: libraryAccess ? parseCsv(libraryAccess) : [],
    apartmentAdjustment: apt ? parseCsv(apt) : null,
    contextSummary: safeJson(ctxSummary),
    contextManifest: safeJson(ctxManifest),
    policyCards: safeJson(cards),
  });
}

// ── 방법론 노트(화면 하단 작은 글씨용) ──────────────────────────────────
export const METHOD_NOTES: string[] = [
  "공원 도달 결핍 = case 1(즉시 개선)·2(우선 검토). 도보 500m 도달권(Valhalla 봉인값) 기준 공원 수·면적·녹지율로 판정.",
  "독서 결핍(내·외부) = reading_gap_type이 '학교도서관 직접투자 우선'인 학교(도보 500m 공공도서관 0개 + 사서·인당장서 지표 부족).",
  `유흥 인허가 밀집 = 학교 반경 ${INSIGHT_THRESHOLDS.nightlifeRadiusM}m(직선) 내 유흥·단란주점 인허가 ${INSIGHT_THRESHOLDS.nightlifeMinCount}건 이상. 좌표 확보 레코드만 세므로 하한 관측치이며 영업 여부·안전 판정이 아님.`,
  `착공기록 다수 = 반경 500m 내 착공기록 중 사용승인 미기록 ${INSIGHT_THRESHOLDS.constructionMinOpen}건 이상. 연수·계양·미추홀구만 수집, 주소 기반 추정 좌표, 현재 공사 여부 미확인.`,
  "지정사업 없음 = 2026학년도 인천시교육청 지정·연구·선도학교 공고에 0건(학년도 기준 추정). 지원 자격·우열 판정이 아님.",
  "학생 증가 전망 = 2029 예측 재학생(가중추세+LightGBM 잔차) > 2025 재학생.",
  "겹침 수 = 위 6개 플래그 중 해당 개수. 통합 우선 학교는 공원 우선대상(별도 묶음 제외) 중 겹침 수 내림차순 → 우선순위 rank 오름차순.",
  "수요 매트릭스 = 정책 행동 카드의 park_need × reading_need(0~3). 별도 트랙·자료 공백 학교는 판정 보류.",
  "구별 비율은 해당 구 초등학교 수 대비. 미수집 레이어는 0%가 아니라 '미수집'으로 표기.",
  "시·구 통계(case 분포·Top 5·최우수 학교·잠재 수요)는 기존 규칙(generate_statistics_preview_data_safe.py)과 동일하며, 이제 화면을 열 때마다 최신 데이터 파일로 다시 계산됩니다.",
];
