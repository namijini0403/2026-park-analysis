import { useMemo, useState } from "react";
import SchoolDetailReportPage from "./SchoolDetailReportPagePreview";
import SimulationPage from "./SimulationPage";
import { previewSchoolDetailReport } from "./previewData";
import { mapSchoolRowToReportProps, mapCandidateFeatures } from "./schoolDataMapper";

// localStorage에서 학교 데이터를 읽어 React props로 변환
// 메인 앱(index.html)이 학교 클릭 시 저장한 JSON을 소비
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

export default function App() {
  const [showSimulation, setShowSimulation] = useState(false);

  // localStorage에서 학교 row 읽기 (없으면 석암초 프리뷰 fallback)
  const schoolRow = useMemo(() => readSchoolFromStorage(), []);
  const rawCandidates = useMemo(() => readCandidatesFromStorage(), []);

  // 학교 좌표 (enrichSchoolRows에서 위도/경도 키로 저장됨)
  const schoolLat = schoolRow
    ? Number(schoolRow["위도"] ?? schoolRow.lat ?? 37.46235)
    : 37.46235;
  const schoolLng = schoolRow
    ? Number(schoolRow["경도"] ?? schoolRow.lng ?? 126.6867275)
    : 126.6867275;

  const detailProps = useMemo(() => {
    if (!schoolRow) {
      // 메인 앱 없이 직접 열었을 때 (프리뷰/개발용)
      return {
        ...previewSchoolDetailReport,
        onSimulationClick: () => setShowSimulation(true),
      };
    }
    return mapSchoolRowToReportProps(schoolRow, () => setShowSimulation(true));
  }, [schoolRow]);

  const candidates = useMemo(() => {
    if (!schoolRow) {
      // fallback: 석암초 하드코딩 mock
      return [
        { grid_id: "SCHOOL_INT", cx: 126.6867275, cy: 37.46235, xgb_predicted_2029: 498, xgb_predicted_2031: 472, nearest_park_dist: 0, nearest_pg_dist: 0, nearest_school_dist: 0, nearest_apt_dist: 0, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"], is_school_internal: true },
        { grid_id: "CG_00562", cx: 126.6878, cy: 37.4621, xgb_predicted_2029: 464, xgb_predicted_2031: 473, nearest_park_dist: 312, nearest_pg_dist: 2032, nearest_school_dist: 35, nearest_apt_dist: 180, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"] },
        { grid_id: "CG_00580", cx: 126.6901, cy: 37.4643, xgb_predicted_2029: 412, xgb_predicted_2031: 421, nearest_park_dist: 450, nearest_pg_dist: 1800, nearest_school_dist: 180, nearest_apt_dist: 320, land_feasibility_level: "high" as const, linked_schools: ["인천석암초등학교"] },
        { grid_id: "CG_00541", cx: 126.6854, cy: 37.4598, xgb_predicted_2029: 388, xgb_predicted_2031: 395, nearest_park_dist: 520, nearest_pg_dist: 2200, nearest_school_dist: 220, nearest_apt_dist: 410, land_feasibility_level: "medium" as const, linked_schools: ["인천석암초등학교"] },
      ];
    }
    return mapCandidateFeatures(rawCandidates, schoolLat, schoolLng, {
      predicted2029: detailProps.potentialDemand2029,
      predicted2031: detailProps.potentialDemand2031,
    });
  }, [schoolRow, rawCandidates, schoolLat, schoolLng, detailProps.potentialDemand2029, detailProps.potentialDemand2031]);

  return (
    <div className="min-h-screen bg-slate-100">
      {showSimulation ? (
        <SimulationPage
          schoolName={detailProps.schoolName}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          casePolicyLabel={detailProps.casePolicyLabel}
          candidates={candidates}
          onBack={() => setShowSimulation(false)}
        />
      ) : (
        <SchoolDetailReportPage {...detailProps} />
      )}
    </div>
  );
}
