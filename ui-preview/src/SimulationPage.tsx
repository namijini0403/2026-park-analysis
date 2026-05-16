import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { MouseEvent } from "react";
import KakaoMap, { CandidateMarker, CandidateRouteLine } from "./KakaoMap";

const LETTERS = "ABCDEFGHIJ".split("");
const BARRIER_KEYS = ["motorway", "trunk", "primary", "secondary", "tertiary"] as const;

type BarrierKey = (typeof BARRIER_KEYS)[number];

type ShapDriver = {
  feature: string;
  value: number;
  shap_value: number;
};

interface Candidate {
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
  barrier_counts?: Record<BarrierKey, number>;
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
  shap_positive_drivers?: ShapDriver[];
  shap_negative_drivers?: ShapDriver[];
  shap_explanation_text?: string | null;
  shap_waterfall_image_path?: string | null;
}

interface RedevelopmentProject {
  name: string;
  stage: string;
  distanceM: number;
  type?: string;
  area?: number;
  householdCount?: number | null;
}

interface LargeApartmentComplex {
  name: string;
  householdCount: number;
  distanceM: number;
  address?: string;
}

interface SimulationPageProps {
  schoolName: string;
  schoolLat: number;
  schoolLng: number;
  casePolicyLabel: string;
  caseType?: number;
  candidates: Candidate[];
  redevelopmentProjects?: RedevelopmentProject[];
  largeApartmentComplexes?: LargeApartmentComplex[];
  onBack: () => void;
}

type FilterState = {
  excludePrimary: boolean;
  excludeSecondary: boolean;
  excludeTertiary: boolean;
  excludeAccident: boolean;
  excludeRedev: boolean;
  excludeLargeApt: boolean;
};

type WeightState = {
  benefit: number;
  schoolDistance: number;
  parkDistance: number;
};

type SimulationMode = "ai" | "manual";

type WeightToggleState = Record<keyof WeightState, boolean>;

type ScoredCandidate = Candidate & {
  final_score: number;
  benefit_score: number;
  school_distance_score: number;
  facility_gap_score: number;
  ai_message?: string;
};

const DEFAULT_FILTERS: FilterState = {
  excludePrimary: false,
  excludeSecondary: false,
  excludeTertiary: false,
  excludeAccident: false,
  excludeRedev: false,
  excludeLargeApt: false,
};

const DEFAULT_WEIGHTS: WeightState = {
  benefit: 45,
  schoolDistance: 30,
  parkDistance: 25,
};

const AI_DEFAULT_FILTERS: FilterState = {
  excludePrimary: true,
  excludeSecondary: true,
  excludeTertiary: false,
  excludeAccident: false,
  excludeRedev: false,
  excludeLargeApt: false,
};

const AI_DEFAULT_WEIGHTS: WeightState = {
  benefit: 20,
  schoolDistance: 70,
  parkDistance: 10,
};

const AI_RECOMMENDATION_COUNT = 3;

const RECOMMENDATION_TYPE_LABELS: Record<string, string> = {
  stable: "안정형",
  demand_strong: "수혜극대화형",
  access_gap_reduction: "접근성보완형",
  proximity_first: "근접우선형",
  scenario_sensitive: "시나리오민감형",
  balanced: "균형형",
};

const BARRIER_COLOR: Record<NonNullable<Candidate["barrier_severity"]>, string> = {
  green: "#10B981",
  yellow: "#FBBF24",
  orange: "#F97316",
  red: "#EF4444",
};

const SIM_COLORS = {
  bg: "#050B14",
  page: "#081421",
  panel: "rgba(16, 27, 45, 0.96)",
  elevated: "rgba(21, 34, 56, 0.96)",
  inset: "rgba(8, 20, 33, 0.96)",
  border: "rgba(255, 255, 255, 0.10)",
  borderStrong: "rgba(16, 185, 129, 0.34)",
  text: "#F8FAFC",
  secondary: "#CBD5E1",
  muted: "#94A3B8",
  green: "#10B981",
  greenSoft: "#A7F3D0",
  greenDark: "#064E3B",
  amber: "#FBBF24",
  amberSoft: "#FDE68A",
  red: "#F87171",
  blue: "#60A5FA",
} as const;

const SIM_PANEL: CSSProperties = {
  background: "linear-gradient(165deg, rgba(21,34,56,0.96) 0%, rgba(16,27,45,0.98) 55%, rgba(8,20,33,0.98) 100%)",
  border: `1px solid ${SIM_COLORS.border}`,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 26px 64px -44px rgba(0,0,0,0.95)",
};

const SIM_PANEL_FLAT: CSSProperties = {
  background: SIM_COLORS.panel,
  border: `1px solid ${SIM_COLORS.border}`,
};

const SIM_INSET: CSSProperties = {
  background: SIM_COLORS.inset,
  border: `1px solid ${SIM_COLORS.border}`,
};

const SIM_ACCENT_PANEL: CSSProperties = {
  background: SIM_COLORS.elevated,
  border: `1px solid ${SIM_COLORS.border}`,
  boxShadow: "inset 3px 0 0 rgba(16, 185, 129, 0.72)",
};

const FILTER_COPY: Array<{ key: keyof FilterState; title: string; description: string }> = [
  { key: "excludePrimary", title: "주요 도시 간선도로 횡단 후보 제외", description: "학교에서 후보지로 가는 최단 경로에 주요 도시 간선도로 횡단이 1회 이상 있으면 제외합니다." },
  { key: "excludeSecondary", title: "중간급 간선도로 횡단 후보 제외", description: "학교에서 후보지로 가는 최단 경로에 중간급 간선도로 횡단이 1회 이상 있으면 제외합니다." },
  { key: "excludeTertiary", title: "지구 내 간선도로 횡단 후보 제외", description: "학교에서 후보지로 가는 최단 경로에 지구 내 간선도로 횡단이 1회 이상 있으면 제외합니다." },
  { key: "excludeAccident", title: "사고위험 지점 인접 후보 제외", description: "사고위험 지점 인접 정보가 있으면 해당 후보를 제외합니다." },
  { key: "excludeRedev", title: "재개발 영향권 후보 제외", description: "재개발 영향권에 포함된 후보지를 제외합니다." },
  { key: "excludeLargeApt", title: "500세대 이상 대단지 인근 후보 제외", description: "대단지 인근 후보지를 제외합니다." },
];

