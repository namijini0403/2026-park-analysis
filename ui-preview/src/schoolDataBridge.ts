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
  pareto_candidate?: boolean;
  top5_stability_score?: number;
  mean_rank?: number;
  rank_std?: number;
  robust_rank?: number;
  recommendation_type?: string | null;
  robust_recommendation_reason?: string | null;
  predicted_beneficiaries_used?: number;
  shap_diagnostic_tag?: string | null;
  shap_positive_drivers?: Array<{ feature: string; value: number; shap_value: number }>;
  shap_negative_drivers?: Array<{ feature: string; value: number; shap_value: number }>;
  shap_explanation_text?: string | null;
  shap_waterfall_image_path?: string | null;
}

type RawRow = Record<string, unknown>;

type LegacySchoolSnapshot = {
  school_id?: string | null;
  school_name?: string | null;
  gu?: string | null;
  legacy_case_label?: string | null;
  legacy_badge_text?: string | null;
  legacy_status_message?: string | null;
  legacy_nearest_park_name?: string | null;
  legacy_nearest_park_distance_m?: number | null;
  legacy_iso_park_count?: number | null;
  legacy_buf_park_count?: number | null;
  legacy_iso_playground_count?: number | null;
  legacy_buf_playground_count?: number | null;
  legacy_iso_green_ratio?: number | null;
  legacy_access_ratio?: number | null;
  legacy_gap_count?: number | null;
  legacy_student_trend?: Array<{ year: string; value: number }>;
  legacy_similar_schools?: Array<{
    schoolName: string;
    districtName: string;
    nearestParkDistanceM: number;
    greenRatio: number;
    playgroundCount: number;
  }>;
  legacy_missing_fields?: string[];
};

