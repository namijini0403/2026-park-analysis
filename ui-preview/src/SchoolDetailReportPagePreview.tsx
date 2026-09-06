import * as React from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AiExplainerPanel from "./AiExplainerPanel";
import type { ReadingContext } from "./schoolDataBridge";

// 백분위 방향 규칙
// nearestParkDistance: share_ge 기준 -> 낮을수록 불리 (10% = 상위 10% 불리 = 위험)
// greenRatio: share_le 기준 -> 높을수록 불리 (88% = 하위 88% = 위험)
// playgroundCount: share_le 기준 -> 높을수록 불리
// currentStudentCount: share_ge 기준 -> 높을수록 수혜 대상 많음 (우선순위 가중)

type StatusTone = "danger" | "warning" | "caution" | "positive";

type StudentTrendPoint = {
  year: string;
  value: number;
};

type SimilarSchoolItem = {
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  rank?: number;
  similarityDistance?: number;
};

type BenchmarkSchoolItem = SimilarSchoolItem;

type RedevelopmentProject = {
  name: string;
  distanceM: number;
  stage: string;
  location: string;
};

// 학교 맥락 레이어 (지정·연구학교, 주변 시설): 참고용 정보 계약
// docs/context_layers_contract_20260906.md 참조. 미수집 커버리지는 0건으로 표기하지 않는다.
export type ContextDesignationSummary = {
  designation_id: string;
  designation_type: string;
  program_name: string;
  school_year: number | null;
  period_status: string;
  source_url: string;
};

export type ContextFacilitySummary = {
  status: string;
  observed_count?: number | null;
  total_count?: number | null;
  observed_completed_count?: number | null;
  label_ko?: string;
  within_m?: number;
  distance_basis_ko?: string;
  nearest_observed_m?: number | null;
  records?: Array<{ facility_id: string; distance_m: number }>;
};

export type ContextFacilityDetailRecord = {
  facility_id: string;
  distance_m: number;
  name?: string | null;
  category?: string | null;
  subtype?: string | null;
  address?: string | null;
  business_status?: string | null;
  construction_status?: string | null;
  construction_type?: string | null;
  main_use?: string | null;
  permit_date?: string | null;
  start_date?: string | null;
  approval_date?: string | null;
  use_approved?: boolean | null;
  coordinate_source?: string | null;
  source_url?: string | null;
};

export type ContextFacilityDetails = {
  records: ContextFacilityDetailRecord[];
  truncated_count: number;
};

export type ContextDesignationRecord = {
  designation_id: string;
  school_name: string;
  school_level: string;
  designation_type: string;
  program_name: string;
  school_year: number | null;
  period_status: string;
  period_basis?: string;
  designation_start_date?: string | null;
  designation_end_date?: string | null;
  financial_support_amount?: string | null;
  verification_status?: string | null;
  source?: {
    url?: string | null;
    title?: string | null;
    published_date?: string | null;
    retrieved_at?: string | null;
    source_file?: string | null;
  };
};

export type ContextManifestLayer = {
  status?: string;
  status_label_ko?: string;
  label_ko?: string;
  reason_ko?: string;
  usage_note_ko?: string;
  period_note_ko?: string;
  scope_note_ko?: string;
  coverage_note_ko?: string;
  coverage_regions?: string[];
  coverage_basis_ko?: string;
  coordinate_note_ko?: string;
  source_as_of_note_ko?: string;
  distance_basis_ko?: string;
  record_count?: number;
  located_record_count?: number;
  unlocated_record_count?: number;
  active_record_count?: number;
  matched_elementary_count?: number;
  programs_covered?: string[];
  sources?: Array<{
    url?: string | null;
    title?: string | null;
    published_date?: string | null;
    source_as_of?: string | null;
    retrieved_at?: string | null;
  }>;
};

export type SchoolContextLayers = {
  load_status: "loaded" | "pending" | "failed";
  data_as_of?: string | null;
  usage_note_ko?: string | null;
  manifest_layers?: Record<string, ContextManifestLayer>;
  school_summary?: {
    school_name?: string;
    gu?: string | null;
    designations?: {
      status: string;
      current: ContextDesignationSummary[];
      historical: ContextDesignationSummary[];
      scope_note_ko?: string;
    };
    nightlife?: ContextFacilitySummary;
    construction?: ContextFacilitySummary;
  } | null;
  designation_records?: ContextDesignationRecord[];
  facility_details?: {
    status?: "loaded" | "pending" | "failed";
    nightlife?: ContextFacilityDetails | null;
    construction?: ContextFacilityDetails | null;
  } | null;
};

export const CASE_LABELS = {
  1: { policy: "즉시 개선 대상", status: "공원 접근 결핍" },
  2: { policy: "우선 검토 대상", status: "공원 접근 가능 · 녹지 부족" },
  3: { policy: "모니터링 대상", status: "공원 접근 가능 · 녹지 비율 양호" },
  4: { policy: "유지·관리 대상", status: "공원 접근 양호 · 녹지 충분" },
  99: { policy: "별도 정책 필요", status: "도서·분교 등 별도 기준 검토" },
} as const;

export type SchoolDetailReportProps = {
  schoolName: string;
  districtName: string;
  casePolicyLabel: string;
  caseStatusLabel: string;
  statusSummary?: string;
  nearestParkDistanceM: number;
  nearestParkName?: string;
  nearestParkAccessNote?: string;
  nearestOfficialParkType?: string;
  nearestOfficialParkAreaM2?: number | null;
  nearestOfficialParkFunctionClass?: string;
  nearestOfficialParkFunctionLabel?: string;
  nearestFunctionalParkDistanceM?: number | null;
  nearestFunctionalParkName?: string;
  nearestFunctionalParkAreaM2?: number | null;
  nearestOfficialRouteDistanceM?: number | null;
  nearestOfficialRouteDetourRatio?: number | null;
  nearestOfficialMajorRoadCrossingCount?: number | null;
  nearestOfficialLargeIntersectionFlag?: boolean | null;
  nearestOfficialAccidentHotspotFlag?: boolean | null;
  nearestOfficialBarrierLevel?: number | null;
  nearestOfficialBarrierLabel?: string;
  nearestOfficialBarrierSummary?: string;
  nearestOfficialBarrierDescription?: string;
  nearestFunctionalRouteDistanceM?: number | null;
  nearestFunctionalRouteDetourRatio?: number | null;
  nearestFunctionalMajorRoadCrossingCount?: number | null;
  nearestFunctionalLargeIntersectionFlag?: boolean | null;
  nearestFunctionalAccidentHotspotFlag?: boolean | null;
  nearestFunctionalBarrierLevel?: number | null;
  nearestFunctionalBarrierLabel?: string;
  nearestFunctionalBarrierSummary?: string;
  nearestFunctionalBarrierDescription?: string;
  accessConditionType?: string;
  accessConditionLabel?: string;
  accessConditionDescription?: string;
  functionalAccessPhysicalBarrierFlag?: boolean;
  functionalAccessPhysicalBarrierLabel?: string;
  functionalAccessPhysicalBarrierBasis?: string;
  activitySpaceLimited?: boolean;
  onlyMicroPark?: boolean;
  noFunctionalPark?: boolean;
  noOfficialParkFlag?: boolean;
  nearestParkDistanceCityAvg: number;
  nearestParkDistanceDistrictAvg: number;
  nearestParkDistanceCityPercentile?: number;
  nearestParkDistanceDistrictPercentile?: number;
  greenRatio: number;
  greenRatioDisplayBasis?: string;
  greenRatioReviewNote?: string;
  greenRatioHighReviewFlag?: boolean;
  greenRatioCityAvg: number;
  greenRatioDistrictAvg: number;
  greenRatioCityPercentile?: number;
  greenRatioDistrictPercentile?: number;
  greenRatioCityPercentile_lt?: number;
  greenRatioDistrictPercentile_lt?: number;
  greenRatioCityZeroShare?: number;
  greenRatioDistrictZeroShare?: number;
  greenRatioCityNonZeroPercentile?: number;
  greenRatioDistrictNonZeroPercentile?: number;
  greenRatioCityNonZeroAvg?: number;
  greenRatioDistrictNonZeroAvg?: number;
  playgroundCount: number;
  straightLinePlaygroundCount?: number | null;
  playgroundCountCityAvg: number;
  playgroundCountDistrictAvg: number;
  playgroundCountCityPercentile?: number;
  playgroundCountDistrictPercentile?: number;
  playgroundCountCityPercentile_lt?: number;
  playgroundCountDistrictPercentile_lt?: number;
  playgroundCountCityZeroShare?: number;
  playgroundCountDistrictZeroShare?: number;
  playgroundCountCityNonZeroPercentile?: number;
  playgroundCountDistrictNonZeroPercentile?: number;
  playgroundCountCityNonZeroAvg?: number;
  playgroundCountDistrictNonZeroAvg?: number;
  noParkWithin500m?: boolean;
  accessibilityRatio?: number;
  parkShortageVsAvg?: number;
  studentTrend: StudentTrendPoint[];
  studentTrendChangePct?: number;
  studentTrendCityAvg: number;
  studentTrendDistrictAvg: number;
  currentStudentCount2025?: number;
  currentStudentCountCityPercentile?: number;
  currentStudentCountDistrictPercentile?: number;
  potentialDemand2029: number;
  potentialDemand2031: number;
  problemTags: string[];
  contextTags: string[];
  redevelopmentPlanYear?: string;
  redevelopmentType?: string;
  hasLargeApartmentComplexNearby?: boolean;
  similarityK?: number;
  similaritySelectionFeatures?: string;
  similarityComparisonFeatures?: string;
  similarityCommonPoints?: string;
  similarityStrengthsText?: string;
  similarityWeaknessesText?: string;
  similarityPeerAvgNearestParkDistanceM?: number;
  similarityPeerAvgGreenRatio?: number;
  similarityPeerAvgPlaygroundCount?: number;
  similarSchools?: SimilarSchoolItem[];
  cityBestEnvironmentSchool?: BenchmarkSchoolItem;
  districtBestEnvironmentSchool?: BenchmarkSchoolItem;
  redevelopmentProjects?: RedevelopmentProject[];
  contextLayers?: SchoolContextLayers;
  onSimulationClick?: () => void;
  readingContext?: ReadingContext | null;
};

type MetricCardProps = {
  title: string;
  icon: string;
  value: string;
  unit: string;
  tone: StatusTone;
  headline: string;
  emphasisLine?: string;
  comparisonLines?: string[];
  comparisonVisual?: React.ReactNode;
  footer?: React.ReactNode;
};