const WEIGHT_COPY: Array<{ key: keyof WeightState; title: string; description: string }> = [
  { key: "benefit", title: "잠재수혜학생수", description: "보행권 잠재수요가 높을수록 가점을 줍니다." },
  { key: "schoolDistance", title: "학교에서의 거리", description: "학교와 가까울수록 가점을 줍니다." },
  { key: "parkDistance", title: "기존 공원과의 거리", description: "기존 공원과 멀수록 가점을 줍니다." },
];

const DEFAULT_WEIGHT_TOGGLES: WeightToggleState = {
  benefit: true,
  schoolDistance: true,
  parkDistance: true,
};

function rankBadgeStyle(index: number): { color: string; bg: string } {
  if (index === 0) return { color: "#FCA5A5", bg: "rgba(225, 90, 70, 0.12)" };
  if (index === 1) return { color: SIM_COLORS.amber, bg: "rgba(251, 191, 36, 0.10)" };
  if (index === 2) return { color: "#FDE68A", bg: "rgba(253, 230, 138, 0.10)" };
  return { color: SIM_COLORS.muted, bg: "rgba(255,255,255,0.08)" };
}

function getStableCandidateLabel(index: number): string {
  const baseLabel = LETTERS[index % LETTERS.length] ?? String(index + 1);
  const cycle = Math.floor(index / LETTERS.length);
  return cycle === 0 ? baseLabel : `${baseLabel}${cycle + 1}`;
}

function normalizeWeights(weights: WeightState): WeightState {
  const total = weights.benefit + weights.schoolDistance + weights.parkDistance;
  if (total <= 0) {
    return { benefit: 1 / 3, schoolDistance: 1 / 3, parkDistance: 1 / 3 };
  }
  return {
    benefit: weights.benefit / total,
    schoolDistance: weights.schoolDistance / total,
    parkDistance: weights.parkDistance / total,
  };
}

