from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(__file__).resolve().parents[1]
PRIORITY_PATH = BASE / "data_processed" / "school_priority_with_functional_park_layer.csv"
FORECAST_PATH = BASE / "data_processed" / "school_enrollment_forecast_20260418_model1.csv"
STUDENT_TREND_PATH = BASE / "data_processed" / "student_trend.csv"
APARTMENT_ADJUSTMENT_PATH = BASE / "data_processed" / "school_walk_500m_apartment_adjustment_20260504.csv"
OUT_PATHS = [
    BASE / "ui-preview" / "src" / "statisticsPreviewDataSafe.ts",
    BASE / "app" / "src" / "statisticsPreviewDataSafe.ts",
]

CASE_POLICY_LABELS = {
    1.0: "즉시 개선 대상",
    2.0: "우선 검토 대상",
    3.0: "모니터링 대상",
    4.0: "유지·관리 대상",
}

GREEN_RATIO_SOURCE_COLUMNS = ("display_green_ratio", "corrected_green_ratio", "iso_green_ratio")
STATISTICS_GREEN_RATIO_COLUMN = "statistics_green_ratio"


def round1(value: float | int | None) -> float:
    if value is None or pd.isna(value):
        return 0.0
    return round(float(value), 1)


def numeric_series(df: pd.DataFrame, column: str) -> pd.Series:
    if column not in df.columns:
        return pd.Series(0, index=df.index, dtype=float)
    return pd.to_numeric(df[column], errors="coerce").fillna(0)


def attach_statistics_green_ratio(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    series = pd.Series(pd.NA, index=out.index, dtype="Float64")
    for column in GREEN_RATIO_SOURCE_COLUMNS:
        if column not in out.columns:
            continue
        values = pd.to_numeric(out[column], errors="coerce")
        series = series.where(series.notna(), values)
    out[STATISTICS_GREEN_RATIO_COLUMN] = series.fillna(0).astype(float)
    return out


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
        "greenRatio": round1(row[STATISTICS_GREEN_RATIO_COLUMN]),
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
    valid = attach_statistics_green_ratio(df)
    valid["nearest_park_dist_m"] = pd.to_numeric(valid["nearest_park_dist_m"], errors="coerce")
    valid[STATISTICS_GREEN_RATIO_COLUMN] = pd.to_numeric(valid[STATISTICS_GREEN_RATIO_COLUMN], errors="coerce")
    valid["iso_playground_count"] = pd.to_numeric(valid["iso_playground_count"], errors="coerce").fillna(0)

    candidates = valid[
        valid["nearest_park_dist_m"].notna()
        & valid[STATISTICS_GREEN_RATIO_COLUMN].notna()
        & (valid["nearest_park_dist_m"] <= 200)
    ].copy()
    if candidates.empty:
        return None

    q1, q2, q3 = quartile_cutoffs(valid[STATISTICS_GREEN_RATIO_COLUMN])
    quartile_order = {"Q4": 0, "Q3": 1, "Q2": 2, "Q1": 3}
    candidates["green_quartile"] = candidates[STATISTICS_GREEN_RATIO_COLUMN].apply(lambda v: assign_quartile(v, q1, q2, q3))
    candidates["quartile_order"] = candidates["green_quartile"].map(quartile_order).fillna(99)
    candidates["playground_flag"] = (candidates["iso_playground_count"] >= 1).astype(int)

    candidates = candidates.sort_values(
        by=["quartile_order", "playground_flag", STATISTICS_GREEN_RATIO_COLUMN, "nearest_park_dist_m"],
        ascending=[True, False, False, True],
        kind="mergesort",
    )
    return candidates.iloc[0]


def build_priority_school_lists(priority_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    if priority_df.empty:
        return priority_df.copy(), priority_df.copy(), priority_df.copy()

    base = priority_df.copy()
    for column, fallback in [
        ("case_type", 99),
        ("priority_rank", 9999),
        ("forecast_2029", 0),
        ("current_student_count", 0),
        ("iso_park_count", 9999),
        ("iso_playground_count", 9999),
        (STATISTICS_GREEN_RATIO_COLUMN, 9999),
    ]:
        base[column] = pd.to_numeric(base[column], errors="coerce").fillna(fallback)

    default_df = base.sort_values(
        by=["case_type", "priority_rank", "forecast_2029"],
        ascending=[True, True, False],
        kind="mergesort",
    ).head(5)
    playground_focused_df = base.sort_values(
        by=["iso_park_count", STATISTICS_GREEN_RATIO_COLUMN, "iso_playground_count", "case_type", "current_student_count", "priority_rank"],
        ascending=[True, True, True, True, False, True],
        kind="mergesort",
    ).head(5)
    student_focused_df = base.sort_values(
        by=["current_student_count", "case_type", "iso_park_count", STATISTICS_GREEN_RATIO_COLUMN, "iso_playground_count", "priority_rank"],
        ascending=[False, True, True, True, True, True],
        kind="mergesort",
    ).head(5)
    return default_df, playground_focused_df, student_focused_df


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
  topPrioritySchoolsPlaygroundFocused: StatisticsSchoolItem[];
  topPrioritySchoolsStudentFocused: StatisticsSchoolItem[];
  bestSchool: StatisticsSchoolItem;
}};

