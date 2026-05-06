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
  barrier_counts?: Record<"motorway" | "trunk" | "primary" | "secondary" | "tertiary", number>;
  barrier_severity?: "green" | "yellow" | "orange" | "red";
  barrier_severity_label?: string;
  barrier_color?: string;
  barrier_note?: string;
  route_length_m?: number;
  route_coords?: Array<[number, number]>;
  fallback_candidate?: boolean;
  fallback_distance_basis?: string;
  candidate_display_tier?: string;
  candidate_display_label?: string;
  fallback_distance_limit_m?: number;
  fallback_explanation?: string;
  has_large_apt?: boolean;
  redev_flag?: boolean;
  redev_level?: string;
  redev_warning_text?: string;
  accident_hotspot_flag?: boolean;
  accident_hotspot_text?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

function n(v: unknown, fallback = 0): number {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

function maybeNumber(v: unknown): number | null {
  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function s(v: unknown, fallback = ""): string {
  return v != null ? String(v) : fallback;
}

type ManualBarrierOverride = {
  nearestParkName?: string;
  note: string;
};

const MANUAL_BARRIER_OVERRIDES: Record<string, ManualBarrierOverride> = {
  B000025206: { nearestParkName: "동춘1구역근린공원", note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000002963: { nearestParkName: "화도진공원", note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003102: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 2번 지나야 합니다." },
  B000003132: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번 지나야 합니다." },
  B000002981: { nearestParkName: "다솔어린이공원", note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000025246: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번 지나야 합니다." },
  B000002959: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번 지나야 합니다." },
  B000025189: { note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000025236: { note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003158: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번 지나야 합니다." },
  B000026504: { note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003048: { nearestParkName: "달빛공원", note: "공원까지 가는 길에는 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003123: { note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번, 중간급 간선도로를 1번 지나야 합니다." },
  B000003144: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 중간급 간선도로를 2번 지나야 합니다." },
  B000003077: { note: "공원까지 가려면 중간급 간선도로를 1번 지나야 합니다." },
  B000002990: { note: "공원까지 가려면 중간급 간선도로를 1번 지나야 합니다." },
  B000003145: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 차가 많고 폭이 넓은 주요 도시 간선도로를 1번, 중간급 간선도로를 1번 지나야 합니다." },
  B000003029: { note: "공원까지 가려면 중간급 간선도로를 1번 지나야 합니다." },
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

function buildCaseStatusLabel(row: RawRow, cityAvgGreenRatio = CITY_AVG.greenRatio): string {
  if (isSpecialPolicySchool(row)) return CASE_LABELS[99].status;

  const nearestParkDistanceM = n(row.nearest_park_dist_m, 9999);
  const greenRatio = n(row.iso_green_ratio);
  const playgroundCount = n(row.iso_playground_count);
  const hasParkWithin500m = n(row.iso_park_count) > 0 && nearestParkDistanceM < 500;
  const strongGreenThreshold = Math.max(4, cityAvgGreenRatio * 0.7);

  if (!hasParkWithin500m) return "공원 접근 결핍";
  if (greenRatio === 0) return "공원 접근 가능 · 녹지 없음";
  if (greenRatio < 3) return "공원 접근 가능 · 녹지 부족";
  if (playgroundCount === 0) return "공원 접근 가능 · 놀이환경 부족";
  if (nearestParkDistanceM <= 300 && greenRatio >= strongGreenThreshold) return "공원 접근 양호";
  return "공원 접근 가능 · 생활환경 보완 필요";
}

function getCaseType(row: RawRow, fallback = 1): number {
  if (isSpecialPolicySchool(row)) return 99;
  return n(row.case_type, fallback);
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

  if (dist >= 800)
    tags.push("도보권 공원이 없어 공원 접근성이 결핍된 상태입니다");
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
  const caseType = getCaseType(row, 0);
  if (caseType === 1 || caseType === 3)
    tags.push("보행 동선에 대로 횡단 구간이 있을 수 있습니다");
  tags.push("학교 주변에서 바로 대체할 수 있는 공원 선택지가 제한적입니다");
  tags.push("주거 밀도 대비 아동 체류 공간이 부족합니다");
  if (caseType === 99)
    tags.unshift("도서·분교 등 별도 여건을 반영한 정책 검토가 필요한 학교입니다");
  return tags.slice(0, 3);
}

export function mapSchoolRowToReportProps(
  row: RawRow,
  onSimulationClick?: () => void
): SchoolDetailReportProps {
  const schoolName = s(row["학교명"] ?? row.school_name, "학교");
  const gu = s(row.gu ?? row["gu"]);
  const districtName = gu ? `인천광역시 ${gu}` : "인천광역시";

  const caseType = getCaseType(row, 1);
  const { policy: casePolicyLabel } = getCaseLabels(caseType);

  const nearestParkDistanceM = n(row.nearest_park_dist_m);
  const manualBarrierOverride = getManualBarrierOverride(row);
  const nearestParkName = s(manualBarrierOverride?.nearestParkName ?? row.nearest_park_name ?? row.nearest_park_name_clean ?? "");

  const greenRatio = n(row.iso_green_ratio);
  const playgroundCount = n(row.iso_playground_count);
  const caseStatusLabel = buildCaseStatusLabel(row, CITY_AVG.greenRatio);

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
      rank: i,
      similarityDistance: Number.isFinite(Number(row[`similar_school_${i}_distance`]))
        ? Number(row[`similar_school_${i}_distance`])
        : undefined,
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
    ...(manualBarrierOverride?.note ? { nearestParkAccessNote: manualBarrierOverride.note } : {}),
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
    ...(Number.isFinite(Number(row.knn_k)) ? { similarityK: n(row.knn_k) } : {}),
    ...(s(row.selection_features || row.similarity_features) ? { similaritySelectionFeatures: s(row.selection_features || row.similarity_features) } : {}),
    ...(s(row.comparison_features) ? { similarityComparisonFeatures: s(row.comparison_features) } : {}),
    ...(s(row.common_points || row.common_traits) ? { similarityCommonPoints: s(row.common_points || row.common_traits) } : {}),
    ...(s(row.relative_strengths) ? { similarityStrengthsText: s(row.relative_strengths) } : {}),
    ...(s(row.relative_weaknesses) ? { similarityWeaknessesText: s(row.relative_weaknesses) } : {}),
    ...(Number.isFinite(Number(row.peer_avg_nearest_park_dist_m))
      ? { similarityPeerAvgNearestParkDistanceM: n(row.peer_avg_nearest_park_dist_m) }
      : {}),
    ...(Number.isFinite(Number(row.peer_avg_iso_green_ratio))
      ? { similarityPeerAvgGreenRatio: n(row.peer_avg_iso_green_ratio) }
      : {}),
    ...(Number.isFinite(Number(row.peer_avg_iso_playground_count))
      ? { similarityPeerAvgPlaygroundCount: n(row.peer_avg_iso_playground_count) }
      : {}),
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
  schoolLng: number,
  schoolDemand?: {
    predicted2029?: number;
    predicted2031?: number;
  }
): Candidate[] {
  const external: Candidate[] = features.map((p) => ({
    grid_id: s(p.grid_id, "CG_?"),
    cx: n(p.cx),
    cy: n(p.cy),
    resident_children_2029: n(p.pred_beneficiary_2029 ?? p.xgb_predicted_2029 ?? p.forecast_2029),
    resident_children_2031: n(p.pred_beneficiary_2031 ?? p.xgb_predicted_2031 ?? p.forecast_2031),
    walkshed_potential_2029: n(p.walkshed_beneficiary_2029 ?? p.pred_beneficiary_2029 ?? p.xgb_predicted_2029 ?? p.forecast_2029),
    walkshed_potential_2031: n(p.walkshed_beneficiary_2031 ?? p.pred_beneficiary_2031 ?? p.xgb_predicted_2031 ?? p.forecast_2031),
    xgb_predicted_2029: n(p.pred_beneficiary_2029 ?? p.xgb_predicted_2029 ?? p.forecast_2029),
    xgb_predicted_2031: n(p.pred_beneficiary_2031 ?? p.xgb_predicted_2031 ?? p.forecast_2031),
    nearest_park_dist: n(p.nearest_park_dist ?? p.avg_park_dist_m),
    nearest_pg_dist: n(p.nearest_pg_dist ?? p.nearest_pg_dist_m ?? p.avg_pg_dist_m),
    nearest_school_dist: maybeNumber(p.route_length_m ?? p.nearest_school_dist) ?? 9999,
    nearest_apt_dist: maybeNumber(p.nearest_apt_dist) ?? 9999,
    land_feasibility_level: FEASIBILITY_LEVELS.has(s(p.land_feasibility_level))
      ? (s(p.land_feasibility_level) as "high" | "medium" | "low")
      : "medium",
    linked_schools: Array.isArray(p.linked_schools) ? p.linked_schools : [],
    ...(p.barrier_counts && typeof p.barrier_counts === "object"
      ? {
          barrier_counts: p.barrier_counts as Record<"motorway" | "trunk" | "primary" | "secondary" | "tertiary", number>,
        }
      : {}),
    ...(s(p.barrier_severity) ? { barrier_severity: s(p.barrier_severity) as "green" | "yellow" | "orange" | "red" } : {}),
    ...(s(p.barrier_severity_label) ? { barrier_severity_label: s(p.barrier_severity_label) } : {}),
    ...(s(p.barrier_color) ? { barrier_color: s(p.barrier_color) } : {}),
    ...(s(p.barrier_note) ? { barrier_note: s(p.barrier_note) } : {}),
    ...(Number.isFinite(Number(p.route_length_m)) ? { route_length_m: n(p.route_length_m) } : {}),
    ...(Array.isArray(p.route_coords)
      ? {
          route_coords: (p.route_coords as Array<[number, number]>)
            .filter((item) => Array.isArray(item) && item.length === 2)
            .map((item) => [n(item[0]), n(item[1])] as [number, number]),
        }
      : {}),
    ...(p.fallback_candidate ? { fallback_candidate: true } : {}),
    ...(s(p.fallback_distance_basis) ? { fallback_distance_basis: s(p.fallback_distance_basis) } : {}),
    ...(s(p.candidate_display_tier) ? { candidate_display_tier: s(p.candidate_display_tier) } : {}),
    ...(s(p.candidate_display_label) ? { candidate_display_label: s(p.candidate_display_label) } : {}),
    ...(Number.isFinite(Number(p.fallback_distance_limit_m)) ? { fallback_distance_limit_m: n(p.fallback_distance_limit_m) } : {}),
    ...(s(p.fallback_explanation) ? { fallback_explanation: s(p.fallback_explanation) } : {}),
    ...(p.has_large_apt != null ? { has_large_apt: Boolean(p.has_large_apt) } : {}),
    ...(p.redev_flag != null ? { redev_flag: Boolean(p.redev_flag) } : {}),
    ...(s(p.redev_level) ? { redev_level: s(p.redev_level) } : {}),
    ...(s(p.redev_warning_text) ? { redev_warning_text: s(p.redev_warning_text) } : {}),
    ...(p.accident_hotspot_flag != null
      ? { accident_hotspot_flag: Boolean(p.accident_hotspot_flag) }
      : p.accident_buffer_flag != null
        ? { accident_hotspot_flag: Boolean(p.accident_buffer_flag) }
        : p.passes_accident_hotspot != null
          ? { accident_hotspot_flag: Boolean(p.passes_accident_hotspot) }
          : {}),
    ...(s(p.accident_hotspot_text ?? p.accident_buffer_text) ? { accident_hotspot_text: s(p.accident_hotspot_text ?? p.accident_buffer_text) } : {}),
  }));

  // 교내 시설 후보 (학교 좌표에 고정)
  const schoolInternal: Candidate = {
    grid_id: "SCHOOL_INT",
    cx: schoolLng,
    cy: schoolLat,
    resident_children_2029: Math.round(n(schoolDemand?.predicted2029)),
    resident_children_2031: Math.round(n(schoolDemand?.predicted2031)),
    walkshed_potential_2029: Math.round(n(schoolDemand?.predicted2029)),
    walkshed_potential_2031: Math.round(n(schoolDemand?.predicted2031)),
    xgb_predicted_2029: Math.round(n(schoolDemand?.predicted2029)),
    xgb_predicted_2031: Math.round(n(schoolDemand?.predicted2031)),
    nearest_park_dist: 0,
    nearest_pg_dist: 0,
    nearest_school_dist: 0,
    nearest_apt_dist: 0,
    land_feasibility_level: "high",
    linked_schools: [],
    is_school_internal: true,
    barrier_counts: { motorway: 0, trunk: 0, primary: 0, secondary: 0, tertiary: 0 },
    barrier_severity: "green",
    barrier_severity_label: "?숆탳 ?대? ?ㅼ튂",
    barrier_color: "#2980b9",
    barrier_note: "학교 안에 설치하는 경우에는 외부 유입 수요보다 해당 학교의 예상 학생 규모를 기준으로 활용 가능 인원을 보는 편이 더 적절합니다.",
  };

  return [schoolInternal, ...external];
}
