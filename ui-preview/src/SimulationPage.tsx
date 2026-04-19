import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import KakaoMap, { CandidateMarker, CandidateRouteLine } from "./KakaoMap";

const LETTERS = "ABCDEFGHIJ".split("");

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
  barrier_counts?: Record<"motorway" | "trunk" | "primary" | "secondary" | "tertiary", number>;
  barrier_severity?: "green" | "yellow" | "orange" | "red";
  barrier_severity_label?: string;
  barrier_color?: string;
  barrier_note?: string;
  route_length_m?: number;
  route_coords?: Array<[number, number]>;
  fallback_candidate?: boolean;
  fallback_distance_basis?: string;
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

type FilterMode = "ai" | "manual";
type ManualFilter = "demand" | "park" | "school" | "playground";
type BarrierFilter = "green" | "yellow_or_less" | "orange_or_less" | "all";

function rankBadgeStyle(i: number): { color: string; bg: string } {
  if (i === 0) return { color: "#c0392b", bg: "#fdecea" };
  if (i === 1) return { color: "#d35400", bg: "#fef0e6" };
  if (i === 2) return { color: "#b7770d", bg: "#fef9e3" };
  return { color: "#7f8c8d", bg: "#f4f4f4" };
}

const BARRIER_COLOR: Record<NonNullable<Candidate["barrier_severity"]>, string> = {
  green: "#2E8B57",
  yellow: "#D4A017",
  orange: "#E67E22",
  red: "#C0392B",
};

function barrierRank(severity: Candidate["barrier_severity"]): number {
  if (severity === "red") return 3;
  if (severity === "orange") return 2;
  if (severity === "yellow") return 1;
  return 0;
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
    return candidate.barrier_note ?? "학교 내부 설치 후보지로, 공원까지 이동 경로 단절성보다 학교 안 설치 가능성을 우선 검토합니다.";
  }
  return candidate.barrier_note ?? "후보지까지의 도로 단절 정보는 현재 준비 중입니다.";
}

function getBarrierCountSummary(candidate: Candidate): string | null {
  if (candidate.is_school_internal || !candidate.barrier_counts) return null;

  const parts: string[] = [];
  const counts = candidate.barrier_counts;
  if ((counts.motorway ?? 0) > 0) parts.push(`고속도로 ${counts.motorway}회`);
  if ((counts.trunk ?? 0) > 0) parts.push(`자동차 전용 간선도로 ${counts.trunk}회`);
  if ((counts.primary ?? 0) > 0) parts.push(`도시 대로 ${counts.primary}회`);
  if ((counts.secondary ?? 0) > 0) parts.push(`중간급 도로 ${counts.secondary}회`);
  if ((counts.tertiary ?? 0) > 0 && parts.length === 0) parts.push("생활도로 있음");

  return parts.length ? parts.join(" / ") : null;
}

function getCandidateDistanceLabel(candidate: Candidate): string {
  if (candidate.fallback_candidate && candidate.fallback_distance_basis === "straight_line_m") {
    return "학교 직선거리(참고)";
  }
  return "학교 거리";
}

function matchesBarrierFilter(candidate: Candidate, filter: BarrierFilter): boolean {
  if (candidate.is_school_internal) return true;
  const rank = barrierRank(getBarrierSeverity(candidate));
  if (filter === "green") return rank === 0;
  if (filter === "yellow_or_less") return rank <= 1;
  if (filter === "orange_or_less") return rank <= 2;
  return true;
}

function minmax(arr: number[]): number[] {
  const mn = Math.min(...arr);
  const mx = Math.max(...arr);
  if (mx === mn) return arr.map(() => 0.5);
  return arr.map((v) => (v - mn) / (mx - mn));
}

