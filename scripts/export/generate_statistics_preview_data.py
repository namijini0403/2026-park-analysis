from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(r"c:\2026_data_analysis_park")
PRIORITY_PATH = BASE / "data/processed" / "school_priority_case_system_20260411.csv"
FORECAST_PATH = BASE / "data/processed" / "beneficiary_forecast.csv"
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
    }


def choose_best_school(df: pd.DataFrame) -> pd.Series:
    eligible = df[pd.to_numeric(df["nearest_park_dist_m"], errors="coerce").notna()].copy()
    eligible = eligible[pd.to_numeric(eligible["nearest_park_dist_m"], errors="coerce") > 0]
    if eligible.empty:
        eligible = df.copy()

    eligible["nearest_park_dist_m"] = pd.to_numeric(eligible["nearest_park_dist_m"], errors="coerce").fillna(0)
    eligible["iso_green_ratio"] = pd.to_numeric(eligible["iso_green_ratio"], errors="coerce").fillna(0)
    eligible["iso_playground_count"] = pd.to_numeric(eligible["iso_playground_count"], errors="coerce").fillna(0)

    max_dist = max(float(eligible["nearest_park_dist_m"].max()), 1.0)
    max_green = max(float(eligible["iso_green_ratio"].max()), 1.0)
    max_playground = max(float(eligible["iso_playground_count"].max()), 1.0)

    def rank_case(value: float | int | None) -> int:
        if pd.isna(value):
            return 4
        num = float(value)
        if num == 4.0:
            return 0
        if num == 3.0:
            return 1
        if num == 2.0:
            return 2
        if num == 1.0:
            return 3
        return 4

    eligible["_case_rank"] = eligible["case_type"].apply(rank_case)
    eligible["_environment_score"] = (
        (1 - (eligible["nearest_park_dist_m"] / max_dist).clip(0, 1)) * 0.45
        + (eligible["iso_green_ratio"] / max_green).clip(0, 1) * 0.45
        + (eligible["iso_playground_count"] / max_playground).clip(0, 1) * 0.10
        + eligible["_case_rank"].map({0: 0.05, 1: 0.02}).fillna(0.0)
    )

    eligible = eligible.sort_values(
        by=[
            "_environment_score",
            "_case_rank",
            "nearest_park_dist_m",
            "iso_green_ratio",
            "iso_playground_count",
            "forecast_2029",
        ],
        ascending=[False, True, True, False, False, False],
    )
    return eligible.iloc[0]


def build_typescript(data: dict) -> str:
    payload = json.dumps(data, ensure_ascii=True, indent=2)
    return f"""export type StatisticsSchoolItem = {{
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
  cityBestSchool: StatisticsSchoolItem;
}};

export const cityStatisticsPreviewDataSafe: CityStatisticsData = {payload};
"""


def main() -> None:
    priority = pd.read_csv(PRIORITY_PATH)
    forecast = pd.read_csv(FORECAST_PATH)

    merged = priority.merge(
        forecast[["학교ID", "forecast_2029", "forecast_2031"]],
        on="학교ID",
        how="left",
    )

    merged["forecast_2029"] = merged["forecast_2029"].fillna(0)
    merged["forecast_2031"] = merged["forecast_2031"].fillna(0)
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
                "avgNearestParkDistanceM": round1(district_df["nearest_park_dist_m"].mean()),
                "avgGreenRatio": round1(district_df["iso_green_ratio"].mean()),
                "avgPlaygroundCount": round(float(district_df["iso_playground_count"].mean()), 2),
                "topPrioritySchools": [school_record(row, idx + 1) for idx, (_, row) in enumerate(top_df.iterrows())],
                "bestSchool": school_record(best_row, 1),
            }
        )

    city_top_df = merged.sort_values(
        by=["priority_rank", "priority_score", "forecast_2029"],
        ascending=[True, False, False],
    ).head(10)
    city_best_row = choose_best_school(merged)

    data = {
        "cityName": "인천광역시",  # [전국 확장] from scripts.config.region_config import CITY_NAME
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
        "cityBestSchool": school_record(city_best_row, 1),
    }

    OUT_PATH.write_text(build_typescript(data), encoding="utf-8")
    print(f"generated: {OUT_PATH}")
    print(f"districts: {len(district_rows)}")
    print("michuhol top 5:")
    michuhol = next(item for item in district_rows if item["districtName"] == "미추홀구")
    for row in michuhol["topPrioritySchools"]:
        print(row["rank"], row["schoolName"], row["casePolicyLabel"], row["caseStatusLabel"], row["potentialDemand2029"])
    print("michuhol best:", michuhol["bestSchool"]["schoolName"], michuhol["bestSchool"]["caseStatusLabel"])


if __name__ == "__main__":
    main()