type PositionPoint = {
  id: string;
  label: string;
  schoolName: string;
  districtName: string;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  rankLabel?: string;
  pointType: "current" | "similar" | "cityBest" | "districtBest" | "sharedBest";
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatOptionalDistance(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "자료 없음";
  return `${formatNumber(Math.round(Number(value)))}m`;
}

function formatOptionalArea(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "자료 없음";
  return `${formatNumber(Math.round(Number(value)))}㎡`;
}

function formatOptionalRatio(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "자료 없음";
  return formatDecimal(Number(value), 2);
}

function formatOptionalCount(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "자료 없음";
  return formatNumber(Math.round(Number(value)));
}

// 독서교육 접근성 섹션 전용: 정수로 반올림하지 않고 천단위 구분만 적용 (1인당 장서수 등 소수 값 보존)
function formatOptionalNumber(value?: number | null, unit = "") {
  if (value == null || !Number.isFinite(Number(value))) return "자료 없음";
  return `${formatNumber(Number(value))}${unit}`;
}

function formatBooleanFlag(value?: boolean | null) {
  if (value == null) return "자료 없음";
  return value ? "인접" : "확인 안 됨";
}

function compactBarrierLabel(label?: string) {
  if (!label) return "자료 없음";
  return label.replace(/^보행 부담\s*/, "").trim();
}

function formatDecimal(value: number, digits = 1) {
  return new Intl.NumberFormat("ko-KR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatWholeNumber(value: number) {
  return formatNumber(Math.round(value));
}

function formatWholePercent(value: number) {
  return `${formatWholeNumber(value)}%`;
}

function formatGreenNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "0";
  if (value > 0 && value < 0.1) return "<0.1";
  if (value < 1) return formatDecimal(value, 1);
  return formatWholeNumber(value);
}

function formatGreenPercent(value: number) {
  const formatted = formatGreenNumber(value);
  return formatted === "-" ? "-" : `${formatted}%`;
}

function formatSignedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function getDisplayPercentile(value: number, percentileLe?: number, percentileLt?: number) {
  if (percentileLe == null) return undefined;
  if (percentileLt == null) return Math.round(percentileLe * 10) / 10;
  if (value === 0) return Math.max(1, Math.round((percentileLt + 1) * 10) / 10);
  return Math.round((percentileLt + 1) * 10) / 10;
}

type ZeroInflatedDisplayModel = {
  isZero: boolean;
  zeroShare?: number;
  nonZeroPercentile?: number;
  nonZeroAvg?: number;
  comparisonDisabled: boolean;
  emphasisLine?: string;
  percentileLabel: string;
  avgLabel?: string;
  currentRatio?: number;
  avgRatio?: number;
  directionLabel: string;
};

function getRelativeLevelText(tone: StatusTone, kind: "park" | "green" | "playground" | "demand") {
  if (kind === "park") {
    if (tone === "positive") return "비교적 좋은 편입니다.";
    if (tone === "caution") return "보통 수준입니다.";
    if (tone === "warning") return "다소 불리한 편입니다.";
    return "가장 불리한 그룹에 가깝습니다.";
  }
  if (kind === "demand") {
    if (tone === "positive") return "비교적 큰 편입니다.";
    if (tone === "caution") return "보통 수준입니다.";
    if (tone === "warning") return "다소 작은 편입니다.";
    return "작은 편에 가깝습니다.";
  }
  if (tone === "positive") return "비교적 좋은 편입니다.";
  if (tone === "caution") return "보통 수준입니다.";
  if (tone === "warning") return "다소 부족한 편입니다.";
  return "가장 부족한 그룹에 가깝습니다.";
}

function getParkHeadline(distanceM: number) {
  if (distanceM <= 150) return "가까운 공원을 바로 이용할 수 있는 학교입니다.";
  if (distanceM <= 300) return "가까운 공원이 있는 편입니다.";
  if (distanceM <= 500) return "공원 접근성은 보통 수준입니다.";
  if (distanceM <= 800) return "가까운 공원이 다소 부족한 학교입니다.";
  return "가까운 공원 접근성이 불리한 학교입니다.";
}

function getParkDetail(distanceM: number) {
  if (distanceM <= 150) return "학교 주변에서 공원 접근성이 매우 좋은 편입니다.";
  if (distanceM <= 300) return "일상적으로 이용 가능한 공원이 비교적 가까이에 있습니다.";
  if (distanceM <= 500) return "가까운 공원이 없는 것은 아니지만, 바로 인접한 수준은 아닙니다.";
  if (distanceM <= 800) return "공원은 접근 가능하지만, 일상적으로 바로 이용하기에는 거리가 있는 편입니다.";
  return "가까운 생활권 안에서 바로 이용할 수 있는 공원이 부족합니다.";
}

function getGreenHeadline(tone: StatusTone, value: number) {
  if (value === 0) return "보행권 안 녹지 환경이 매우 부족한 학교입니다.";
  if (tone === "positive") return "보행권 안 녹지 환경이 매우 좋은 학교입니다.";
  if (tone === "caution") return "녹지 환경은 보통 수준입니다.";
  if (tone === "warning") return "녹지 환경이 부족한 편입니다.";
  return "보행권 안 녹지 환경이 매우 부족한 학교입니다.";
}

function getGreenDetail(tone: StatusTone, value: number) {
  if (value === 0) return "학교 주변 보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.";
  if (tone === "positive") return "학교 주변에서 머물며 이용할 수 있는 녹지 공간이 충분합니다.";
  if (tone === "caution") return "체류형 녹지 공간이 아주 풍부하지는 않지만 기본 수준은 갖추고 있습니다.";
  if (tone === "warning") return "학교 주변에서 머물며 이용할 수 있는 녹지 공간이 넉넉하지 않습니다.";
  return "학교 주변 보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.";
}

function getPlaygroundHeadline(tone: StatusTone, count: number) {
  if (count === 0) return "놀이터 접근성이 불리한 학교입니다.";
  if (tone === "positive") return "가까운 놀이터 이용 환경이 매우 좋은 학교입니다.";
  if (tone === "caution") return "놀이터 접근성은 보통 수준입니다.";
  if (tone === "warning") return "가까운 놀이터가 다소 부족한 학교입니다.";
  return "놀이터 접근성이 불리한 학교입니다.";
}

function getPlaygroundDetail(tone: StatusTone, count: number) {
  if (count === 0) return "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.";
  if (tone === "positive") return "아이들이 걸어서 이용할 수 있는 놀이터가 충분한 편입니다.";
  if (tone === "caution") return "기본적인 이용은 가능하지만 매우 풍부한 수준은 아닙니다.";
  if (tone === "warning") return "이용 가능한 놀이터는 있으나 선택지가 넉넉하지 않습니다.";
  return "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.";
}

function getStudentDemandTone(currentStudentCount: number, percentile?: number): StatusTone {
  if (percentile != null) {
    if (percentile <= 20) return "positive";
    if (percentile <= 50) return "caution";
    if (percentile <= 75) return "warning";
    return "danger";
  }
  if (currentStudentCount >= 700) return "positive";
  if (currentStudentCount >= 400) return "caution";
  if (currentStudentCount >= 200) return "warning";
  return "danger";
}

function getStudentHeadline(tone: StatusTone) {
  if (tone === "positive") return "주변 학생 수요가 매우 큰 학교입니다.";
  if (tone === "caution") return "주변 학생 수요는 보통 수준입니다.";
  if (tone === "warning") return "주변 학생 수요가 다소 적은 편입니다.";
  return "주변 학생 수요가 작은 학교입니다.";
}

function getStudentDetail(tone: StatusTone) {
  if (tone === "positive") return "시설 설치 시 수혜 규모가 크게 나타날 가능성이 있습니다.";
  if (tone === "caution") return "시설 설치 시 평균적인 수혜 규모가 예상됩니다.";
  if (tone === "warning") return "설치 효과는 제한적일 수 있습니다.";
  return "시설 설치 시 직접적인 수혜 규모는 크지 않을 수 있습니다.";
}

function buildZeroInflatedDisplayModel({
  value,
  zeroShare,
  nonZeroPercentile,
  nonZeroAvg,
  basisLabel,
  zeroMessage,
  nonZeroMessage,
  directionLabel,
  scaleMax,
}: {
  value: number;
  zeroShare?: number;
  nonZeroPercentile?: number;
  nonZeroAvg?: number;
  basisLabel: string;
  zeroMessage: string;
  nonZeroMessage: string;
  directionLabel: string;
  scaleMax: number;
}): ZeroInflatedDisplayModel {
  if (!Number.isFinite(value)) {
    return {
      isZero: false,
      comparisonDisabled: true,
      percentileLabel: "비교 불가",
      directionLabel,
      emphasisLine: `${basisLabel} 비교에 필요한 값이 없습니다.`,
    };
  }

  if (value === 0) {
    return {
      isZero: true,
      zeroShare,
      comparisonDisabled: true,
      percentileLabel: "현재 값 해석",
      directionLabel,
      emphasisLine: `${zeroMessage} ${basisLabel} 기준으로도 매우 부족한 편입니다.`,
    };
  }

  const clamp = (target: number) => clampPercent((target / Math.max(scaleMax, 1)) * 100);

  return {
    isZero: false,
    zeroShare,
    nonZeroPercentile,
    nonZeroAvg,
    comparisonDisabled: false,
    percentileLabel: "현재 값 해석",
    directionLabel,
    avgLabel: nonZeroAvg != null ? `${formatWholeNumber(nonZeroAvg)}` : undefined,
    currentRatio: clamp(value),
    avgRatio: nonZeroAvg != null ? clamp(nonZeroAvg) : undefined,
    emphasisLine:
      nonZeroPercentile != null
        ? `${basisLabel} 기준으로 현재 수준을 비교해 볼 수 있습니다.`
        : `${basisLabel} 기준 비교 가능한 학교 수가 충분하지 않습니다.`,
  };
}

function getToneMeta(tone: StatusTone) {
  switch (tone) {
    case "danger":
      return {
        badge: "위험",
        accent: "text-rose-300",
        soft: "bg-navy-900/95",
        border: "border-white/10",
        stripe: "accent-stripe accent-stripe-rose pl-5",
      };
    case "warning":
      return {
        badge: "경고",
        accent: "text-amber-300",
        soft: "bg-navy-900/95",
        border: "border-white/10",
        stripe: "accent-stripe accent-stripe-amber pl-5",
      };
    case "caution":
      return {
        badge: "주의",
        accent: "text-yellow-200",
        soft: "bg-navy-900/95",
        border: "border-white/10",
        stripe: "accent-stripe accent-stripe-yellow pl-5",
      };
    default:
      return {
        badge: "양호",
        accent: "text-forest-300",
        soft: "bg-navy-900/95",
        border: "border-white/10",
        stripe: "accent-stripe accent-stripe-forest pl-5",
      };
  }
}

function toneFromComparison(current: number, city: number, district: number, higherIsBetter: boolean): StatusTone {
  const cityGap = higherIsBetter ? current - city : city - current;
  const districtGap = higherIsBetter ? current - district : district - current;
  const avgGap = (cityGap + districtGap) / 2;
  if (avgGap <= -2.5) return "danger";
  if (avgGap <= -1.2) return "warning";
  if (avgGap < 0) return "caution";
  return "positive";
}

function buildTrendTone(points: StudentTrendPoint[]): StatusTone {
  const first = points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  if (!first) return "caution";
  const change = ((last - first) / first) * 100;
  if (change <= -18) return "danger";
  if (change <= -10) return "warning";
  if (change < -3) return "caution";
  return "positive";
}

// nearestParkDistance: share_ge 기준 — percentile 낮을수록 불리(거리 긴 학교가 적다 = 이 학교가 나쁨)
function parkToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile <= 25) return "danger";
  if (percentile <= 50) return "warning";
  if (percentile <= 70) return "caution";
  return "positive";
}

// 백분위 없을 때 거리 직접 비교로 tone 산출
function parkToneFromDistance(distanceM: number, cityAvg: number): StatusTone {
  if (distanceM <= cityAvg * 0.45) return "positive";  // 시 평균의 절반 이하 → 양호
  if (distanceM <= cityAvg) return "caution";
  if (distanceM <= cityAvg * 1.6) return "warning";
  return "danger";
}

// greenRatio: share_le 기준 — percentile 높을수록 불리(녹지 낮은 학교가 많다 = 이 학교가 나쁨)
function greenToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile >= 80) return "danger";
  if (percentile >= 60) return "warning";
  if (percentile >= 40) return "caution";
  return "positive";
}

function greenToneFromValue(value: number, cityAvg: number): StatusTone {
  if (value >= cityAvg * 1.2) return "positive";
  if (value >= cityAvg * 0.5) return "caution";
  if (value > 0) return "warning";
  return "danger";
}

// playgroundCount: share_le 기준 — percentile 높을수록 불리
function playgroundToneFromPercentile(percentile: number | undefined): StatusTone {
  if (percentile == null) return "caution";
  if (percentile >= 80) return "danger";
  if (percentile >= 60) return "warning";
  if (percentile >= 40) return "caution";
  return "positive";
}

function playgroundToneFromValue(count: number, cityAvg: number): StatusTone {
  if (count >= cityAvg * 1.5) return "positive";
  if (count >= cityAvg) return "caution";
  if (count > 0) return "warning";
  return "danger";
}

function trendToneFromChange(changePercent: number): StatusTone {
  if (changePercent > 0) return "caution";
  if (changePercent <= -18) return "danger";
  if (changePercent <= -10) return "warning";
  return "caution";
}

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("relative rounded-2xl border border-white/10 bg-card-grad shadow-card", className)} {...props} />;
}

function Badge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const meta = getToneMeta(tone);
  const ringMap: Record<StatusTone, string> = {
    danger: "border-rose-400/50 bg-rose-500/15 text-rose-200",
    warning: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    caution: "border-yellow-400/45 bg-yellow-400/12 text-yellow-100",
    positive: "border-forest-400/55 bg-forest-500/15 text-forest-200",
  };
  void meta;
  return <span className={cx("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide", ringMap[tone])}>{children}</span>;
}

function Button({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cx("inline-flex items-center justify-center rounded-2xl bg-forest-grad px-5 py-3 text-sm font-semibold text-white shadow-glow transition hover:brightness-110", className)} {...props} />;
}

function SectionShell({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-forest-300">{kicker}</p>
        <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SectionChip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-white/15 bg-navy-900/95 px-3 py-1.5 text-sm font-medium text-slate-200">{children}</span>;
}

function DarkChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-navy-900/95 px-3 py-1.5 text-sm font-medium text-slate-200">
      {children}
    </span>
  );
}

