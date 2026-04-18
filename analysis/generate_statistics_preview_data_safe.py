from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(r"c:\2026_data_analysis_park")
PRIORITY_PATH = BASE / "data_processed" / "school_priority_case_system_20260411.csv"
FORECAST_PATH = BASE / "data_processed" / "beneficiary_forecast.csv"
STUDENT_TREND_PATH = BASE / "data_processed" / "student_trend.csv"
OUT_PATH = BASE / "ui-preview" / "src" / "statisticsPreviewDataSafe.ts"

CASE_POLICY_LABELS = {
    1.0: "즉시 개선 대상",
    2.0: "우선 검토 대상",
    3.0: "모니터링 대상",
    4.0: "유지·관리 대상",
}


def round1(value: float | int | None) -> float:
    if value is None or pd.isna(value):
        return 0.0
    return round(float(value), 1)


def quartile_cutoffs(series: pd.Series) -> tuple[float, float, float]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return (float("nan"), float("nan"), float("nan"))
    return (
        float(clean.quantile(0.25)),
        float(clean.quantile(0.50)),
        float(clean.quantile(0.75)),
    )


def assign_quartile(value: float, q1: float, q2: float, q3: float) -> str | None:
    if pd.isna(value) or any(pd.isna([q1, q2, q3])):
        return None
    if value >= q3:
        return "Q4"
    if value >= q2:
        return "Q3"
    if value >= q1:
        return "Q2"
    return "Q1"


def school_record(row: pd.Series, rank: int) -> dict:
    return {
        "rank": rank,
        "schoolName": str(row["학교명"]),
        "districtName": str(row["gu"]),
        "casePolicyLabel": str(row["casePolicyLabel"]),
        "caseStatusLabel": str(row["case_label"]),
        "potentialDemand2029": int(round(float(row["forecast_2029"]))),
        "potentialDemand2031": int(round(float(row["forecast_2031"]))),
        "nearestParkDistanceM": round1(row["nearest_park_dist_m"]),
        "greenRatio": round1(row["iso_green_ratio"]),
        "playgroundCount": int(round(float(row["iso_playground_count"]))),
        "currentStudentCount": int(round(float(row["current_student_count"]))),
    }


def build_empty_best_school(district_name: str) -> dict:
    return {
        "rank": 1,
        "schoolName": "기준 충족 학교 없음",
        "districtName": district_name,
        "casePolicyLabel": "기준 미충족",
        "caseStatusLabel": "200m 이내 후보 없음",
        "potentialDemand2029": 0,
        "potentialDemand2031": 0,
        "nearestParkDistanceM": 0,
        "greenRatio": 0,
        "playgroundCount": 0,
        "currentStudentCount": 0,
    }


def choose_best_school(df: pd.DataFrame) -> pd.Series | None:
    valid = df.copy()
    valid["nearest_park_dist_m"] = pd.to_numeric(valid["nearest_park_dist_m"], errors="coerce")
    valid["iso_green_ratio"] = pd.to_numeric(valid["iso_green_ratio"], errors="coerce")
    valid["iso_playground_count"] = pd.to_numeric(valid["iso_playground_count"], errors="coerce").fillna(0)

    candidates = valid[
        valid["nearest_park_dist_m"].notna()
        & valid["iso_green_ratio"].notna()
        & (valid["nearest_park_dist_m"] <= 200)
    ].copy()
    if candidates.empty:
        return None

    q1, q2, q3 = quartile_cutoffs(valid["iso_green_ratio"])
    quartile_order = {"Q4": 0, "Q3": 1, "Q2": 2, "Q1": 3}
    candidates["green_quartile"] = candidates["iso_green_ratio"].apply(lambda v: assign_quartile(v, q1, q2, q3))
    candidates["quartile_order"] = candidates["green_quartile"].map(quartile_order).fillna(99)
    candidates["playground_flag"] = (candidates["iso_playground_count"] >= 1).astype(int)

    candidates = candidates.sort_values(
        by=["quartile_order", "playground_flag", "iso_green_ratio", "nearest_park_dist_m"],
        ascending=[True, False, False, True],
        kind="mergesort",
    )
    return candidates.iloc[0]


def build_typescript(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=False, indent=2)
    return f'''export type StatisticsSchoolItem = {{
  rank: number;
  schoolName: string;
  districtName: string;
  casePolicyLabel: string;
  caseStatusLabel: string;
  potentialDemand2029: number;
  potentialDemand2031: number;
  nearestParkDistanceM: number;
  greenRatio: number;
  playgroundCount: number;
  currentStudentCount: number;
}};

export type DistrictStatistics = {{
  districtName: string;
  schoolCount: number;
  case1Count: number;
  case2Count: number;
  case3Count: number;
  case4Count: number;
  specialPolicyCount: number;
  priorityReviewCount: number;
  totalPotentialDemand2029: number;
  totalPotentialDemand2031: number;
  avgNearestParkDistanceM: number;
  avgGreenRatio: number;
  avgPlaygroundCount: number;
  topPrioritySchools: StatisticsSchoolItem[];
  bestSchool: StatisticsSchoolItem;
}};

export type CityStatisticsData = {{
  cityName: string;
  summary: {{
    schoolCount: number;
    districtCount: number;
    urgentSupportCount: number;
    priorityReviewCount: number;
    totalPotentialDemand2029: number;
    totalPotentialDemand2031: number;
  }}; 
  districts: DistrictStatistics[];
  cityTopPrioritySchools: StatisticsSchoolItem[];
  cityTopPrioritySchoolsPlaygroundFocused: StatisticsSchoolItem[];
  cityTopPrioritySchoolsStudentFocused: StatisticsSchoolItem[];
  cityBestSchool: StatisticsSchoolItem;
}};

export const cityStatisticsPreviewDataSafe: CityStatisticsData = {payload};
'''