function n(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function maybeNumber(value: unknown): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function s(value: unknown, fallback = ""): string {
  return value != null ? String(value) : fallback;
}

function activityScaleText(value: string): string {
  return value
    .replace(/활동 가능 공원/g, "활동규모 공원")
    .replace(/활동공원/g, "활동규모 공원")
    .replace(/활동 가능/g, "활동규모");
}

function boolFlag(value: unknown): boolean {
  return value === true || s(value).toLowerCase() === "true";
}

function getDisplayGreenRatio(row: RawRow): number {
  return (
    maybeNumber(row.display_green_ratio) ??
    maybeNumber(row.corrected_green_ratio) ??
    maybeNumber(row.iso_green_ratio) ??
    0
  );
}

function getSimilarSchoolGreenRatio(row: RawRow, index: number): number {
  return (
    maybeNumber(row[`similar_school_${index}_display_green_ratio`]) ??
    maybeNumber(row[`similar_school_${index}_corrected_green_ratio`]) ??
    maybeNumber(row[`similar_school_${index}_iso_green_ratio`]) ??
    0
  );
}

type ManualBarrierOverride = {
  nearestParkName?: string;
  note: string;
};

const MANUAL_BARRIER_OVERRIDES: Record<string, ManualBarrierOverride> = {
  B000025206: { nearestParkName: "동춘1구역근린공원", note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000002963: { nearestParkName: "화도진공원", note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003102: { note: "공원까지 가려면 주요 도시 간선도로를 2번 횡단해야 합니다." },
  B000003132: { note: "공원까지 가려면 주요 도시 간선도로를 1번 횡단해야 합니다." },
  B000002981: { nearestParkName: "다솔어린이공원", note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000025246: { note: "공원까지 가려면 주요 도시 간선도로를 1번 횡단해야 합니다." },
  B000002959: { note: "공원까지 가려면 주요 도시 간선도로를 1번 횡단해야 합니다." },
  B000025189: { note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000025236: { note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003158: { note: "공원까지 가려면 주요 도시 간선도로를 1번 횡단해야 합니다." },
  B000026504: { note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003048: { nearestParkName: "달빛공원", note: "공원까지 가는 길은 생활도로 중심으로, 간선도로 횡단 부담이 낮은 편입니다." },
  B000003123: { note: "공원까지 가려면 주요 도시 간선도로를 1번, 중간급 간선도로를 1번 횡단해야 합니다." },
  B000003144: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 중간급 간선도로를 2번 횡단해야 합니다." },
  B000003077: { note: "공원까지 가려면 중간급 간선도로를 1번 횡단해야 합니다." },
  B000002990: { note: "공원까지 가려면 중간급 간선도로를 1번 횡단해야 합니다." },
  B000003145: { nearestParkName: "석곶체육공원", note: "공원까지 가려면 주요 도시 간선도로를 1번, 중간급 간선도로를 1번 횡단해야 합니다." },
  B000003029: { note: "공원까지 가려면 중간급 간선도로를 1번 횡단해야 합니다." },
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

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getDisplayedDemand(
  row: RawRow,
  year: 2029 | 2031,
): number {
  return n(
    year === 2029
      ? row.forecast_2029 ?? row.predicted_2029 ?? row.target_2029
      : row.forecast_2031 ?? row.predicted_2031 ?? row.target_2031,
  );
}

function getCaseLabels(caseType: number): { policy: string; status: string } {
  const key = caseType as keyof typeof CASE_LABELS;
  return CASE_LABELS[key] ?? CASE_LABELS[1];
}

function buildCaseStatusLabel(row: RawRow, cityAvgGreenRatio = CITY_AVG.greenRatio): string {
  if (isSpecialPolicySchool(row)) return CASE_LABELS[99].status;

  const nearestParkDistanceM = n(row.nearest_park_dist_m, 9999);
  const greenRatio = getDisplayGreenRatio(row);
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
  const green = getDisplayGreenRatio(row);
  const playground = n(row.iso_playground_count);
  const demand2029 = n(row.forecast_2029);

  if (dist >= 800) tags.push("도보권 공원이 사실상 없는 상태입니다");
  else if (dist >= 500) tags.push("가장 가까운 공원까지의 거리가 긴 편입니다");

  if (green === 0) tags.push("생활권 녹지 비율이 0%입니다");
  else if (green < 3) tags.push("생활권 녹지 비율이 매우 낮습니다");

  if (playground === 0) tags.push("도보 접근 가능한 놀이터가 없습니다");
  if (demand2029 >= 400) tags.push("잠재 수요가 높아 우선 검토 가치가 큽니다");
  if (!tags.length) tags.push("생활권 핵심 지표는 비교적 안정적인 편입니다");

  return tags.slice(0, 4);
}

function buildContextTags(row: RawRow): string[] {
  const tags: string[] = [];
  const caseType = getCaseType(row, 0);

  if (caseType === 1 || caseType === 3) {
    tags.push("보행 동선에 경로 부담 요인이 있을 가능성이 있습니다");
  }
  tags.push("학교 주변에 바로 접근 가능한 녹지나 놀이터가 부족합니다");
  tags.push("주거 밀도 대비 아동 체류 공간이 부족한 편입니다");
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

function bestSchoolBlock(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const obj = value as Record<string, unknown>;
  return {
    schoolName: s(obj.schoolName),
    districtName: s(obj.districtName),
    nearestParkDistanceM: n(obj.nearestParkDistanceM),
    greenRatio: n(obj.greenRatio),
    playgroundCount: n(obj.playgroundCount),
  };
}

function isFiniteSimilarSchool(item: {
  schoolName?: string;
  districtName?: string;
  nearestParkDistanceM?: number;
  greenRatio?: number;
  playgroundCount?: number;
}) {
  return (
    s(item.schoolName) !== "" &&
    Number.isFinite(Number(item.nearestParkDistanceM)) &&
    Number.isFinite(Number(item.greenRatio)) &&
    Number.isFinite(Number(item.playgroundCount))
  );
}

export function applyLegacySchoolSnapshot(
  base: SchoolDetailReportProps,
  snapshotValue: unknown,
): SchoolDetailReportProps {
  if (!snapshotValue || typeof snapshotValue !== "object") return base;

  const snapshot = snapshotValue as LegacySchoolSnapshot;
  const patched: SchoolDetailReportProps = {
    ...base,
    ...(snapshot.legacy_nearest_park_name ? { nearestParkName: snapshot.legacy_nearest_park_name } : {}),
    ...(snapshot.legacy_nearest_park_distance_m != null
      ? { nearestParkDistanceM: n(snapshot.legacy_nearest_park_distance_m, base.nearestParkDistanceM) }
      : {}),
    ...(snapshot.legacy_iso_green_ratio != null
      ? { greenRatio: n(snapshot.legacy_iso_green_ratio, base.greenRatio) }
      : {}),
    ...(snapshot.legacy_iso_playground_count != null
      ? { playgroundCount: n(snapshot.legacy_iso_playground_count, base.playgroundCount) }
      : {}),
    ...(snapshot.legacy_buf_playground_count != null
      ? { straightLinePlaygroundCount: n(snapshot.legacy_buf_playground_count) }
      : {}),
    ...(snapshot.legacy_access_ratio != null
      ? { accessibilityRatio: n(snapshot.legacy_access_ratio) }
      : {}),
    ...(snapshot.legacy_gap_count != null
      ? { parkShortageVsAvg: n(snapshot.legacy_gap_count) }
      : {}),
    ...(Array.isArray(snapshot.legacy_student_trend) && snapshot.legacy_student_trend.length
      ? { studentTrend: snapshot.legacy_student_trend.map((item) => ({ year: String(item.year), value: n(item.value) })) }
      : {}),
    ...(Array.isArray(snapshot.legacy_similar_schools) &&
    snapshot.legacy_similar_schools.some((item) =>
      isFiniteSimilarSchool({
        schoolName: s(item.schoolName),
        districtName: s(item.districtName),
        nearestParkDistanceM: Number(item.nearestParkDistanceM),
        greenRatio: Number(item.greenRatio),
        playgroundCount: Number(item.playgroundCount),
      }),
    )
      ? {
          similarSchools: snapshot.legacy_similar_schools
            .map((item) => ({
              schoolName: s(item.schoolName),
              districtName: s(item.districtName),
              nearestParkDistanceM: Number(item.nearestParkDistanceM),
              greenRatio: Number(item.greenRatio),
              playgroundCount: Number(item.playgroundCount),
            }))
            .filter(isFiniteSimilarSchool)
            .slice(0, 4),
        }
      : {}),
  };

  if (Array.isArray(snapshot.legacy_missing_fields) && snapshot.legacy_missing_fields.length) {
    // Keep this as a separate migration log without interrupting render.
    console.warn("[legacy-school-snapshot] missing fields", {
      school_id: snapshot.school_id,
      school_name: snapshot.school_name,
      missing_fields: snapshot.legacy_missing_fields,
    });
  }

  return patched;
}

export function mapSchoolRowToReportProps(
  row: RawRow,
  onSimulationClick?: () => void,
): SchoolDetailReportProps {
  const schoolName = getSchoolName(row);
  const gu = s(row.gu ?? row["gu"]);
  const districtName = gu ? `인천광역시 ${gu}` : "인천광역시";

  const caseType = getCaseType(row, 1);
  const { policy: casePolicyLabel } = getCaseLabels(caseType);

  const nearestParkDistanceM = n(row.nearest_park_dist_m);
  const manualBarrierOverride = getManualBarrierOverride(row);
  const nearestOfficialParkName = s(row.nearest_official_park_name ?? row.nearest_park_name ?? row.nearest_park_name_clean ?? "");
  const nearestParkName = s(manualBarrierOverride?.nearestParkName ?? nearestOfficialParkName);
  const greenRatio = getDisplayGreenRatio(row);
  const playgroundCount = n(row.iso_playground_count);
  const graphNearestOfficialParkName = s(row.graph_nearest_official_park_name);
  const officialRouteMatchesPark =
    !graphNearestOfficialParkName ||
    !nearestOfficialParkName ||
    graphNearestOfficialParkName === nearestOfficialParkName;
  const officialRouteMismatchSummary = graphNearestOfficialParkName
    ? `보행 경로 산출 대상(${graphNearestOfficialParkName})과 공식 최근접 공원(${nearestOfficialParkName})이 달라, 공식 공원 경로 특성은 지도에서 별도 확인이 필요합니다.`
    : "공식 최근접 공원 경로 특성은 지도에서 별도 확인이 필요합니다.";

  const cityAvg = avgBlock(row, "_cityAvg");
  const districtAvg = avgBlock(row, "_districtAvg");
  const caseStatusLabel = buildCaseStatusLabel(row, cityAvg?.greenRatio ?? CITY_AVG.greenRatio);

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
    if (first > 0) {
      studentTrendChangePct = ((last - first) / first) * 100;
    }
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
      greenRatio: getSimilarSchoolGreenRatio(row, i),
      playgroundCount: n(row[`similar_school_${i}_iso_playground_count`]),
    }))
    .filter(isFiniteSimilarSchool)
    .slice(0, 4);

  const cityBestEnvironmentSchool = bestSchoolBlock(row._cityBest);
  const districtBestEnvironmentSchool = bestSchoolBlock(row._districtBest);

  return {
    schoolName,
    districtName,
    casePolicyLabel,
    caseStatusLabel,
    nearestParkDistanceM,
    ...(nearestParkName ? { nearestParkName } : {}),
    ...(manualBarrierOverride?.note ? { nearestParkAccessNote: manualBarrierOverride.note } : {}),
    ...(s(row.nearest_official_park_type) ? { nearestOfficialParkType: s(row.nearest_official_park_type) } : {}),
    ...(maybeNumber(row.nearest_official_park_area_m2) != null
      ? { nearestOfficialParkAreaM2: maybeNumber(row.nearest_official_park_area_m2)! }
      : {}),
    ...(s(row.nearest_official_park_function_class) ? { nearestOfficialParkFunctionClass: s(row.nearest_official_park_function_class) } : {}),
    ...(s(row.nearest_official_park_function_label) ? { nearestOfficialParkFunctionLabel: s(row.nearest_official_park_function_label) } : {}),
    ...(maybeNumber(row.nearest_functional_park_dist_m) != null
      ? { nearestFunctionalParkDistanceM: maybeNumber(row.nearest_functional_park_dist_m)! }
      : {}),
    ...(s(row.nearest_functional_park_name) ? { nearestFunctionalParkName: s(row.nearest_functional_park_name) } : {}),
    ...(maybeNumber(row.nearest_functional_park_area_m2) != null
      ? { nearestFunctionalParkAreaM2: maybeNumber(row.nearest_functional_park_area_m2)! }
      : {}),
    ...(officialRouteMatchesPark && maybeNumber(row.nearest_official_route_dist_m) != null
      ? { nearestOfficialRouteDistanceM: maybeNumber(row.nearest_official_route_dist_m)! }
      : {}),
    ...(officialRouteMatchesPark && maybeNumber(row.nearest_official_route_detour_ratio) != null
      ? { nearestOfficialRouteDetourRatio: maybeNumber(row.nearest_official_route_detour_ratio)! }
      : {}),
    ...(officialRouteMatchesPark && maybeNumber(row.nearest_official_major_road_crossing_count) != null
      ? { nearestOfficialMajorRoadCrossingCount: maybeNumber(row.nearest_official_major_road_crossing_count)! }
      : {}),
    ...(officialRouteMatchesPark && row.nearest_official_large_intersection_flag != null
      ? { nearestOfficialLargeIntersectionFlag: row.nearest_official_large_intersection_flag === true || s(row.nearest_official_large_intersection_flag).toLowerCase() === "true" }
      : {}),
    ...(officialRouteMatchesPark && row.nearest_official_accident_hotspot_flag != null
      ? { nearestOfficialAccidentHotspotFlag: row.nearest_official_accident_hotspot_flag === true || s(row.nearest_official_accident_hotspot_flag).toLowerCase() === "true" }
      : {}),
    ...(officialRouteMatchesPark && maybeNumber(row.nearest_official_barrier_level) != null
      ? { nearestOfficialBarrierLevel: maybeNumber(row.nearest_official_barrier_level)! }
      : {}),
    ...(officialRouteMatchesPark && s(row.nearest_official_barrier_label)
      ? { nearestOfficialBarrierLabel: s(row.nearest_official_barrier_label) }
      : !officialRouteMatchesPark
        ? { nearestOfficialBarrierLabel: "경로 재확인 필요" }
        : {}),
    ...(officialRouteMatchesPark && s(row.nearest_official_barrier_summary)
      ? { nearestOfficialBarrierSummary: s(row.nearest_official_barrier_summary) }
      : !officialRouteMatchesPark
        ? { nearestOfficialBarrierSummary: officialRouteMismatchSummary }
        : {}),
    ...(officialRouteMatchesPark && s(row.nearest_official_barrier_description)
      ? { nearestOfficialBarrierDescription: s(row.nearest_official_barrier_description) }
      : !officialRouteMatchesPark
        ? { nearestOfficialBarrierDescription: "현재 데이터에서는 공식 최근접 공원명과 그래프 기반 경로 산출 대상이 일치하지 않아, 간선도로 횡단 여부를 단정 표시하지 않습니다." }
        : {}),
    ...(maybeNumber(row.nearest_functional_route_dist_m) != null
      ? { nearestFunctionalRouteDistanceM: maybeNumber(row.nearest_functional_route_dist_m)! }
      : {}),
    ...(maybeNumber(row.nearest_functional_route_detour_ratio) != null
      ? { nearestFunctionalRouteDetourRatio: maybeNumber(row.nearest_functional_route_detour_ratio)! }
      : {}),
    ...(maybeNumber(row.nearest_functional_major_road_crossing_count) != null
      ? { nearestFunctionalMajorRoadCrossingCount: maybeNumber(row.nearest_functional_major_road_crossing_count)! }
      : {}),
    ...(row.nearest_functional_large_intersection_flag != null
      ? { nearestFunctionalLargeIntersectionFlag: row.nearest_functional_large_intersection_flag === true || s(row.nearest_functional_large_intersection_flag).toLowerCase() === "true" }
      : {}),
    ...(row.nearest_functional_accident_hotspot_flag != null
      ? { nearestFunctionalAccidentHotspotFlag: row.nearest_functional_accident_hotspot_flag === true || s(row.nearest_functional_accident_hotspot_flag).toLowerCase() === "true" }
      : {}),
    ...(maybeNumber(row.nearest_functional_barrier_level) != null
      ? { nearestFunctionalBarrierLevel: maybeNumber(row.nearest_functional_barrier_level)! }
      : {}),
    ...(s(row.nearest_functional_barrier_label) ? { nearestFunctionalBarrierLabel: s(row.nearest_functional_barrier_label) } : {}),
    ...(s(row.nearest_functional_barrier_summary) ? { nearestFunctionalBarrierSummary: s(row.nearest_functional_barrier_summary) } : {}),
    ...(s(row.nearest_functional_barrier_description) ? { nearestFunctionalBarrierDescription: s(row.nearest_functional_barrier_description) } : {}),
    ...(s(row.access_condition_type) ? { accessConditionType: s(row.access_condition_type) } : {}),
    ...(s(row.access_condition_label) ? { accessConditionLabel: activityScaleText(s(row.access_condition_label)) } : {}),
    ...(s(row.access_condition_description) ? { accessConditionDescription: activityScaleText(s(row.access_condition_description)) } : {}),
    ...(s(row.green_ratio_display_basis) ? { greenRatioDisplayBasis: s(row.green_ratio_display_basis) } : {}),
    ...(s(row.green_ratio_review_note) ? { greenRatioReviewNote: s(row.green_ratio_review_note) } : {}),
    greenRatioHighReviewFlag: boolFlag(row.green_ratio_high_review_flag),
    activitySpaceLimited: boolFlag(row.activity_space_limited_flag),
    onlyMicroPark: boolFlag(row.only_micro_park_flag),
    noFunctionalPark: boolFlag(row.no_functional_park_flag),
    noOfficialParkFlag: boolFlag(row.no_official_park_flag),
    nearestParkDistanceCityAvg: cityAvg?.nearestParkDistanceM ?? CITY_AVG.nearestParkDist,
    nearestParkDistanceDistrictAvg:
      districtAvg?.nearestParkDistanceM ?? cityAvg?.nearestParkDistanceM ?? CITY_AVG.nearestParkDist,
    ...(maybeNumber(row.nearestParkDistanceCityPercentile) != null
      ? { nearestParkDistanceCityPercentile: maybeNumber(row.nearestParkDistanceCityPercentile)! }
      : {}),
    ...(maybeNumber(row.nearestParkDistanceDistrictPercentile) != null
      ? { nearestParkDistanceDistrictPercentile: maybeNumber(row.nearestParkDistanceDistrictPercentile)! }
      : {}),
    greenRatio,
    greenRatioCityAvg: cityAvg?.greenRatio ?? CITY_AVG.greenRatio,
    greenRatioDistrictAvg: districtAvg?.greenRatio ?? cityAvg?.greenRatio ?? CITY_AVG.greenRatio,
    ...(maybeNumber(row.greenRatioCityPercentile) != null
      ? { greenRatioCityPercentile: maybeNumber(row.greenRatioCityPercentile)! }
      : {}),
    ...(maybeNumber(row.greenRatioDistrictPercentile) != null
      ? { greenRatioDistrictPercentile: maybeNumber(row.greenRatioDistrictPercentile)! }
      : {}),
    ...(maybeNumber(row.greenRatioCityPercentile_lt) != null
      ? { greenRatioCityPercentile_lt: maybeNumber(row.greenRatioCityPercentile_lt)! }
      : {}),
    ...(maybeNumber(row.greenRatioDistrictPercentile_lt) != null
      ? { greenRatioDistrictPercentile_lt: maybeNumber(row.greenRatioDistrictPercentile_lt)! }
      : {}),
    ...(maybeNumber(row.greenRatioCityZeroShare) != null
      ? { greenRatioCityZeroShare: maybeNumber(row.greenRatioCityZeroShare)! }
      : {}),
    ...(maybeNumber(row.greenRatioDistrictZeroShare) != null
      ? { greenRatioDistrictZeroShare: maybeNumber(row.greenRatioDistrictZeroShare)! }
      : {}),
    ...(maybeNumber(row.greenRatioCityNonZeroPercentile) != null
      ? { greenRatioCityNonZeroPercentile: maybeNumber(row.greenRatioCityNonZeroPercentile)! }
      : {}),
    ...(maybeNumber(row.greenRatioDistrictNonZeroPercentile) != null
      ? { greenRatioDistrictNonZeroPercentile: maybeNumber(row.greenRatioDistrictNonZeroPercentile)! }
      : {}),
    ...(maybeNumber(row.greenRatioCityNonZeroAvg) != null
      ? { greenRatioCityNonZeroAvg: maybeNumber(row.greenRatioCityNonZeroAvg)! }
      : {}),
    ...(maybeNumber(row.greenRatioDistrictNonZeroAvg) != null
      ? { greenRatioDistrictNonZeroAvg: maybeNumber(row.greenRatioDistrictNonZeroAvg)! }
      : {}),
    playgroundCount,
    ...(maybeNumber(row.buf_playground_count) != null
      ? { straightLinePlaygroundCount: maybeNumber(row.buf_playground_count)! }
      : {}),
    playgroundCountCityAvg: cityAvg?.playgroundCount ?? CITY_AVG.playgroundCount,
    playgroundCountDistrictAvg: districtAvg?.playgroundCount ?? cityAvg?.playgroundCount ?? CITY_AVG.playgroundCount,
    ...(maybeNumber(row.playgroundCountCityPercentile) != null
      ? { playgroundCountCityPercentile: maybeNumber(row.playgroundCountCityPercentile)! }
      : {}),
    ...(maybeNumber(row.playgroundCountDistrictPercentile) != null
      ? { playgroundCountDistrictPercentile: maybeNumber(row.playgroundCountDistrictPercentile)! }
      : {}),
    ...(maybeNumber(row.playgroundCountCityPercentile_lt) != null
      ? { playgroundCountCityPercentile_lt: maybeNumber(row.playgroundCountCityPercentile_lt)! }
      : {}),
    ...(maybeNumber(row.playgroundCountDistrictPercentile_lt) != null
      ? { playgroundCountDistrictPercentile_lt: maybeNumber(row.playgroundCountDistrictPercentile_lt)! }
      : {}),
    ...(maybeNumber(row.playgroundCountCityZeroShare) != null
      ? { playgroundCountCityZeroShare: maybeNumber(row.playgroundCountCityZeroShare)! }
      : {}),
    ...(maybeNumber(row.playgroundCountDistrictZeroShare) != null
      ? { playgroundCountDistrictZeroShare: maybeNumber(row.playgroundCountDistrictZeroShare)! }
      : {}),
    ...(maybeNumber(row.playgroundCountCityNonZeroPercentile) != null
      ? { playgroundCountCityNonZeroPercentile: maybeNumber(row.playgroundCountCityNonZeroPercentile)! }
      : {}),
    ...(maybeNumber(row.playgroundCountDistrictNonZeroPercentile) != null
      ? { playgroundCountDistrictNonZeroPercentile: maybeNumber(row.playgroundCountDistrictNonZeroPercentile)! }
      : {}),
    ...(maybeNumber(row.playgroundCountCityNonZeroAvg) != null
      ? { playgroundCountCityNonZeroAvg: maybeNumber(row.playgroundCountCityNonZeroAvg)! }
      : {}),
    ...(maybeNumber(row.playgroundCountDistrictNonZeroAvg) != null
      ? { playgroundCountDistrictNonZeroAvg: maybeNumber(row.playgroundCountDistrictNonZeroAvg)! }
      : {}),
    noParkWithin500m: n(row.iso_park_count) === 0 || nearestParkDistanceM >= 500,
    ...(maybeNumber(row.access_ratio) != null ? { accessibilityRatio: maybeNumber(row.access_ratio)! } : {}),
    ...(maybeNumber(row.gap_count) != null ? { parkShortageVsAvg: maybeNumber(row.gap_count)! } : {}),
    studentTrend,
    studentTrendChangePct,
    studentTrendCityAvg: cityAvg?.studentTrendPct ?? CITY_AVG.studentTrendPct,
    studentTrendDistrictAvg: districtAvg?.studentTrendPct ?? cityAvg?.studentTrendPct ?? CITY_AVG.studentTrendPct,
    currentStudentCount2025,
    ...(maybeNumber(row.currentStudentCountCityPercentile) != null
      ? { currentStudentCountCityPercentile: maybeNumber(row.currentStudentCountCityPercentile)! }
      : {}),
    ...(maybeNumber(row.currentStudentCountDistrictPercentile) != null
      ? { currentStudentCountDistrictPercentile: maybeNumber(row.currentStudentCountDistrictPercentile)! }
      : {}),
    potentialDemand2029: Math.round(potentialDemand2029),
    potentialDemand2031: Math.round(potentialDemand2031),
    ...(maybeNumber(row.knn_k) != null ? { similarityK: maybeNumber(row.knn_k)! } : {}),
    ...(s(row.selection_features || row.similarity_features) ? { similaritySelectionFeatures: s(row.selection_features || row.similarity_features) } : {}),
    ...(s(row.comparison_features) ? { similarityComparisonFeatures: s(row.comparison_features) } : {}),
    ...(s(row.common_points || row.common_traits) ? { similarityCommonPoints: s(row.common_points || row.common_traits) } : {}),
    ...(s(row.relative_strengths) ? { similarityStrengthsText: s(row.relative_strengths) } : {}),
    ...(s(row.relative_weaknesses) ? { similarityWeaknessesText: s(row.relative_weaknesses) } : {}),
    ...(maybeNumber(row.peer_avg_nearest_park_dist_m) != null
      ? { similarityPeerAvgNearestParkDistanceM: maybeNumber(row.peer_avg_nearest_park_dist_m)! }
      : {}),
    ...(maybeNumber(row.peer_avg_iso_green_ratio) != null
      ? { similarityPeerAvgGreenRatio: maybeNumber(row.peer_avg_iso_green_ratio)! }
      : {}),
    ...(maybeNumber(row.peer_avg_iso_playground_count) != null
      ? { similarityPeerAvgPlaygroundCount: maybeNumber(row.peer_avg_iso_playground_count)! }
      : {}),
    similarSchools: similarSchools.length ? similarSchools : undefined,
    ...(cityBestEnvironmentSchool ? { cityBestEnvironmentSchool } : {}),
    ...(districtBestEnvironmentSchool ? { districtBestEnvironmentSchool } : {}),
    problemTags: buildProblemTags(row),
    contextTags: buildContextTags(row),
    hasLargeApartmentComplexNearby: Boolean(row.has_large_apt ?? row.large_apt_flag),
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
  },
): Candidate[] {
  const external: Candidate[] = features.map((feature) => ({
    resident_children_2029: n(feature.pred_beneficiary_2029 ?? feature.xgb_predicted_2029 ?? feature.forecast_2029),
    resident_children_2031: n(feature.pred_beneficiary_2031 ?? feature.xgb_predicted_2031 ?? feature.forecast_2031),
    walkshed_potential_2029: n(feature.walkshed_beneficiary_2029 ?? feature.pred_beneficiary_2029 ?? feature.xgb_predicted_2029 ?? feature.forecast_2029),
    walkshed_potential_2031: n(feature.walkshed_beneficiary_2031 ?? feature.pred_beneficiary_2031 ?? feature.xgb_predicted_2031 ?? feature.forecast_2031),
    grid_id: s(feature.grid_id, "CG_UNKNOWN"),
    cx: n(feature.cx),
    cy: n(feature.cy),
    xgb_predicted_2029: n(feature.pred_beneficiary_2029 ?? feature.xgb_predicted_2029 ?? feature.forecast_2029),
    xgb_predicted_2031: n(feature.pred_beneficiary_2031 ?? feature.xgb_predicted_2031 ?? feature.forecast_2031),
    nearest_park_dist: n(feature.nearest_park_dist ?? feature.avg_park_dist_m),
    nearest_pg_dist: n(feature.nearest_pg_dist ?? feature.nearest_pg_dist_m ?? feature.avg_pg_dist_m),
    nearest_school_dist: maybeNumber(feature.route_length_m ?? feature.nearest_school_dist) ?? 9999,
    nearest_apt_dist: maybeNumber(feature.nearest_apt_dist) ?? 9999,
    land_feasibility_level: FEASIBILITY_LEVELS.has(s(feature.land_feasibility_level))
      ? (s(feature.land_feasibility_level) as "high" | "medium" | "low")
      : "medium",
    linked_schools: arrayOfStrings(feature.linked_schools),
    ...(feature.barrier_counts && typeof feature.barrier_counts === "object"
      ? {
          barrier_counts: feature.barrier_counts as Record<"motorway" | "trunk" | "primary" | "secondary" | "tertiary", number>,
        }
      : {}),
    ...(s(feature.barrier_severity) ? { barrier_severity: s(feature.barrier_severity) as "green" | "yellow" | "orange" | "red" } : {}),
    ...(s(feature.barrier_severity_label) ? { barrier_severity_label: s(feature.barrier_severity_label) } : {}),
    ...(s(feature.barrier_color) ? { barrier_color: s(feature.barrier_color) } : {}),
    ...(s(feature.barrier_note) ? { barrier_note: s(feature.barrier_note) } : {}),
    ...(maybeNumber(feature.route_length_m) != null ? { route_length_m: maybeNumber(feature.route_length_m)! } : {}),
    ...(Array.isArray(feature.route_coords)
      ? {
          route_coords: (feature.route_coords as Array<[number, number]>)
            .filter((item) => Array.isArray(item) && item.length === 2)
            .map((item) => [n(item[0]), n(item[1])] as [number, number]),
        }
      : {}),
    ...(feature.fallback_candidate ? { fallback_candidate: true } : {}),
    ...(s(feature.fallback_distance_basis) ? { fallback_distance_basis: s(feature.fallback_distance_basis) } : {}),
    ...(s(feature.candidate_display_tier) ? { candidate_display_tier: s(feature.candidate_display_tier) } : {}),
    ...(s(feature.candidate_display_label) ? { candidate_display_label: s(feature.candidate_display_label) } : {}),
    ...(maybeNumber(feature.fallback_distance_limit_m) != null ? { fallback_distance_limit_m: maybeNumber(feature.fallback_distance_limit_m)! } : {}),
    ...(s(feature.fallback_explanation) ? { fallback_explanation: s(feature.fallback_explanation) } : {}),
    ...(feature.has_large_apt != null ? { has_large_apt: Boolean(feature.has_large_apt) } : {}),
    ...(feature.redev_flag != null ? { redev_flag: Boolean(feature.redev_flag) } : {}),
    ...(s(feature.redev_level) ? { redev_level: s(feature.redev_level) } : {}),
    ...(s(feature.redev_warning_text) ? { redev_warning_text: s(feature.redev_warning_text) } : {}),
    ...(feature.accident_hotspot_flag != null
      ? { accident_hotspot_flag: Boolean(feature.accident_hotspot_flag) }
      : feature.accident_buffer_flag != null
        ? { accident_hotspot_flag: Boolean(feature.accident_buffer_flag) }
        : feature.passes_accident_hotspot != null
          ? { accident_hotspot_flag: Boolean(feature.passes_accident_hotspot) }
          : {}),
    ...(s(feature.accident_hotspot_text ?? feature.accident_buffer_text)
      ? { accident_hotspot_text: s(feature.accident_hotspot_text ?? feature.accident_buffer_text) }
      : {}),
    ...(feature.pareto_candidate != null ? { pareto_candidate: Boolean(feature.pareto_candidate) } : {}),
    ...(maybeNumber(feature.top5_stability_score) != null ? { top5_stability_score: maybeNumber(feature.top5_stability_score)! } : {}),
    ...(maybeNumber(feature.mean_rank) != null ? { mean_rank: maybeNumber(feature.mean_rank)! } : {}),
    ...(maybeNumber(feature.rank_std) != null ? { rank_std: maybeNumber(feature.rank_std)! } : {}),
    ...(maybeNumber(feature.robust_rank) != null ? { robust_rank: maybeNumber(feature.robust_rank)! } : {}),
    ...(s(feature.recommendation_type) ? { recommendation_type: s(feature.recommendation_type) } : {}),
    ...(s(feature.robust_recommendation_reason) ? { robust_recommendation_reason: s(feature.robust_recommendation_reason) } : {}),
    ...(maybeNumber(feature.predicted_beneficiaries_used) != null ? { predicted_beneficiaries_used: maybeNumber(feature.predicted_beneficiaries_used)! } : {}),
    ...(s(feature.shap_diagnostic_tag) ? { shap_diagnostic_tag: s(feature.shap_diagnostic_tag) } : {}),
    ...(Array.isArray(feature.shap_positive_drivers) ? { shap_positive_drivers: feature.shap_positive_drivers as Array<{ feature: string; value: number; shap_value: number }> } : {}),
    ...(Array.isArray(feature.shap_negative_drivers) ? { shap_negative_drivers: feature.shap_negative_drivers as Array<{ feature: string; value: number; shap_value: number }> } : {}),
    ...(s(feature.shap_explanation_text) ? { shap_explanation_text: s(feature.shap_explanation_text) } : {}),
    ...(s(feature.shap_waterfall_image_path) ? { shap_waterfall_image_path: s(feature.shap_waterfall_image_path) } : {}),
  }));

  const schoolInternal: Candidate = {
    grid_id: "SCHOOL_INT",
    cx: schoolLng,
    cy: schoolLat,
    xgb_predicted_2029: Math.round(n(schoolDemand?.predicted2029)),
    xgb_predicted_2031: Math.round(n(schoolDemand?.predicted2031)),
    resident_children_2029: Math.round(n(schoolDemand?.predicted2029)),
    resident_children_2031: Math.round(n(schoolDemand?.predicted2031)),
    walkshed_potential_2029: Math.round(n(schoolDemand?.predicted2029)),
    walkshed_potential_2031: Math.round(n(schoolDemand?.predicted2031)),
    nearest_park_dist: 0,
    nearest_pg_dist: 0,
    nearest_school_dist: 0,
    nearest_apt_dist: 0,
    land_feasibility_level: "high",
    linked_schools: [],
    is_school_internal: true,
    barrier_counts: { motorway: 0, trunk: 0, primary: 0, secondary: 0, tertiary: 0 },
    barrier_severity: "green",
    barrier_severity_label: "학교 내부 설치",
    barrier_color: "#2980b9",
    barrier_note: "학교 내부 설치 후보지로, 기존 공원까지의 외부 경로 부담 대신 학교 안 설치 가능성을 우선 검토합니다.",
  };

  return [schoolInternal, ...external];
}