function formatRoundedCount(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function computeAiScores(candidates: Candidate[]): Candidate[] {
  if (candidates.length === 0) return [];
  const internal = candidates.filter((c) => c.is_school_internal);
  const external = candidates.filter((c) => !c.is_school_internal && c.walkshed_potential_2029 >= 200);
  if (external.length === 0) return [...internal, ...candidates.filter((c) => !c.is_school_internal)];

  const sortedPg = [...external.map((c) => c.nearest_pg_dist)].sort((a, b) => a - b);
  const pgCap = sortedPg[Math.floor(external.length * 0.95)] ?? sortedPg[sortedPg.length - 1] ?? 0;

  const sDemand = minmax(external.map((c) => c.walkshed_potential_2029));
  const sPark = minmax(external.map((c) => c.nearest_park_dist));
  const sSchool = minmax(external.map((c) => c.nearest_school_dist)).map((v) => 1 - v);
  const sPg = minmax(external.map((c) => Math.min(c.nearest_pg_dist, pgCap)));

  const scored = external
    .map((c, i) => ({
      ...c,
      ai_score: sDemand[i] * 0.3 + sPark[i] * 0.3 + sSchool[i] * 0.3 + sPg[i] * 0.1,
    }))
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  return [...internal, ...scored];
}

function computeManualScores(
  candidates: Candidate[],
  filters: Record<ManualFilter, boolean>
): Candidate[] {
  const internal = candidates.filter((c) => c.is_school_internal);
  const external = candidates.filter((c) => !c.is_school_internal);

  const active = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k]) => k as ManualFilter);
  if (active.length === 0) return [...internal, ...external];

  const scoreMap: Record<ManualFilter, number[]> = {
    demand: minmax(external.map((c) => c.walkshed_potential_2029)),
    park: minmax(external.map((c) => c.nearest_park_dist)),
    school: minmax(external.map((c) => c.nearest_school_dist)).map((v) => 1 - v),
    playground: minmax(external.map((c) => c.nearest_pg_dist)),
  };

  const weight = 1 / active.length;
  const scored = [...external]
    .map((c, i) => ({
      ...c,
      ai_score: active.reduce((sum, f) => sum + scoreMap[f][i] * weight, 0),
    }))
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0));

  return [...internal, ...scored];
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
  const [mode, setMode] = useState<FilterMode>("ai");
  const [manualFilters, setManualFilters] = useState<Record<ManualFilter, boolean>>({
    demand: true,
    park: true,
    school: true,
    playground: false,
  });
  const [barrierFilter, setBarrierFilter] = useState<BarrierFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ranked, setRanked] = useState<Candidate[]>([]);

  // 순위 재계산: 모드·필터·후보지 바뀔 때마다
  useEffect(() => {
    if (mode === "ai") {
      setRanked(computeAiScores(candidates));
    } else {
      setRanked(computeManualScores(candidates, manualFilters));
    }
  }, [mode, manualFilters, candidates]);

  // 선택 초기화: 모드 전환 또는 후보지 목록 자체가 바뀔 때만
  useEffect(() => {
    setSelected(new Set());
  }, [mode, candidates, barrierFilter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const internalCandidate = ranked.find((c) => c.is_school_internal);
  const externalRanked = ranked.filter((c) => !c.is_school_internal);
  const visibleExternalRanked = externalRanked.filter((candidate) => matchesBarrierFilter(candidate, barrierFilter));

  // 카카오맵 마커 목록 (ranked 순서 바뀌면 레이블도 재생성)
  const mapMarkers = useMemo((): CandidateMarker[] => {
    const intCand = ranked.find((c) => c.is_school_internal);
    const extRanked = ranked.filter((c) => !c.is_school_internal).filter((candidate) => matchesBarrierFilter(candidate, barrierFilter));

    const result: CandidateMarker[] = [
      // 학교 마커
      {
        id: "SCHOOL",
        lat: schoolLat,
        lng: schoolLng,
        label: "학교",
        color: "#1a1a2e",
        isSchool: true,
      },
    ];

    // 교내 설치 마커 (학교에서 약 30m 북쪽 오프셋 → 겹치지 않게)
    if (intCand) {
      result.push({
        id: intCand.grid_id,
        lat: schoolLat + 0.00027,
        lng: schoolLng - 0.00035,
        label: "교내",
        color: "#2980b9",
        isInternal: true,
      });
    }

    // 외부 후보지 A, B, C...
    extRanked.slice(0, 10).forEach((c, i) => {
      result.push({
        id: c.grid_id,
        lat: c.cy,
        lng: c.cx,
        label: LETTERS[i] ?? String(i + 1),
        color: getBarrierColor(c),
      });
    });

    return result;
  }, [barrierFilter, ranked, schoolLat, schoolLng]);

  const routeLines = useMemo((): CandidateRouteLine[] => {
    return ranked
      .filter((candidate) => selected.has(candidate.grid_id) && !candidate.is_school_internal)
      .filter((candidate) => matchesBarrierFilter(candidate, barrierFilter))
      .filter((candidate) => Array.isArray(candidate.route_coords) && candidate.route_coords.length >= 2)
      .map((candidate) => ({
        id: candidate.grid_id,
        path: candidate.route_coords as Array<[number, number]>,
        color: getBarrierColor(candidate),
      }));
  }, [barrierFilter, ranked, selected]);

  const selectedCandidates = ranked.filter((c) => selected.has(c.grid_id) && matchesBarrierFilter(c, barrierFilter));
  const totalDemand2029 = selectedCandidates.reduce((sum, c) => sum + c.walkshed_potential_2029, 0);
  const totalDemand2031 = selectedCandidates.reduce((sum, c) => sum + c.walkshed_potential_2031, 0);

  const filterLabels: Record<ManualFilter, string> = {
    demand: "잠재수요 높은 순",
    park: "공원 공백 우선",
    school: "학교 접근성 우선",
    playground: "놀이터 공백 우선",
  };

  const barrierFilterLabels: Record<BarrierFilter, string> = {
    green: "큰 도로 횡단 없음",
    yellow_or_less: "중간급 도로까지 허용",
    orange_or_less: "도시 대로까지 허용",
    all: "모든 후보 보기",
  };

  return (
    <div
      style={{
        fontFamily: "Pretendard, sans-serif",
        maxWidth: 1050,
        margin: "0 auto",
        padding: "24px 32px",
      }}
    >
      {/* 뒤로 가기 */}
      <button
        onClick={onBack}
        style={{
          marginBottom: 16,
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid #ddd",
          cursor: "pointer",
          background: "#fff",
        }}
      >
        ← 리포트로 돌아가기
      </button>

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>SIMULATION</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{schoolName}</h1>
        <div style={{ marginTop: 6, fontSize: 12, color: "#999" }}>
          기준 좌표 {schoolLat.toFixed(5)}, {schoolLng.toFixed(5)}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 6,
            padding: "3px 10px",
            borderRadius: 20,
            background: "#e74c3c",
            color: "#fff",
            fontSize: 12,
          }}
        >
          {casePolicyLabel}
        </span>
      </div>

      {/* 지도 + 목록 2컬럼 */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* ── 카카오 지도 ─────────────────────────── */}
        <div style={{ flexShrink: 0, width: 380 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 8 }}>
            후보지 위치 지도
          </div>
          <KakaoMap
            center={{ lat: schoolLat, lng: schoolLng }}
            markers={mapMarkers}
            routes={routeLines}
            selected={selected}
            onToggle={toggleSelect}
            height={310}
          />
          {/* 범례 */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 10,
              flexWrap: "wrap",
              fontSize: 11,
              color: "#666",
            }}
          >
            <LegendItem color="#1a1a2e" shape="diamond" label="학교" />
            <LegendItem color="#2980b9" shape="circle" label="교내 설치" />
            <LegendItem color="#2E8B57" shape="circle" label="큰 도로 횡단 없음" />
            <LegendItem color="#D4A017" shape="circle" label="중간급 도로 포함" />
            <LegendItem color="#E67E22" shape="circle" label="도시 대로 포함" />
            <LegendItem color="#C0392B" shape="circle" label="간선/고속도로 포함" />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "#bbb", lineHeight: 1.6 }}>
            * 후보지 점 색은 학교에서 후보지까지 가는 최단 경로의 최고 위험 도로 등급을 뜻합니다. 선택하면 같은 색 경로가 함께 표시됩니다.
          </div>
        </div>

        {/* ── 후보지 목록 ────────────────────────── */}
        <div style={{ flex: 1, minWidth: 300 }}>

          {/* 모드 토글 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {(["ai", "manual"] as FilterMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "7px 16px",
                  borderRadius: 20,
                  border: "none",
                  cursor: "pointer",
                  background: mode === m ? "#1a1a2e" : "#f0f0f0",
                  color: mode === m ? "#fff" : "#333",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                {m === "ai" ? "AI 추천" : "직접 탐색"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(Object.keys(barrierFilterLabels) as BarrierFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setBarrierFilter(filter)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 20,
                  border: "1.5px solid",
                  borderColor: barrierFilter === filter ? "#111827" : "#d1d5db",
                  background: barrierFilter === filter ? "#111827" : "#fff",
                  color: barrierFilter === filter ? "#fff" : "#4b5563",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {barrierFilterLabels[filter]}
              </button>
            ))}
          </div>

          {mode === "manual" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {(Object.keys(manualFilters) as ManualFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() =>
                    setManualFilters((prev) => ({ ...prev, [f]: !prev[f] }))
                  }
                  style={{
                    padding: "5px 12px",
                    borderRadius: 20,
                    border: "2px solid",
                    borderColor: manualFilters[f] ? "#1a1a2e" : "#ddd",
                    background: manualFilters[f] ? "#1a1a2e" : "#fff",
                    color: manualFilters[f] ? "#fff" : "#555",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {filterLabels[f]}
                </button>
              ))}
            </div>
          )}

          {caseType === 4 && (
            <div
              style={{
                marginBottom: 14,
                padding: "14px 16px",
                borderRadius: 14,
                border: "1px solid #d1fae5",
                background: "#ecfdf5",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#047857", marginBottom: 6 }}>
                후보지 안내
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "#065f46" }}>
                이 학교는 주변 야외활동 환경이 비교적 양호한 편이라, 현재는 별도 외부 후보지 시뮬레이션을 제공하지 않습니다.
                대신 학교 내부 활용 가능 공간과 주변 참고 요인을 함께 확인해 보세요.
              </div>
            </div>
          )}

          {/* 교내 시설 설치 카드 */}
          {internalCandidate && (
            <div
              onClick={() => toggleSelect(internalCandidate.grid_id)}
              style={{
                padding: "13px 16px",
                borderRadius: 12,
                border: "2px solid",
                borderColor: selected.has(internalCandidate.grid_id) ? "#2980b9" : "#b8d4ea",
                background: selected.has(internalCandidate.grid_id) ? "#dbeeff" : "#f0f7ff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: selected.has(internalCandidate.grid_id) ? "#2980b9" : "#fff",
                  border: "2.5px solid #2980b9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: selected.has(internalCandidate.grid_id) ? "#fff" : "#2980b9",
                  flexShrink: 0,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                교내
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a5276", marginBottom: 4 }}>
                  학교 내부 시설 설치
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: "#555", flexWrap: "wrap" }}>
                  <span>
                    👤 2029 예상 학생수 <b>{formatRoundedCount(internalCandidate.xgb_predicted_2029)}명</b>
                  </span>
                  <span>
                    👤 2031 예상 학생수 <b>{formatRoundedCount(internalCandidate.xgb_predicted_2031)}명</b>
                  </span>
                  <span>📍 학교 부지 내</span>
                  <span>🛝 놀이터·체육시설 신설</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
                  {getBarrierNote(internalCandidate)} 2029년 수치는 학교 학생수 예측 모델을 바탕으로 본 학교의 예상 학생 규모를 보여주는 참고값입니다.
                </div>
              </div>
              <span
                style={{
                  padding: "2px 9px",
                  borderRadius: 10,
                  fontSize: 11,
                  background: "#2980b922",
                  color: "#2980b9",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                교내 설치
              </span>
            </div>
          )}

          {/* 외부 후보지 카드 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleExternalRanked.slice(0, 10).map((c, i) => {
              const label = LETTERS[i] ?? String(i + 1);
              const barrierColor = getBarrierColor(c);
              const isSel = selected.has(c.grid_id);
              return (
                <div
                  key={c.grid_id}
                  onClick={() => toggleSelect(c.grid_id)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    border: "2px solid",
                    borderColor: isSel ? "#1a1a2e" : "#eee",
                    background: isSel ? "#f0f4ff" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        background: isSel ? barrierColor : "#fff",
                        border: `2.5px solid ${barrierColor}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 800,
                        color: isSel ? "#fff" : barrierColor,
                        flexShrink: 0,
                      }}
                    >
                    {label}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#aaa" }}>{c.grid_id}</span>
                      <span
                        style={{
                          padding: "1px 7px",
                          borderRadius: 10,
                          fontSize: 10,
                          background: rankBadgeStyle(i).bg,
                          color: rankBadgeStyle(i).color,
                          fontWeight: 700,
                        }}
                      >
                        추천 {i + 1}순위
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 10,
                          background: `${barrierColor}18`,
                          color: barrierColor,
                          fontWeight: 700,
                        }}
                      >
                        {getBarrierLabel(c)}
                      </span>
                      {c.fallback_candidate ? (
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            fontWeight: 700,
                          }}
                        >
                          생활권 외 보조 후보
                        </span>
                      ) : null}
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#555", flexWrap: "wrap" }}>
                      <span>
                        👤 인접 2029 <b>{formatRoundedCount(c.resident_children_2029)}명</b>
                      </span>
                      <span>
                        👤 인접 2031 <b>{formatRoundedCount(c.resident_children_2031)}명</b>
                      </span>
                      <span>
                        🚶 보행권 2029 <b>{formatRoundedCount(c.walkshed_potential_2029)}명</b>
                      </span>
                      <span>
                        🚶 보행권 2031 <b>{formatRoundedCount(c.walkshed_potential_2031)}명</b>
                      </span>
                      <span>
                        {getCandidateDistanceLabel(c)} <b>{c.nearest_school_dist.toLocaleString()}m</b>
                      </span>
                      <span>
                        🌳 <b>{c.nearest_park_dist}m</b>
                      </span>
                    </div>
                    {getBarrierCountSummary(c) ? (
                      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: barrierColor }}>
                        {getBarrierCountSummary(c)}
                      </div>
                    ) : null}
                    <div style={{ marginTop: 8, fontSize: 12, color: "#4b5563", lineHeight: 1.6 }}>
                      {getBarrierNote(c)} 후보지 인접 예상 아동수는 250m 기준 참고값이며, 보행권 수요는 후보지 중심 500m 보행권 안의 예상 아동 규모입니다.
                    </div>
                  </div>
                  {i < 3 && !isSel && <div style={{ fontSize: 16 }}>⚡</div>}
                </div>
              );
            })}
            {visibleExternalRanked.length === 0 ? (
              <div
                style={{
                  border: "1px dashed #d1d5db",
                  borderRadius: 12,
                  padding: "16px 18px",
                  background: "#fafafa",
                  fontSize: 13,
                  color: "#6b7280",
                  lineHeight: 1.7,
                }}
              >
                현재 단절성 필터를 만족하는 외부 후보지가 없습니다. 필터를 완화해 다른 후보지를 확인해 보세요.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* 합산 요약 */}
      {selected.size > 0 && (
        <div
          style={{
            padding: 24,
            borderRadius: 16,
            background: "#1a1a2e",
            color: "#fff",
            marginTop: 24,
          }}
        >
          <div style={{ fontSize: 13, color: "#aaa", marginBottom: 8 }}>
            선택한 후보지 {selectedCandidates.length}곳 합산
          </div>
          <div style={{ display: "flex", gap: 40, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, color: "#aaa" }}>2029 예상 잠재수요인원</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>
                {formatRoundedCount(totalDemand2029)}
                <span style={{ fontSize: 16, marginLeft: 4 }}>명</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#aaa" }}>2031 예상 잠재수요인원</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>
                {formatRoundedCount(totalDemand2031)}
                <span style={{ fontSize: 16, marginLeft: 4 }}>명</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart
              data={[
                { name: "2029", value: totalDemand2029 },
                { name: "2031", value: totalDemand2031 },
              ]}
              layout="vertical"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={40}
                tick={{ fill: "#aaa", fontSize: 12 }}
              />
              <Tooltip formatter={(v: number) => [`${formatRoundedCount(v)}명`]} />
              <Bar dataKey="value" fill="#4ecdc4" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {false && redevelopmentProjects.length > 0 && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>
            BEFORE YOU DECIDE
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
            시설 설치 판단 전에 함께 볼 변화 요인
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 14 }}>
            학교 반경 500m 안에서 확인된 재개발·정비사업입니다. 설치 위치를 정할 때 향후 보행 동선과 생활권 수요 변화 가능성을 함께 보세요.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {redevelopmentProjects.map((project, index) => (
              <div
                key={`${project.name}-${index}`}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  padding: "14px 16px",
                  background: "#fafafa",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
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
                        fontWeight: 600,
                      }}
                    >
                      {project.type}
                    </span>
                  ) : null}
                  {Number.isFinite(project.area) ? (
                    <span style={{ color: "#6b7280" }}>면적 {Math.round(project.area ?? 0).toLocaleString()}㎡</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(redevelopmentProjects.length > 0 || largeApartmentComplexes.length > 0) && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 16,
            background: "#fff",
            border: "1px solid #e5e7eb",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a3412", marginBottom: 6 }}>
            BEFORE YOU DECIDE
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
            시설 설치 전에 참고해야 할 요인
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, marginBottom: 14 }}>
            학교 반경 500m 안에서 확인된 재개발·정비사업과 500세대 이상 대단지 아파트입니다.
            설치 위치를 정할 때 주변 생활권 구조와 미집계 녹지·놀이터 가능성을 함께 확인해 보세요.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                인근 500세대 이상 대단지 아파트
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.7, marginBottom: 10 }}>
                대단지 내부 녹지나 놀이터가 공공 데이터에 모두 잡히지 않았을 수 있습니다.
                현장 확인 시 단지 내 개방 가능 공간도 함께 살펴보는 것이 좋습니다.
              </div>
              {largeApartmentComplexes.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {largeApartmentComplexes.map((complex, index) => (
                    <div
                      key={`${complex.name}-${index}`}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "14px 16px",
                        background: "#f8fafc",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
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
              ) : (
                <div
                  style={{
                    border: "1px dashed #d1d5db",
                    borderRadius: 12,
                    padding: "14px 16px",
                    background: "#fafafa",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  근처 500세대 이상 대단지 아파트는 확인되지 않았습니다.
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 8 }}>
                인근 재개발·정비사업
              </div>
              {redevelopmentProjects.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {redevelopmentProjects.map((project, index) => (
                    <div
                      key={`${project.name}-${index}`}
                      style={{
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        padding: "14px 16px",
                        background: "#fafafa",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
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
                              fontWeight: 600,
                            }}
                          >
                            {project.type}
                          </span>
                        ) : null}
                        {Number.isFinite(project.area) ? (
                          <span style={{ color: "#6b7280" }}>면적 {Math.round(project.area ?? 0).toLocaleString()}㎡</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    border: "1px dashed #d1d5db",
                    borderRadius: 12,
                    padding: "14px 16px",
                    background: "#fafafa",
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  근처 재개발·정비사업은 확인되지 않았습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#666" }}>
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
