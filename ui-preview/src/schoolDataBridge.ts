import type { SchoolDetailReportProps } from "./SchoolDetailReportPagePreview";
import { CASE_LABELS } from "./SchoolDetailReportPagePreview";

const CITY_AVG = {
  nearestParkDist: 1176.827,
  greenRatio: 7.845,
  playgroundCount: 0.471,
  studentTrendPct: -10.955,
};

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

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function getCaseLabels(caseType: number): { policy: string; status: string } {
  const key = caseType as keyof typeof CASE_LABELS;
  return CASE_LABELS[key] ?? CASE_LABELS[1];
}

function getSchoolName(row: RawRow) {
  return s(row["학교명"] ?? row.school_name, "학교");
}

function buildProblemTags(row: RawRow): string[] {
  const tags: string[] = [];
  const dist = n(row.nearest_park_dist_m, 9999);
  const green = n(row.iso_green_ratio);
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
  const caseType = n(row.case_type);

  if (caseType === 1 || caseType === 3) {
    tags.push("보행 동선에 단절 구간이 있을 가능성이 있습니다");
  }
  tags.push("학교 주변에 바로 접근 가능한 녹지나 놀이터가 부족합니다");
  tags.push("주거 밀도 대비 아동 체류 공간이 부족한 편입니다");
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
    ...(Array.isArray(snapshot.legacy_similar_schools) && snapshot.legacy_similar_schools.length
      ? {
          similarSchools: snapshot.legacy_similar_schools.map((item) => ({
            schoolName: s(item.schoolName),
            districtName: s(item.districtName),
            nearestParkDistanceM: n(item.nearestParkDistanceM),
            greenRatio: n(item.greenRatio),
            playgroundCount: n(item.playgroundCount),
          })),
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

  const caseType = n(row.case_type, 1);
  const { policy: casePolicyLabel, status: caseStatusLabel } = getCaseLabels(caseType);

  const nearestParkDistanceM = n(row.nearest_park_dist_m);
  const nearestParkName = s(row.nearest_park_name ?? row.nearest_park_name_clean ?? "");
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
    if (first > 0) {
      studentTrendChangePct = ((last - first) / first) * 100;
    }
  }

  const currentStudentCount2025 = rawTrend.length
    ? rawTrend[rawTrend.length - 1].students
    : n(row.predicted_current);

  const similarSchools = [1, 2, 3, 4, 5]
    .map((i) => ({
      schoolName: s(row[`similar_school_${i}_name`]),
      districtName: s(row[`similar_school_${i}_gu`] ?? row[`similar_school_${i}_districtName`] ?? ""),
      nearestParkDistanceM: n(row[`similar_school_${i}_nearest_park_dist_m`]),
      greenRatio: n(row[`similar_school_${i}_iso_green_ratio`]),
      playgroundCount: n(row[`similar_school_${i}_iso_playground_count`]),
    }))
    .filter((item) => item.schoolName !== "");

  const cityBestEnvironmentSchool = bestSchoolBlock(row._cityBest);
  const districtBestEnvironmentSchool = bestSchoolBlock(row._districtBest);

  return {
    schoolName,
    districtName,
    casePolicyLabel,
    caseStatusLabel,
    nearestParkDistanceM,
    ...(nearestParkName ? { nearestParkName } : {}),
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
    potentialDemand2029: n(row.forecast_2029 ?? row.predicted_2029 ?? row.target_2029),
    potentialDemand2031: n(row.forecast_2031 ?? row.predicted_2031 ?? row.target_2031),
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
): Candidate[] {
  const external: Candidate[] = features.map((feature) => ({
    grid_id: s(feature.grid_id, "CG_UNKNOWN"),
    cx: n(feature.cx),
    cy: n(feature.cy),
    xgb_predicted_2029: n(feature.xgb_predicted_2029 ?? feature.forecast_2029),
    xgb_predicted_2031: n(feature.xgb_predicted_2031 ?? feature.forecast_2031),
    nearest_park_dist: n(feature.nearest_park_dist ?? feature.avg_park_dist_m),
    nearest_pg_dist: n(feature.nearest_pg_dist ?? feature.nearest_pg_dist_m ?? feature.avg_pg_dist_m),
    nearest_school_dist: n(feature.nearest_school_dist),
    nearest_apt_dist: n(feature.nearest_apt_dist),
    land_feasibility_level: FEASIBILITY_LEVELS.has(s(feature.land_feasibility_level))
      ? (s(feature.land_feasibility_level) as "high" | "medium" | "low")
      : "medium",
    linked_schools: arrayOfStrings(feature.linked_schools),
  }));

  const schoolInternal: Candidate = {
    grid_id: "SCHOOL_INT",
    cx: schoolLng,
    cy: schoolLat,
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
