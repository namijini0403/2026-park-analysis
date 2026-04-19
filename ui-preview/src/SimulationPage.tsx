import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import KakaoMap, { CandidateMarker, CandidateRouteLine } from "./KakaoMap";

const LETTERS = "ABCDEFGHIJ".split("");
const BARRIER_KEYS = ["motorway", "trunk", "primary", "secondary", "tertiary"] as const;

type BarrierKey = (typeof BARRIER_KEYS)[number];

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
  has_large_apt?: boolean;
  redev_flag?: boolean;
  redev_level?: string;
  redev_warning_text?: string;
  accident_hotspot_flag?: boolean;
  accident_hotspot_text?: string;
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

type ScoredCandidate = Candidate & {
  final_score: number;
  benefit_score: number;
  school_distance_score: number;
  facility_gap_score: number;
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

const BARRIER_COLOR: Record<NonNullable<Candidate["barrier_severity"]>, string> = {
  green: "#2E8B57",
  yellow: "#D4A017",
  orange: "#E67E22",
  red: "#C0392B",
};

const FILTER_COPY: Array<{ key: keyof FilterState; title: string; description: string }> = [
  { key: "excludePrimary", title: "?꾩떆 ?濡??〓떒 ?꾨낫 ?쒖쇅", description: "?숆탳?먯꽌 ?꾨낫吏濡?媛??理쒕떒 寃쎈줈???꾩떆 ?濡??〓떒??1???댁긽 ?덉쑝硫??쒖쇅?⑸땲??" },
  { key: "excludeSecondary", title: "以묎컙湲??꾨줈 ?〓떒 ?꾨낫 ?쒖쇅", description: "?숆탳?먯꽌 ?꾨낫吏濡?媛??理쒕떒 寃쎈줈??以묎컙湲??꾨줈 ?〓떒??1???댁긽 ?덉쑝硫??쒖쇅?⑸땲??" },
  { key: "excludeTertiary", title: "?쇰컲 ?꾨줈 ?〓떒 ?꾨낫 ?쒖쇅", description: "?숆탳?먯꽌 ?꾨낫吏濡?媛??理쒕떒 寃쎈줈???쇰컲 ?꾨줈 ?〓떒??1???댁긽 ?덉쑝硫??쒖쇅?⑸땲??" },
  { key: "excludeAccident", title: "?ш퀬?ㅻ컻吏??寃쎌쑀 ?꾨낫 ?쒖쇅", description: "?ш퀬?ㅻ컻吏??buffer 寃쎌쑀 ?뺣낫媛 ?덉쑝硫??대떦 ?꾨낫瑜??쒖쇅?⑸땲??" },
  { key: "excludeRedev", title: "?ш컻諛??곹뼢沅??꾨낫 ?쒖쇅", description: "?ш컻諛??곹뼢沅뚯뿉 ?ы븿???꾨낫吏瑜??쒖쇅?⑸땲??" },
  { key: "excludeLargeApt", title: "500?몃? ?댁긽 ??⑥? ?멸렐 ?꾨낫 ?쒖쇅", description: "??⑥? ?멸렐 ?꾨낫吏瑜??쒖쇅?⑸땲??" },
];

const WEIGHT_COPY: Array<{ key: keyof WeightState; title: string; description: string }> = [
  { key: "benefit", title: "잠재수혜학생수", description: "보행권 안 잠재수요가 높을수록 가점을 줍니다." },
  { key: "schoolDistance", title: "학교에서의 거리", description: "학교와 가까울수록 가점을 줍니다." },
  { key: "parkDistance", title: "기존 공원과의 거리", description: "기존 공원과 멀수록 가점을 줍니다." },
];

function rankBadgeStyle(index: number): { color: string; bg: string } {
  if (index === 0) return { color: "#c0392b", bg: "#fdecea" };
  if (index === 1) return { color: "#d35400", bg: "#fef0e6" };
  if (index === 2) return { color: "#b7770d", bg: "#fef9e3" };
  return { color: "#6b7280", bg: "#f3f4f6" };
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
  if (!Number.isFinite(value) || value >= 9999) return "?뺣낫 ?놁쓬";
  return `${Math.round(value).toLocaleString("ko-KR")}m`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
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
  if (candidate.is_school_internal) return "#2980b9";
  return candidate.barrier_color ?? BARRIER_COLOR[getBarrierSeverity(candidate)];
}

function getBarrierLabel(candidate: Candidate): string {
  if (candidate.is_school_internal) return "학교 내부 설치";
  return candidate.barrier_severity_label ?? "경로 정보 준비 중";
}

function getBarrierNote(candidate: Candidate): string {
  if (candidate.is_school_internal) {
    return "학교 안에 바로 설치하는 대안입니다. 별도 도로 횡단 없이 곧바로 이용할 수 있는 옵션으로 해석합니다.";
  }
  return candidate.barrier_note ?? "경로 정보가 아직 연결되지 않은 후보지입니다.";
}

function getBarrierCountSummary(candidate: Candidate): string {
  if (candidate.is_school_internal) return "?숆탳 ?대? ?ㅼ튂 ?꾨낫";
  const counts = getBarrierCounts(candidate);
  const parts: string[] = [];
  if (counts.motorway > 0) parts.push(`怨좎냽?꾨줈 ${counts.motorway}???〓떒`);
  if (counts.trunk > 0) parts.push(`?먮룞李??꾩슜 媛꾩꽑 ${counts.trunk}???〓떒`);
  if (counts.primary > 0) parts.push(`?꾩떆 ?濡?${counts.primary}???〓떒`);
  if (counts.secondary > 0) parts.push(`以묎컙湲??꾨줈 ${counts.secondary}???〓떒`);
  if (counts.tertiary > 0) parts.push(`?쇰컲 ?꾨줈 ${counts.tertiary}???〓떒`);
  return parts.length ? parts.join(" / ") : "???꾨줈 ?〓떒 ?놁쓬";
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

function computeAiRecommendations(candidates: Candidate[]): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const demandScores = minmaxScore(candidates.map((candidate) => candidate.walkshed_potential_2029));
  const schoolDistanceScores = minmaxScore(candidates.map((candidate) => candidate.nearest_school_dist), true);
  const parkGapScores = minmaxScore(candidates.map((candidate) => candidate.nearest_park_dist));

  const playgroundDistances = candidates.map((candidate) => candidate.nearest_pg_dist).sort((left, right) => left - right);
  const playgroundCap =
    playgroundDistances[Math.floor(playgroundDistances.length * 0.95)] ??
    playgroundDistances[playgroundDistances.length - 1] ??
    0;
  const playgroundGapScores = minmaxScore(
    candidates.map((candidate) => Math.min(candidate.nearest_pg_dist, playgroundCap)),
  );

  return candidates
    .map((candidate, index) => {
      const finalScore =
        demandScores[index] * 0.35 +
        schoolDistanceScores[index] * 0.3 +
        parkGapScores[index] * 0.25 +
        playgroundGapScores[index] * 0.1;

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

function getCandidateDistanceLabel(candidate: Candidate): string {
  if (candidate.fallback_candidate && candidate.fallback_distance_basis === "straight_line_m") {
    return "?숆탳 吏곸꽑嫄곕━(李멸퀬)";
  }
  return "?숆탳 寃쎈줈嫄곕━";
}

function buildFilterReasonSummary(filters: FilterState): string[] {
  const summaries: string[] = [];
  if (filters.excludePrimary) summaries.push("?꾩떆 ?濡??〓떒 ?꾨낫 ?쒖쇅");
  if (filters.excludeSecondary) summaries.push("以묎컙湲??꾨줈 ?〓떒 ?꾨낫 ?쒖쇅");
  if (filters.excludeTertiary) summaries.push("?쇰컲 ?꾨줈 ?〓떒 ?꾨낫 ?쒖쇅");
  if (filters.excludeAccident) summaries.push("?ш퀬?ㅻ컻吏??寃쎌쑀 ?꾨낫 ?쒖쇅");
  if (filters.excludeRedev) summaries.push("?ш컻諛??곹뼢沅??꾨낫 ?쒖쇅");
  if (filters.excludeLargeApt) summaries.push("500?몃? ?댁긽 ??⑥? ?멸렐 ?꾨낫 ?쒖쇅");
  return summaries;
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
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [weights, setWeights] = useState<WeightState>(DEFAULT_WEIGHTS);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const internalCandidate = useMemo(
    () => candidates.find((candidate) => candidate.is_school_internal),
    [candidates],
  );

  const externalCandidates = useMemo(
    () => candidates.filter((candidate) => !candidate.is_school_internal),
    [candidates],
  );

  const filteredCandidates = useMemo(
    () => externalCandidates.filter((candidate) => passesFilters(candidate, filters)),
    [externalCandidates, filters],
  );
  const candidateLabelMap = useMemo(() => {
    return new Map(
      externalCandidates.map((candidate, index) => [candidate.grid_id, getStableCandidateLabel(index)] as const),
    );
  }, [externalCandidates]);

  const rankedCandidates = useMemo(
    () => scoreCandidates(filteredCandidates, weights),
    [filteredCandidates, weights],
  );
  const aiRecommendations = useMemo(
    () => computeAiRecommendations(filteredCandidates).slice(0, 3),
    [filteredCandidates],
  );

  const normalizedWeights = useMemo(() => normalizeWeights(weights), [weights]);
  const filterSummary = useMemo(() => buildFilterReasonSummary(filters), [filters]);

  useEffect(() => {
    setSelected((previous) => {
      const allowed = new Set<string>();
      if (internalCandidate) allowed.add(internalCandidate.grid_id);
      rankedCandidates.forEach((candidate) => allowed.add(candidate.grid_id));

      const next = new Set<string>();
      previous.forEach((id) => {
        if (allowed.has(id)) next.add(id);
      });
      return next;
    });
  }, [internalCandidate, rankedCandidates]);

  const toggleSelect = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mapMarkers = useMemo((): CandidateMarker[] => {
    const markers: CandidateMarker[] = [
      {
        id: "SCHOOL",
        lat: schoolLat,
        lng: schoolLng,
        label: "?숆탳",
        color: "#1a1a2e",
        isSchool: true,
      },
    ];

    if (internalCandidate) {
      markers.push({
        id: internalCandidate.grid_id,
        lat: schoolLat + 0.00027,
        lng: schoolLng - 0.00035,
        label: "援먮궡",
        color: "#2980b9",
        isInternal: true,
      });
    }

    rankedCandidates.slice(0, 10).forEach((candidate, index) => {
      markers.push({
        id: candidate.grid_id,
        lat: candidate.cy,
        lng: candidate.cx,
        label: candidateLabelMap.get(candidate.grid_id) ?? getStableCandidateLabel(index),
        color: getBarrierColor(candidate),
      });
    });

    return markers;
  }, [candidateLabelMap, internalCandidate, rankedCandidates, schoolLat, schoolLng]);

  const routeLines = useMemo((): CandidateRouteLine[] => {
    return rankedCandidates
      .filter((candidate) => selected.has(candidate.grid_id))
      .filter((candidate) => Array.isArray(candidate.route_coords) && candidate.route_coords.length >= 2)
      .map((candidate) => ({
        id: candidate.grid_id,
        path: candidate.route_coords as Array<[number, number]>,
        color: getBarrierColor(candidate),
      }));
  }, [rankedCandidates, selected]);

  const selectedCandidates = useMemo(() => {
    const byId = new Map<string, Candidate>();
    if (internalCandidate) byId.set(internalCandidate.grid_id, internalCandidate);
    rankedCandidates.forEach((candidate) => byId.set(candidate.grid_id, candidate));
    return Array.from(selected).map((id) => byId.get(id)).filter(Boolean) as Candidate[];
  }, [internalCandidate, rankedCandidates, selected]);

  const totalDemand2029 = selectedCandidates.reduce((sum, candidate) => sum + candidate.walkshed_potential_2029, 0);
  const totalDemand2031 = selectedCandidates.reduce((sum, candidate) => sum + candidate.walkshed_potential_2031, 0);

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
          border: "1px solid #d1d5db",
          cursor: "pointer",
          background: "#fff",
          color: "#374151",
          fontWeight: 600,
        }}
      >
        由ы룷?몃줈 ?뚯븘媛湲?      </button>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#9ca3af", marginBottom: 6 }}>
          HUMAN-IN-THE-LOOP SIMULATION
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#111827" }}>{schoolName}</h1>
        <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              display: "inline-flex",
              padding: "4px 10px",
              borderRadius: 999,
              background: "#111827",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {casePolicyLabel}
          </span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            湲곗? 醫뚰몴 {schoolLat.toFixed(5)}, {schoolLng.toFixed(5)}
          </span>
        </div>
      </div>

      <div
        style={{
          marginBottom: 22,
          padding: "18px 20px",
          borderRadius: 18,
          background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)",
          border: "1px solid #fed7aa",
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
          ?뚰뵾 議곌굔? ?꾪꽣濡? ?곗꽑?쒖쐞???щ씪?대뜑濡??섎닠??遊낅땲??        </div>
        <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.75 }}>
          ?뚰뵾?섍퀬 ?띠? 議곌굔? ?꾪꽣濡??쒖쇅?섍퀬, 以묒슂?섍쾶 蹂닿퀬 ?띠? 湲곗?? ?щ씪?대뜑濡?議곗젅?섏꽭??
          AI媛 ?먮룞?쇰줈 寃곗젙???대━??寃껋씠 ?꾨땲?? ?ъ슜?먯쓽 ?먮떒 湲곗???諛섏쁺???곗꽑?쒖쐞瑜?怨꾩궛?⑸땲??
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 420px) minmax(0, 1fr)", gap: 22, alignItems: "start" }}>
        <div>
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
              border: "1px solid #bfdbfe",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1d4ed8", marginBottom: 4 }}>AI 異붿쿇</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                  ?꾩옱 ?쒖쇅 議곌굔???듦낵???꾨낫 以?AI媛 李멸퀬???곗꽑?쒖쐞瑜?癒쇱? ?쒖븞?⑸땲??                </div>
              </div>
              <span
                style={{
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                李멸퀬???먮룞 異붿쿇
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, marginBottom: 12 }}>
              ?좎옱?섑삙?숈깮?? ?숆탳 ?묎렐?? 湲곗〈 怨듭썝怨???댄꽣 怨듬갚???④퍡 蹂?湲곗큹 異붿쿇?낅땲??
              理쒖쥌 ?곗꽑?쒖쐞???꾨옒 ?꾪꽣? ?щ씪?대뜑?먯꽌 吏곸젒 議곗젙?????덉뒿?덈떎.
            </div>
            {aiRecommendations.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {aiRecommendations.map((candidate, index) => {
                  const badge = rankBadgeStyle(index);
                  const barrierColor = getBarrierColor(candidate);
                  const fixedLabel = candidateLabelMap.get(candidate.grid_id) ?? "-";
                  return (
                    <div
                      key={"ai-" + candidate.grid_id}
                      onClick={() => toggleSelect(candidate.grid_id)}
                      style={{
                        borderRadius: 14,
                        border: "1px solid #dbeafe",
                        background: "#ffffff",
                        padding: "12px 14px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: badge.bg,
                            color: badge.color,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          AI 추천 {index + 1}
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#e5e7eb",
                            color: "#111827",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          위치 {fixedLabel}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{candidate.grid_id}</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: barrierColor + "18",
                            color: barrierColor,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {getBarrierLabel(candidate)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: 8,
                          fontSize: 12,
                          color: "#374151",
                          lineHeight: 1.6,
                        }}
                      >
                        <div style={{ padding: "8px 10px", borderRadius: 10, background: "#f8fafc" }}>
                          2029 잠재수요 <b>{formatCount(candidate.walkshed_potential_2029)}명</b>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 10, background: "#f8fafc" }}>
                          학교 거리 <b>{formatDistance(candidate.nearest_school_dist)}</b>
                        </div>
                        <div style={{ padding: "8px 10px", borderRadius: 10, background: "#f8fafc" }}>
                          기존 공원 거리 <b>{formatDistance(candidate.nearest_park_dist)}</b>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  border: "1px dashed #bfdbfe",
                  borderRadius: 14,
                  padding: "14px 16px",
                  background: "#f8fbff",
                  fontSize: 13,
                  color: "#4b5563",
                  lineHeight: 1.7,
                }}
              >
                ?꾩옱 ?쒖쇅 議곌굔???듦낵???몃? ?꾨낫媛 ?놁뼱 AI 異붿쿇???쒖떆?????놁뒿?덈떎.
              </div>
            )}
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e5e7eb",
              marginBottom: 18,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", marginBottom: 8 }}>후보지 경로 지도</div>
            <KakaoMap
              center={{ lat: schoolLat, lng: schoolLng }}
              markers={mapMarkers}
              routes={routeLines}
              selected={selected}
              onToggle={toggleSelect}
              height={340}
            />
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <LegendItem color="#1a1a2e" shape="diamond" label="학교" />
              <LegendItem color="#2980b9" shape="circle" label="학교 내부 설치" />
              <LegendItem color="#2E8B57" shape="circle" label="큰 도로 횡단 없음" />
              <LegendItem color="#D4A017" shape="circle" label="중간급 도로 포함" />
              <LegendItem color="#E67E22" shape="circle" label="도시 대로 포함" />
              <LegendItem color="#C0392B" shape="circle" label="간선·고속도로 포함" />
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
              후보지 점 색은 학교에서 후보지까지 가는 최단 경로에서 나타나는 최고 횡단 부담 등급을 뜻합니다.
              후보지를 선택하면 같은 색 계열의 경로가 함께 강조됩니다.
            </div>
          </div>

          {selected.size > 0 ? (
            <div
              style={{
                padding: 20,
                borderRadius: 18,
                background: "#111827",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 13, color: "#cbd5e1", marginBottom: 8 }}>
                선택한 후보지 {selectedCandidates.length}곳 요약
              </div>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>2029 잠재수요인원</div>
                  <div style={{ fontSize: 34, fontWeight: 800 }}>
                    {formatCount(totalDemand2029)}
                    <span style={{ fontSize: 16, marginLeft: 4 }}>명</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>2031 잠재수요인원</div>
                  <div style={{ fontSize: 34, fontWeight: 800 }}>
                    {formatCount(totalDemand2031)}
                    <span style={{ fontSize: 16, marginLeft: 4 }}>명</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={88}>
                <BarChart
                  data={[
                    { name: "2029", value: totalDemand2029 },
                    { name: "2031", value: totalDemand2031 },
                  ]}
                  layout="vertical"
                >
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={40} tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => [formatCount(value) + "명", "잠재수요인원"]} />
                  <Bar dataKey="value" fill="#4ecdc4" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </div>

        <div>
          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e5e7eb",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 12 }}>?쒖쇅 議곌굔 ?ㅼ젙</div>
            <div style={{ display: "grid", gap: 10 }}>
              {FILTER_COPY.map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "12px 14px",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: filters[item.key] ? "#fff7ed" : "#f9fafb",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={filters[item.key]}
                    onChange={() =>
                      setFilters((previous) => ({
                        ...previous,
                        [item.key]: !previous[item.key],
                      }))
                    }
                    style={{ marginTop: 2 }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{item.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e5e7eb",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 12 }}>우선순위 기준 설정</div>
            <div style={{ display: "grid", gap: 16 }}>
              {WEIGHT_COPY.map((item) => (
                <div key={item.key} style={{ padding: "12px 14px", borderRadius: 14, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 6, alignItems: "center" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{item.title}</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#ea580c" }}>
                      {formatPercent(normalizedWeights[item.key])}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6, marginBottom: 10 }}>{item.description}</div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={weights[item.key]}
                    onChange={(event) =>
                      setWeights((previous) => ({
                        ...previous,
                        [item.key]: Number(event.target.value),
                      }))
                    }
                    style={{ width: "100%" }}
                  />
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    원본 레버 값 {weights[item.key]}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              padding: 18,
              borderRadius: 18,
              background: "#fff",
              border: "1px solid #e5e7eb",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 10 }}>계산 결과</div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
              <MetricPill label="전체 후보" value={String(externalCandidates.length) + "곳"} tone="#1f2937" background="#f3f4f6" />
              <MetricPill label="필터 통과 후보" value={String(rankedCandidates.length) + "곳"} tone="#065f46" background="#ecfdf5" />
              <MetricPill label="제외된 후보" value={String(externalCandidates.length - rankedCandidates.length) + "곳"} tone="#9a3412" background="#fff7ed" />
            </div>
            <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7 }}>
              필터를 먼저 적용한 뒤, 남은 후보에 대해서만 잠재수요, 학교 거리, 기존 공원과의 거리를 정규화해 종합점수를 계산합니다.
              도로 횡단, 사고다발지역, 재개발, 대단지 조건은 점수에 넣지 않고 필터에서만 반영합니다.
            </div>
            {filterSummary.length ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                {filterSummary.map((item) => (
                  <span
                    key={item}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 999,
                      background: "#fff7ed",
                      color: "#c2410c",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
            {caseType === 4 ? (
              <div
                style={{
                  marginTop: 14,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "#eff6ff",
                  color: "#1e3a8a",
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                현재 학교는 절대 취약형(case 4)으로 분류되어 있어, 교내 설치안과 외부 후보지를 함께 비교해 보는 것이 좋습니다.
              </div>
            ) : null}
          </div>

          {internalCandidate ? (
            <div
              onClick={() => toggleSelect(internalCandidate.grid_id)}
              style={{
                padding: "14px 16px",
                borderRadius: 16,
                border: "2px solid",
                borderColor: selected.has(internalCandidate.grid_id) ? "#2980b9" : "#bfdbfe",
                background: selected.has(internalCandidate.grid_id) ? "#eff6ff" : "#f8fbff",
                cursor: "pointer",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>학교 내부 설치 대안</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{getBarrierNote(internalCandidate)}</div>
                </div>
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "#dbeafe",
                    color: "#1d4ed8",
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  학교 내부
                </span>
              </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, color: "#374151" }}>
                  <span>2029 기준 {formatCount(internalCandidate.walkshed_potential_2029)}명</span>
                  <span>2031 기준 {formatCount(internalCandidate.walkshed_potential_2031)}명</span>
                </div>
            </div>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rankedCandidates.slice(0, 10).map((candidate, index) => {
              const label = candidateLabelMap.get(candidate.grid_id) ?? getStableCandidateLabel(index);
              const barrierColor = getBarrierColor(candidate);
              const isSelected = selected.has(candidate.grid_id);
              const style = rankBadgeStyle(index);
              const chips: string[] = [];
              if (hasRedevelopmentRisk(candidate)) chips.push("재개발 영향권");
              if (hasLargeAptNearby(candidate)) chips.push("500세대 이상 대단지 인근");
              if (hasAccidentHotspot(candidate)) chips.push("사고다발지역 경유");

              return (
                <div
                  key={candidate.grid_id}
                  onClick={() => toggleSelect(candidate.grid_id)}
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: "2px solid",
                    borderColor: isSelected ? "#111827" : "#e5e7eb",
                    background: isSelected ? "#f8fafc" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", gap: 14 }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: "2.5px solid " + barrierColor,
                        background: isSelected ? barrierColor : "#fff",
                        color: isSelected ? "#fff" : barrierColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{candidate.grid_id}</span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: "#e5e7eb",
                            color: "#111827",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          위치 {label}
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: style.bg,
                            color: style.color,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          현재 순위 {index + 1}
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            background: barrierColor + "18",
                            color: barrierColor,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {getBarrierLabel(candidate)}
                        </span>
                        {candidate.fallback_candidate ? (
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            생활권 외 보조 후보
                          </span>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                          gap: 8,
                          fontSize: 12,
                          color: "#374151",
                        }}
                      >
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          인근 거주 2029 <b>{formatCount(candidate.resident_children_2029)}명</b>
                        </div>
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          인근 거주 2031 <b>{formatCount(candidate.resident_children_2031)}명</b>
                        </div>
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          잠재수요 2029 <b>{formatCount(candidate.walkshed_potential_2029)}명</b>
                        </div>
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          잠재수요 2031 <b>{formatCount(candidate.walkshed_potential_2031)}명</b>
                        </div>
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          {getCandidateDistanceLabel(candidate)} <b>{formatDistance(candidate.nearest_school_dist)}</b>
                        </div>
                        <div style={{ padding: "9px 10px", borderRadius: 12, background: "#f8fafc" }}>
                          기존 공원 거리 <b>{formatDistance(candidate.nearest_park_dist)}</b>
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: barrierColor }}>
                        {getBarrierCountSummary(candidate)}
                      </div>

                      {chips.length ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                          {chips.map((chip) => (
                            <span
                              key={chip}
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "#fff7ed",
                                color: "#9a3412",
                                fontSize: 11,
                                fontWeight: 700,
                              }}
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div
                        style={{
                          marginTop: 10,
                          padding: "10px 12px",
                          borderRadius: 12,
                          background: isSelected ? "#eef2ff" : "#f9fafb",
                          fontSize: 12,
                          color: "#4b5563",
                          lineHeight: 1.7,
                        }}
                      >
                        <div style={{ marginBottom: 4, fontWeight: 800, color: "#111827" }}>
                          종합점수 {candidate.final_score.toFixed(3)}
                        </div>
                        <div>
                          잠재수요 {candidate.benefit_score.toFixed(2)} × {formatPercent(normalizedWeights.benefit)} /
                          학교 거리 {candidate.school_distance_score.toFixed(2)} × {formatPercent(normalizedWeights.schoolDistance)} /
                          기존 공원 거리 {candidate.facility_gap_score.toFixed(2)} × {formatPercent(normalizedWeights.parkDistance)}
                        </div>
                        <div style={{ marginTop: 4 }}>{getBarrierNote(candidate)}</div>
                        {candidate.accident_hotspot_text ? <div style={{ marginTop: 4 }}>{candidate.accident_hotspot_text}</div> : null}
                        {candidate.redev_warning_text ? <div style={{ marginTop: 4 }}>{candidate.redev_warning_text}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {rankedCandidates.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #d1d5db",
                  borderRadius: 16,
                  padding: "18px 20px",
                  background: "#fafafa",
                  fontSize: 13,
                  color: "#6b7280",
                  lineHeight: 1.7,
                }}
              >
                현재 제외 조건을 모두 만족하는 후보지가 없습니다. 필터를 일부 완화하면 다시 비교할 수 있습니다.
              </div>
            ) : null}
          </div>

          {(redevelopmentProjects.length > 0 || largeApartmentComplexes.length > 0) && (
            <div
              style={{
                marginTop: 18,
                padding: 18,
                borderRadius: 18,
                background: "#fff",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#9a3412", marginBottom: 6 }}>참고할 주변 맥락</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 10 }}>
                후보지 판단 전에 같이 봐야 할 생활권 변화 요인
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 14 }}>
                아래 정보는 점수에는 직접 반영하지 않지만, 회피 여부를 판단할 때 함께 참고할 수 있는 배경 정보입니다.
              </div>

              {largeApartmentComplexes.length > 0 ? (
                <div style={{ marginBottom: redevelopmentProjects.length > 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                    인근 500세대 이상 대단지
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {largeApartmentComplexes.map((complex, index) => (
                      <div
                        key={complex.name + "-" + index}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: "12px 14px",
                          background: "#f8fafc",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{complex.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{complex.distanceM.toLocaleString()}m</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              fontWeight: 700,
                            }}
                          >
                            {complex.householdCount.toLocaleString()}세대
                          </span>
                          {complex.address ? <span style={{ color: "#6b7280" }}>{complex.address}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {redevelopmentProjects.length > 0 ? (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                    인근 재개발 정비사업
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {redevelopmentProjects.map((project, index) => (
                      <div
                        key={project.name + "-" + index}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: 12,
                          padding: "12px 14px",
                          background: "#fafafa",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{project.name}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{project.distanceM.toLocaleString()}m</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                          <span
                            style={{
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#fff7ed",
                              color: "#c2410c",
                              fontWeight: 700,
                            }}
                          >
                            {project.stage || "단계 정보 없음"}
                          </span>
                          {project.type ? (
                            <span
                              style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                fontWeight: 700,
                              }}
                            >
                              {project.type}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
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
        background,
        minWidth: 132,
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" }}>
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
            border: "2px solid " + color,
          }}
        />
      )}
      {label}
    </div>
  );
}
