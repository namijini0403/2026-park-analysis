from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.linear_model import ElasticNet
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_processed"
OUTPUT = ROOT / "output"

sys.path.insert(0, str(ROOT))

import compare_school_enrollment_models as cmp

SUMMARY_CSV = OUTPUT / "school_enrollment_recursive_error_distribution.csv"
DETAIL_CSV = OUTPUT / "school_enrollment_recursive_backtest_predictions.csv"
SUMMARY_MD = OUTPUT / "school_enrollment_recursive_error_distribution.md"


def load_local_frames() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    trend = pd.read_csv(DATA / "student_trend.csv", encoding="utf-8-sig")
    priority = pd.read_csv(DATA / "school_priority.csv", encoding="utf-8-sig")

    trend["연도"] = pd.to_numeric(trend["연도"], errors="coerce")
    trend["학생수"] = pd.to_numeric(trend["학생수"], errors="coerce")
    trend = trend.dropna(subset=["학교ID", "연도", "학생수"]).copy()
    trend["연도"] = trend["연도"].astype(int)

    structural = priority[cmp.STRUCTURAL_COLS].copy()
    for col in ["iso_child_total", "redev_완료수", "redev_진행중수", "redev_예정수", "is_new_school"]:
        structural[col] = pd.to_numeric(structural[col], errors="coerce").fillna(0)

    trend = trend.merge(structural[["학교ID", "gu"]], on="학교ID", how="left")
    trend = trend.dropna(subset=["gu"]).copy()

    gu_year = (
        trend.groupby(["gu", "연도"], as_index=False)["학생수"]
        .sum()
        .sort_values(["gu", "연도"])
        .copy()
    )
    gu_year["prev_students"] = gu_year.groupby("gu")["학생수"].shift(1)
    gu_year["cohort_factor_actual"] = np.where(
        gu_year["prev_students"] > 0,
        gu_year["학생수"] / gu_year["prev_students"],
        1.0,
    )
    return trend, structural, gu_year


