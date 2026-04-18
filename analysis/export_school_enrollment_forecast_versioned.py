from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


BASE = Path(r"c:\2026_data_analysis_park")
FORECAST_CANDIDATES_PATH = BASE / "output" / "school_enrollment_forecast_candidates.csv"
COMPARISON_PATH = BASE / "output" / "school_enrollment_model_comparison.json"
PRIORITY_PATH = BASE / "data_processed" / "school_priority_case_system_20260411.csv"
FALLBACK_PROXY_PATH = BASE / "data_processed" / "beneficiary_forecast_v3.csv"
OUT_PATH = BASE / "data_processed" / "school_enrollment_forecast_20260418_model1.csv"

MODEL_VERSION = "school_enrollment_model1_walk_forward_recursive_20260418"
SELECTED_MODEL = "weighted_trend_plus_lgbm_residual"


def main() -> None:
    forecast_df = pd.read_csv(FORECAST_CANDIDATES_PATH, encoding="utf-8-sig")
    comparison = json.loads(COMPARISON_PATH.read_text(encoding="utf-8"))
    priority_df = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    fallback_proxy_df = pd.read_csv(FALLBACK_PROXY_PATH, encoding="utf-8-sig")

    one_year = comparison["model1"]["overall"]
    mid_term = comparison["recursive_walk_forward"]["mid_term_average"]["model1"]

    out = forecast_df.rename(
        columns={
            "model1_forecast_2029": "forecast_2029",
            "model1_forecast_2031": "forecast_2031",
        }
    ).copy()
    out["predicted_2029"] = out["forecast_2029"]
    out["predicted_2031"] = out["forecast_2031"]
    out["selected_model"] = SELECTED_MODEL
    out["model_version"] = MODEL_VERSION
    out["validation_scheme"] = "walk_forward_recursive"
    out["one_year_r2"] = float(one_year["r2"])
    out["one_year_mae"] = float(one_year["mae"])
    out["mid_term_r2"] = float(mid_term["r2"])
    out["mid_term_mae"] = float(mid_term["mae"])

    missing_priority = priority_df.loc[~priority_df["학교ID"].isin(out["학교ID"])].copy()
    if not missing_priority.empty:
        fallback_rows = missing_priority.merge(
            fallback_proxy_df[
                [
                    "학교ID",
                    "학교명",
                    "gu",
                    "predicted_2029",
                    "predicted_2031",
                    "cohort_change_2029_prophet",
                    "cohort_change_2031_prophet",
                ]
            ],
            on=["학교ID", "학교명", "gu"],
            how="left",
        )
        fallback_rows = fallback_rows.assign(
            current_students_2025=0,
            forecast_2029=fallback_rows["predicted_2029"].fillna(0).round().astype(int),
            forecast_2031=fallback_rows["predicted_2031"].fillna(0).round().astype(int),
            selected_model="fallback_new_school_proxy",
            model_version=f"{MODEL_VERSION}_with_new_school_fallback",
            validation_scheme="proxy_fallback",
            one_year_r2=float(one_year["r2"]),
            one_year_mae=float(one_year["mae"]),
            mid_term_r2=float(mid_term["r2"]),
            mid_term_mae=float(mid_term["mae"]),
            cohort_change_2029=fallback_rows["cohort_change_2029_prophet"].fillna(1.0),
            cohort_change_2031=fallback_rows["cohort_change_2031_prophet"].fillna(1.0),
        )[
            [
                "학교ID",
                "학교명",
                "gu",
                "current_students_2025",
                "forecast_2029",
                "forecast_2031",
                "predicted_2029",
                "predicted_2031",
                "cohort_change_2029",
                "cohort_change_2031",
                "selected_model",
                "model_version",
                "validation_scheme",
                "one_year_r2",
                "one_year_mae",
                "mid_term_r2",
                "mid_term_mae",
            ]
        ]
        out = pd.concat([out, fallback_rows], ignore_index=True)

    ordered_cols = [
        "학교ID",
        "학교명",
        "gu",
        "current_students_2025",
        "forecast_2029",
        "forecast_2031",
        "predicted_2029",
        "predicted_2031",
        "cohort_change_2029",
        "cohort_change_2031",
        "selected_model",
        "model_version",
        "validation_scheme",
        "one_year_r2",
        "one_year_mae",
        "mid_term_r2",
        "mid_term_mae",
    ]
    out = out[ordered_cols].sort_values(["gu", "학교명"]).reset_index(drop=True)
    out.to_csv(OUT_PATH, index=False, encoding="utf-8-sig")
    print(f"generated: {OUT_PATH}")


if __name__ == "__main__":
    main()