def main() -> None:
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    forecast = pd.read_csv(FORECAST_PATH, encoding="utf-8-sig")
    student_trend = pd.read_csv(STUDENT_TREND_PATH, encoding="utf-8-sig")

    latest_students = (
        student_trend.assign(
            연도=pd.to_numeric(student_trend["연도"], errors="coerce"),
            학생수=pd.to_numeric(student_trend["학생수"], errors="coerce"),
        )
        .dropna(subset=["연도"])
        .sort_values(["학교ID", "연도"])
        .groupby("학교ID", as_index=False)
        .tail(1)[["학교ID", "학생수"]]
        .rename(columns={"학생수": "current_student_count"})
    )

    merged = priority.merge(
        forecast[["학교ID", "forecast_2029", "forecast_2031"]],
        on="학교ID",
        how="left",
    )
    merged = merged.merge(latest_students, on="학교ID", how="left")
    merged["forecast_2029"] = pd.to_numeric(merged["forecast_2029"], errors="coerce").fillna(0)
    merged["forecast_2031"] = pd.to_numeric(merged["forecast_2031"], errors="coerce").fillna(0)
    merged["current_student_count"] = pd.to_numeric(merged["current_student_count"], errors="coerce").fillna(0)
    merged["casePolicyLabel"] = merged["case_type"].map(CASE_POLICY_LABELS).fillna("별도 정책 적용")

    district_rows: list[dict] = []
    for district_name, district_df in merged.groupby("gu", sort=False):
        district_df = district_df.copy()
        top_df = district_df.sort_values(
            by=["priority_rank", "priority_score", "forecast_2029"],
            ascending=[True, False, False],
        ).head(5)
        best_row = choose_best_school(district_df)
        district_rows.append(
            {
                "districtName": district_name,
                "schoolCount": int(len(district_df)),
                "case1Count": int((district_df["case_type"] == 1.0).sum()),
                "case2Count": int((district_df["case_type"] == 2.0).sum()),
                "case3Count": int((district_df["case_type"] == 3.0).sum()),
                "case4Count": int((district_df["case_type"] == 4.0).sum()),
                "specialPolicyCount": int(district_df["case_type"].isna().sum()),
                "priorityReviewCount": int(district_df["case_type"].isin([1.0, 2.0]).sum()),
                "totalPotentialDemand2029": int(round(district_df["forecast_2029"].sum())),
                "totalPotentialDemand2031": int(round(district_df["forecast_2031"].sum())),
                "avgNearestParkDistanceM": round1(pd.to_numeric(district_df["nearest_park_dist_m"], errors="coerce").mean()),
                "avgGreenRatio": round1(pd.to_numeric(district_df["iso_green_ratio"], errors="coerce").mean()),
                "avgPlaygroundCount": round(float(pd.to_numeric(district_df["iso_playground_count"], errors="coerce").fillna(0).mean()), 2),
                "topPrioritySchools": [school_record(row, idx + 1) for idx, (_, row) in enumerate(top_df.iterrows())],
                "bestSchool": school_record(best_row, 1) if best_row is not None else build_empty_best_school(str(district_name)),
            }
        )

    city_case1_df = merged[merged["case_type"] == 1.0].copy()
    city_top_df = city_case1_df.sort_values(
        by=["priority_rank", "priority_score", "forecast_2029"],
        ascending=[True, False, False],
    )
    city_top_playground_df = city_case1_df.sort_values(
        by=["iso_park_count", "iso_green_ratio", "iso_playground_count", "current_student_count", "priority_rank"],
        ascending=[True, True, True, False, True],
        kind="mergesort",
    )
    city_top_student_df = city_case1_df.sort_values(
        by=["current_student_count", "iso_park_count", "iso_green_ratio", "iso_playground_count", "priority_rank"],
        ascending=[False, True, True, True, True],
        kind="mergesort",
    )
    city_best_row = choose_best_school(merged)

    data = {
        "cityName": "인천광역시",
        "summary": {
            "schoolCount": int(len(merged)),
            "districtCount": int(merged["gu"].nunique()),
            "urgentSupportCount": int((merged["case_type"] == 1.0).sum()),
            "priorityReviewCount": int((merged["case_type"] == 2.0).sum()),
            "totalPotentialDemand2029": int(round(merged["forecast_2029"].sum())),
            "totalPotentialDemand2031": int(round(merged["forecast_2031"].sum())),
        },
        "districts": district_rows,
        "cityTopPrioritySchools": [school_record(row, idx + 1) for idx, (_, row) in enumerate(city_top_df.iterrows())],
        "cityTopPrioritySchoolsPlaygroundFocused": [
            school_record(row, idx + 1) for idx, (_, row) in enumerate(city_top_playground_df.iterrows())
        ],
        "cityTopPrioritySchoolsStudentFocused": [
            school_record(row, idx + 1) for idx, (_, row) in enumerate(city_top_student_df.iterrows())
        ],
        "cityBestSchool": school_record(city_best_row, 1) if city_best_row is not None else build_empty_best_school("인천광역시"),
    }

    OUT_PATH.write_text(build_typescript(data), encoding="utf-8")
    print(f"generated: {OUT_PATH}")
    print("city best:", data["cityBestSchool"]["schoolName"], data["cityBestSchool"]["greenRatio"])


if __name__ == "__main__":
    main()