function minmaxScore(values: number[], reverse = false): number[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 1);
  return values.map((value) => {
    const normalized = (value - min) / (max - min);
    return reverse ? 1 - normalized : normalized;
  });
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatDistance(value: number): string {
  if (!Number.isFinite(value) || value >= 9999) return "정보 없음";
  return `${Math.round(value).toLocaleString("ko-KR")}m`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatOneDecimal(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(1);
}

function formatStability(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value * 100)}%`;
}

function hasRobustRecommendation(candidate: Candidate): boolean {
  return Number.isFinite(candidate.robust_rank) || Number.isFinite(candidate.top5_stability_score);
}

function getRecommendationTypeLabel(candidate: Candidate): string {
  const key = candidate.recommendation_type ?? "";
  return RECOMMENDATION_TYPE_LABELS[key] ?? "후보 진단형";
}

function getShapTagLabel(tag: string | null | undefined): string {
  if (tag === "development_dependent") return "미래 개발 의존형";
  if (tag === "access_gap_driven") return "접근성 보완형";
  if (tag === "uncertainty_attention") return "주의 검토형";
  return "안정 수요형";
}

function getBarrierCounts(candidate: Candidate): Record<BarrierKey, number> {
  return {
    motorway: candidate.barrier_counts?.motorway ?? 0,
    trunk: candidate.barrier_counts?.trunk ?? 0,
    primary: candidate.barrier_counts?.primary ?? 0,
    secondary: candidate.barrier_counts?.secondary ?? 0,
    tertiary: candidate.barrier_counts?.tertiary ?? 0,
  };
}

function getBarrierSeverity(candidate: Candidate): NonNullable<Candidate["barrier_severity"]> {
  if (candidate.is_school_internal) return "green";
  return candidate.barrier_severity ?? "green";
}

function getBarrierColor(candidate: Candidate): string {
  if (candidate.is_school_internal) return SIM_COLORS.blue;
  return candidate.barrier_color ?? BARRIER_COLOR[getBarrierSeverity(candidate)];
}

function sanitizeBarrierText(value?: string): string {
  return String(value ?? "")
    .replace(/주요 도시 간선도로/g, "주요 도시 간선도로")
    .replace(/주요 도시 간선도로/g, "주요 도시 간선도로")
    .replace(/주요 도시 간선도로 계열/g, "주요 도시 간선도로")
    .replace(/주요 도시 간선도로/g, "주요 도시 간선도로")
    .replace(/주요 도시 간선도로/g, "주요 도시 간선도로")
    .replace(/중간급 간선도로/g, "중간급 간선도로")
    .replace(/지구 내 간선도로/g, "지구 내 간선도로")
    .replace(/간선도로 횡단 부담이 낮아/g, "간선도로 횡단 부담이 낮아")
    .replace(/사고위험 지점/g, "사고위험 지점");
}

function getBarrierLabel(candidate: Candidate): string {
  if (candidate.is_school_internal) return "학교 내부 설치";
  return sanitizeBarrierText(candidate.barrier_severity_label ?? "경로 정보 준비 중");
}

function getBarrierNote(candidate: Candidate): string {
  if (candidate.is_school_internal) {
    return "학교 안에 설치하는 대안입니다. 별도 도로 횡단 없이 바로 이용할 수 있는 옵션으로 해석합니다.";
  }
  return sanitizeBarrierText(candidate.barrier_note ?? "경로 정보가 아직 연결되지 않은 후보지입니다.");
}

function getBarrierCountSummary(candidate: Candidate): string {
  if (candidate.is_school_internal) return "학교 내부 설치 후보";
  const counts = getBarrierCounts(candidate);
  const parts: string[] = [];
  const cityArterialCount = counts.motorway + counts.trunk + counts.primary;
  if (cityArterialCount > 0) parts.push(`주요 도시 간선도로 ${cityArterialCount}회 횡단`);
  if (counts.secondary > 0) parts.push(`중간급 간선도로 ${counts.secondary}회 횡단`);
  if (counts.tertiary > 0) parts.push(`지구 내 간선도로 ${counts.tertiary}회 횡단`);
  return parts.length ? parts.join(" / ") : "생활도로 중심 경로";
}

function hasLargeAptNearby(candidate: Candidate): boolean {
  if (candidate.has_large_apt != null) return Boolean(candidate.has_large_apt);
  return Number.isFinite(candidate.nearest_apt_dist) && candidate.nearest_apt_dist <= 500;
}

function hasAccidentHotspot(candidate: Candidate): boolean {
  return Boolean(candidate.accident_hotspot_flag);
}

function hasRedevelopmentRisk(candidate: Candidate): boolean {
  if (candidate.redev_flag != null) return Boolean(candidate.redev_flag);
  return Boolean(candidate.redev_level && candidate.redev_level !== "none");
}

function passesFilters(candidate: Candidate, filters: FilterState): boolean {
  if (candidate.is_school_internal) return true;

  const counts = getBarrierCounts(candidate);
  if (filters.excludePrimary && counts.primary > 0) return false;
  if (filters.excludeSecondary && counts.secondary > 0) return false;
  if (filters.excludeTertiary && counts.tertiary > 0) return false;
  if (filters.excludeAccident && hasAccidentHotspot(candidate)) return false;
  if (filters.excludeRedev && hasRedevelopmentRisk(candidate)) return false;
  if (filters.excludeLargeApt && hasLargeAptNearby(candidate)) return false;
  return true;
}

function scoreCandidates(candidates: Candidate[], weights: WeightState): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const normalizedWeights = normalizeWeights(weights);
  const benefitScores = minmaxScore(candidates.map((candidate) => candidate.walkshed_potential_2029));
  const schoolDistanceScores = minmaxScore(candidates.map((candidate) => candidate.nearest_school_dist), true);
  const facilityGapScores = minmaxScore(candidates.map((candidate) => candidate.nearest_park_dist));

  return candidates
    .map((candidate, index) => {
      const finalScore =
        benefitScores[index] * normalizedWeights.benefit +
        schoolDistanceScores[index] * normalizedWeights.schoolDistance +
        facilityGapScores[index] * normalizedWeights.parkDistance;

      return {
        ...candidate,
        benefit_score: benefitScores[index],
        school_distance_score: schoolDistanceScores[index],
        facility_gap_score: facilityGapScores[index],
        final_score: finalScore,
        ai_score: finalScore,
      };
    })
    .sort((left, right) => right.final_score - left.final_score);
}

type AiRecommendationResult = {
  recommendations: ScoredCandidate[];
  fallbackApplied: boolean;
  filterSummary: string;
};

function scoreWithNormalizedWeights(candidates: Candidate[], weights: WeightState): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const normalizedWeights = normalizeWeights(weights);
  const demandScores = minmaxScore(candidates.map((candidate) => candidate.walkshed_potential_2029));
  const schoolDistanceScores = minmaxScore(candidates.map((candidate) => candidate.nearest_school_dist), true);
  const parkGapScores = minmaxScore(candidates.map((candidate) => candidate.nearest_park_dist));

  return candidates
    .map((candidate, index) => {
      const finalScore =
        schoolDistanceScores[index] * normalizedWeights.schoolDistance +
        demandScores[index] * normalizedWeights.benefit +
        parkGapScores[index] * normalizedWeights.parkDistance;

      return {
        ...candidate,
        benefit_score: demandScores[index],
        school_distance_score: schoolDistanceScores[index],
        facility_gap_score: parkGapScores[index],
        final_score: finalScore,
        ai_score: finalScore,
      };
    })
    .sort((left, right) => right.final_score - left.final_score);
}

function buildAiMessage(candidate: Candidate): string {
  return getBarrierCountSummary(candidate);
}

function computeAiRecommendations(candidates: Candidate[]): AiRecommendationResult {
  if (candidates.length === 0) {
    return {
      recommendations: [],
      fallbackApplied: false,
      filterSummary: "적용 가능한 외부 후보가 없습니다.",
    };
  }

  const primaryAndSecondarySafe = candidates.filter((candidate) => {
    const counts = getBarrierCounts(candidate);
    return counts.primary === 0 && counts.secondary === 0;
  });

  const primarySafeOnly = candidates.filter((candidate) => {
    const counts = getBarrierCounts(candidate);
    return counts.primary === 0;
  });

  const fallbackApplied =
    primaryAndSecondarySafe.length === 0 &&
    primarySafeOnly.length > 0;

  const basePool = fallbackApplied ? primarySafeOnly : primaryAndSecondarySafe;
  const recommendations = scoreWithNormalizedWeights(basePool, AI_DEFAULT_WEIGHTS)
    .map((candidate) => ({
      ...candidate,
      ai_message: buildAiMessage(candidate),
    }))
    .sort((left, right) => {
      const leftRank = Number.isFinite(left.robust_rank) ? left.robust_rank! : Number.POSITIVE_INFINITY;
      const rightRank = Number.isFinite(right.robust_rank) ? right.robust_rank! : Number.POSITIVE_INFINITY;
      if (leftRank !== rightRank) return leftRank - rightRank;
      return right.final_score - left.final_score;
    })
    .slice(0, AI_RECOMMENDATION_COUNT);

  return {
    recommendations,
    fallbackApplied,
    filterSummary: fallbackApplied
      ? "주요 도시 간선도로 미횡단 후보는 유지하고, 중간급 간선도로 미횡단 후보가 없어 중간급 간선도로 조건만 완화했습니다."
      : "주요 도시 간선도로 미횡단 + 중간급 간선도로 미횡단 조건으로 기본 추천을 계산했습니다.",
  };
}

function getCandidateDistanceLabel(candidate: Candidate): string {
  if (candidate.fallback_candidate && candidate.fallback_distance_basis === "straight_line_m") {
    return "학교 직선거리(참고)";
  }
  return "학교 경로거리";
}

function getCandidateTierLabel(candidate: Candidate): string {
  if (candidate.fallback_candidate) return candidate.candidate_display_label ?? "보조 후보지";
  return "기본 후보지";
}

function getCandidateTierStyle(candidate: Candidate) {
  return candidate.fallback_candidate
    ? { background: "rgba(251, 191, 36, 0.10)", color: SIM_COLORS.amber, border: "1px solid rgba(251, 191, 36, 0.30)" }
    : { background: "rgba(16, 185, 129, 0.12)", color: SIM_COLORS.green, border: "1px solid rgba(16, 185, 129, 0.30)" };
}

function buildFilterReasonSummary(filters: FilterState): string[] {
  const summaries: string[] = [];
  if (filters.excludePrimary) summaries.push("주요 도시 간선도로 횡단 후보 제외");
  if (filters.excludeSecondary) summaries.push("중간급 간선도로 횡단 후보 제외");
  if (filters.excludeTertiary) summaries.push("지구 내 간선도로 횡단 후보 제외");
  if (filters.excludeAccident) summaries.push("사고위험 지점 인접 후보 제외");
  if (filters.excludeRedev) summaries.push("재개발 영향권 후보 제외");
  if (filters.excludeLargeApt) summaries.push("500세대 이상 대단지 인근 후보 제외");
  return summaries;
}

function applyWeightToggles(weights: WeightState, toggles: WeightToggleState): WeightState {
  return {
    benefit: toggles.benefit ? weights.benefit : 0,
    schoolDistance: toggles.schoolDistance ? weights.schoolDistance : 0,
    parkDistance: toggles.parkDistance ? weights.parkDistance : 0,
  };
}

function buildCandidateSummary(candidate: Partial<Pick<ScoredCandidate, "benefit_score" | "school_distance_score" | "facility_gap_score">>): string {
  const reasons: string[] = [];
  const schoolScore = candidate.school_distance_score ?? 0;
  const benefitScore = candidate.benefit_score ?? 0;
  const facilityScore = candidate.facility_gap_score ?? 0;
  if (schoolScore >= 0.7) reasons.push("생활권 중심 접근 가능");
  if (benefitScore >= 0.7) reasons.push("수요 규모 우수");
  if (facilityScore >= 0.7) reasons.push("기존 공원 공백 큼");
  if (reasons.length === 0 && schoolScore >= 0.45) reasons.push("접근성 안정적");
  if (reasons.length === 0 && benefitScore >= 0.45) reasons.push("수요 대비 무난");
  if (reasons.length === 0) reasons.push("복합 조건 균형");
  return reasons.slice(0, 2).join(", ");
}

function buildCandidateReasons(candidate: Partial<Pick<ScoredCandidate, "benefit_score" | "school_distance_score" | "facility_gap_score">>): string[] {
  const reasons: string[] = [];
  const schoolScore = candidate.school_distance_score ?? 0;
  const benefitScore = candidate.benefit_score ?? 0;
  const facilityScore = candidate.facility_gap_score ?? 0;
  if (benefitScore >= 0.65) reasons.push("수요가 충분함");
  if (schoolScore >= 0.65) reasons.push("접근성이 안정적임");
  if (facilityScore >= 0.65) reasons.push("기존 공원 부족 지역에 가까움");
  if (benefitScore < 0.4) reasons.push("수요 규모는 상대적으로 제한적임");
  if (schoolScore < 0.4) reasons.push("학교와의 거리는 다소 있는 편임");
  if (facilityScore < 0.4) reasons.push("기존 공원과의 차별성은 크지 않음");
  return reasons.slice(0, 3);
}

function RobustCandidateBrief({
  candidate,
  compact = false,
  isOpen = false,
  onShapClick,
}: {
  candidate: Candidate;
  compact?: boolean;
  isOpen?: boolean;
  onShapClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  if (!hasRobustRecommendation(candidate)) return null;
  return (
    <div style={{ marginTop: 10, padding: compact ? "10px 12px" : "12px 14px", borderRadius: 12, background: "rgba(37, 99, 235, 0.10)", border: "1px solid rgba(96, 165, 250, 0.25)" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        {candidate.pareto_candidate ? (
          <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.14)", color: SIM_COLORS.greenSoft, fontSize: 11, fontWeight: 800 }}>Pareto 후보</span>
        ) : null}
        <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: SIM_COLORS.text, fontSize: 11, fontWeight: 800 }}>
          Top5 안정성 {formatStability(candidate.top5_stability_score)}
        </span>
        <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: SIM_COLORS.text, fontSize: 11, fontWeight: 800 }}>
          평균 순위 {formatOneDecimal(candidate.mean_rank)}위
        </span>
        <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(251, 191, 36, 0.10)", color: SIM_COLORS.amber, fontSize: 11, fontWeight: 800 }}>
          {getRecommendationTypeLabel(candidate)}
        </span>
      </div>
      {candidate.robust_recommendation_reason ? (
        <div style={{ fontSize: compact ? 12 : 13, color: SIM_COLORS.secondary, lineHeight: 1.55 }}>{candidate.robust_recommendation_reason}</div>
      ) : null}
      <button
        type="button"
        onClick={onShapClick}
        style={{ marginTop: 10, border: `1px solid ${SIM_COLORS.borderStrong}`, background: SIM_COLORS.elevated, color: SIM_COLORS.greenSoft, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
      >
        {isOpen ? "SHAP 예측 근거 닫기" : "SHAP 예측 근거 보기"}
      </button>
      {isOpen ? <ShapDiagnosticPanel candidate={candidate} /> : null}
    </div>
  );
}

function ShapDiagnosticPanel({ candidate }: { candidate: Candidate }) {
  const positive = candidate.shap_positive_drivers ?? [];
  const negative = candidate.shap_negative_drivers ?? [];
  if (!hasRobustRecommendation(candidate) && !positive.length && !negative.length) return null;
  return (
    <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: SIM_COLORS.inset, border: `1px solid ${SIM_COLORS.border}` }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: SIM_COLORS.text, marginBottom: 6 }}>SHAP 예측 근거</div>
      <div style={{ fontSize: 12, color: SIM_COLORS.muted, lineHeight: 1.6, marginBottom: 10 }}>
        이 설명은 최종 추천 순위가 아니라, 미래 수혜 아동 수 예측값의 변수별 근거입니다. 최종 후보 판단은 안정성 점수, 정책 필터, 현장 검토를 함께 고려합니다.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginBottom: 10 }}>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: SIM_COLORS.panel }}>
          예상 수혜 아동 수 <b>{formatCount(candidate.predicted_beneficiaries_used ?? candidate.walkshed_potential_2031)}명</b>
        </div>
        <div style={{ padding: "10px 12px", borderRadius: 10, background: SIM_COLORS.panel }}>
          진단 태그 <b>{getShapTagLabel(candidate.shap_diagnostic_tag)}</b>
        </div>
      </div>
      {candidate.shap_explanation_text ? <div style={{ fontSize: 13, color: SIM_COLORS.secondary, lineHeight: 1.6, marginBottom: 10 }}>{candidate.shap_explanation_text}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <DriverList title="예측값을 높인 변수" drivers={positive} positive />
        <DriverList title="예측값을 낮춘 변수" drivers={negative} />
      </div>
      {candidate.shap_waterfall_image_path ? (
        <img
          src={candidate.shap_waterfall_image_path.startsWith("http") ? candidate.shap_waterfall_image_path : `../../${candidate.shap_waterfall_image_path}`}
          alt="SHAP waterfall"
          style={{ width: "100%", maxWidth: 680, marginTop: 12, borderRadius: 10, border: `1px solid ${SIM_COLORS.border}` }}
        />
      ) : null}
    </div>
  );
}

function DriverList({ title, drivers, positive = false }: { title: string; drivers: ShapDriver[]; positive?: boolean }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: SIM_COLORS.panel }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: positive ? SIM_COLORS.greenSoft : SIM_COLORS.amber, marginBottom: 8 }}>{title}</div>
      <div style={{ display: "grid", gap: 6, fontSize: 12, color: SIM_COLORS.secondary }}>
        {drivers.length ? drivers.slice(0, 3).map((driver) => (
          <div key={`${driver.feature}-${driver.shap_value}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>{driver.feature}</span>
            <b>{driver.shap_value.toFixed(1)}</b>
          </div>
        )) : <div>표시할 변수가 없습니다.</div>}
      </div>
    </div>
  );
}