function MetricCard({ title, icon, value, unit, tone, headline, emphasisLine, comparisonLines, comparisonVisual, footer }: MetricCardProps) {
  const meta = getToneMeta(tone);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-400">{icon} {title}</p>
          <div className="mt-3 flex items-end gap-2">
            <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
            <p className="pb-1 text-sm font-medium text-slate-400">{unit}</p>
          </div>
        </div>
        <Badge tone={tone}>{meta.badge}</Badge>
      </div>
      <div className={cx("mt-4 rounded-2xl border p-4", meta.soft, meta.border, meta.stripe)}>
        <p className={cx("text-sm font-semibold tracking-tight", meta.accent)}>{headline}</p>
        {emphasisLine ? (
          <p className="mt-2 text-base font-bold tracking-tight text-white">{emphasisLine}</p>
        ) : null}
        {comparisonVisual ? comparisonVisual : null}
        {comparisonLines?.length ? (
          <div className="mt-2 space-y-1 text-sm text-slate-200">
            {comparisonLines.map((line) => <p key={line}>{line}</p>)}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </Card>
  );
}

function ComparisonBar({
  label,
  percentile,
  percentileLabel,
  currentRatio,
  avgRatio,
  currentLabel,
  avgLabel,
  avgTitle,
  directionLabel,
  disabled,
  disabledMessage,
}: {
  label: string;
  percentile?: number;
  percentileLabel: string;
  currentRatio?: number;
  avgRatio?: number;
  currentLabel: string;
  avgLabel: string;
  avgTitle: string;
  directionLabel: string;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const marker = (value: number) => `${clampPercent(value)}%`;

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-2xl bg-navy-900/95 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-2xl font-black tracking-tight text-white">
            {percentile == null ? "-" : formatWholePercent(percentile)}
          </p>
          <p className="text-xs font-medium text-slate-400">
            {percentile == null ? "비교 분포 계산 중" : percentileLabel}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
          <span>불리</span>
          <span>{directionLabel}</span>
          <span>유리</span>
        </div>
        <div className={cx("relative h-3 rounded-full ring-1 ring-white/15", disabled ? "bg-navy-900/95" : "bg-navy-900/95")}>
          <div
            className={cx(
              "absolute inset-y-0 left-0 rounded-full",
              disabled ? "bg-white/15" : "bg-gradient-to-r from-rose-500/60 via-amber-400/60 to-forest-400/70",
            )}
            style={{ width: "100%" }}
          />
          {!disabled && avgRatio != null ? (
            <div className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-white/60" style={{ left: marker(avgRatio) }} />
          ) : null}
          {!disabled && currentRatio != null ? (
            <div className="absolute top-1/2 h-6 w-6 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-navy-950 bg-forest-400 shadow-glow" style={{ left: marker(currentRatio) }} />
          ) : null}
        </div>
        {disabled && disabledMessage ? <p className="text-[11px] text-slate-400">{disabledMessage}</p> : null}
        <div className="grid gap-2 text-xs text-slate-200">
          <div className="flex items-center justify-between rounded-xl bg-navy-900/95 px-3 py-2">
            <span className="font-semibold text-slate-400">현재</span>
            <span className="font-semibold text-white">{currentLabel}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-navy-900/95 px-3 py-2">
            <span className="font-semibold text-slate-400">{avgTitle}</span>
            <span>{avgLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentTrendMini({ data }: { data: StudentTrendPoint[] }) {
  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 10, left: -24, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} width={40} />
          <Tooltip contentStyle={{ borderRadius: 12, backgroundColor: "rgba(10,22,51,0.95)", borderColor: "rgba(255,255,255,0.1)", color: "#E5E7EB" }} formatter={(value: number) => [`${formatNumber(value)}명`, "학생 수"]} />
          <Line type="monotone" dataKey="value" stroke="#3FB081" strokeWidth={2.5} dot={{ r: 3, fill: "#3FB081" }} activeDot={{ r: 5 }}>
            <LabelList dataKey="value" position="top" formatter={(value: number) => formatNumber(value)} style={{ fill: "#94A3B8", fontSize: 10 }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SchoolHeader({ schoolName, districtName, casePolicyLabel, caseStatusLabel, statusSummary, noParkWithin500m, nearestParkDistanceM, greenRatio, greenRatioHighReviewFlag, playgroundCount }: Pick<SchoolDetailReportProps, "schoolName" | "districtName" | "casePolicyLabel" | "caseStatusLabel" | "statusSummary" | "noParkWithin500m" | "nearestParkDistanceM" | "greenRatio" | "greenRatioHighReviewFlag" | "playgroundCount">) {
  return (
    <Card className="overflow-hidden">
      <div className="relative space-y-5 p-7">
        {/* Decorative top-left forest accent corner */}
        <div className="pointer-events-none absolute -top-px left-7 right-7 h-px bg-gradient-to-r from-transparent via-forest-400/50 to-transparent" />
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/45 bg-rose-500/12 px-3 py-1 text-[11px] font-bold tracking-[0.16em] text-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
            {casePolicyLabel}
          </span>
          <span className="rounded-full border border-white/10 bg-navy-900/95 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-300">{caseStatusLabel}</span>
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">{schoolName}</h1>
          <p className="mt-2 text-base font-semibold text-slate-300">{districtName}</p>
          {statusSummary ? <p className="mt-4 max-w-3xl text-base leading-7 font-medium text-slate-200">{statusSummary}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <DarkChip>🌳 최근접 공원 {formatNumber(nearestParkDistanceM)}m</DarkChip>
          <DarkChip>🌿 녹지 {formatGreenPercent(greenRatio)}</DarkChip>
          {greenRatioHighReviewFlag ? <DarkChip>녹지비율 검수 필요</DarkChip> : null}
          <DarkChip>🛝 놀이터 {formatNumber(playgroundCount)}개</DarkChip>
          {noParkWithin500m ? <DarkChip>🔴 500m 내 공원 없음</DarkChip> : null}
        </div>
      </div>
    </Card>
  );
}

function ParkAccessConditionCard(props: Pick<SchoolDetailReportProps, "nearestParkDistanceM" | "greenRatio" | "nearestParkName" | "nearestParkAccessNote" | "nearestOfficialParkType" | "nearestOfficialParkAreaM2" | "nearestOfficialParkFunctionLabel" | "nearestFunctionalParkDistanceM" | "nearestFunctionalParkName" | "nearestFunctionalParkAreaM2" | "nearestOfficialRouteDistanceM" | "nearestOfficialRouteDetourRatio" | "nearestOfficialMajorRoadCrossingCount" | "nearestOfficialLargeIntersectionFlag" | "nearestOfficialAccidentHotspotFlag" | "nearestOfficialBarrierLevel" | "nearestOfficialBarrierLabel" | "nearestOfficialBarrierSummary" | "nearestOfficialBarrierDescription" | "nearestFunctionalRouteDistanceM" | "nearestFunctionalRouteDetourRatio" | "nearestFunctionalMajorRoadCrossingCount" | "nearestFunctionalLargeIntersectionFlag" | "nearestFunctionalAccidentHotspotFlag" | "nearestFunctionalBarrierLevel" | "nearestFunctionalBarrierLabel" | "nearestFunctionalBarrierSummary" | "nearestFunctionalBarrierDescription" | "accessConditionType" | "accessConditionLabel" | "accessConditionDescription" | "functionalAccessPhysicalBarrierFlag" | "functionalAccessPhysicalBarrierLabel" | "functionalAccessPhysicalBarrierBasis" | "noOfficialParkFlag" | "noFunctionalPark">) {
  const isImbalance =
    props.accessConditionType === "near_park_low_green_imbalance" ||
    ((props.nearestFunctionalParkDistanceM ?? Infinity) <= 500 && props.greenRatio < 5);
  const hasBarrier = props.functionalAccessPhysicalBarrierFlag === true;
  const roadCrossingCount = Number(props.nearestFunctionalMajorRoadCrossingCount ?? 0);
  const officialRoadCrossingCount = Number(props.nearestOfficialMajorRoadCrossingCount ?? 0);
  const hasLargeIntersection = props.nearestFunctionalLargeIntersectionFlag === true;
  const officialHasLargeIntersection = props.nearestOfficialLargeIntersectionFlag === true;
  const routeDistance = props.nearestOfficialRouteDistanceM ?? props.nearestParkDistanceM;
  const activityRouteDistance = props.nearestFunctionalRouteDistanceM ?? props.nearestFunctionalParkDistanceM;
  const physicalBarrierLabel = hasBarrier ? props.functionalAccessPhysicalBarrierBasis ?? "간선급 도로 횡단 또는 대형 교차로 통과" : "해당 없음";
  const routeNamesDiffer = Boolean(
    props.nearestParkName &&
      props.nearestFunctionalParkName &&
      props.nearestParkName !== props.nearestFunctionalParkName,
  );
  const higherActivityRiskReasons = [
    Number.isFinite(roadCrossingCount) &&
    Number.isFinite(officialRoadCrossingCount) &&
    roadCrossingCount > officialRoadCrossingCount
      ? "간선도로 횡단"
      : "",
    hasLargeIntersection && !officialHasLargeIntersection ? "대형 교차로" : "",
  ].filter(Boolean);
  const routeBasisWarning = higherActivityRiskReasons.length
    ? `활동규모 공원 경로는 공식 최근접 공원 경로와 비교해 ${higherActivityRiskReasons.join("·")} 항목이 더 불리하게 산정됩니다.`
    : routeNamesDiffer
      ? "공식 최근접 공원과 활동규모 공원 대상지가 달라 경로 특성을 별도로 해석합니다."
      : "";
  const finalInterpretation = props.noOfficialParkFlag
    ? "도보 도달권 내 공식 공원이 확인되지 않아 신규 조성 또는 학교 내부 공간 활용을 우선 검토해야 합니다."
    : props.noFunctionalPark
      ? "도보권 내 3,000㎡ 이상 활동규모 공원은 확인되지 않습니다. 활동규모 공원은 기준 면적 이상으로 아이들이 머물며 활동할 수 있는 규모의 공원입니다."
    : isImbalance && hasBarrier
      ? `가까운 활동규모 공원은 있으나 학교 도보 도달권 전체의 녹지 비율은 낮고, 도달 경로에 ${physicalBarrierLabel}이 확인됩니다.`
    : isImbalance
      ? "가까운 활동규모 공원은 있으나 학교 도보 도달권 전체의 녹지 비율은 낮아, 공원 접근성과 도달권 녹지환경을 분리해 해석해야 합니다."
      : hasBarrier
        ? `활동규모 공원은 있으나, 도달 경로에 ${physicalBarrierLabel}이 확인됩니다.`
      : props.accessConditionDescription ?? "공식 공원 접근성과 활동규모 공원 접근성을 분리해 추가 검토할 수 있습니다.";

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-forest-300">Existing Facility Access</p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-white">공식 공원과 활동규모 공원</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={isImbalance ? "warning" : props.noOfficialParkFlag ? "danger" : "positive"}>
            {props.accessConditionLabel ?? "추가 검토 필요"}
          </Badge>
          {hasBarrier ? <Badge tone="warning">{props.functionalAccessPhysicalBarrierLabel ?? "보행부담 동반형"}</Badge> : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">공식 최근접 공원</p>
          <p className="text-base font-bold text-white">
            {props.nearestParkName ?? "자료 없음"}
            {props.nearestOfficialParkType ? ` · ${props.nearestOfficialParkType}` : ""}
            {` · ${formatOptionalArea(props.nearestOfficialParkAreaM2)}`}
          </p>
          <p className="mt-2 text-sm font-semibold text-forest-200">{props.nearestOfficialParkFunctionLabel ?? "규모 기준 자료 없음"}</p>
          <div className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">거리: <span className="font-bold text-white">{formatOptionalDistance(routeDistance)}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">규모 기준: <span className="font-bold text-white">{props.nearestOfficialParkFunctionLabel ?? "자료 없음"}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">보행 부담: <span className="font-bold text-white">{compactBarrierLabel(props.nearestOfficialBarrierLabel)}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">간선도로 횡단: <span className="font-bold text-white">{props.nearestOfficialMajorRoadCrossingCount == null ? "자료 없음" : `${formatOptionalCount(props.nearestOfficialMajorRoadCrossingCount)}회`}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">대형 교차로: <span className="font-bold text-white">{formatBooleanFlag(props.nearestOfficialLargeIntersectionFlag)}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">우회율: <span className="font-bold text-white">{formatOptionalRatio(props.nearestOfficialRouteDetourRatio)}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-forest-300">활동규모 공원</p>
          <p className="text-base font-bold text-white">
            {props.nearestFunctionalParkName ?? "자료 없음"}
            {` · ${formatOptionalArea(props.nearestFunctionalParkAreaM2)}`}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            3,000㎡ 이상으로 아이들이 머물며 활동할 수 있는 규모의 공원입니다.
          </p>
          <div className="mt-4 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">거리: <span className="font-bold text-white">{formatOptionalDistance(activityRouteDistance)}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">보행부담 태그: <span className="font-bold text-white">{physicalBarrierLabel}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">간선도로 횡단: <span className="font-bold text-white">{props.nearestFunctionalMajorRoadCrossingCount == null ? "자료 없음" : `${formatOptionalCount(props.nearestFunctionalMajorRoadCrossingCount)}회`}</span></div>
            <div className="rounded-xl bg-white/[0.04] px-3 py-2">대형 교차로: <span className="font-bold text-white">{formatBooleanFlag(props.nearestFunctionalLargeIntersectionFlag)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
          <p className="text-sm font-semibold text-slate-300">공식 공원 경로 특성</p>
          <p className="mt-2 text-base font-bold leading-7 text-white">{props.nearestOfficialBarrierSummary ?? "자료 없음"}</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <p>{props.nearestOfficialBarrierDescription ?? "경로 자료가 없어 보행부담을 추정할 수 없습니다."}</p>
            <p>사고위험 지점: {formatBooleanFlag(props.nearestOfficialAccidentHotspotFlag)}</p>
            {props.nearestParkAccessNote ? <p>{props.nearestParkAccessNote}</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
          <p className="text-sm font-semibold text-slate-300">활동규모 공원 경로 특성</p>
          <p className="mt-2 text-base font-bold leading-7 text-white">{props.nearestFunctionalBarrierSummary ?? "자료 없음"}</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            <p>{props.nearestFunctionalBarrierDescription ?? "경로 자료가 없어 보행부담을 추정할 수 없습니다."}</p>
            <p>사고위험 지점: {formatBooleanFlag(props.nearestFunctionalAccidentHotspotFlag)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium leading-6 text-slate-100">
        {routeBasisWarning ? <p className="mb-2 text-amber-200">{routeBasisWarning}</p> : null}
        {finalInterpretation}
      </div>
    </Card>
  );
}

function SchoolProfileGrid(props: Pick<SchoolDetailReportProps, "nearestParkDistanceM" | "nearestParkDistanceCityAvg" | "nearestParkDistanceDistrictAvg" | "nearestParkDistanceCityPercentile" | "nearestParkDistanceDistrictPercentile" | "greenRatio" | "greenRatioDisplayBasis" | "greenRatioReviewNote" | "greenRatioHighReviewFlag" | "greenRatioCityAvg" | "greenRatioDistrictAvg" | "greenRatioCityPercentile" | "greenRatioDistrictPercentile" | "greenRatioCityPercentile_lt" | "greenRatioDistrictPercentile_lt" | "greenRatioCityZeroShare" | "greenRatioDistrictZeroShare" | "greenRatioCityNonZeroPercentile" | "greenRatioDistrictNonZeroPercentile" | "greenRatioCityNonZeroAvg" | "greenRatioDistrictNonZeroAvg" | "playgroundCount" | "playgroundCountCityAvg" | "playgroundCountDistrictAvg" | "playgroundCountCityPercentile" | "playgroundCountDistrictPercentile" | "playgroundCountCityPercentile_lt" | "playgroundCountDistrictPercentile_lt" | "playgroundCountCityZeroShare" | "playgroundCountDistrictZeroShare" | "playgroundCountCityNonZeroPercentile" | "playgroundCountDistrictNonZeroPercentile" | "playgroundCountCityNonZeroAvg" | "playgroundCountDistrictNonZeroAvg" | "studentTrend" | "studentTrendChangePct" | "studentTrendCityAvg" | "studentTrendDistrictAvg" | "currentStudentCount2025" | "currentStudentCountCityPercentile" | "currentStudentCountDistrictPercentile" | "nearestParkName" | "nearestParkAccessNote" | "nearestOfficialParkType" | "nearestOfficialParkAreaM2" | "nearestOfficialParkFunctionClass" | "nearestOfficialParkFunctionLabel" | "nearestFunctionalParkDistanceM" | "nearestFunctionalParkName" | "nearestFunctionalParkAreaM2" | "nearestOfficialRouteDistanceM" | "nearestOfficialRouteDetourRatio" | "nearestOfficialMajorRoadCrossingCount" | "nearestOfficialLargeIntersectionFlag" | "nearestOfficialAccidentHotspotFlag" | "nearestOfficialBarrierLevel" | "nearestOfficialBarrierLabel" | "nearestOfficialBarrierSummary" | "nearestOfficialBarrierDescription" | "nearestFunctionalRouteDistanceM" | "nearestFunctionalRouteDetourRatio" | "nearestFunctionalMajorRoadCrossingCount" | "nearestFunctionalLargeIntersectionFlag" | "nearestFunctionalAccidentHotspotFlag" | "nearestFunctionalBarrierLevel" | "nearestFunctionalBarrierLabel" | "nearestFunctionalBarrierSummary" | "nearestFunctionalBarrierDescription" | "accessConditionType" | "accessConditionLabel" | "accessConditionDescription" | "functionalAccessPhysicalBarrierFlag" | "functionalAccessPhysicalBarrierLabel" | "activitySpaceLimited" | "onlyMicroPark" | "noFunctionalPark" | "noOfficialParkFlag" | "straightLinePlaygroundCount" | "noParkWithin500m" | "accessibilityRatio" | "parkShortageVsAvg">) {
  const [comparisonBasis, setComparisonBasis] = React.useState<"city" | "district">("city");
  const parkPercentile = comparisonBasis === "city" ? props.nearestParkDistanceCityPercentile : props.nearestParkDistanceDistrictPercentile;
  const basisLabel = comparisonBasis === "city" ? "인천시 기준" : "구 기준";
  const parkAvg = comparisonBasis === "city" ? props.nearestParkDistanceCityAvg : props.nearestParkDistanceDistrictAvg;
  const parkTone = parkPercentile != null
    ? parkToneFromPercentile(parkPercentile)
    : parkToneFromDistance(props.nearestParkDistanceM, parkAvg);
  const greenZeroShare = comparisonBasis === "city" ? props.greenRatioCityZeroShare : props.greenRatioDistrictZeroShare;
  const greenNonZeroPercentile = comparisonBasis === "city" ? props.greenRatioCityNonZeroPercentile : props.greenRatioDistrictNonZeroPercentile;
  const greenNonZeroAvg = comparisonBasis === "city" ? props.greenRatioCityNonZeroAvg : props.greenRatioDistrictNonZeroAvg;
  const playgroundZeroShare = comparisonBasis === "city" ? props.playgroundCountCityZeroShare : props.playgroundCountDistrictZeroShare;
  const playgroundNonZeroPercentile = comparisonBasis === "city" ? props.playgroundCountCityNonZeroPercentile : props.playgroundCountDistrictNonZeroPercentile;
  const playgroundNonZeroAvg = comparisonBasis === "city" ? props.playgroundCountCityNonZeroAvg : props.playgroundCountDistrictNonZeroAvg;
  const greenAvg = comparisonBasis === "city" ? props.greenRatioCityAvg : props.greenRatioDistrictAvg;
  const playgroundAvg = comparisonBasis === "city" ? props.playgroundCountCityAvg : props.playgroundCountDistrictAvg;
  const first = props.studentTrend[0]?.value ?? 0;
  const last = props.studentTrend[props.studentTrend.length - 1]?.value ?? 0;
  const changePercent = props.studentTrendChangePct ?? (first ? ((last - first) / first) * 100 : 0);
  const trendTone = trendToneFromChange(changePercent);
  const currentStudentCount = props.currentStudentCount2025 ?? last;
  const studentDemandTone = getStudentDemandTone(currentStudentCount, comparisonBasis === "city" ? props.currentStudentCountCityPercentile : props.currentStudentCountDistrictPercentile);
  const parkScaleMax = Math.max(1200, props.nearestParkDistanceM, parkAvg, props.nearestParkDistanceDistrictAvg, props.nearestParkDistanceCityAvg);
  const greenScaleMax = Math.max(12, props.greenRatio, greenAvg, greenNonZeroAvg ?? 0);
  const playgroundScaleMax = Math.max(3, props.playgroundCount + 1, playgroundAvg * 3, (playgroundNonZeroAvg ?? 0) * 3);
  const activityScaleDistance = props.nearestFunctionalRouteDistanceM ?? props.nearestFunctionalParkDistanceM;
  const nearestOfficialParkIsBelowActivityScale =
    props.onlyMicroPark ||
    props.activitySpaceLimited ||
    ["playground_like", "small_child_park"].includes(props.nearestOfficialParkFunctionClass ?? "");
  const showActivityScaleDistanceNote =
    nearestOfficialParkIsBelowActivityScale &&
    activityScaleDistance != null &&
    Number.isFinite(Number(activityScaleDistance)) &&
    Number(activityScaleDistance) > props.nearestParkDistanceM;
  const scaleToRatio = (value: number, max: number, higherIsBetter: boolean) => {
    if (max <= 0) return higherIsBetter ? 100 : 0;
    const normalized = clampPercent((value / max) * 100);
    return higherIsBetter ? normalized : 100 - normalized;
  };
  const greenDisplayModel = buildZeroInflatedDisplayModel({
    value: props.greenRatio,
    zeroShare: greenZeroShare,
    nonZeroPercentile: greenNonZeroPercentile,
    nonZeroAvg: greenNonZeroAvg,
    basisLabel,
    zeroMessage: "보행권 안에 체감 가능한 녹지 공간이 거의 없습니다.",
    nonZeroMessage: "현재 수준",
    directionLabel: "녹지 많을수록 유리",
    scaleMax: greenScaleMax,
  });
  const playgroundDisplayModel = buildZeroInflatedDisplayModel({
    value: props.playgroundCount,
    zeroShare: playgroundZeroShare,
    nonZeroPercentile: playgroundNonZeroPercentile,
    nonZeroAvg: playgroundNonZeroAvg,
    basisLabel,
    zeroMessage: "생활권 안에서 바로 이용할 수 있는 놀이터가 부족합니다.",
    nonZeroMessage: "현재 수준",
    directionLabel: "놀이터 많을수록 유리",
    scaleMax: playgroundScaleMax,
  });
  const displayedGreenPercentile = greenDisplayModel.nonZeroPercentile;
  const displayedPlaygroundPercentile = playgroundDisplayModel.nonZeroPercentile;
  const greenTone = displayedGreenPercentile != null
    ? greenToneFromPercentile(displayedGreenPercentile)
    : greenToneFromValue(props.greenRatio, greenAvg);
  const playgroundTone = displayedPlaygroundPercentile != null
    ? playgroundToneFromPercentile(displayedPlaygroundPercentile)
    : playgroundToneFromValue(props.playgroundCount, playgroundAvg);
  const accessDisplayLabel =
    props.functionalAccessPhysicalBarrierFlag && !(props.accessConditionLabel ?? "").includes("보행부담")
      ? `${props.accessConditionLabel ?? "추가 검토 필요"} · ${props.functionalAccessPhysicalBarrierLabel ?? "보행부담 동반형"}`
      : props.accessConditionLabel ?? (props.noParkWithin500m ? "공원 접근 결핍형" : "추가 검토 필요");

  return (
    <SectionShell kicker="External Access" title="외부 접근성·수요 현황">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setComparisonBasis("city")}
          className={cx(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            comparisonBasis === "city"
              ? "bg-forest-grad text-white shadow-glow"
              : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10",
          )}
        >
          인천시 기준
        </button>
        <button
          type="button"
          onClick={() => setComparisonBasis("district")}
          className={cx(
            "rounded-full px-4 py-2 text-sm font-semibold transition",
            comparisonBasis === "district"
              ? "bg-forest-grad text-white shadow-glow"
              : "border border-white/15 bg-navy-900/95 text-slate-200 hover:bg-white/10",
          )}
        >
          구 기준
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricCard
          title="최근접 공원 거리"
          icon="🌳"
          value={formatNumber(props.nearestParkDistanceM)}
          unit="m"
          tone={parkTone}
          headline={getParkHeadline(props.nearestParkDistanceM)}
          emphasisLine={getParkDetail(props.nearestParkDistanceM)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 공원 접근성은 ${getRelativeLevelText(parkTone, "park")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={parkPercentile}
              percentileLabel="공원 거리가 먼 편 상위"
              currentRatio={scaleToRatio(props.nearestParkDistanceM, parkScaleMax, false)}
              avgRatio={scaleToRatio(parkAvg, parkScaleMax, false)}
              currentLabel={`${formatNumber(props.nearestParkDistanceM)}m`}
              avgLabel={`${formatNumber(parkAvg)}m`}
              avgTitle={comparisonBasis === "city" ? "인천시 평균" : "구 평균"}
              directionLabel="거리 짧을수록 유리"
            />
          }
          footer={
            showActivityScaleDistanceNote ? (
              <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-xs font-medium leading-5 text-amber-100">
                <p>가장 가까운 공원의 규모가 작아, 충분한 놀이, 활동 공간을 제공하기에 한계가 있습니다.</p>
                <p className="mt-1">
                  일정 규모 이상의 활동 가능 공원(활동규모 공원)까지의 실제 도보 거리는 약 {formatOptionalDistance(activityScaleDistance)}입니다.
                </p>
              </div>
            ) : null
          }
        />
        <MetricCard
          title="녹지 비율"
          icon="🌿"
          value={formatGreenNumber(props.greenRatio)}
          unit="%"
          tone={greenTone}
          headline={getGreenHeadline(greenTone, props.greenRatio)}
          emphasisLine={getGreenDetail(greenTone, props.greenRatio)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 녹지 환경은 ${getRelativeLevelText(greenTone, "green")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={displayedGreenPercentile}
              percentileLabel={greenDisplayModel.percentileLabel}
              currentRatio={greenDisplayModel.currentRatio}
              avgRatio={greenDisplayModel.avgRatio}
              currentLabel={formatGreenPercent(props.greenRatio)}
              avgLabel={greenDisplayModel.avgLabel ? `${greenDisplayModel.avgLabel}%` : "-"}
              avgTitle={comparisonBasis === "city" ? "녹지가 있는 학교 평균" : "구 내 녹지가 있는 학교 평균"}
              directionLabel={greenDisplayModel.directionLabel}
              disabled={greenDisplayModel.comparisonDisabled}
              disabledMessage="현재 값 기준으로만 비교선을 표시했습니다."
            />
          }
          footer={
            props.greenRatioDisplayBasis === "apartment_adjusted" ? (
              <p className="rounded-xl border border-forest-300/20 bg-forest-300/10 px-3 py-2 text-xs font-medium leading-5 text-forest-100">
                아파트 단지 내부 보행 가능성 보정값을 표시합니다.
              </p>
            ) : null
          }
        />
        <MetricCard
          title="도보권 놀이터"
          icon="🛝"
          value={formatNumber(props.playgroundCount)}
          unit="개"
          tone={playgroundTone}
          headline={getPlaygroundHeadline(playgroundTone, props.playgroundCount)}
          emphasisLine={getPlaygroundDetail(playgroundTone, props.playgroundCount)}
          comparisonLines={[
            `${basisLabel.replace(" 기준", "")}에서도 놀이터 접근성은 ${getRelativeLevelText(playgroundTone, "playground")}`,
          ]}
          comparisonVisual={
            <ComparisonBar
              label={`${basisLabel} 해석`}
              percentile={displayedPlaygroundPercentile}
              percentileLabel={playgroundDisplayModel.percentileLabel}
              currentRatio={playgroundDisplayModel.currentRatio}
              avgRatio={playgroundDisplayModel.avgRatio}
              currentLabel={`${formatNumber(props.playgroundCount)}개`}
              avgLabel={playgroundDisplayModel.avgLabel ? `${playgroundDisplayModel.avgLabel}개` : "-"}
              avgTitle={comparisonBasis === "city" ? "놀이터가 있는 학교 평균" : "구 내 놀이터가 있는 학교 평균"}
              directionLabel={playgroundDisplayModel.directionLabel}
              disabled={playgroundDisplayModel.comparisonDisabled}
              disabledMessage="현재 값 기준으로만 비교선을 표시했습니다."
            />
          }
          footer={props.straightLinePlaygroundCount != null ? <div className="rounded-2xl bg-navy-900/95 px-4 py-3 text-sm text-slate-200">500m 직선거리 반경 안에는 놀이터가 {formatNumber(props.straightLinePlaygroundCount)}개 있지만, 실제 도보 이동 500m 이내 놀이터는 {formatNumber(props.playgroundCount)}개입니다.</div> : null}
        />
        <MetricCard
          title="학생 수 추세"
          icon="📉"
          value={formatSignedPercent(changePercent)}
          unit="6년 변화"
          tone={trendTone}
          headline={getStudentHeadline(studentDemandTone)}
          emphasisLine={getStudentDetail(studentDemandTone)}
          comparisonLines={[
            `현재 학생 규모는 ${formatNumber(currentStudentCount)}명으로, ${basisLabel.replace(" 기준", "")}에서는 ${getRelativeLevelText(studentDemandTone, "demand")}`,
            changePercent > props.studentTrendDistrictAvg
              ? "최근 학생 수 흐름은 평균보다 조금 더 유지되는 편입니다."
              : "최근 학생 수 흐름은 평균보다 조금 더 감소하는 편입니다.",
          ]}
          footer={<StudentTrendMini data={props.studentTrend} />}
        />
      </div>
      <ParkAccessConditionCard {...props} />
      <Card className="p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4"><p className="text-sm font-medium text-slate-400">접근성 유형</p><p className="mt-2 text-xl font-bold text-white">{accessDisplayLabel}</p></div>
          <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4"><p className="text-sm font-medium text-slate-400">접근성 비율</p><p className="mt-2 text-2xl font-bold text-white">{props.accessibilityRatio != null ? `${formatDecimal(props.accessibilityRatio, 1)}%` : "-"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4"><p className="text-sm font-medium text-slate-400">평균 대비 공원 부족</p><p className="mt-2 text-2xl font-bold text-white">{props.parkShortageVsAvg != null ? `${formatDecimal(props.parkShortageVsAvg, 1)}개` : "-"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4"><p className="text-sm font-medium text-slate-400">최근접 활동규모 공원</p><p className="mt-2 text-2xl font-bold text-white">{formatOptionalDistance(props.nearestFunctionalParkDistanceM)}</p></div>
        </div>
      </Card>
    </SectionShell>
  );
}

function readingGapTone(gapType?: string | null): StatusTone {
  switch (gapType) {
    case "direct_investment_first":
      return "danger";
    case "school_hub_mobile":
      return "warning";
    case "public_link":
      return "caution";
    case "maintain_monitor":
      return "positive";
    default:
      return "caution";
  }
}

function ReadingAccessSection({ readingContext }: Pick<SchoolDetailReportProps, "readingContext">) {
  if (!readingContext || readingContext.matched === false) {
    return (
      <SectionShell kicker="Reading Reachability" title="독서 도달성 (외부 접근성·내부 공급)">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-400">추가 확인 필요 (학교–도서관 도달성 데이터 없음)</p>
        </Card>
      </SectionShell>
    );
  }

  const {
    isoPublicLibraryCount,
    perCapitaBooks,
    librarianTotal,
    seatCount,
    bookCount,
    nearestLibraryName,
    nearestLibraryType,
    nearestLibraryDistM,
    nearestLibraryCoordApprox,
    gapType,
    gapLabel,
    gapReason,
    cityStats,
    policy,
  } = readingContext;

  const librarianMissing = librarianTotal === 0;

  return (
    <SectionShell kicker="Reading Reachability" title="독서 도달성 (외부 접근성·내부 공급)">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={readingGapTone(gapType)}>{gapLabel ?? "자료 없음"}</Badge>
        {gapReason ? <p className="text-sm text-slate-400">{gapReason}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-400">도보 500m 공공·어린이도서관</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">{formatOptionalNumber(isoPublicLibraryCount, "개")}</p>
          <p className="mt-2 text-sm text-slate-400">
            인천 {formatOptionalNumber(cityStats?.total)}교 중 {formatOptionalNumber(cityStats?.externalShortageCount)}교가 0개
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-400">학교도서관 1인당 장서</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">{formatOptionalNumber(perCapitaBooks, "권")}</p>
          <p className="mt-2 text-sm text-slate-400">시 중앙값 {formatOptionalNumber(cityStats?.cityMedianPerCapita, "권")}</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-400">사서</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-white">{formatOptionalNumber(librarianTotal, "명")}</p>
            </div>
            {librarianMissing ? <Badge tone="danger">사서 미배치</Badge> : null}
          </div>
          <p className="mt-2 text-sm text-slate-400">시 전체 미배치 {formatOptionalNumber(cityStats?.noLibrarianCount)}교</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-slate-400">열람좌석 / 장서</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-white">
            {formatOptionalNumber(seatCount, "석")} / {formatOptionalNumber(bookCount, "권")}
          </p>
        </Card>
      </div>
      <Card className="p-4">
        <p className="text-sm text-slate-200">
          최근접 도서관 {nearestLibraryName ?? "자료 없음"} ({nearestLibraryType ? `${nearestLibraryType}도서관` : "자료 없음"}, {formatOptionalNumber(nearestLibraryDistM, "m")} 직선 참고치
          {nearestLibraryCoordApprox ? ", 좌표 근사" : ""})
        </p>
      </Card>
      {policy ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">통합 우선 검토안(기본 시나리오): {policy.primaryLabel ?? "자료 없음"}</p>
            <SectionChip>조건부 대안: {policy.altLabel ?? "해당 없음 — 정기 재진단"}</SectionChip>
            <SectionChip>
              안정성 12개 조건 조합 중 {formatOptionalNumber(policy.stability != null ? Math.round(policy.stability * 12) : null, "개")} 유지
            </SectionChip>
            {policy.separateTrack ? <DarkChip>도서 지역 별도 정책 트랙</DarkChip> : null}
            {policy.dataGap ? <Badge tone="warning">독서 데이터 보완 필요</Badge> : null}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {policy.primaryModule === "reading"
              ? "정책 행동 카드는 공원·독서 필요도를 함께 비교해 산출한 통합 권고이며, 이 학교는 독서 필요도가 더 높아 위 검토안이 독서 기준으로 정해졌습니다."
              : "정책 행동 카드는 공원·독서 필요도를 함께 비교해 산출한 통합 권고입니다. 이 학교는 공원 필요도가 우선 적용되어 위 검토안은 공원 기준이며, 독서 대응은 위의 격차 유형을 따릅니다."}
            {" 예산·부지·접근성 조건별 전환 시나리오와 기관별 역할은 지도 진단 패널의 정책 행동 카드를 참고하세요."}
          </p>
        </Card>
      ) : null}
    </SectionShell>
  );
}

function ProblemSection({
  problemTags,
  studentTrend,
  studentTrendChangePct,
  noParkWithin500m,
  nearestParkDistanceM,
  greenRatio,
  playgroundCount,
  potentialDemand2029,
  accessConditionLabel,
  accessConditionDescription,
  functionalAccessPhysicalBarrierFlag,
  functionalAccessPhysicalBarrierLabel,
}: Pick<
  SchoolDetailReportProps,
  "problemTags" | "studentTrend" | "studentTrendChangePct" | "noParkWithin500m" | "nearestParkDistanceM" | "greenRatio" | "playgroundCount" | "potentialDemand2029" | "accessConditionLabel" | "accessConditionDescription" | "functionalAccessPhysicalBarrierFlag" | "functionalAccessPhysicalBarrierLabel"
>) {
  const first = studentTrend[0]?.value ?? 0;
  const last = studentTrend[studentTrend.length - 1]?.value ?? 0;
  const changePercent = studentTrendChangePct ?? (first ? ((last - first) / first) * 100 : 0);
  const hasNoWalkablePark = noParkWithin500m ?? nearestParkDistanceM >= 500;
  const lowGreen = greenRatio <= 0;
  const noPlayground = playgroundCount <= 0;
  const highDemand = potentialDemand2029 >= 400;
  const mediumDemand = potentialDemand2029 >= 220;
  const accessDisplayLabel =
    functionalAccessPhysicalBarrierFlag && !(accessConditionLabel ?? "").includes("보행부담")
      ? `${accessConditionLabel ?? "추가 검토 필요"} · ${functionalAccessPhysicalBarrierLabel ?? "보행부담 동반형"}`
      : accessConditionLabel;

  let decisionText = "";
  if (hasNoWalkablePark && lowGreen && noPlayground) {
    decisionText =
      highDemand
        ? "공원 접근성과 녹지 환경이 모두 불리한 학교입니다. 가까운 공원이 부족하고, 학교 주변에서 체감할 수 있는 녹지 공간과 놀이터도 적어 개선 시 수혜 효과가 크게 나타날 가능성이 있습니다."
        : "공원 접근성과 녹지 환경이 모두 불리한 학교입니다. 가까운 공원이 부족하고, 학교 주변에서 체감할 수 있는 녹지 공간과 놀이터도 적습니다.";
  } else if (hasNoWalkablePark && lowGreen) {
    decisionText =
      highDemand
        ? "시설 접근성은 불리하지만, 주변 학생 수요는 큰 학교입니다. 가까운 공원과 체감 가능한 녹지 공간이 부족해 개선 필요성이 높은 편입니다."
        : "가까운 공원 접근성은 불리하고, 녹지 환경도 매우 약한 학교입니다. 생활권 안에서 바로 이용할 수 있는 야외공간 보완이 필요합니다.";
  } else if (hasNoWalkablePark) {
    decisionText =
      mediumDemand
        ? "녹지 환경은 일부 갖추고 있으나, 가까운 공원 접근성은 다소 불리한 학교입니다. 바로 이용 가능한 공원이 부족해 접근성 개선의 우선순위가 있습니다."
        : "공원 접근성은 다소 불리한 학교입니다. 머무를 수 있는 환경은 일부 있지만 바로 이용 가능한 공원은 부족한 편입니다.";
  } else if (lowGreen || noPlayground) {
    decisionText =
      highDemand
        ? "가까운 시설은 있지만, 주변 녹지나 놀이환경은 부족한 학교입니다. 접근성 자체는 나쁘지 않지만 체류형 야외환경의 질은 약한 편입니다."
        : "가까운 시설은 있지만, 주변 녹지나 놀이터 선택지는 넉넉하지 않은 학교입니다. 생활권 환경의 질을 보완할 필요가 있습니다.";
  } else {
    decisionText =
      highDemand
        ? "가까운 시설과 녹지 환경이 모두 비교적 양호한 학교입니다. 공원 접근성과 주변 환경이 전반적으로 안정적이며 수요 규모도 큰 편입니다."
        : "가까운 시설과 녹지 환경이 모두 비교적 양호한 학교입니다. 공원 접근성과 주변 환경이 전반적으로 안정적인 편입니다.";
  }
  return (
    <SectionShell kicker="Reachability" title="정책 도달성 핵심 판단">
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Decision Signal</p>
        {accessDisplayLabel ? (
          <div className="mb-4 rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
            <p className="text-sm font-bold text-forest-200">{accessDisplayLabel}</p>
            <p className="mt-1 text-sm leading-6 text-slate-200">{accessConditionDescription}</p>
          </div>
        ) : null}
        <p className="mt-2 text-base font-semibold text-white">{decisionText}</p>
      </Card>
    </SectionShell>
  );
}

function ContextSection({
  contextTags,
  hasLargeApartmentComplexNearby,
  noParkWithin500m,
  nearestParkDistanceM,
}: Pick<
  SchoolDetailReportProps,
  "contextTags" | "hasLargeApartmentComplexNearby" | "noParkWithin500m" | "nearestParkDistanceM"
>) {
  return (
    <SectionShell kicker="Context" title="지역 맥락">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">도달권 해석</p>
          <div className="mt-4 space-y-3">
            <div className="accent-stripe accent-stripe-rose rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-4">
              <p className="text-sm font-semibold text-rose-200">
                {noParkWithin500m
                  ? "학교에서 도보 이동으로 바로 접근할 수 있는 공원이 없습니다."
                  : "도보권 공원 접근은 가능하지만 평균 대비 불리한 편입니다."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-4">
              <p className="text-sm font-medium text-slate-100">
                가장 가까운 공원도 약 {formatNumber(nearestParkDistanceM)}m 떨어져 있어, 일상적 이용에 거리 부담이 있습니다.
              </p>
            </div>
            {hasLargeApartmentComplexNearby ? (
              <div className="accent-stripe accent-stripe-amber rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-4">
                <p className="text-sm font-medium text-amber-200">
                  근처 500세대 이상 대단지 아파트가 있어, 미집계 녹지·놀이터가 일부 존재할 가능성이 있습니다.
                </p>
              </div>
            ) : null}
          </div>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">주변 조건</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {contextTags.map((tag) => (
              <SectionChip key={tag}>
                {tag === "학교 주변에서 바로 대체할 수 있는 공원 선택지가 없습니다"
                  ? "학교 주변에 바로 접근 가능한 녹지나 놀이터가 부족합니다"
                  : tag}
              </SectionChip>
            ))}
            {hasLargeApartmentComplexNearby ? <SectionChip>🏢 500세대 이상 대단지 아파트 인접</SectionChip> : null}
          </div>
        </Card>
      </div>
    </SectionShell>
  );
}

function SimilarSchoolsSection({
  schoolName,
  districtName,
  nearestParkDistanceM,
  greenRatio,
  playgroundCount,
  similarSchools,
  cityBestEnvironmentSchool,
  districtBestEnvironmentSchool,
  similarityK,
  similaritySelectionFeatures,
  similarityComparisonFeatures,
  similarityCommonPoints,
  similarityStrengthsText,
  similarityWeaknessesText,
  similarityPeerAvgNearestParkDistanceM,
  similarityPeerAvgGreenRatio,
  similarityPeerAvgPlaygroundCount,
}: Pick<
  SchoolDetailReportProps,
  | "schoolName"
  | "districtName"
  | "nearestParkDistanceM"
  | "greenRatio"
  | "playgroundCount"
  | "similarSchools"
  | "cityBestEnvironmentSchool"
  | "districtBestEnvironmentSchool"
  | "similarityK"
  | "similaritySelectionFeatures"
  | "similarityComparisonFeatures"
  | "similarityCommonPoints"
  | "similarityStrengthsText"
  | "similarityWeaknessesText"
  | "similarityPeerAvgNearestParkDistanceM"
  | "similarityPeerAvgGreenRatio"
  | "similarityPeerAvgPlaygroundCount"
>) {
  const [hoveredPointId, setHoveredPointId] = React.useState<string | null>(null);
  if (!similarSchools?.length) return null;

  const currentPoint: PositionPoint = { id: "current", label: "현재 학교", schoolName, districtName, nearestParkDistanceM, greenRatio, playgroundCount, pointType: "current" };
  const sharedBenchmark = cityBestEnvironmentSchool && districtBestEnvironmentSchool && cityBestEnvironmentSchool.schoolName === districtBestEnvironmentSchool.schoolName && cityBestEnvironmentSchool.districtName === districtBestEnvironmentSchool.districtName;
  const benchmarkPoints: PositionPoint[] = sharedBenchmark ? [{ id: "shared-best", label: "시·구 공통 기준학교", schoolName: cityBestEnvironmentSchool.schoolName, districtName: cityBestEnvironmentSchool.districtName, nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM, greenRatio: cityBestEnvironmentSchool.greenRatio, playgroundCount: cityBestEnvironmentSchool.playgroundCount, pointType: "sharedBest" }] : [ ...(cityBestEnvironmentSchool ? [{ id: "city-best", label: "인천시 최우수", schoolName: cityBestEnvironmentSchool.schoolName, districtName: cityBestEnvironmentSchool.districtName, nearestParkDistanceM: cityBestEnvironmentSchool.nearestParkDistanceM, greenRatio: cityBestEnvironmentSchool.greenRatio, playgroundCount: cityBestEnvironmentSchool.playgroundCount, pointType: "cityBest" as const }] : []), ...(districtBestEnvironmentSchool ? [{ id: "district-best", label: "구 최우수", schoolName: districtBestEnvironmentSchool.schoolName, districtName: districtBestEnvironmentSchool.districtName, nearestParkDistanceM: districtBestEnvironmentSchool.nearestParkDistanceM, greenRatio: districtBestEnvironmentSchool.greenRatio, playgroundCount: districtBestEnvironmentSchool.playgroundCount, pointType: "districtBest" as const }] : []) ];
  const similarPoints: PositionPoint[] = similarSchools.map((school, index) => ({
    id: `similar-${index}`,
    label: school.schoolName,
    schoolName: school.schoolName,
    districtName: school.districtName,
    nearestParkDistanceM: school.nearestParkDistanceM,
    greenRatio: school.greenRatio,
    playgroundCount: school.playgroundCount,
    rankLabel: `K${school.rank ?? index + 1}`,
    pointType: "similar",
  }));
  const plotPoints = [currentPoint, ...similarPoints, ...benchmarkPoints];
  const xDomainMin = 0;
  const xDomainMax = 1200;
  const yDomainMin = 0;
  const yDomainMax = 24;
  const parkThreshold = 500;
  const greenThreshold = 5;
  const xTicks = [0, 300, 600, 900, 1200];
  const yTicks = [0, 5, 10, 15, 20, 24];
  const svgWidth = 760;
  const svgHeight = 420;
  const margin = { top: 26, right: 28, bottom: 54, left: 62 };
  const chartWidth = svgWidth - margin.left - margin.right;
  const chartHeight = svgHeight - margin.top - margin.bottom;
  const scaleX = (value: number) => {
    const safeValue = Math.min(Math.max(value, xDomainMin), xDomainMax);
    return margin.left + ((safeValue - xDomainMin) / (xDomainMax - xDomainMin)) * chartWidth;
  };
  const scaleY = (value: number) => {
    const safeValue = Math.min(Math.max(value, yDomainMin), yDomainMax);
    return margin.top + chartHeight - ((safeValue - yDomainMin) / (yDomainMax - yDomainMin)) * chartHeight;
  };
  const positionedPoints = plotPoints.map((point) => ({ ...point, x: scaleX(point.nearestParkDistanceM), y: scaleY(point.greenRatio) }));
  const hoveredPoint = positionedPoints.find((point) => point.id === hoveredPointId) ?? null;
  const avgSimilarPark =
    similarityPeerAvgNearestParkDistanceM ??
    similarPoints.reduce((sum, point) => sum + point.nearestParkDistanceM, 0) / similarPoints.length;
  const avgSimilarGreen =
    similarityPeerAvgGreenRatio ??
    similarPoints.reduce((sum, point) => sum + point.greenRatio, 0) / similarPoints.length;
  const avgSimilarPlayground =
    similarityPeerAvgPlaygroundCount ??
    similarPoints.reduce((sum, point) => sum + point.playgroundCount, 0) / similarPoints.length;
  const strengthLines = similarityStrengthsText
    ? similarityStrengthsText.split("|").map((item) => item.trim()).filter(Boolean)
    : [];
  const weaknessLines = similarityWeaknessesText
    ? similarityWeaknessesText.split("|").map((item) => item.trim()).filter(Boolean)
    : [];
  const fallbackStrength =
    nearestParkDistanceM < avgSimilarPark
      ? `KNN 비교군 평균보다 최근접 공원 거리가 ${formatWholeNumber(avgSimilarPark - nearestParkDistanceM)}m 더 가깝습니다.`
      : greenRatio > avgSimilarGreen
        ? `KNN 비교군 평균보다 녹지 비율이 ${formatDecimal(greenRatio - avgSimilarGreen, 1)}%p 더 높습니다.`
        : playgroundCount > avgSimilarPlayground
          ? `KNN 비교군 평균보다 도보권 놀이터가 ${formatWholeNumber(playgroundCount - avgSimilarPlayground)}개 더 많습니다.`
          : "KNN 비교군 평균 대비 두드러진 상대 강점은 크지 않습니다.";
  const fallbackWeakness =
    nearestParkDistanceM > avgSimilarPark
      ? `KNN 비교군 평균보다 최근접 공원 거리가 ${formatWholeNumber(nearestParkDistanceM - avgSimilarPark)}m 더 멉니다.`
      : greenRatio < avgSimilarGreen
        ? `KNN 비교군 평균보다 녹지 비율이 ${formatDecimal(avgSimilarGreen - greenRatio, 1)}%p 더 낮습니다.`
        : playgroundCount < avgSimilarPlayground
          ? `KNN 비교군 평균보다 도보권 놀이터가 ${formatWholeNumber(avgSimilarPlayground - playgroundCount)}개 더 적습니다.`
          : "KNN 비교군 평균 대비 두드러진 상대 약점은 크지 않습니다.";
  const comparisonMetricLines = [
    `KNN 비교군 평균 공원 거리 ${formatWholeNumber(avgSimilarPark)}m`,
    `KNN 비교군 평균 녹지 비율 ${formatDecimal(avgSimilarGreen, 1)}%`,
    `KNN 비교군 평균 놀이터 ${formatDecimal(avgSimilarPlayground, 1)}개`,
  ];
  const similarityMethodText =
    "유사학교는 학생 규모와 학생 수 변화 흐름, 주변 아동 규모, 주거 밀도, 재개발 여부 같은 생활권 맥락을 AI가 종합적으로 분석해 도출한 비교군입니다.";

  function renderMarker(point: (typeof positionedPoints)[number]) {
    if (point.pointType === "current") return <g><circle cx={point.x} cy={point.y} r={16} fill="#ef4444" opacity={0.18} /><circle cx={point.x} cy={point.y} r={9} fill="#dc2626" stroke="#ffffff" strokeWidth={3} /></g>;
    if (point.pointType === "cityBest") {
      const s = 11;
      const pts = [[point.x, point.y - s], [point.x + 3.5, point.y - 3.5], [point.x + s, point.y - 3.5], [point.x + 5, point.y + 1.5], [point.x + 7, point.y + s], [point.x, point.y + 5], [point.x - 7, point.y + s], [point.x - 5, point.y + 1.5], [point.x - s, point.y - 3.5], [point.x - 3.5, point.y - 3.5]].map(([x, y]) => `${x},${y}`).join(" ");
      return <polygon points={pts} fill="#eab308" stroke="#ffffff" strokeWidth={2.5} />;
    }
    if (point.pointType === "districtBest") return <path d={`M ${point.x} ${point.y - 10} L ${point.x + 10} ${point.y} L ${point.x} ${point.y + 10} L ${point.x - 10} ${point.y} Z`} fill="#0ea5e9" stroke="#ffffff" strokeWidth={2.5} />;
    if (point.pointType === "sharedBest") return <g><circle cx={point.x} cy={point.y} r={12} fill="#111827" stroke="#ffffff" strokeWidth={2.5} /><text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#f8fafc">시·구</text></g>;
    return (
      <g>
        <circle cx={point.x} cy={point.y} r={11} fill="#475569" stroke="#ffffff" strokeWidth={2.5} />
        <text x={point.x} y={point.y + 4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f8fafc">
          {point.rankLabel ?? "K"}
        </text>
      </g>
    );
  }

  const clippedCount = plotPoints.filter((point) => point.nearestParkDistanceM > xDomainMax).length;

  return (
    <SectionShell kicker="Benchmark" title="유사학교(KNN) 비교군 안에서의 도달성 위치">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="min-w-0 p-6">
          <p className="text-sm text-slate-300">
            현재 학교와 환경 맥락이 비슷한 학교를 KNN으로 묶고, 그 안에서 외부 접근성 지표(공원 거리·녹지 비율)가 어디에 놓이는지 비교했습니다.
            {similarityK ? ` 이번 비교는 K=${similarityK} 기준입니다.` : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2"><SectionChip>현재 학교</SectionChip><SectionChip>KNN 비교군</SectionChip><SectionChip>인천시 최우수</SectionChip><SectionChip>구 최우수</SectionChip></div>
          <p className="mt-4 text-xs leading-6 text-slate-400">{similarityMethodText}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="accent-stripe accent-stripe-forest rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-3 text-sm font-medium text-forest-200">좋은 방향은 왼쪽 위입니다. 공원 거리는 500m 안쪽일수록, 녹지 비율은 5% 이상일수록 유리합니다.</div><div className="rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-3 text-sm font-medium text-slate-200">배경 사분면은 인천시 평균이 아니라 생활권 판단선 기준으로 나뉩니다.</div></div>
          {clippedCount > 0 ? <p className="mt-3 text-xs text-slate-400">가독성을 위해 최근접 공원 거리 축은 1,200m까지 표시했고, 이를 넘는 점 {clippedCount}개는 우측 경계에 맞춰 표시했습니다.</p> : null}
          <div className="mt-5"><div className="relative max-w-full overflow-x-auto rounded-2xl border border-white/10 bg-navy-850/95"><svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-[420px] w-full min-w-[640px]"><rect x="0" y="0" width={svgWidth} height={svgHeight} fill="#050B14" /><rect x={margin.left} y={margin.top} width={scaleX(parkThreshold) - margin.left} height={scaleY(greenThreshold) - margin.top} fill="rgba(16, 185, 129, 0.10)" /><rect x={scaleX(parkThreshold)} y={margin.top} width={scaleX(xDomainMax) - scaleX(parkThreshold)} height={scaleY(greenThreshold) - margin.top} fill="rgba(251, 191, 36, 0.08)" /><rect x={margin.left} y={scaleY(greenThreshold)} width={scaleX(parkThreshold) - margin.left} height={margin.top + chartHeight - scaleY(greenThreshold)} fill="rgba(251, 191, 36, 0.07)" /><rect x={scaleX(parkThreshold)} y={scaleY(greenThreshold)} width={scaleX(xDomainMax) - scaleX(parkThreshold)} height={margin.top + chartHeight - scaleY(greenThreshold)} fill="rgba(248, 113, 113, 0.10)" />{xTicks.map((tick) => <g key={`x-${tick}`}><line x1={scaleX(tick)} x2={scaleX(tick)} y1={margin.top} y2={margin.top + chartHeight} stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" /><text x={scaleX(tick)} y={svgHeight - 18} textAnchor="middle" fontSize="11" fill="#94A3B8">{tick}</text></g>)}{yTicks.map((tick) => <g key={`y-${tick}`}><line x1={margin.left} x2={margin.left + chartWidth} y1={scaleY(tick)} y2={scaleY(tick)} stroke="rgba(148, 163, 184, 0.18)" strokeDasharray="3 3" /><text x={margin.left - 12} y={scaleY(tick) + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{tick}</text></g>)}<line x1={scaleX(parkThreshold)} x2={scaleX(parkThreshold)} y1={margin.top} y2={margin.top + chartHeight} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 5" /><line x1={margin.left} x2={margin.left + chartWidth} y1={scaleY(greenThreshold)} y2={scaleY(greenThreshold)} stroke="rgba(255,255,255,0.35)" strokeDasharray="6 5" /><text x={scaleX(parkThreshold) + 8} y={margin.top + chartHeight + 22} fontSize="11" fontWeight="700" fill="#CBD5E1">500m 판단선</text><text x={margin.left + 8} y={scaleY(greenThreshold) - 10} fontSize="11" fontWeight="700" fill="#CBD5E1">녹지 5% 판단선</text><text x={margin.left + 10} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#6EE7B7">생활환경 양호</text><text x={margin.left + chartWidth - 110} y={margin.top + 18} fontSize="12" fontWeight="700" fill="#FBE6A9">공원 접근 불리</text><text x={margin.left + 10} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#FCD34D">녹지 부족</text><text x={margin.left + chartWidth - 76} y={margin.top + chartHeight - 12} fontSize="12" fontWeight="700" fill="#FCA5A5">이중 취약</text><text x={margin.left + chartWidth / 2} y={svgHeight - 2} textAnchor="middle" fontSize="12" fill="#94A3B8">최근접 공원 거리 (m)</text><text transform={`translate(18 ${margin.top + chartHeight / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill="#94A3B8">녹지 비율 (%)</text>{positionedPoints.map((point) => <g key={point.id} onMouseEnter={() => setHoveredPointId(point.id)} onMouseLeave={() => setHoveredPointId((current) => current === point.id ? null : current)} style={{ cursor: "pointer" }}>{renderMarker(point)}{point.pointType !== "similar" && point.pointType !== "current" ? <g transform={`translate(${point.x + 12},${point.y - 26})`}><rect width={Math.max(92, point.label.length * 8)} height="24" rx="12" fill="rgba(8, 20, 33, 0.96)" stroke="rgba(255,255,255,0.18)" /><text x="12" y="16" fontSize="11" fontWeight={700} fill="#FFFFFF">{point.label}</text></g> : null}</g>)}</svg>{hoveredPoint ? <div className="pointer-events-none absolute z-20 w-56 max-w-[80vw] rounded-2xl border border-white/10 bg-navy-900 p-3 shadow-xl" style={{ left: `${Math.min(Math.max((hoveredPoint.x / svgWidth) * 100, 8), 92)}%`, top: `${Math.min(Math.max((hoveredPoint.y / svgHeight) * 100 - 14, 6), 88)}%`, transform: "translate(-50%, -100%)" }}><p className="text-sm font-bold text-white">{hoveredPoint.pointType === "current" ? "현재 학교" : hoveredPoint.schoolName}</p><p className="text-xs text-slate-400">{hoveredPoint.pointType === "current" ? `${hoveredPoint.schoolName} · ${hoveredPoint.districtName}` : hoveredPoint.districtName}</p><div className="mt-2 space-y-1 text-xs text-slate-200"><p>최근접 공원 거리 {formatNumber(hoveredPoint.nearestParkDistanceM)}m</p><p>녹지 비율 {formatGreenPercent(hoveredPoint.greenRatio)}</p><p>놀이터 수 {formatNumber(hoveredPoint.playgroundCount)}개</p></div></div> : null}</div></div>
        </Card>
        <div className="grid min-w-0 gap-4">
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-400">기준학교 정보</p>
            <div className="mt-4 space-y-3">
              <div className="accent-stripe accent-stripe-rose rounded-2xl border border-white/10 bg-navy-900/95 p-4 pl-5">
                <p className="text-sm font-semibold text-white">현재 학교</p>
                <p className="mt-1 text-xs text-slate-300">{schoolName} · 공원 {formatNumber(nearestParkDistanceM)}m · 녹지 {formatGreenPercent(greenRatio)} · 놀이터 {formatNumber(playgroundCount)}개</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
                <p className="text-sm font-semibold text-white">KNN 비교군 평균</p>
                <p className="mt-1 text-xs text-slate-300">
                  공원 {formatWholeNumber(avgSimilarPark)}m · 녹지 {formatDecimal(avgSimilarGreen, 1)}% · 놀이터 {formatDecimal(avgSimilarPlayground, 1)}개
                </p>
              </div>
              {benchmarkPoints.map((point) => (
                <div
                  key={point.id}
                  className={cx(
                    "rounded-2xl border border-white/10 bg-navy-900/95 p-4 pl-5 accent-stripe",
                    point.pointType === "cityBest"
                      ? "accent-stripe-yellow"
                      : point.pointType === "districtBest"
                      ? "accent-stripe-sky"
                      : "accent-stripe-forest",
                  )}
                >
                  <p className="text-sm font-semibold text-white">{point.label}</p>
                  <p className="mt-1 text-xs text-slate-300">{point.schoolName} · 공원 {formatNumber(point.nearestParkDistanceM)}m · 녹지 {formatGreenPercent(point.greenRatio)} · 놀이터 {formatNumber(point.playgroundCount)}개</p>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-400">KNN 비교군 해석</p>
            <div className="mt-4 space-y-3">
              <div className="accent-stripe accent-stripe-forest rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-forest-300">상대 우위</p>
                <div className="mt-2 space-y-2 text-sm text-forest-100">
                  {(strengthLines.length ? strengthLines : [fallbackStrength]).map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
              <div className="accent-stripe accent-stripe-rose rounded-2xl border border-white/10 bg-navy-900/95 px-5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-300">상대 열위</p>
                <div className="mt-2 space-y-2 text-sm text-rose-100">
                  {(weaknessLines.length ? weaknessLines : [fallbackWeakness]).map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">비교 기준값</p>
                <div className="mt-2 space-y-1 text-sm text-slate-200">
                  {comparisonMetricLines.map((line) => <p key={line}>{line}</p>)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-slate-400">KNN 비교군 목록</p>
            <div className="mt-4 space-y-3">
              {similarSchools.map((school, index) => (
                <div key={`${school.schoolName}-${index}`} className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{`K${school.rank ?? index + 1}`} · {school.schoolName}</p>
                      <p className="text-xs text-slate-400">{school.districtName}</p>
                    </div>
                    {school.similarityDistance != null ? (
                      <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                        거리 {formatDecimal(school.similarityDistance, 2)}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-300">
                    공원 {formatWholeNumber(school.nearestParkDistanceM)}m · 녹지 {formatGreenPercent(school.greenRatio)} · 놀이터 {formatNumber(school.playgroundCount)}개
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SectionShell>
  );
}

function RedevelopmentNotice({ redevelopmentPlanYear, redevelopmentType, redevelopmentProjects }: Pick<SchoolDetailReportProps, "redevelopmentPlanYear" | "redevelopmentType" | "redevelopmentProjects">) {
  if (!redevelopmentPlanYear || !redevelopmentType) return null;
  return (
    <section>
      <Card className="p-5">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">Change Risk</p>
            <p className="mt-2 text-base font-semibold text-white">
              이 지역은 {redevelopmentPlanYear}년에 {redevelopmentType}이 예정되어 있어, 향후 생활환경과 아동 인구 흐름이 변동할 수 있습니다.
            </p>
          </div>
          {redevelopmentProjects?.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {redevelopmentProjects.map((project) => (
                <div
                  key={`${project.name}-${project.distanceM}`}
                  className="accent-stripe accent-stripe-amber rounded-2xl border border-white/10 bg-navy-900/95 p-4 pl-5"
                >
                  <p className="text-sm font-semibold text-white">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatNumber(project.distanceM)}m</p>
                  <p className="mt-2 inline-flex rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-200">
                    {project.stage}
                  </p>
                  <p className="mt-2 text-xs text-slate-300">{project.location}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Card>
    </section>
  );
}

const PERIOD_STATUS_LABELS: Record<string, string> = {
  current: "지정 운영 중",
  expired: "지정 기간 종료",
  upcoming: "지정 예정",
  unknown: "지정 기간 미상",
};

function formatContextDate(value?: string | null) {
  return value ? value : "날짜 미상";
}

function isSafeHttpUrl(url?: string | null): url is string {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function ContextFacilityCard({
  title,
  layer,
  summary,
  details,
  detailsStatus,
  recordLine,
}: {
  title: string;
  layer?: ContextManifestLayer;
  summary?: ContextFacilitySummary;
  details?: ContextFacilityDetails | null;
  detailsStatus?: "loaded" | "pending" | "failed";
  recordLine: (record: ContextFacilityDetailRecord) => string;
}) {
  const status = summary?.status ?? layer?.status ?? "unknown";
  const pending = status === "unknown" || status === "unavailable";
  return (
    <div className="rounded-2xl border border-white/10 bg-navy-900/95 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {pending ? (
        <>
          <p className="mt-2 inline-flex rounded-full border border-slate-400/40 bg-slate-500/15 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
            {summary?.label_ko ?? layer?.status_label_ko ?? "자료 수집 전"}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-400">
            {layer?.reason_ko ?? layer?.coverage_note_ko ?? "검증된 공공데이터 원본이 아직 확보되지 않았습니다."}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            미수집·미관측 상태이며 &quot;0건&quot;을 의미하지 않습니다.
          </p>
        </>
      ) : summary?.observed_count == null ? (
        <p className="mt-2 text-xs leading-5 text-slate-400">학교 좌표 미상으로 집계할 수 없습니다.</p>
      ) : (
        <>
          <p className="mt-2 text-2xl font-bold text-white">
            관측 {formatNumber(summary.observed_count)}건
            <span className="ml-2 text-xs font-medium text-slate-400">반경 {summary.within_m ?? 500}m 직선거리</span>
          </p>
          {summary.observed_completed_count != null && summary.observed_completed_count > 0 ? (
            <p className="mt-1 text-xs text-slate-300">이 중 사용승인(완료) 기록 {summary.observed_completed_count}건 — 현재 공사 위험 아님</p>
          ) : null}
          {summary.nearest_observed_m != null ? (
            <p className="mt-1 text-xs text-slate-400">최근접 관측 {formatNumber(Math.round(summary.nearest_observed_m))}m</p>
          ) : null}
          <p className="mt-2 text-xs leading-5 text-amber-200/90 font-semibold">
            {summary.label_ko ?? "좌표 확보 레코드 기준 최소 관측치"} · 전체 수는 확인 불가(total 미상)
          </p>
          {details?.records.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-300">
                개별 기록 {details.records.length}건 보기
                {details.truncated_count > 0 ? ` (거리순 상위, 외 ${details.truncated_count}건)` : ""}
              </summary>
              <ul className="mt-2 space-y-1.5">
                {details.records.map((record) => (
                  <li key={record.facility_id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-5 text-slate-300">
                    {recordLine(record)}
                  </li>
                ))}
              </ul>
            </details>
          ) : summary.observed_count > 0 ? (
            // 관측 건수가 있는데 개별 기록이 없으면 원인을 숨기지 않고 명시한다
            <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs leading-5 text-rose-100">
              {detailsStatus === "failed"
                ? "개별 기록 데이터를 불러오지 못했습니다(시설 위치 데이터 다운로드 실패). 지도 화면을 새로고침한 뒤 학교를 다시 선택해 주세요."
                : "개별 기록이 아직 로딩되지 않은 상태에서 리포트가 생성되었습니다. 지도에서 학교를 다시 선택하면 목록이 포함됩니다."}
            </p>
          ) : null}
          {layer?.coverage_note_ko ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">{layer.coverage_note_ko}</p>
          ) : null}
          {layer?.coordinate_note_ko ? (
            <p className="mt-1 text-xs leading-5 text-slate-500">{layer.coordinate_note_ko}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

function SchoolContextLayersSection({ contextLayers }: Pick<SchoolDetailReportProps, "contextLayers">) {
  const notice = (message: string) => (
    <SectionShell kicker="School Context" title="학교 지정·주변 맥락 정보">
      <Card className="p-5">
        <p className="text-sm text-slate-300">{message}</p>
      </Card>
    </SectionShell>
  );

  if (!contextLayers) {
    return notice("이 세션에는 학교 맥락 데이터(지정 현황·주변 시설)가 연결되지 않았습니다.");
  }
  if (contextLayers.load_status === "failed") {
    return notice("학교 맥락 데이터를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.");
  }
  if (contextLayers.load_status !== "loaded") {
    return notice("학교 맥락 데이터가 아직 로딩되지 않은 상태에서 리포트가 열렸습니다. 지도를 새로고침한 뒤 학교를 다시 선택해 주세요.");
  }

  const layers = contextLayers.manifest_layers ?? {};
  const designationLayer = layers.school_designations;
  const summary = contextLayers.school_summary;
  const records = contextLayers.designation_records ?? [];
  const current = summary?.designations?.current ?? [];
  const historical = summary?.designations?.historical ?? [];
  const currentIds = new Set(current.map((item) => item.designation_id));

  const nightlifeRecordLine = (record: ContextFacilityDetailRecord) =>
    [
      record.name ?? "이름 미상",
      record.category ? `${record.category}${record.subtype ? `(${record.subtype})` : ""}` : null,
      `${formatNumber(Math.round(record.distance_m))}m`,
      record.business_status ? `인허가 상태: ${record.business_status}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  const constructionRecordLine = (record: ContextFacilityDetailRecord) =>
    [
      record.name ?? record.main_use ?? "기록",
      record.construction_type ?? record.category,
      `${formatNumber(Math.round(record.distance_m))}m`,
      record.start_date ? `착공처리 ${record.start_date}` : null,
      record.approval_date ? `사용승인 ${record.approval_date} (완료 기록)` : "사용승인 기록 없음",
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <SectionShell kicker="School Context" title="학교 지정·주변 맥락 정보">
      <Card className="p-5">
        <div className="space-y-5">
          <p className="text-xs leading-5 text-slate-400">
            {contextLayers.usage_note_ko ?? "참고용 맥락 정보입니다. 자동 안전 등급·지원 자격·법령 위반 판정에 사용하지 않습니다."}
            {contextLayers.data_as_of ? ` · 수집 기준일 ${contextLayers.data_as_of}` : ""}
          </p>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">지정·지원 프로그램 현황</p>
            <p className="mt-2 text-base font-semibold text-white">
              {summary?.designations?.status !== "available"
                ? "자료 수집 전"
                : current.length
                  ? current
                      .map((item) => `${item.school_year ?? ""}학년도 ${item.program_name} ${item.designation_type}`.trim())
                      .join(", ")
                  : "수집된 명단 기준 해당 없음"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {summary?.designations?.scope_note_ko ??
                designationLayer?.scope_note_ko ??
                "수집된 프로그램 명단 기준이며, 그 외 지정·지원 사업은 미수집입니다."}
            </p>
            {designationLayer?.period_note_ko ? (
              <p className="mt-1 text-xs text-slate-500">{designationLayer.period_note_ko}</p>
            ) : null}
            {records.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {records.map((record) => {
                  const isCurrent = currentIds.has(record.designation_id);
                  return (
                    <div
                      key={record.designation_id}
                      className={`rounded-2xl border p-4 ${
                        isCurrent ? "border-violet-400/25 bg-violet-500/10" : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">
                        {record.program_name} {record.designation_type}
                      </p>
                      <p className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isCurrent
                          ? "border border-violet-300/40 bg-violet-500/20 text-violet-100"
                          : "border border-slate-400/40 bg-slate-500/15 text-slate-200"
                      }`}>
                        {record.school_year != null ? `${record.school_year}학년도 명단 · ` : ""}
                        {PERIOD_STATUS_LABELS[record.period_status] ?? "지정 기간 미상"}
                        {record.period_basis === "school_year_only" ? " (학년도 기준 추정)" : ""}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        {record.financial_support_amount
                          ? `지원 내역(원문 명시): ${record.financial_support_amount}`
                          : "지원 예산·금액은 원문에 명시되지 않아 표시하지 않습니다."}
                      </p>
                      {isSafeHttpUrl(record.source?.url) ? (
                        <p className="mt-2 text-xs leading-5 text-slate-400">
                          출처:{" "}
                          <a
                            href={record.source!.url!}
                            target="_blank"
                            rel="noreferrer"
                            className="text-forest-300 underline decoration-forest-300/50 underline-offset-2 hover:text-forest-200"
                          >
                            {record.source?.title ?? record.source?.url}
                          </a>
                          <br />
                          발행 {formatContextDate(record.source?.published_date)} · 수집 {formatContextDate(record.source?.retrieved_at)}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
            {historical.length && !records.length ? (
              <p className="mt-2 text-xs text-slate-400">과거 학년도 이력 {historical.length}건 (상세는 위 목록 참조)</p>
            ) : null}
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">학교 주변 시설 맥락 (직선거리 500m)</p>
            <p className="mt-1 text-xs text-slate-500">
              인허가·행정기록 기반 참고 지표입니다. 직선거리 기준이라 실제 도보 경로·체감 노출과 다르며,
              업종·기록 사실이지 사고위험·불법행위·현장 상태 판정이 아닙니다.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ContextFacilityCard
                title="유흥·단란주점 인허가 현황"
                layer={layers.nightlife_permits}
                summary={summary?.nightlife}
                details={contextLayers.facility_details?.nightlife}
                detailsStatus={contextLayers.facility_details?.status}
                recordLine={nightlifeRecordLine}
              />
              <ContextFacilityCard
                title="공사장(착공신고) 행정기록"
                layer={layers.construction_records}
                summary={summary?.construction}
                details={contextLayers.facility_details?.construction}
                detailsStatus={contextLayers.facility_details?.status}
                recordLine={constructionRecordLine}
              />
            </div>
          </div>

          {(() => {
            const sourceGroups = [
              { label: "지정·지원 프로그램 출처", sources: designationLayer?.sources ?? [], note: undefined },
              { label: "유흥·단란주점 인허가 출처", sources: layers.nightlife_permits?.sources ?? [], note: layers.nightlife_permits?.source_as_of_note_ko },
              { label: "공사장 행정기록 출처", sources: layers.construction_records?.sources ?? [], note: layers.construction_records?.source_as_of_note_ko },
            ].filter((group) => group.sources.length);
            if (!sourceGroups.length) return null;
            return (
              <div className="border-t border-white/10 pt-3 space-y-2">
                {sourceGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-slate-400">{group.label}</p>
                    {group.sources.map((source, index) => (
                      <p key={`${source.url}-${index}`} className="mt-1 text-xs leading-5 text-slate-500">
                        {isSafeHttpUrl(source.url) ? (
                          <a href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-slate-300">
                            {source.title ?? source.url}
                          </a>
                        ) : (
                          source.title
                        )}
                        {source.source_as_of ? ` · 원자료 기준 ${source.source_as_of}` : ""}
                        {source.published_date ? ` · 발행 ${source.published_date}` : ""}
                        {!source.source_as_of && !source.published_date ? " · 원자료 기준일 미확인" : ""}
                        {` · 수집 ${formatContextDate(source.retrieved_at)}`}
                      </p>
                    ))}
                    {group.note ? (
                      <p className="mt-1 text-xs leading-5 text-slate-600">{group.note}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </Card>
    </SectionShell>
  );
}

function SimulationEntry({
  onSimulationClick,
  potentialDemand2029,
  potentialDemand2031,
}: Pick<SchoolDetailReportProps, "onSimulationClick" | "potentialDemand2029" | "potentialDemand2031">) {
  return (
    <SectionShell kicker="Action" title="다음 액션: 정책 행동 검토">
      <Card className="p-6">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-lg font-semibold text-white">학교 기준 예상 학생수</p>
            <p className="mt-1 text-sm text-slate-400">학교 학생수 예측 모델(가중 추세 + LightGBM 잔차 보정)로 산출한 수요 축 참고값입니다. 학교 내부 공급(교내 설치) 검토와 외부 후보지 비교의 출발점으로 활용합니다.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">2029년 예상 학생수</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatNumber(potentialDemand2029)}명</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-navy-900/95 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">2031년 예상 학생수</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatNumber(potentialDemand2031)}명</p>
              </div>
            </div>
          </div>
          {onSimulationClick ? (
            <div className="flex justify-start lg:justify-end">
              <Button onClick={onSimulationClick}>후보지 시뮬레이션 열기</Button>
            </div>
          ) : null}
        </div>
      </Card>
    </SectionShell>
  );
}

export default function SchoolDetailReportPage(props: SchoolDetailReportProps) {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-8 px-4 py-8 lg:px-8">
      <SchoolHeader {...props} />
      <SchoolProfileGrid {...props} />
      <ReadingAccessSection readingContext={props.readingContext} />
      <ProblemSection {...props} />
      <ContextSection {...props} />
      <SimilarSchoolsSection {...props} />
      <AiExplainerPanel
        schoolContext={{
          school_name: props.schoolName,
          district_name: props.districtName,
          case_label: props.casePolicyLabel,
          case_status_label: props.caseStatusLabel,
          nearest_park_distance_m: props.nearestParkDistanceM,
          nearest_park_name: props.nearestParkName,
          green_ratio: props.greenRatio,
          playground_count: props.playgroundCount,
          no_park_within_500m: props.noParkWithin500m,
          potential_demand_2029: props.potentialDemand2029,
          potential_demand_2031: props.potentialDemand2031,
        }}
      />
      <RedevelopmentNotice {...props} />
      <SchoolContextLayersSection contextLayers={props.contextLayers} />
      <SimulationEntry {...props} />
    </div>
  );
}
