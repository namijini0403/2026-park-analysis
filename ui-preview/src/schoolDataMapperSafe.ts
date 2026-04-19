import type { SchoolDetailReportProps } from "./SchoolDetailReportPagePreview";
import { CASE_LABELS } from "./SchoolDetailReportPagePreview";

// 2026-04-18 갱신: OSMnx v2 + 공원원 합집합 교차 면적 수정 반영 (active schools, N=240)
const CITY_AVG = {
  nearestParkDist: 378.886,
  greenRatio: 8.068,
  playgroundCount: 0.383,
  studentTrendPct: -8.470,
};

export interface Candidate {
  grid_id: string;
  cx: number;
  cy: number;
  xgb_predicted_2029: number;
  xgb_predicted_2031: number;
  resident_children_2029: number;
  resident_children_2031: number;
  walkshed_potential_2029: number;
  walkshed_potential_2031: number;
  nearest_park_dist: number;
  nearest_pg_dist: number;
  nearest_school_dist: number;
  nearest_apt_dist: number;
  land_feasibility_level: "high" | "medium" | "low";
  linked_schools: string[];
  is_school_internal?: boolean;
  ai_score?: number;
}

type RawRow = Record<string, unknown>;

function n(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function s(value: unknown, fallback = ""): string {
  return value != null ? String(value) : fallback;
}

type ManualBarrierOverride = {
  nearestParkName?: string;
  note: string;
};

const MANUAL_BARRIER_OVERRIDES: Record<string, ManualBarrierOverride> = {
  B000025206: { nearestParkName: "동춘1구역근린공원", note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000002963: { nearestParkName: "화도진공원", note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000003102: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 2번 지나야 합니다." },
  B000003132: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번 지나야 합니다." },
  B000002981: { nearestParkName: "다솔어린이공원", note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000025246: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번 지나야 합니다." },
  B000002959: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번 지나야 합니다." },
  B000025189: { note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000025236: { note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000003158: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번 지나야 합니다." },
  B000026504: { note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000003048: { nearestParkName: "달빛공원", note: "공원까지 가는 길에는 차가 많고 폭이 넓은 대로 같은 큰 단절 요소가 없어, 비교적 안전하게 이동할 수 있습니다." },
  B000003123: { note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번, 중간급 도로를 1번 지나야 합니다." },
  B000003144: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 중간급 도로를 2번 지나야 합니다." },
  B000003077: { note: "공원까지 가려면 중간급 도로를 1번 지나야 합니다." },
  B000002990: { note: "공원까지 가려면 중간급 도로를 1번 지나야 합니다." },
  B000003145: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 차가 많고 폭이 넓은 도시 대로를 1번, 중간급 도로를 1번 지나야 합니다." },
  B000003029: { note: "공원까지 가려면 중간급 도로를 1번 지나야 합니다." },
};

function isSpecialPolicySchool(row: RawRow): boolean {
  const caseLabel = s(row.case_label).trim();
  const separateBundleTag = n(row.is_separate_bundle_tag);
  const islandTag = n(row.is_island_tag);
  const caseTypeRaw = s(row.case_type).trim().toLowerCase();
  return (
    caseLabel === "별도 묶음" ||
    separateBundleTag === 1 ||
    islandTag === 1 ||
    caseTypeRaw === "99" ||
    caseTypeRaw === "island"
  );
}

function getDisplayedDemand(
  row: RawRow,
  year: 2029 | 2031,
): number {
  return n(year === 2029 ? row.forecast_2029 ?? row.predicted_2029 ?? row.target_2029 : row.forecast_2031 ?? row.predicted_2031 ?? row.target_2031);
}

function getCaseLabels(caseType: number): { policy: string; status: string } {
  const key = caseType as keyof typeof CASE_LABELS;
  return CASE_LABELS[key] ?? CASE_LABELS[1];
}

function getCaseType(row: RawRow, fallback = 1): number {
  if (isSpecialPolicySchool(row)) return 99;
  return n(row.case_type, fallback);
}

function getSchoolName(row: RawRow) {
  return s(row["학교명"] ?? row.school_name, "학교");
}

function getManualBarrierOverride(row: RawRow): ManualBarrierOverride | undefined {
  const schoolId = s(row["학교ID"] ?? row.school_id);
  return MANUAL_BARRIER_OVERRIDES[schoolId];
}

function buildProblemTags(row: RawRow): string[] {
  const tags: string[] = [];
  const dist = n(row.nearest_park_dist_m, 9999);
  const green = n(row.iso_green_ratio);
  const pg = n(row.iso_playground_count);

  if (dist >= 800) {
    tags.push("도보권 공원이 없어 공원 접근이 단절된 상태입니다");
  } else if (dist >= 500) {
    tags.push("가장 가까운 공원까지의 이동 거리가 긴 편입니다");
  }

  if (green === 0) {
    tags.push("녹지 비율이 0%로 확인됩니다");
  } else if (green < 3) {
    tags.push("생활권 녹지 비율이 매우 낮습니다");
  }

  if (pg === 0) {
    tags.push("도보 접근 가능한 놀이터가 없습니다");
  }

  const demand2029 = n(row.forecast_2029);
  if (demand2029 >= 400) {
    tags.push("잠재 수요가 높아 개선 우선순위가 큽니다");
  }

  if (!tags.length) {
    tags.push("종합 생활환경 지표는 평균 범위 안에 있습니다");
  }

  return tags.slice(0, 4);
}

function buildContextTags(row: RawRow): string[] {
  const tags: string[] = [];
  const caseType = getCaseType(row, 0);
  if (caseType === 1 || caseType === 3) {
    tags.push("보행 동선에 단절 구간이 있을 가능성이 있습니다");
  }
  tags.push("학교 주변에 바로 접근 가능한 녹지나 놀이터가 부족합니다");
  tags.push("주거 밀도 대비 아동 체류 공간이 부족합니다");
  if (caseType === 99) {
    tags.unshift("도서·분교 등 별도 여건을 반영한 정책 검토가 필요한 학교입니다");
  }
  return tags.slice(0, 3);
}

function avgBlock(row: RawRow, key: "_cityAvg" | "_districtAvg") {
  const value = row[key];
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  return {
    nearestParkDistanceM: n(obj.nearestParkDistanceM, CITY_AVG.nearestParkDist),
    greenRatio: n(obj.greenRatio, CITY_AVG.greenRatio),
    playgroundCount: n(obj.playgroundCount, CITY_AVG.playgroundCount),
    studentTrendPct: n(obj.studentTrendPct, CITY_AVG.studentTrendPct),
  };
}

export function mapSchoolRowToReportProps(
  row: RawRow,
  onSimulationClick?: () => void
): SchoolDetailReportProps {
  const schoolName = getSchoolName(row);
  const gu = s(row.gu ?? row["gu"]);
  const districtName = gu ? `인천광역시 ${gu}` : "인천광역시";

  const caseType = getCaseType(row, 1);
  const { policy: casePolicyLabel, status: caseStatusLabel } = getCaseLabels(caseType);

  const nearestParkDistanceM = n(row.nearest_park_dist_m);
  const manualBarrierOverride = getManualBarrierOverride(row);
  const nearestParkName = s(manualBarrierOverride?.nearestParkName ?? row.nearest_park_name ?? row.nearest_park_name_clean ?? "");
  const greenRatio = n(row.iso_green_ratio);
  const playgroundCount = n(row.iso_playground_count);

  const cityAvg = avgBlock(row, "_cityAvg");
  const districtAvg = avgBlock(row, "_districtAvg");

  const rawTrend = Array.isArray(row.studentTrend)
    ? (row.studentTrend as Array<{ year: number; students: number }>)
    : [];
  const studentTrend = rawTrend.map((item) => ({
    year: String(item.year),
    value: Number(item.students),
  }));

  let studentTrendChangePct = 0;
  if (rawTrend.length >= 2) {
    const first = rawTrend[0].students;
    const last = rawTrend[rawTrend.length - 1].students;
    if (first > 0) studentTrendChangePct = ((last - first) / first) * 100;
  }

  const currentStudentCount2025 = rawTrend.length
    ? rawTrend[rawTrend.length - 1].students
    : n(row.current_students_2025 ?? row.current_student_count ?? row.predicted_current);
  const potentialDemand2029 = getDisplayedDemand(row, 2029);
  const potentialDemand2031 = getDisplayedDemand(row, 2031);

  const similarSchools = [1, 2, 3, 4, 5]
    .map((i) => ({
      schoolName: s(row[`similar_school_${i}_name`]),
      districtName: s(row[`similar_school_${i}_gu`] ?? row[`similar_school_${i}_districtName`] ?? ""),
      nearestParkDistanceM: n(row[`similar_school_${i}_nearest_park_dist_m`]),
      greenRatio: n(row[`similar_school_${i}_iso_green_ratio`]),
      playgroundCount: n(row[`similar_school_${i}_iso_playground_count`]),
    }))
    .filter((item) => item.schoolName !== "");

  const cityBestEnvironmentSchool = row._cityBest && typeof row._cityBest === "object"
    ? {
        schoolName: s((row._cityBest as Record<string, unknown>).schoolName),
        districtName: s((row._cityBest as Record<string, unknown>).districtName),
        nearestParkDistanceM: n((row._cityBest as Record<string, unknown>).nearestParkDistanceM),
        greenRatio: n((row._cityBest as Record<string, unknown>).greenRatio),
        playgroundCount: n((row._cityBest as Record<string, unknown>).playgroundCount),
      }
    : undefined;

  const districtBestEnvironmentSchool = row._districtBest && typeof row._districtBest === "object"
    ? {
        schoolName: s((row._districtBest as Record<string, unknown>).schoolName),
        districtName: s((row._districtBest as Record<string, unknown>).districtName),
        nearestParkDistanceM: n((row._districtBest as Record<string, unknown>).nearestParkDistanceM),
        greenRatio: n((row._districtBest as Record<string, unknown>).greenRatio),
        playgroundCount: n((row._districtBest as Record<string, unknown>).playgroundCount),
      }
    : undefined;

  return {
    schoolName,
    districtName,
    casePolicyLabel,
    caseStatusLabel,
    nearestParkDistanceM,
    ...(nearestParkName ? { nearestParkName } : {}),
    ...(manualBarrierOverride?.note ? { nearestParkAccessNote: manualBarrierOverride.note } : {}),
    nearestParkDistanceCityAvg: cityAvg?.nearestParkDistanceM ?? CITY_AVG.nearestParkDist,
    nearestParkDistanceDistrictAvg: districtAvg?.nearestParkDistanceM ?? cityAvg?.nearestParkDistanceM ?? CITY_AVG.nearestParkDist,
    greenRatio,
    greenRatioCityAvg: cityAvg?.greenRatio ?? CITY_AVG.greenRatio,
    greenRatioDistrictAvg: districtAvg?.greenRatio ?? cityAvg?.greenRatio ?? CITY_AVG.greenRatio,
    playgroundCount,
    playgroundCountCityAvg: cityAvg?.playgroundCount ?? CITY_AVG.playgroundCount,
    playgroundCountDistrictAvg: districtAvg?.playgroundCount ?? cityAvg?.playgroundCount ?? CITY_AVG.playgroundCount,
    studentTrend,
    studentTrendChangePct,
    studentTrendCityAvg: cityAvg?.studentTrendPct ?? CITY_AVG.studentTrendPct,
    studentTrendDistrictAvg: districtAvg?.studentTrendPct ?? cityAvg?.studentTrendPct ?? CITY_AVG.studentTrendPct,
    currentStudentCount2025,
    potentialDemand2029,
    potentialDemand2031,
    noParkWithin500m: nearestParkDistanceM === 0 || nearestParkDistanceM >= 500,
    accessibilityRatio: n(row.access_ratio),
    similarSchools: similarSchools.length ? similarSchools : undefined,
    ...(cityBestEnvironmentSchool ? { cityBestEnvironmentSchool } : {}),
    ...(districtBestEnvironmentSchool ? { districtBestEnvironmentSchool } : {}),
    problemTags: buildProblemTags(row),
    contextTags: buildContextTags(row),
    ...(onSimulationClick ? { onSimulationClick } : {}),
  };
}

const FEASIBILITY_LEVELS = new Set(["high", "medium", "low"]);

export function mapCandidateFeatures(
  features: RawRow[],
  schoolLat: number,
  schoolLng: number
): Candidate[] {
  const external: Candidate[] = features.map((p) => ({
    grid_id: s(p.grid_id, "CG_?"),
    cx: n(p.cx),
    cy: n(p.cy),
    resident_children_2029: n(p.pred_beneficiary_2029 ?? p.xgb_predicted_2029 ?? p.forecast_2029),
    resident_children_2031: n(p.pred_beneficiary_2031 ?? p.xgb_predicted_2031 ?? p.forecast_2031),
    walkshed_potential_2029: n(p.walkshed_beneficiary_2029 ?? p.pred_beneficiary_2029 ?? p.xgb_predicted_2029 ?? p.forecast_2029),
    walkshed_potential_2031: n(p.walkshed_beneficiary_2031 ?? p.pred_beneficiary_2031 ?? p.xgb_predicted_2031 ?? p.forecast_2031),
    xgb_predicted_2029: n(p.xgb_predicted_2029 ?? p.forecast_2029),
    xgb_predicted_2031: n(p.xgb_predicted_2031 ?? p.forecast_2031),
    nearest_park_dist: n(p.nearest_park_dist ?? p.avg_park_dist_m),
    nearest_pg_dist: n(p.nearest_pg_dist ?? p.nearest_pg_dist_m ?? p.avg_pg_dist_m),
    nearest_school_dist: n(p.nearest_school_dist),
    nearest_apt_dist: n(p.nearest_apt_dist),
    land_feasibility_level: FEASIBILITY_LEVELS.has(s(p.land_feasibility_level))
      ? (s(p.land_feasibility_level) as "high" | "medium" | "low")
      : "medium",
    linked_schools: Array.isArray(p.linked_schools) ? (p.linked_schools as string[]) : [],
  }));

  const schoolInternal: Candidate = {
    grid_id: "SCHOOL_INT",
    cx: schoolLng,
    cy: schoolLat,
    resident_children_2029: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.resident_children_2029, 0) / external.length)
      : 0,
    resident_children_2031: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.resident_children_2031, 0) / external.length)
      : 0,
    walkshed_potential_2029: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.walkshed_potential_2029, 0) / external.length)
      : 0,
    walkshed_potential_2031: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.walkshed_potential_2031, 0) / external.length)
      : 0,
    xgb_predicted_2029: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.xgb_predicted_2029, 0) / external.length)
      : 0,
    xgb_predicted_2031: external.length
      ? Math.round(external.reduce((sum, item) => sum + item.xgb_predicted_2031, 0) / external.length)
      : 0,
    nearest_park_dist: 0,
    nearest_pg_dist: 0,
    nearest_school_dist: 0,
    nearest_apt_dist: 0,
    land_feasibility_level: "high",
    linked_schools: [],
    is_school_internal: true,
  };

  return [schoolInternal, ...external];
}
