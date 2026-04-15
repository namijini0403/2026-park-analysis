import { useMemo, useState } from "react";
import SchoolDetailReportPage from "./SchoolDetailReportPagePreview";
import SimulationPage from "./SimulationPage";
import { previewSchoolDetailReport } from "./previewData";

export default function App() {
  const [showSimulation, setShowSimulation] = useState(false);

  const mockCandidates = useMemo(
    () => [
      // 학교 내부 시설 설치 후보 (교내)
      { grid_id: "SCHOOL_INT", cx: 126.6867275, cy: 37.46235, xgb_predicted_2029: 498, xgb_predicted_2031: 472, nearest_park_dist: 0, nearest_pg_dist: 0, nearest_school_dist: 0, nearest_apt_dist: 0, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"], is_school_internal: true },
      // 외부 후보지
      { grid_id: "CG_00562", cx: 126.6878, cy: 37.4621, xgb_predicted_2029: 464, xgb_predicted_2031: 473, nearest_park_dist: 312, nearest_pg_dist: 2032, nearest_school_dist: 35, nearest_apt_dist: 180, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"] },
      { grid_id: "CG_00580", cx: 126.6901, cy: 37.4643, xgb_predicted_2029: 412, xgb_predicted_2031: 421, nearest_park_dist: 450, nearest_pg_dist: 1800, nearest_school_dist: 180, nearest_apt_dist: 320, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"] },
      { grid_id: "CG_00541", cx: 126.6854, cy: 37.4598, xgb_predicted_2029: 388, xgb_predicted_2031: 395, nearest_park_dist: 520, nearest_pg_dist: 2200, nearest_school_dist: 220, nearest_apt_dist: 410, land_feasibility_level: "medium" as const, linked_schools: ["인천석암초등학교"] },
      { grid_id: "CG_00601", cx: 126.6923, cy: 37.4665, xgb_predicted_2029: 351, xgb_predicted_2031: 358, nearest_park_dist: 280, nearest_pg_dist: 1600, nearest_school_dist: 310, nearest_apt_dist: 150, land_feasibility_level: "medium" as const, linked_schools: ["인천석암초등학교"] },
      { grid_id: "CG_00520", cx: 126.6831, cy: 37.4576, xgb_predicted_2029: 310, xgb_predicted_2031: 316, nearest_park_dist: 680, nearest_pg_dist: 2800, nearest_school_dist: 390, nearest_apt_dist: 520, land_feasibility_level: "medium" as const, linked_schools: ["인천석암초등학교"] },
    ],
    []
  );

  const detailProps = useMemo(
    () => ({
      ...previewSchoolDetailReport,
      onSimulationClick: () => setShowSimulation(true),
    }),
    []
  );

  return (
    <div className="min-h-screen bg-slate-100">
      {showSimulation ? (
        <SimulationPage
          schoolName={previewSchoolDetailReport.schoolName}
          schoolLat={37.46235}
          schoolLng={126.6867275}
          casePolicyLabel={previewSchoolDetailReport.casePolicyLabel}
          candidates={mockCandidates}
          onBack={() => setShowSimulation(false)}
        />
      ) : (
        <SchoolDetailReportPage {...detailProps} />
      )}
    </div>
  );
}
