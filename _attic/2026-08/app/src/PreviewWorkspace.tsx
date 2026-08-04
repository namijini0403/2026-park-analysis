import { useMemo, useState } from "react";
import SchoolDetailReportPage from "./SchoolDetailReportPagePreview";
import SimulationPage from "./SimulationPage";
import StatisticsPage from "./StatisticsPage";
import { previewSchoolDetailReport } from "./previewData";
import { cityStatisticsPreviewData } from "./statisticsPreviewData";

type ViewMode = "report" | "simulation" | "statistics";

function readInitialView(): ViewMode {
  if (typeof window === "undefined") return "report";
  const view = new URLSearchParams(window.location.search).get("view");
  if (view === "simulation" || view === "statistics" || view === "report") {
    return view;
  }
  return "report";
}

export default function PreviewWorkspace() {
  const [view, setView] = useState<ViewMode>(() => readInitialView());

  const mockCandidates = useMemo(
    () => [
      {
        grid_id: "SCHOOL_INT",
        cx: 126.6867275,
        cy: 37.46235,
        xgb_predicted_2029: 498,
        xgb_predicted_2031: 472,
        resident_children_2029: 498,
        resident_children_2031: 472,
        walkshed_potential_2029: 498,
        walkshed_potential_2031: 472,
        nearest_park_dist: 0,
        nearest_pg_dist: 0,
        nearest_school_dist: 0,
        nearest_apt_dist: 0,
        land_feasibility_level: "high" as const,
        linked_schools: ["인천석암초등학교"],
        is_school_internal: true,
      },
      {
        grid_id: "CG_00562",
        cx: 126.6878,
        cy: 37.4621,
        xgb_predicted_2029: 464,
        xgb_predicted_2031: 473,
        resident_children_2029: 464,
        resident_children_2031: 473,
        walkshed_potential_2029: 464,
        walkshed_potential_2031: 473,
        nearest_park_dist: 312,
        nearest_pg_dist: 2032,
        nearest_school_dist: 35,
        nearest_apt_dist: 180,
        land_feasibility_level: "high" as const,
        linked_schools: ["인천석암초등학교"],
      },
      {
        grid_id: "CG_00580",
        cx: 126.6901,
        cy: 37.4643,
        xgb_predicted_2029: 412,
        xgb_predicted_2031: 421,
        resident_children_2029: 412,
        resident_children_2031: 421,
        walkshed_potential_2029: 412,
        walkshed_potential_2031: 421,
        nearest_park_dist: 450,
        nearest_pg_dist: 1800,
        nearest_school_dist: 180,
        nearest_apt_dist: 320,
        land_feasibility_level: "high" as const,
        linked_schools: ["인천석암초등학교"],
      },
      {
        grid_id: "CG_00541",
        cx: 126.6854,
        cy: 37.4598,
        xgb_predicted_2029: 388,
        xgb_predicted_2031: 395,
        resident_children_2029: 388,
        resident_children_2031: 395,
        walkshed_potential_2029: 388,
        walkshed_potential_2031: 395,
        nearest_park_dist: 520,
        nearest_pg_dist: 2200,
        nearest_school_dist: 220,
        nearest_apt_dist: 410,
        land_feasibility_level: "medium" as const,
        linked_schools: ["인천석암초등학교"],
      },
      {
        grid_id: "CG_00601",
        cx: 126.6923,
        cy: 37.4665,
        xgb_predicted_2029: 351,
        xgb_predicted_2031: 358,
        resident_children_2029: 351,
        resident_children_2031: 358,
        walkshed_potential_2029: 351,
        walkshed_potential_2031: 358,
        nearest_park_dist: 280,
        nearest_pg_dist: 1600,
        nearest_school_dist: 310,
        nearest_apt_dist: 150,
        land_feasibility_level: "medium" as const,
        linked_schools: ["인천석암초등학교"],
      },
      {
        grid_id: "CG_00520",
        cx: 126.6831,
        cy: 37.4576,
        xgb_predicted_2029: 310,
        xgb_predicted_2031: 316,
        resident_children_2029: 310,
        resident_children_2031: 316,
        walkshed_potential_2029: 310,
        walkshed_potential_2031: 316,
        nearest_park_dist: 680,
        nearest_pg_dist: 2800,
        nearest_school_dist: 390,
        nearest_apt_dist: 520,
        land_feasibility_level: "medium" as const,
        linked_schools: ["인천석암초등학교"],
      },
    ],
    []
  );

  const detailProps = useMemo(
    () => ({
      ...previewSchoolDetailReport,
      onSimulationClick: () => setView("simulation"),
    }),
    []
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">UI Preview</p>
            <p className="text-sm font-semibold text-slate-900">학교 상세 리포트 · 후보지 시뮬레이션 · 전체 통계</p>
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
          schoolName={previewSchoolDetailReport.schoolName}
          schoolLat={37.46235}
          schoolLng={126.6867275}
          casePolicyLabel={previewSchoolDetailReport.casePolicyLabel}
          candidates={mockCandidates}
          onBack={() => setView("report")}
        />
      ) : view === "statistics" ? (
        <StatisticsPage data={cityStatisticsPreviewData} />
      ) : (
        <SchoolDetailReportPage {...detailProps} />
      )}
    </div>
  );
}