export type CityStatisticsData = {{
  cityName: string;
  summary: {{
    schoolCount: number;
    districtCount: number;
    case1Count: number;
    case2Count: number;
    case3Count: number;
    case4Count: number;
    separateBundleCount: number;
    urgentSupportCount: number;
    priorityReviewCount: number;
    apartmentPermeabilitySchoolCount: number;
    apartmentAdjustmentCandidateCount: number;
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
    if APARTMENT_ADJUSTMENT_PATH.exists():
        apartment_adjustment = pd.read_csv(APARTMENT_ADJUSTMENT_PATH, encoding="utf-8-sig")
        priority = priority.merge(
            apartment_adjustment[["학교ID", "apt_permeability_flag", "apt_adjustment_candidate"]],
            on="학교ID",
            how="left",
        )

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
    merged = attach_statistics_green_ratio(merged)

    district_rows: list[dict] = []
    for district_name, district_df in merged.groupby("gu", sort=False):
        district_df = district_df.copy()
        priority_df = district_df[district_df["case_type"].isin([1.0, 2.0])].copy()
        top_df, top_playground_df, top_student_df = build_priority_school_lists(priority_df)
        best_row = choose_best_school(district_df)
        district_rows.append(
            {
                "districtName": district_name,
                "schoolCount": int(len(district_df)),
                "case1Count": int((district_df["case_type"] == 1.0).sum()),
                "case2Count": int((district_df["case_type"] == 2.0).sum()),
                "case3Count": int((district_df["case_type"] == 3.0).sum()),
                "case4Count": int((district_df["case_type"] == 4.0).sum()),
                "specialPolicyCount": int(numeric_series(district_df, "is_separate_bundle_tag").eq(1).sum()),
                "priorityReviewCount": int((district_df["case_type"] == 2.0).sum()),
                "totalPotentialDemand2029": int(round(district_df["forecast_2029"].sum())),
                "totalPotentialDemand2031": int(round(district_df["forecast_2031"].sum())),
                "avgNearestParkDistanceM": round1(pd.to_numeric(district_df["nearest_park_dist_m"], errors="coerce").mean()),
                "avgGreenRatio": round1(pd.to_numeric(district_df[STATISTICS_GREEN_RATIO_COLUMN], errors="coerce").mean()),
                "avgPlaygroundCount": round(float(pd.to_numeric(district_df["iso_playground_count"], errors="coerce").fillna(0).mean()), 2),
                "topPrioritySchools": [school_record(row, idx + 1) for idx, (_, row) in enumerate(top_df.iterrows())],
                "topPrioritySchoolsPlaygroundFocused": [
                    school_record(row, idx + 1) for idx, (_, row) in enumerate(top_playground_df.iterrows())
                ],
                "topPrioritySchoolsStudentFocused": [
                    school_record(row, idx + 1) for idx, (_, row) in enumerate(top_student_df.iterrows())
                ],
                "bestSchool": school_record(best_row, 1) if best_row is not None else build_empty_best_school(str(district_name)),
            }
        )

    city_case1_df = merged[merged["case_type"] == 1.0].copy()
    city_top_df = city_case1_df.sort_values(
        by=["priority_rank", "priority_score", "forecast_2029"],
        ascending=[True, False, False],
    )
    city_top_playground_df = city_case1_df.sort_values(
        by=["iso_park_count", STATISTICS_GREEN_RATIO_COLUMN, "iso_playground_count", "current_student_count", "priority_rank"],
        ascending=[True, True, True, False, True],
        kind="mergesort",
    )
    city_top_student_df = city_case1_df.sort_values(
        by=["current_student_count", "iso_park_count", STATISTICS_GREEN_RATIO_COLUMN, "iso_playground_count", "priority_rank"],
        ascending=[False, True, True, True, True],
        kind="mergesort",
    )
    city_best_row = choose_best_school(merged)

    data = {
        "cityName": "인천광역시",
        "summary": {
            "schoolCount": int(len(merged)),
            "districtCount": int(merged["gu"].nunique()),
            "case1Count": int((merged["case_type"] == 1.0).sum()),
            "case2Count": int((merged["case_type"] == 2.0).sum()),
            "case3Count": int((merged["case_type"] == 3.0).sum()),
            "case4Count": int((merged["case_type"] == 4.0).sum()),
            "separateBundleCount": int(numeric_series(merged, "is_separate_bundle_tag").eq(1).sum()),
            "urgentSupportCount": int((merged["case_type"] == 1.0).sum()),
            "priorityReviewCount": int((merged["case_type"] == 2.0).sum()),
            "apartmentPermeabilitySchoolCount": int(numeric_series(merged, "apt_permeability_flag").eq(1).sum()),
            "apartmentAdjustmentCandidateCount": int(numeric_series(merged, "apt_adjustment_candidate").eq(1).sum()),
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

    rendered = build_typescript(data)
    for out_path in OUT_PATHS:
        out_path.write_text(rendered, encoding="utf-8")
        print(f"generated: {out_path}")
    print("city best:", data["cityBestSchool"]["schoolName"], data["cityBestSchool"]["greenRatio"])


if __name__ == "__main__":
    main()