def recursive_prediction_rows(
    one_step_df: pd.DataFrame,
    recursive_df: pd.DataFrame,
    model1_alpha: float,
    model2_params: dict[str, float],
    model2_alpha: float,
) -> pd.DataFrame:
    model1_features = list(cmp.build_model1_matrix(one_step_df).columns)
    model2_features = list(cmp.build_model2_matrix(one_step_df).columns)
    rows: list[dict[str, Any]] = []

    for horizon in sorted(int(h) for h in recursive_df["horizon"].unique().tolist()):
        horizon_df = recursive_df[recursive_df["horizon"] == horizon].reset_index(drop=True)
        for year in cmp.walk_forward_years(horizon_df):
            train_df = one_step_df[one_step_df["target_year"] < year].reset_index(drop=True)
            valid_df = horizon_df[horizon_df["target_year"] == year].reset_index(drop=True)
            if train_df.empty or valid_df.empty:
                continue

            x1_train = cmp.build_model1_matrix(train_df)
            y1_train = train_df["target_students"].to_numpy(dtype=float)
            base1_train = train_df["base_next_pred"].to_numpy(dtype=float) * (
                1.0 + model1_alpha * (train_df["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0)
            )
            model1 = LGBMRegressor(**cmp.LIGHTGBM_PARAMS)
            model1.fit(x1_train, y1_train - base1_train)

            x2_train = cmp.build_model2_matrix(train_df)
            y2_train = np.log(
                (train_df["target_students"].to_numpy(dtype=float) + 1.0)
                / (train_df["last_students"].to_numpy(dtype=float) + 1.0)
            )
            model2 = Pipeline(
                [
                    ("scaler", StandardScaler()),
                    (
                        "elastic",
                        ElasticNet(
                            alpha=float(model2_params["alpha"]),
                            l1_ratio=float(model2_params["l1_ratio"]),
                            max_iter=20000,
                            random_state=42,
                        ),
                    ),
                ]
            )
            model2.fit(x2_train, y2_train)

            for _, row in valid_df.iterrows():
                actual = float(row["target_students"])
                pred1 = cmp.predict_model1_recursive(
                    history_values=row["history_values"],
                    cohort_factors=row["cohort_factors"],
                    row=row,
                    model=model1,
                    blend_alpha=model1_alpha,
                    feature_names=model1_features,
                )
                pred2 = cmp.predict_model2_recursive(
                    history_values=row["history_values"],
                    cohort_factors=row["cohort_factors"],
                    row=row,
                    model=model2,
                    blend_alpha=model2_alpha,
                    feature_names=model2_features,
                )
                for model_name, pred in (
                    ("Model 1", pred1),
                    ("Model 2", pred2),
                ):
                    residual = float(pred - actual)
                    rows.append(
                        {
                            "model": model_name,
                            "horizon": horizon,
                            "school_id": row["학교ID"],
                            "school_name": row["학교명"],
                            "origin_year": int(row["origin_year"]),
                            "target_year": int(row["target_year"]),
                            "actual": actual,
                            "prediction": float(pred),
                            "residual": residual,
                            "absolute_error": abs(residual),
                        }
                    )
    return pd.DataFrame(rows)


def summarize_errors(predictions: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    groups: list[tuple[str, str, pd.DataFrame]] = [
        (str(model), f"{int(horizon)}", group)
        for (model, horizon), group in predictions.groupby(["model", "horizon"], sort=True)
    ]
    for model, group in predictions[predictions["horizon"].isin([2, 3])].groupby("model", sort=True):
        groups.append((str(model), "2~3 pooled", group))

    for model, horizon_label, group in groups:
        residual = group["residual"].to_numpy(dtype=float)
        abs_error = group["absolute_error"].to_numpy(dtype=float)
        rows.append(
            {
                "model": model,
                "horizon": horizon_label,
                "n": int(len(group)),
                "residual_mean": float(np.mean(residual)),
                "residual_std": float(np.std(residual, ddof=1)),
                "residual_q1": float(np.quantile(residual, 0.25)),
                "residual_median": float(np.quantile(residual, 0.50)),
                "residual_q3": float(np.quantile(residual, 0.75)),
                "residual_iqr": float(np.quantile(residual, 0.75) - np.quantile(residual, 0.25)),
                "abs_error_mean": float(np.mean(abs_error)),
                "abs_error_std": float(np.std(abs_error, ddof=1)),
                "abs_error_q1": float(np.quantile(abs_error, 0.25)),
                "abs_error_median": float(np.quantile(abs_error, 0.50)),
                "abs_error_q3": float(np.quantile(abs_error, 0.75)),
                "abs_error_iqr": float(np.quantile(abs_error, 0.75) - np.quantile(abs_error, 0.25)),
            }
        )
    return pd.DataFrame(rows)


def write_markdown(summary: pd.DataFrame) -> None:
    lines = [
        "# 학생수 재귀 백테스트 오차 분포",
        "",
        "단위: 명. residual은 `prediction - actual`, absolute error는 `abs(prediction - actual)`입니다.",
        "",
        "| 모델 | horizon | n | residual std | residual IQR | absolute error std | absolute error IQR |",
        "|---|---:|---:|---:|---:|---:|---:|",
    ]
    for row in summary.itertuples(index=False):
        lines.append(
            f"| {row.model} | {row.horizon} | {row.n} | "
            f"{row.residual_std:.1f} | {row.residual_iqr:.1f} | "
            f"{row.abs_error_std:.1f} | {row.abs_error_iqr:.1f} |"
        )
    SUMMARY_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    trend, structural, gu_year = load_local_frames()
    one_step_df = cmp.build_backtest_rows(trend, structural, gu_year)
    recursive_df = cmp.build_recursive_backtest_rows(trend, structural, gu_year)

    _, model1_alpha, _, _ = cmp.evaluate_model1(one_step_df)
    _, model2_params, model2_alpha, _, _ = cmp.evaluate_model2(one_step_df)

    predictions = recursive_prediction_rows(one_step_df, recursive_df, model1_alpha, model2_params, model2_alpha)
    summary = summarize_errors(predictions)

    predictions.to_csv(DETAIL_CSV, index=False, encoding="utf-8-sig")
    summary.to_csv(SUMMARY_CSV, index=False, encoding="utf-8-sig")
    write_markdown(summary)

    print(json.dumps({"summary_csv": str(SUMMARY_CSV), "detail_csv": str(DETAIL_CSV), "rows": len(predictions)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
