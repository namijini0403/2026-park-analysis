import { useMemo, useState } from "react";
import SchoolDetailReportPage from "./SchoolDetailReportPagePreview";
import SimulationPage from "./SimulationPage";
import StatisticsPageSafe from "./StatisticsPageSafe";
import LandingPage from "./LandingPage";
import AiExplainerPanel from "./AiExplainerPanel";
import { previewSchoolDetailReport } from "./previewData";
import { cityStatisticsPreviewDataSafe } from "./statisticsPreviewDataSafe";
import { applyLegacySchoolSnapshot, mapSchoolRowToReportProps, mapCandidateFeatures } from "./schoolDataBridge";

type ViewMode = "landing" | "report" | "simulation" | "statistics";

const VIEW_PRINT_LABELS: Record<ViewMode, string> = {
  landing: "시스템 시작 화면",
  report: "학교 상세 리포트",
  simulation: "후보지 시뮬레이션",
  statistics: "전체 통계 리포트",
};

type RedevelopmentProject = {
  name: string;
  stage: string;
  distanceM: number;
  type?: string;
  area?: number | null;
};

type LargeApartmentComplex = {
  name: string;
  householdCount: number;
  distanceM: number;
  address?: string;
};

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "landing";
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "recommendation") return "simulation";
  if (view === "simulation" || view === "statistics" || view === "report" || view === "landing") {
    return view as ViewMode;
  }
  // localStorage에 학교 데이터가 있으면 바로 리포트, 없으면 랜딩
  try {
    if (localStorage.getItem("parkAnalysis_school")) return "report";
  } catch {
    // ignore
  }
  return "landing";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSchoolFromStorage(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("parkAnalysis_school");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readCandidatesFromStorage(): Record<string, any>[] {
  try {
    const raw = localStorage.getItem("parkAnalysis_candidates");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readRedevelopmentProjects(schoolRow: Record<string, any> | null): RedevelopmentProject[] {
  if (!schoolRow || !Array.isArray(schoolRow._redevelopmentProjects)) return [];
  return schoolRow._redevelopmentProjects
    .map((item: Record<string, unknown>) => ({
      name: String(item.name ?? ""),
      stage: String(item.stage ?? ""),
      distanceM: Number(item.distanceM ?? 0),
      type: item.type != null ? String(item.type) : undefined,
      area: item.area == null ? undefined : Number(item.area),
    }))
    .filter((item: RedevelopmentProject) => item.name !== "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readLargeApartmentComplexes(schoolRow: Record<string, any> | null): LargeApartmentComplex[] {
  if (!schoolRow || !Array.isArray(schoolRow._largeApartmentComplexes)) return [];
  return schoolRow._largeApartmentComplexes
    .map((item: Record<string, unknown>) => ({
      name: String(item.name ?? ""),
      householdCount: Number(item.householdCount ?? 0),
      distanceM: Number(item.distanceM ?? 0),
      address: item.address != null ? String(item.address) : undefined,
    }))
    .filter((item: LargeApartmentComplex) => item.name !== "" && Number.isFinite(item.householdCount));
}

function getPreviewCaseType(schoolRow: Record<string, any> | null): number {
  if (!schoolRow) return 1;
  const caseLabel = String(schoolRow.case_label ?? "").trim();
  const caseTypeRaw = String(schoolRow.case_type ?? schoolRow["case_type"] ?? "").trim().toLowerCase();
  if (
    caseLabel === "별도 묶음" ||
    Number(schoolRow.is_separate_bundle_tag ?? 0) === 1 ||
    Number(schoolRow.is_island_tag ?? 0) === 1 ||
    caseTypeRaw === "99" ||
    caseTypeRaw === "island"
  ) {
    return 99;
  }
  return Number(schoolRow.case_type ?? schoolRow["case_type"] ?? 1);
}

export default function PreviewWorkspaceSafe() {
  const [view, setView] = useState<ViewMode>(() => readInitialView());
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const logoSrc = `${import.meta.env.BASE_URL}logo.png`;

  // localStorage에서 학교 데이터 읽기 (없으면 석암초 fallback)
  const schoolRow = useMemo(() => readSchoolFromStorage(), []);
  const rawCandidates = useMemo(() => readCandidatesFromStorage(), []);

  // 학교 좌표
  const schoolLat = schoolRow ? Number(schoolRow["위도"] ?? schoolRow.lat ?? 37.46235) : 37.46235;
  const schoolLng = schoolRow ? Number(schoolRow["경도"] ?? schoolRow.lng ?? 126.6867275) : 126.6867275;
  const caseType = getPreviewCaseType(schoolRow);

  const detailProps = useMemo(() => {
    if (!schoolRow) {
      return {
        ...previewSchoolDetailReport,
        onSimulationClick: () => setView("simulation"),
      };
    }
    const mapped = mapSchoolRowToReportProps(schoolRow, () => setView("simulation"));
    return applyLegacySchoolSnapshot(mapped, schoolRow._legacySnapshot);
  }, [schoolRow]);

  const candidates = useMemo(() => {
    if (!schoolRow) {
      const sn = previewSchoolDetailReport.schoolName;
      return [
        { grid_id: "SCHOOL_INT", cx: 126.6867275, cy: 37.46235, xgb_predicted_2029: 498, xgb_predicted_2031: 472, resident_children_2029: 498, resident_children_2031: 472, walkshed_potential_2029: 498, walkshed_potential_2031: 472, nearest_park_dist: 0, nearest_pg_dist: 0, nearest_school_dist: 0, nearest_apt_dist: 0, land_feasibility_level: "high" as const, linked_schools: [sn], is_school_internal: true },
        { grid_id: "CG_00562", cx: 126.6878, cy: 37.4621, xgb_predicted_2029: 464, xgb_predicted_2031: 473, resident_children_2029: 464, resident_children_2031: 473, walkshed_potential_2029: 464, walkshed_potential_2031: 473, nearest_park_dist: 312, nearest_pg_dist: 2032, nearest_school_dist: 35, nearest_apt_dist: 180, land_feasibility_level: "high" as const, linked_schools: [sn] },
        { grid_id: "CG_00580", cx: 126.6901, cy: 37.4643, xgb_predicted_2029: 412, xgb_predicted_2031: 421, resident_children_2029: 412, resident_children_2031: 421, walkshed_potential_2029: 412, walkshed_potential_2031: 421, nearest_park_dist: 450, nearest_pg_dist: 1800, nearest_school_dist: 180, nearest_apt_dist: 320, land_feasibility_level: "high" as const, linked_schools: [sn] },
        { grid_id: "CG_00541", cx: 126.6854, cy: 37.4598, xgb_predicted_2029: 388, xgb_predicted_2031: 395, resident_children_2029: 388, resident_children_2031: 395, walkshed_potential_2029: 388, walkshed_potential_2031: 395, nearest_park_dist: 520, nearest_pg_dist: 2200, nearest_school_dist: 220, nearest_apt_dist: 410, land_feasibility_level: "medium" as const, linked_schools: [sn] },
      ];
    }
    return mapCandidateFeatures(rawCandidates, schoolLat, schoolLng, {
      predicted2029: detailProps.potentialDemand2029,
      predicted2031: detailProps.potentialDemand2031,
    });
  }, [schoolRow, rawCandidates, schoolLat, schoolLng, detailProps.potentialDemand2029, detailProps.potentialDemand2031]);

  const redevelopmentProjects = useMemo(() => readRedevelopmentProjects(schoolRow), [schoolRow]);
  const largeApartmentComplexes = useMemo(() => readLargeApartmentComplexes(schoolRow), [schoolRow]);

  const handlePrint = () => {
    if (typeof window === "undefined") return;
    const previousTitle = document.title;
    const printTitle = `${detailProps.schoolName} - ${VIEW_PRINT_LABELS[view]}`;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    document.title = printTitle;
    window.addEventListener("afterprint", restoreTitle);
    window.print();
    window.setTimeout(restoreTitle, 1500);
  };

  if (view === "landing") {
    return <LandingPage onEnter={(target) => setView(target)} />;
  }

  return (
    <div className="min-h-screen">
      <div className="app-print-hidden sticky top-0 z-20 border-b border-white/10 bg-navy-950/95">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("landing")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-soft transition hover:scale-105"
              aria-label="홈으로"
            >
              <img src={logoSrc} alt="ParkLens" className="h-full w-full object-contain" />
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-forest-300">
                ParkLens · Incheon
              </p>
              <p className="text-sm font-bold text-white">
                {schoolRow ? detailProps.schoolName : "UI Preview"}
                <span className="ml-2 text-[11px] font-medium text-slate-400">
                  · 학교 상세 · 시뮬레이션 · 통계
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "report", label: "상세 리포트" },
              { key: "simulation", label: "시뮬레이션" },
              { key: "statistics", label: "전체 통계" },
            ].map((item) => {
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key as ViewMode)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-forest-grad text-white shadow-glow"
                      : "border border-white/15 bg-navy-850/95 text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setAiChatOpen((current) => !current)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                aiChatOpen
                  ? "bg-forest-grad text-white shadow-glow"
                  : "border border-forest-400/45 bg-forest-500/10 text-forest-100 hover:bg-forest-500/20"
              }`}
            >
              AI 챗봇
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full border border-forest-400/45 bg-forest-500/10 px-4 py-2 text-sm font-semibold text-forest-100 transition hover:bg-forest-500/20"
            >
              PDF/인쇄
            </button>
          </div>
        </div>
      </div>

      {aiChatOpen ? (
        <div className="app-print-hidden fixed inset-x-4 top-[82px] z-40 mx-auto max-w-[1380px] sm:inset-x-6 lg:inset-x-8">
          <div className="ml-auto max-h-[calc(100vh-104px)] w-full max-w-[560px] overflow-y-auto rounded-3xl border border-white/15 bg-navy-950/95 p-2 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-forest-300">AI Chatbot</p>
                <p className="text-sm font-bold text-white">{detailProps.schoolName} 근거 해설</p>
              </div>
              <button
                type="button"
                onClick={() => setAiChatOpen(false)}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-100 transition hover:bg-white/10"
              >
                닫기
              </button>
            </div>
            <AiExplainerPanel
              title="AI 챗봇"
              description="현재 선택 학교의 Case, 지표, 정책 확인사항을 근거 문서 안에서만 설명합니다. 후보지별 질문은 시뮬레이션 상세에서 선택 후보를 연 뒤 사용할 수 있습니다."
              schoolContext={{
                school_name: detailProps.schoolName,
                district_name: detailProps.districtName,
                case_label: detailProps.casePolicyLabel,
                case_status_label: detailProps.caseStatusLabel,
                nearest_park_distance_m: detailProps.nearestParkDistanceM,
                nearest_park_name: detailProps.nearestParkName,
                green_ratio: detailProps.greenRatio,
                playground_count: detailProps.playgroundCount,
                no_park_within_500m: detailProps.noParkWithin500m,
                potential_demand_2029: detailProps.potentialDemand2029,
                potential_demand_2031: detailProps.potentialDemand2031,
              }}
            />
          </div>
        </div>
      ) : null}

      {view === "simulation" ? (
        <SimulationPage
          schoolName={detailProps.schoolName}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          casePolicyLabel={detailProps.casePolicyLabel}
          caseType={caseType}
          candidates={candidates}
          redevelopmentProjects={redevelopmentProjects}
          largeApartmentComplexes={largeApartmentComplexes}
          onBack={() => setView("report")}
        />
      ) : view === "statistics" ? (
        <StatisticsPageSafe data={cityStatisticsPreviewDataSafe} />
      ) : (
        <SchoolDetailReportPage {...detailProps} />
      )}
    </div>
  );
}
