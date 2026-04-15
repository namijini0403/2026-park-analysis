import { useMemo, useState } from "react";
import SchoolDetailReportPage from "./SchoolDetailReportPagePreview";
import SimulationPage from "./SimulationPage";
import StatisticsPageSafe from "./StatisticsPageSafe";
import { previewSchoolDetailReport } from "./previewData";
import { cityStatisticsPreviewDataSafe } from "./statisticsPreviewDataSafe";
import { mapSchoolRowToReportProps, mapCandidateFeatures } from "./schoolDataMapperSafe";

type ViewMode = "report" | "simulation" | "statistics";

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

export default function PreviewWorkspaceSafe() {
  const [view, setView] = useState<ViewMode>("report");

  // localStorage에서 학교 데이터 읽기 (없으면 석암초 fallback)
  const schoolRow = useMemo(() => readSchoolFromStorage(), []);
  const rawCandidates = useMemo(() => readCandidatesFromStorage(), []);

  // 학교 좌표
  const schoolLat = schoolRow ? Number(schoolRow["위도"] ?? schoolRow.lat ?? 37.46235) : 37.46235;
  const schoolLng = schoolRow ? Number(schoolRow["경도"] ?? schoolRow.lng ?? 126.6867275) : 126.6867275;

  const detailProps = useMemo(() => {
    if (!schoolRow) {
      return {
        ...previewSchoolDetailReport,
        onSimulationClick: () => setView("simulation"),
      };
    }
    return mapSchoolRowToReportProps(schoolRow, () => setView("simulation"));
  }, [schoolRow]);

  const candidates = useMemo(() => {
    if (!schoolRow) {
      const sn = previewSchoolDetailReport.schoolName;
      return [
        { grid_id: "SCHOOL_INT", cx: 126.6867275, cy: 37.46235, xgb_predicted_2029: 498, xgb_predicted_2031: 472, nearest_park_dist: 0, nearest_pg_dist: 0, nearest_school_dist: 0, nearest_apt_dist: 0, land_feasibility_level: "high" as const, linked_schools: [sn], is_school_internal: true },
        { grid_id: "CG_00562", cx: 126.6878, cy: 37.4621, xgb_predicted_2029: 464, xgb_predicted_2031: 473, nearest_park_dist: 312, nearest_pg_dist: 2032, nearest_school_dist: 35, nearest_apt_dist: 180, land_feasibility_level: "high" as const, linked_schools: [sn] },
        { grid_id: "CG_00580", cx: 126.6901, cy: 37.4643, xgb_predicted_2029: 412, xgb_predicted_2031: 421, nearest_park_dist: 450, nearest_pg_dist: 1800, nearest_school_dist: 180, nearest_apt_dist: 320, land_feasibility_level: "high" as const, linked_schools: [sn] },
        { grid_id: "CG_00541", cx: 126.6854, cy: 37.4598, xgb_predicted_2029: 388, xgb_predicted_2031: 395, nearest_park_dist: 520, nearest_pg_dist: 2200, nearest_school_dist: 220, nearest_apt_dist: 410, land_feasibility_level: "medium" as const, linked_schools: [sn] },
      ];
    }
    return mapCandidateFeatures(rawCandidates, schoolLat, schoolLng);
  }, [schoolRow, rawCandidates, schoolLat, schoolLng]);

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {schoolRow ? detailProps.schoolName : "UI Preview"}
            </p>
            <p className="text-sm font-semibold text-slate-900">학교 상세 리포트 · 시뮬레이션</p>
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
                      ? "bg-slate-950 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {view === "simulation" ? (
        <SimulationPage
          schoolName={detailProps.schoolName}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          casePolicyLabel={detailProps.casePolicyLabel}
          candidates={candidates}
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