export default function SimulationPage({
  schoolName,
  schoolLat,
  schoolLng,
  casePolicyLabel,
  caseType,
  candidates,
  redevelopmentProjects = [],
  largeApartmentComplexes = [],
  onBack,
}: SimulationPageProps) {
  const [mode, setMode] = useState<SimulationMode>("manual");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [weights, setWeights] = useState<WeightState>(DEFAULT_WEIGHTS);
  const [weightToggles, setWeightToggles] = useState<WeightToggleState>(DEFAULT_WEIGHT_TOGGLES);
  const [weightsExpanded, setWeightsExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shapOpenId, setShapOpenId] = useState<string | null>(null);

  const internalCandidate = useMemo(
    () => candidates.find((candidate) => candidate.is_school_internal),
    [candidates],
  );

  const externalCandidates = useMemo(
    () => candidates.filter((candidate) => !candidate.is_school_internal),
    [candidates],
  );

  const primaryCandidateCount = useMemo(
    () => externalCandidates.filter((candidate) => !candidate.fallback_candidate).length,
    [externalCandidates],
  );

  const supplementalCandidateCount = externalCandidates.length - primaryCandidateCount;

  const filteredCandidates = useMemo(
    () => externalCandidates.filter((candidate) => passesFilters(candidate, filters)),
    [externalCandidates, filters],
  );
  const candidateLabelMap = useMemo(() => {
    return new Map(
      externalCandidates.map((candidate, index) => [candidate.grid_id, getStableCandidateLabel(index)] as const),
    );
  }, [externalCandidates]);

  const effectiveWeights = useMemo(
    () => applyWeightToggles(weights, weightToggles),
    [weights, weightToggles],
  );
  const rankedCandidates = useMemo(
    () => scoreCandidates(filteredCandidates, effectiveWeights),
    [filteredCandidates, effectiveWeights],
  );
  const aiRecommendations = useMemo(
    () => computeAiRecommendations(externalCandidates),
    [externalCandidates],
  );

  const normalizedWeights = useMemo(() => normalizeWeights(effectiveWeights), [effectiveWeights]);
  const filterSummary = useMemo(() => buildFilterReasonSummary(filters), [filters]);

  const applyAiDefaults = () => {
    setFilters(AI_DEFAULT_FILTERS);
    setWeights(AI_DEFAULT_WEIGHTS);
    setWeightToggles(DEFAULT_WEIGHT_TOGGLES);
    setMode("ai");
  };

  const displayedCandidates = useMemo(
    () => (mode === "ai" ? aiRecommendations.recommendations : rankedCandidates).slice(0, 4),
    [aiRecommendations.recommendations, mode, rankedCandidates],
  );

  useEffect(() => {
    const allowedIds = new Set<string>();
    displayedCandidates.forEach((candidate) => allowedIds.add(candidate.grid_id));
    if (internalCandidate) allowedIds.add(internalCandidate.grid_id);

    setSelectedId((previous) => {
      if (previous && allowedIds.has(previous)) return previous;
      return displayedCandidates[0]?.grid_id ?? internalCandidate?.grid_id ?? null;
    });
  }, [displayedCandidates, internalCandidate]);

  const toggleSelect = (id: string) => {
    setSelectedId((previous) => (previous === id ? null : id));
  };

  const mapMarkers = useMemo((): CandidateMarker[] => {
    const markers: CandidateMarker[] = [
      {
        id: "SCHOOL",
        lat: schoolLat,
        lng: schoolLng,
        label: "학교",
        color: SIM_COLORS.greenDark,
        isSchool: true,
      },
    ];

    if (internalCandidate) {
      markers.push({
        id: internalCandidate.grid_id,
        lat: schoolLat + 0.00027,
        lng: schoolLng - 0.00035,
        label: "교내",
        color: SIM_COLORS.blue,
        isInternal: true,
      });
    }

    displayedCandidates.forEach((candidate, index) => {
      markers.push({
        id: candidate.grid_id,
        lat: candidate.cy,
        lng: candidate.cx,
        label: candidateLabelMap.get(candidate.grid_id) ?? getStableCandidateLabel(index),
        color: getBarrierColor(candidate),
      });
    });

    return markers;
  }, [candidateLabelMap, displayedCandidates, internalCandidate, schoolLat, schoolLng]);

  const routeLines = useMemo((): CandidateRouteLine[] => {
    return displayedCandidates
      .filter((candidate) => candidate.grid_id === selectedId)
      .filter((candidate) => Array.isArray(candidate.route_coords) && candidate.route_coords.length >= 2)
      .map((candidate) => ({
        id: candidate.grid_id,
        path: candidate.route_coords as Array<[number, number]>,
        color: getBarrierColor(candidate),
      }));
  }, [displayedCandidates, selectedId]);

  const selectedCandidate = useMemo(() => {
    const byId = new Map<string, Candidate>();
    if (internalCandidate) byId.set(internalCandidate.grid_id, internalCandidate);
    rankedCandidates.forEach((candidate) => byId.set(candidate.grid_id, candidate));
    aiRecommendations.recommendations.forEach((candidate) => byId.set(candidate.grid_id, candidate));
    return selectedId ? byId.get(selectedId) ?? null : null;
  }, [aiRecommendations.recommendations, internalCandidate, rankedCandidates, selectedId]);

  const openShapPanel = (candidate: Candidate, event?: MouseEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    setSelectedId(candidate.grid_id);
    setShapOpenId((previous) => (previous === candidate.grid_id ? null : candidate.grid_id));
  };

  return (
    <div
      style={{
        fontFamily: "Pretendard, sans-serif",
        maxWidth: 1180,
        margin: "0 auto",
        padding: "24px 28px 40px",
      }}
    >
      <button
        onClick={onBack}
        style={{
          marginBottom: 16,
          padding: "7px 14px",
          borderRadius: 8,
          border: `1px solid ${SIM_COLORS.border}`,
          cursor: "pointer",
          background: SIM_COLORS.panel,
          color: SIM_COLORS.secondary,
          fontWeight: 600,
        }}
      >
        리포트로 돌아가기
      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: SIM_COLORS.green, marginBottom: 6 }}>
          HUMAN-IN-THE-LOOP SIMULATION
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: SIM_COLORS.text }}>{schoolName}</h1>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              display: "inline-flex",
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(16, 185, 129, 0.12)",
              color: SIM_COLORS.greenSoft,
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {casePolicyLabel}
          </span>
          <span style={{ fontSize: 12, color: SIM_COLORS.muted }}>
            기준 좌표 {schoolLat.toFixed(5)}, {schoolLng.toFixed(5)}
          </span>
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: "18px 20px",
          borderRadius: 18,
          ...SIM_ACCENT_PANEL,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 8 }}>
          공공시설 입지 선정을 위한 의사결정 인터페이스
        </div>
        <div style={{ fontSize: 14, color: SIM_COLORS.secondary, lineHeight: 1.75 }}>
          정보를 많이 보여주는 것이 아니라, 30초 안에 비교 후보를 좁혀 선택할 수 있도록 설계한 화면입니다.
          지도에서 위치를 먼저 보고, 참고 맥락과 추천 결과를 비교한 뒤 필요한 경우만 상세 정보를 펼쳐 확인합니다.
        </div>
      </div>

      <div
        style={{
          padding: 18,
          borderRadius: 22,
          ...SIM_PANEL,
          marginBottom: 18,
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, color: SIM_COLORS.muted, marginBottom: 8 }}>후보지 경로 지도</div>
        <KakaoMap
          center={{ lat: schoolLat, lng: schoolLng }}
          markers={mapMarkers}
          routes={routeLines}
          selected={new Set(selectedId ? [selectedId] : [])}
          onToggle={toggleSelect}
          height={Math.max(420, Math.round((typeof window !== "undefined" ? window.innerHeight : 1000) * 0.42))}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <LegendItem color={SIM_COLORS.greenDark} shape="diamond" label="학교" />
          <LegendItem color={SIM_COLORS.blue} shape="circle" label="교내 설치" />
          <LegendItem color={BARRIER_COLOR.green} shape="circle" label="생활도로 중심" />
          <LegendItem color={BARRIER_COLOR.yellow} shape="circle" label="중간급 간선도로 포함" />
          <LegendItem color={BARRIER_COLOR.orange} shape="circle" label="주요 도시 간선도로 포함" />
          <LegendItem color={BARRIER_COLOR.red} shape="circle" label="간선도로 부담 큼" />
        </div>
      </div>

      {(redevelopmentProjects.length > 0 || largeApartmentComplexes.length > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          {largeApartmentComplexes.slice(0, 2).map((complex, index) => (
            <div key={`${complex.name}-${index}`} style={{ padding: 16, borderRadius: 18, ...SIM_PANEL_FLAT }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: SIM_COLORS.blue, marginBottom: 6 }}>대단지 아파트</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 8 }}>{complex.name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(16, 185, 129, 0.10)", color: SIM_COLORS.blue, fontWeight: 700 }}>
                  {complex.householdCount.toLocaleString()}세대
                </span>
                <span style={{ color: SIM_COLORS.muted }}>{complex.distanceM.toLocaleString()}m</span>
              </div>
            </div>
          ))}
          {redevelopmentProjects.slice(0, 2).map((project, index) => (
            <div key={`${project.name}-${index}`} style={{ padding: 16, borderRadius: 18, ...SIM_PANEL_FLAT }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: SIM_COLORS.amber, marginBottom: 6 }}>재개발 정비사업</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 8 }}>{project.name}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(251, 191, 36, 0.10)", color: SIM_COLORS.amber, fontWeight: 700 }}>
                  {project.stage || "단계 정보 없음"}
                </span>
                <span style={{ color: SIM_COLORS.muted }}>{project.distanceM.toLocaleString()}m</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
        <button
          type="button"
          onClick={applyAiDefaults}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: `1px solid ${mode === "ai" ? SIM_COLORS.borderStrong : SIM_COLORS.border}`,
            cursor: "pointer",
            background: mode === "ai" ? "linear-gradient(135deg, #064E3B 0%, #10B981 100%)" : "rgba(16, 185, 129, 0.10)",
            color: mode === "ai" ? SIM_COLORS.text : SIM_COLORS.greenSoft,
            fontWeight: 800,
          }}
        >
          AI 기반 견고 후보 추천
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          style={{
            padding: "10px 14px",
            borderRadius: 999,
            border: `1px solid ${SIM_COLORS.border}`,
            cursor: "pointer",
            background: mode === "manual" ? "linear-gradient(135deg, #064E3B 0%, #10B981 100%)" : SIM_COLORS.panel,
            color: mode === "manual" ? SIM_COLORS.text : SIM_COLORS.secondary,
            fontWeight: 800,
          }}
        >
          직접 설정 모드
        </button>
      </div>

      {mode === "manual" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1fr)", gap: 16, marginBottom: 18 }}>
          <div style={{ padding: 18, borderRadius: 18, ...SIM_PANEL_FLAT }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 12 }}>제외 조건 설정</div>
            <div style={{ display: "grid", gap: 10 }}>
              {FILTER_COPY.map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: `1px solid ${SIM_COLORS.border}`,
                    background: filters[item.key] ? "rgba(251, 191, 36, 0.10)" : SIM_COLORS.inset,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters[item.key]}
                    onChange={() => setFilters((previous) => ({ ...previous, [item.key]: !previous[item.key] }))}
                  />
                  <div style={{ fontSize: 13, fontWeight: 700, color: SIM_COLORS.text }}>{item.title}</div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ padding: 18, borderRadius: 18, ...SIM_PANEL_FLAT }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: SIM_COLORS.text }}>우선순위 기준 설정</div>
              <button
                type="button"
                onClick={() => setWeightsExpanded((previous) => !previous)}
                style={{ border: "none", background: "rgba(255,255,255,0.08)", color: SIM_COLORS.secondary, borderRadius: 999, padding: "7px 12px", fontWeight: 700, cursor: "pointer" }}
              >
                {weightsExpanded ? "접기" : "펼치기"}
              </button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {WEIGHT_COPY.map((item) => (
                <div key={item.key} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${SIM_COLORS.border}`, background: SIM_COLORS.inset }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, color: SIM_COLORS.text }} title={item.description}>
                      <input
                        type="checkbox"
                        checked={weightToggles[item.key]}
                        onChange={() => setWeightToggles((previous) => ({ ...previous, [item.key]: !previous[item.key] }))}
                      />
                      {item.title}
                    </label>
                    <div style={{ fontSize: 12, fontWeight: 800, color: SIM_COLORS.amber }}>{formatPercent(normalizedWeights[item.key])}</div>
                  </div>
                  {weightsExpanded && weightToggles[item.key] ? (
                    <div style={{ marginTop: 10 }}>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={weights[item.key]}
                        onChange={(event) => setWeights((previous) => ({ ...previous, [item.key]: Number(event.target.value) }))}
                        style={{ width: "100%" }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 18, background: "rgba(16, 185, 129, 0.10)", color: SIM_COLORS.greenSoft, fontSize: 13, lineHeight: 1.7 }}>
          미래 수요 예측, Pareto 후보군, 1,000회 가중치 샘플링 기반 순위 안정성을 결합해 다양한 정책 선호에서도 상위권에 유지되는 후보를 제시합니다.
          <div style={{ marginTop: 6 }}>{aiRecommendations.filterSummary}</div>
        </div>
      )}

      <div style={{ padding: 18, borderRadius: 18, ...SIM_PANEL, marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
          <MetricPill label="전체 후보" value={`${externalCandidates.length}곳`} tone={SIM_COLORS.text} background={SIM_COLORS.inset} />
          <MetricPill label="기본 후보" value={`${primaryCandidateCount}곳`} tone={SIM_COLORS.green} background="rgba(16, 185, 129, 0.12)" />
          <MetricPill label="보조 후보" value={`${supplementalCandidateCount}곳`} tone={SIM_COLORS.amber} background="rgba(251, 191, 36, 0.10)" />
          <MetricPill label="현재 비교 후보" value={`${displayedCandidates.length}곳`} tone={SIM_COLORS.green} background="rgba(16, 185, 129, 0.12)" />
          <MetricPill label="남은 후보" value={`${mode === "ai" ? aiRecommendations.recommendations.length : rankedCandidates.length}곳`} tone={SIM_COLORS.amber} background="rgba(251, 191, 36, 0.10)" />
        </div>
        {filterSummary.length && mode === "manual" ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {filterSummary.map((item) => (
              <span key={item} style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(251, 191, 36, 0.10)", color: SIM_COLORS.amber, fontSize: 12, fontWeight: 700 }}>
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {displayedCandidates.length > 0 ? (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 800, color: SIM_COLORS.muted }}>TOP 1 추천 후보</div>
          {(() => {
            const topCandidate = displayedCandidates[0];
            const barrierColor = getBarrierColor(topCandidate);
            const label = candidateLabelMap.get(topCandidate.grid_id) ?? "A";
            const reasons = buildCandidateReasons(topCandidate);
            return (
              <div
                onClick={() => toggleSelect(topCandidate.grid_id)}
                style={{
                  marginBottom: 18,
                  padding: 22,
                  borderRadius: 22,
                  border: `2px solid ${selectedId === topCandidate.grid_id ? barrierColor : SIM_COLORS.borderStrong}`,
                  background: "linear-gradient(165deg, rgba(21,34,56,0.97) 0%, rgba(16,27,45,0.98) 60%, rgba(8,20,33,0.98) 100%)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(16, 185, 129, 0.18)", color: SIM_COLORS.greenSoft, fontSize: 12, fontWeight: 800 }}>
                      {mode === "ai" ? "추천" : "1순위"}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.10)", color: SIM_COLORS.text, fontSize: 12, fontWeight: 800 }}>
                      위치 {label}
                    </span>
                    <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, ...getCandidateTierStyle(topCandidate) }}>
                      {getCandidateTierLabel(topCandidate)}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: SIM_COLORS.text }}>{topCandidate.grid_id}</span>
                  </div>
                  <span style={{ padding: "4px 10px", borderRadius: 999, background: `${barrierColor}18`, color: barrierColor, fontSize: 12, fontWeight: 800 }}>
                    {getBarrierLabel(topCandidate)}
                  </span>
                </div>
                <div style={{ fontSize: 24, fontWeight: 900, color: SIM_COLORS.text, marginBottom: 8 }}>{buildCandidateSummary(topCandidate)}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 10 }}>
                  <div style={{ padding: "10px 12px", borderRadius: 14, background: SIM_COLORS.panel }}>잠재수요 <b>{formatCount(topCandidate.walkshed_potential_2029)}명</b></div>
                  <div style={{ padding: "10px 12px", borderRadius: 14, background: SIM_COLORS.panel }}>{getCandidateDistanceLabel(topCandidate)} <b>{formatDistance(topCandidate.nearest_school_dist)}</b></div>
                  <div style={{ padding: "10px 12px", borderRadius: 14, background: SIM_COLORS.panel }}>기존 공원 거리 <b>{formatDistance(topCandidate.nearest_park_dist)}</b></div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {reasons.map((reason) => (
                    <span key={reason} style={{ padding: "4px 10px", borderRadius: 999, background: SIM_COLORS.panel, color: SIM_COLORS.secondary, fontSize: 12, fontWeight: 700 }}>
                      {reason}
                    </span>
                  ))}
                </div>
                <RobustCandidateBrief
                  candidate={topCandidate}
                  isOpen={shapOpenId === topCandidate.grid_id}
                  onShapClick={(event) => openShapPanel(topCandidate, event)}
                />
              </div>
            );
          })()}

          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 800, color: SIM_COLORS.muted }}>비교 후보</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 18 }}>
            {displayedCandidates.slice(1, 4).map((candidate, index) => {
              const barrierColor = getBarrierColor(candidate);
              const label = candidateLabelMap.get(candidate.grid_id) ?? getStableCandidateLabel(index + 1);
              return (
                <div
                  key={candidate.grid_id}
                  onClick={() => toggleSelect(candidate.grid_id)}
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    border: `2px solid ${selectedId === candidate.grid_id ? barrierColor : "rgba(255,255,255,0.10)"}`,
                    background: SIM_COLORS.panel,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: SIM_COLORS.text, fontSize: 11, fontWeight: 800 }}>순위 {index + 2}</span>
                    <span style={{ padding: "3px 8px", borderRadius: 999, background: "rgba(255,255,255,0.10)", color: SIM_COLORS.text, fontSize: 11, fontWeight: 800 }}>위치 {label}</span>
                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800, ...getCandidateTierStyle(candidate) }}>
                      {getCandidateTierLabel(candidate)}
                    </span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 8 }}>{buildCandidateSummary(candidate)}</div>
                  <div style={{ display: "grid", gap: 6, fontSize: 12, color: SIM_COLORS.secondary }}>
                    <div>잠재수요 <b>{formatCount(candidate.walkshed_potential_2029)}명</b></div>
                    <div>{getCandidateDistanceLabel(candidate)} <b>{formatDistance(candidate.nearest_school_dist)}</b></div>
                    <div>공원 거리 <b>{formatDistance(candidate.nearest_park_dist)}</b></div>
                  </div>
                  <RobustCandidateBrief
                    candidate={candidate}
                    compact
                    isOpen={shapOpenId === candidate.grid_id}
                    onShapClick={(event) => openShapPanel(candidate, event)}
                  />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ border: `1px dashed ${SIM_COLORS.border}`, borderRadius: 16, padding: "18px 20px", background: "rgba(255,255,255,0.03)", fontSize: 13, color: SIM_COLORS.muted, lineHeight: 1.7, marginBottom: 18 }}>
          현재 조건에서 비교 가능한 후보가 없습니다. 직접 설정 모드에서 필터를 일부 완화하면 다시 비교할 수 있습니다.
        </div>
      )}

      {selectedCandidate ? (
        <div style={{ padding: 18, borderRadius: 18, ...SIM_PANEL_FLAT }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: SIM_COLORS.muted, marginBottom: 8 }}>상세 정보</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: SIM_COLORS.text }}>
                위치 {candidateLabelMap.get(selectedCandidate.grid_id) ?? "-"} · {selectedCandidate.grid_id}
              </div>
              <div style={{ fontSize: 13, color: SIM_COLORS.muted, marginTop: 4 }}>{buildCandidateSummary(selectedCandidate as ScoredCandidate)}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 800, ...getCandidateTierStyle(selectedCandidate) }}>
                {getCandidateTierLabel(selectedCandidate)}
              </span>
              <span style={{ padding: "4px 10px", borderRadius: 999, background: `${getBarrierColor(selectedCandidate)}18`, color: getBarrierColor(selectedCandidate), fontSize: 12, fontWeight: 800 }}>
                {getBarrierLabel(selectedCandidate)}
              </span>
            </div>
          </div>
          {selectedCandidate.fallback_candidate ? (
            <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: "rgba(251, 191, 36, 0.10)", border: "1px solid rgba(251, 191, 36, 0.30)", color: SIM_COLORS.amber, fontSize: 13, fontWeight: 700, lineHeight: 1.6 }}>
              {selectedCandidate.fallback_explanation ?? "보조 후보지입니다. 도보 500m 직접 후보지가 부족할 때만 참고로 표시하며, 기본 추천 후보로 해석하지 않습니다."}
            </div>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>인근 거주 2029 <b>{formatCount(selectedCandidate.resident_children_2029)}명</b></div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>인근 거주 2031 <b>{formatCount(selectedCandidate.resident_children_2031)}명</b></div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>잠재수요 2029 <b>{formatCount(selectedCandidate.walkshed_potential_2029)}명</b></div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>잠재수요 2031 <b>{formatCount(selectedCandidate.walkshed_potential_2031)}명</b></div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>{getCandidateDistanceLabel(selectedCandidate)} <b>{formatDistance(selectedCandidate.nearest_school_dist)}</b></div>
            <div style={{ padding: "10px 12px", borderRadius: 12, background: SIM_COLORS.inset }}>기존 공원 거리 <b>{formatDistance(selectedCandidate.nearest_park_dist)}</b></div>
          </div>
          <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: getBarrierColor(selectedCandidate) }}>{getBarrierCountSummary(selectedCandidate)}</div>
          {"final_score" in selectedCandidate ? (
            <div style={{ marginBottom: 12, padding: "12px 14px", borderRadius: 12, background: SIM_COLORS.inset }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: SIM_COLORS.text, marginBottom: 6 }}>이 후보가 높은 이유</div>
              <div style={{ display: "grid", gap: 6, fontSize: 13, color: SIM_COLORS.secondary }}>
                {buildCandidateReasons(selectedCandidate as ScoredCandidate).map((reason, index) => (
                  <div key={reason}>{index + 1}. {reason}</div>
                ))}
              </div>
            </div>
          ) : null}
          <RobustCandidateBrief
            candidate={selectedCandidate}
            isOpen={shapOpenId === selectedCandidate.grid_id}
            onShapClick={(event) => openShapPanel(selectedCandidate, event)}
          />
          <div style={{ display: "grid", gap: 8, fontSize: 13, color: SIM_COLORS.secondary, lineHeight: 1.7 }}>
            <div>{getBarrierNote(selectedCandidate)}</div>
            {selectedCandidate.accident_hotspot_text ? <div>{sanitizeBarrierText(selectedCandidate.accident_hotspot_text)}</div> : null}
            {selectedCandidate.redev_warning_text ? <div>{selectedCandidate.redev_warning_text}</div> : null}
          </div>
          {internalCandidate ? (
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 14, background: "rgba(16, 185, 129, 0.10)", color: SIM_COLORS.greenSoft, fontSize: 13, lineHeight: 1.7 }}>
              교내 설치 대안도 유지됩니다. 필요하면 지도에서 `교내` 마커를 선택해 수혜 규모를 함께 비교할 수 있습니다.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
  background,
}: {
  label: string;
  value: string;
  tone: string;
  background: string;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        ...SIM_INSET,
        background,
        minWidth: 132,
      }}
    >
      <div style={{ fontSize: 11, color: SIM_COLORS.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: tone }}>{value}</div>
    </div>
  );
}

function LegendItem({
  color,
  shape,
  label,
}: {
  color: string;
  shape: "circle" | "diamond";
  label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: SIM_COLORS.muted }}>
      {shape === "diamond" ? (
        <svg width={12} height={12}>
          <rect x={1} y={1} width={10} height={10} rx={1} fill={color} transform="rotate(45 6 6)" />
        </svg>
      ) : (
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: `2px solid ${color}`,
          }}
        />
      )}
      {label}
    </div>
  );
}
