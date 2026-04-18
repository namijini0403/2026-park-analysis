import type { SchoolDetailReportProps } from "./SchoolDetailReportPagePreview";
import { CASE_LABELS } from "./SchoolDetailReportPagePreview";

// 도시 전체 평균 (분석 결과에서 산출 — 2026-04-18 OSMnx v2 + 공원원 합집합 수정 반영, active schools N=240)
const CITY_AVG = {
  nearestParkDist: 378.886,
  greenRatio: 8.068,
  playgroundCount: 0.383,
  studentTrendPct: -8.470,
};

// Candidate interface (SimulationPage.tsx와 동일)
export interface Candidate {
  grid_id: string;
  cx: number;
  cy: number;
  xgb_predicted_2029: number;
  xgb_predicted_2031: number;
  nearest_park_dist: number;
  nearest_pg_dist: number;
  nearest_school_dist: number;
  nearest_apt_dist: number;
  land_feasibility_level: "high" | "medium" | "low";
  linked_schools: string[];
  is_school_internal?: boolean;
  ai_score?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

function n(v: unknown, fallback = 0): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function s(v: unknown, fallback = ""): string {
  return v != null ? String(v) : fallback;
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

function buildProblemTags(row: RawRow): string[] {
  const tags: string[] = [];
  const dist = n(row.nearest_park_dist_m, 9999);
  const green = n(row.iso_green_ratio);
  const pg = n(row.iso_playground_count);

  if (dist >= 800)
    tags.push("도보권 공원이 없어 공원 접근이 단절된 상태입니다");
  else if (dist >= 500)
    tags.push("가장 가까운 공원까지의 거리가 전체 평균보다 깁니다");

  if (green === 0)
    tags.push("녹지 비율과 도보권 놀이터 수가 모두 0입니다");
  else if (green < 3)
    tags.push("도보권 녹지 비율이 매우 낮습니다");

  if (pg === 0)
    tags.push("도보 접근 가능한 놀이터가 없습니다");

  const demand2029 = n(row.forecast_2029 ?? row.cohort_change_2029);
  if (demand2029 >= 400)
    tags.push("도보권 아동 수가 높아 개선 우선순위가 큽니다");

  if (!tags.length)
    tags.push("종합 환경 지표가 전체 평균 이하입니다");

  return tags.slice(0, 4);
}

function buildContextTags(row: RawRow): string[] {
  const tags: string[] = [];
  const caseType = n(row.case_type);
  if (caseType === 1 || caseType === 3)
    tags.push("보행 동선에 대로 횡단 구간이 있을 수 있습니다");
  tags.push("학교 주변에서 바로 대체할 수 있는 공원 선택지가 제한적입니다");
  tags.push("주거 밀도 대비 아동 체류 공간이 부족합니다");
  return tags.slice(0, 3);
}

export function mapSchoolRowToReportProps(
  row: RawRow,
  onSimulationClick?: () => void
): SchoolDetailReportProps {
  const schoolName = s(row["학교명"] ?? row.school_name, "학교");
  const gu = s(row.gu ?? row["gu"]);
  const districtName = gu ? `인천광역시 ${gu}` : "인천광역시";

  const caseType = n(row.case_type, 1);
  const { policy: casePolicyLabel, status: caseStatusLabel } = getCaseLabels(caseType);

  const nearestParkDistanceM = n(row.nearest_park_dist_m);
  const nearestParkName = s(row.nearest_park_name ?? row.nearest_park_name_clean ?? "");

  const greenRatio = n(row.iso_green_ratio);
  const playgroundCount = n(row.iso_playground_count);

  // 학생수 추세: enrichSchoolRows에서 {year, students}[] 로 저장됨
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawTrend: Array<{ year: number; students: number }> = Array.isArray(row.studentTrend)
    ? row.studentTrend
    : [];
  const studentTrend = rawTrend.map((t) => ({
    year: String(t.year),
    value: Number(t.students),
  }));

  // 학생수 변화율 (마지막 - 첫번째) / 첫번째 * 100
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

  // 유사 학교 (similar_school_1_name ~ similar_school_5_name)
  // index.html renderSchoolDetail에서 similar_school_i_nearest_park_dist_m 등을 보강해 저장
  const similarSchools = [1, 2, 3, 4, 5]
    .map((i) => ({
      schoolName: s(row[`similar_school_${i}_name`]),
      districtName: s(row[`similar_school_${i}_gu`] ?? ""),
      nearestParkDistanceM: n(row[`similar_school_${i}_nearest_park_dist_m`]),
      greenRatio: n(row[`similar_school_${i}_iso_green_ratio`]),
      playgroundCount: n(row[`similar_school_${i}_iso_playground_count`]),
    }))
    .filter((sc) => sc.schoolName !== "");

  const noParkWithin500m = nearestParkDistanceM === 0 || nearestParkDistanceM >= 500;
  const accessibilityRatio = n(row.access_ratio);

  // 시·구 최우수 학교 (index.html에서 보강 저장)
  const cityBestEnvironmentSchool = row._cityBest
    ? {
        schoolName: s(row._cityBest.schoolName),
        districtName: s(row._cityBest.districtName),
        nearestParkDistanceM: n(row._cityBest.nearestParkDistanceM),
        greenRatio: n(row._cityBest.greenRatio),
        playgroundCount: n(row._cityBest.playgroundCount),
      }
    : undefined;

  const districtBestEnvironmentSchool = row._districtBest
    ? {
        schoolName: s(row._districtBest.schoolName),
        districtName: s(row._districtBest.districtName),
        nearestParkDistanceM: n(row._districtBest.nearestParkDistanceM),
        greenRatio: n(row._districtBest.greenRatio),
        playgroundCount: n(row._districtBest.playgroundCount),
      }
    : undefined;

  return {
    schoolName,
    districtName,
    casePolicyLabel,
    caseStatusLabel,
    nearestParkDistanceM,
    ...(nearestParkName ? { nearestParkName } : {}),
    nearestParkDistanceCityAvg: CITY_AVG.nearestParkDist,
    nearestParkDistanceDistrictAvg: CITY_AVG.nearestParkDist, // 구별 평균 미확보 → 전체 평균 대체
    greenRatio,
    greenRatioCityAvg: CITY_AVG.greenRatio,
    greenRatioDistrictAvg: CITY_AVG.greenRatio,
    playgroundCount,
    playgroundCountCityAvg: CITY_AVG.playgroundCount,
    playgroundCountDistrictAvg: CITY_AVG.playgroundCount,
    studentTrend,
    studentTrendChangePct,
    studentTrendCityAvg: CITY_AVG.studentTrendPct,
    studentTrendDistrictAvg: CITY_AVG.studentTrendPct,
    currentStudentCount2025,
    potentialDemand2029,
    potentialDemand2031,
    noParkWithin500m,
    accessibilityRatio,
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
    xgb_predicted_2029: n(p.xgb_predicted_2029 ?? p.forecast_2029),
    xgb_predicted_2031: n(p.xgb_predicted_2031 ?? p.forecast_2031),
    nearest_park_dist: n(p.avg_park_dist_m),
    nearest_pg_dist: 0,
    nearest_school_dist: 0,
    nearest_apt_dist: 0,
    land_feasibility_level: FEASIBILITY_LEVELS.has(s(p.land_feasibility_level))
      ? (s(p.land_feasibility_level) as "high" | "medium" | "low")
      : "medium",
    linked_schools: Array.isArray(p.linked_schools) ? p.linked_schools : [],
  }));

  // 교내 시설 후보 (학교 좌표에 고정)
  const schoolInternal: Candidate = {
    grid_id: "SCHOOL_INT",
    cx: schoolLng,
    cy: schoolLat,
    xgb_predicted_2029: external.length
      ? Math.round(external.reduce((s, c) => s + c.xgb_predicted_2029, 0) / external.length)
      : 0,
    xgb_predicted_2031: external.length
      ? Math.round(external.reduce((s, c) => s + c.xgb_predicted_2031, 0) / external.length)
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
