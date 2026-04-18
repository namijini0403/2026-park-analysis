from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data_processed"
OUTPUT = ROOT / "output"

TREND_CSV = DATA / "student_trend.csv"
PRIORITY_CSV = DATA / "school_priority.csv"
GU_COHORT_CSV = DATA / "gu_cohort_change_prophet.csv"

COMPARISON_JSON = OUTPUT / "school_enrollment_model_comparison.json"
COMPARISON_MD = OUTPUT / "school_enrollment_model_comparison.md"
FORECAST_CSV = OUTPUT / "school_enrollment_forecast_candidates.csv"

PROPHET_BLEND_GRID = [0.0, 0.15, 0.25, 0.35, 0.5]
ELASTIC_GRID = [
    {"alpha": 0.001, "l1_ratio": 0.1},
    {"alpha": 0.001, "l1_ratio": 0.5},
    {"alpha": 0.01, "l1_ratio": 0.2},
    {"alpha": 0.01, "l1_ratio": 0.5},
    {"alpha": 0.05, "l1_ratio": 0.5},
]

LIGHTGBM_PARAMS = {
    "n_estimators": 160,
    "learning_rate": 0.05,
    "num_leaves": 15,
    "max_depth": 4,
    "min_child_samples": 12,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "random_state": 42,
    "n_jobs": 1,
    "verbosity": -1,
}

STRUCTURAL_COLS = [
    "학교ID",
    "학교명",
    "gu",
    "iso_child_total",
    "redev_완료수",
    "redev_진행중수",
    "redev_예정수",
    "is_new_school",
]


def weighted_slope(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    x = np.arange(len(values), dtype=float)
    y = np.asarray(values, dtype=float)
    w = np.linspace(1.0, 2.0, len(values), dtype=float)
    x_mean = np.average(x, weights=w)
    y_mean = np.average(y, weights=w)
    denom = np.sum(w * (x - x_mean) ** 2)
    if denom <= 0:
        return 0.0
    return float(np.sum(w * (x - x_mean) * (y - y_mean)) / denom)


def weighted_next_prediction(values: list[float]) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    x = np.arange(len(values), dtype=float)
    y = np.asarray(values, dtype=float)
    w = np.linspace(1.0, 2.0, len(values), dtype=float)
    x_mean = np.average(x, weights=w)
    y_mean = np.average(y, weights=w)
    slope = weighted_slope(values)
    intercept = y_mean - slope * x_mean
    return float(intercept + slope * len(values))


def annualize_factor(total_factor: float, span_years: int) -> float:
    if not np.isfinite(total_factor) or total_factor <= 0:
        return 1.0
    return float(total_factor ** (1.0 / span_years))


def stabilize_future_prediction(prev_value: float, pred_value: float) -> float:
    lower = max(prev_value * 0.65, 0.0)
    upper = max(prev_value * 1.25, prev_value + 80.0, 30.0)
    return float(np.clip(pred_value, lower, upper))


def load_frames() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    trend = pd.read_csv(TREND_CSV, encoding="utf-8-sig")
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    gu_cohort = pd.read_csv(GU_COHORT_CSV, encoding="utf-8-sig")

    trend["연도"] = pd.to_numeric(trend["연도"], errors="coerce")
    trend["학생수"] = pd.to_numeric(trend["학생수"], errors="coerce")
    trend = trend.dropna(subset=["학교ID", "연도", "학생수"]).copy()
    trend["연도"] = trend["연도"].astype(int)

    missing_cols = [col for col in STRUCTURAL_COLS if col not in priority.columns]
    if missing_cols:
        raise ValueError(f"school_priority.csv 필수 컬럼 누락: {missing_cols}")

    structural = priority[STRUCTURAL_COLS].copy()
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

    gu_cohort["annual_factor_2029"] = gu_cohort["cohort_change_2029"].apply(lambda v: annualize_factor(float(v), 5))
    gu_cohort["annual_factor_2031"] = gu_cohort["cohort_change_2031"].apply(lambda v: annualize_factor(float(v), 7))
    gu_future = gu_cohort.rename(columns={"gu_name": "gu"})[
        ["gu", "cohort_change_2029", "cohort_change_2031", "annual_factor_2029", "annual_factor_2031"]
    ].copy()
    return trend, structural, gu_year, gu_future


def make_history_features(values: list[float]) -> dict[str, float]:
    last = float(values[-1]) if values else 0.0
    prev = float(values[-2]) if len(values) >= 2 else last
    prev2 = float(values[-3]) if len(values) >= 3 else prev
    prev3 = float(values[-4]) if len(values) >= 4 else prev2
    delta1 = last - prev
    delta2 = prev - prev2
    delta3 = prev2 - prev3
    pct1 = (delta1 / prev) if prev > 0 else 0.0
    pct2 = ((last - prev2) / prev2) if prev2 > 0 else 0.0
    recent3 = values[-3:] if len(values) >= 3 else values
    recent_mean3 = float(np.mean(recent3)) if recent3 else last
    recent_std3 = float(np.std(recent3)) if recent3 else 0.0
    hist_mean = float(np.mean(values)) if values else 0.0
    hist_std = float(np.std(values)) if values else 0.0
    base_next = weighted_next_prediction(values)
    return {
        "history_count": float(len(values)),
        "last_students": last,
        "prev_students": prev,
        "prev2_students": prev2,
        "delta1": float(delta1),
        "delta2": float(delta2),
        "delta3": float(delta3),
        "pct1": float(pct1),
        "pct2": float(pct2),
        "weighted_slope": weighted_slope(values),
        "recent_mean3": recent_mean3,
        "recent_std3": recent_std3,
        "hist_mean": hist_mean,
        "hist_std": hist_std,
        "level_to_mean_ratio": (last / hist_mean) if hist_mean > 0 else 1.0,
        "base_next_pred": max(base_next, 0.0),
    }


def build_backtest_rows(
    trend: pd.DataFrame,
    structural: pd.DataFrame,
    gu_year: pd.DataFrame,
) -> pd.DataFrame:
    structural_map = structural.set_index("학교ID").to_dict("index")
    gu_factor_map = {
        (str(row["gu"]), int(row["연도"])): float(row["cohort_factor_actual"])
        for _, row in gu_year.iterrows()
    }

    rows: list[dict[str, float | int | str]] = []
    for school_id, group in trend.groupby("학교ID", sort=False):
        group = group.sort_values("연도").reset_index(drop=True)
        meta = structural_map.get(school_id)
        if meta is None:
            continue
        for target_idx in range(2, len(group)):
            history = group.iloc[:target_idx]
            target = group.iloc[target_idx]
            history_values = history["학생수"].astype(float).tolist()
            features = make_history_features(history_values)
            row = {
                "학교ID": school_id,
                "학교명": str(group["학교명"].iloc[0]),
                "gu": str(group["gu"].iloc[0]),
                "target_year": int(target["연도"]),
                "target_students": float(target["학생수"]),
                "cohort_factor_proxy": gu_factor_map.get((str(group["gu"].iloc[0]), int(target["연도"])), 1.0),
            }
            row.update(features)
            row["iso_child_total"] = float(meta["iso_child_total"])
            row["redev_완료수"] = float(meta["redev_완료수"])
            row["redev_진행중수"] = float(meta["redev_진행중수"])
            row["redev_예정수"] = float(meta["redev_예정수"])
            row["is_new_school"] = float(meta["is_new_school"])
            rows.append(row)

    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError("백테스트 행이 생성되지 않았습니다.")
    return df


def regression_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict[str, float]:
    return {
        "r2": float(r2_score(y_true, y_pred)),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
    }


def metrics_by_year(df: pd.DataFrame, pred_col: str) -> list[dict[str, float | int]]:
    rows: list[dict[str, float | int]] = []
    for year, group in df.groupby("target_year", sort=True):
        metrics = regression_metrics(group["target_students"].to_numpy(), group[pred_col].to_numpy())
        rows.append({"target_year": int(year), **metrics})
    return rows


def walk_forward_years(df: pd.DataFrame) -> list[int]:
    years = sorted(int(year) for year in df["target_year"].dropna().unique().tolist())
    return [year for year in years if year >= 2023]


def build_recursive_backtest_rows(
    trend: pd.DataFrame,
    structural: pd.DataFrame,
    gu_year: pd.DataFrame,
    horizons: tuple[int, ...] = (1, 2, 3),
) -> pd.DataFrame:
    structural_map = structural.set_index("학교ID").to_dict("index")
    gu_factor_map = {
        (str(row["gu"]), int(row["연도"])): float(row["cohort_factor_actual"])
        for _, row in gu_year.iterrows()
    }

    rows: list[dict[str, object]] = []
    for school_id, group in trend.groupby("학교ID", sort=False):
        group = group.sort_values("연도").reset_index(drop=True)
        meta = structural_map.get(school_id)
        if meta is None:
            continue
        years = group["연도"].astype(int).tolist()
        students = group["학생수"].astype(float).tolist()
        school_name = str(group["학교명"].iloc[0])
        gu = str(group["gu"].iloc[0])

        for history_end_idx in range(1, len(group) - 1):
            history_values = students[: history_end_idx + 1]
            origin_year = years[history_end_idx]
            for horizon in horizons:
                target_idx = history_end_idx + horizon
                if target_idx >= len(group):
                    continue
                step_factors = [
                    gu_factor_map.get((gu, int(years[step_idx])), 1.0)
                    for step_idx in range(history_end_idx + 1, target_idx + 1)
                ]
                row = {
                    "학교ID": school_id,
                    "학교명": school_name,
                    "gu": gu,
                    "origin_year": origin_year,
                    "target_year": int(years[target_idx]),
                    "horizon": int(horizon),
                    "target_students": float(students[target_idx]),
                    "history_values": history_values.copy(),
                    "cohort_factors": step_factors,
                    "iso_child_total": float(meta["iso_child_total"]),
                    "redev_완료수": float(meta["redev_완료수"]),
                    "redev_진행중수": float(meta["redev_진행중수"]),
                    "redev_예정수": float(meta["redev_예정수"]),
                    "is_new_school": float(meta["is_new_school"]),
                }
                rows.append(row)

    df = pd.DataFrame(rows)
    if df.empty:
        raise ValueError("재귀 백테스트 행이 생성되지 않았습니다.")
    return df


def predict_model1_recursive(
    history_values: list[float],
    cohort_factors: list[float],
    row: pd.Series,
    model: LGBMRegressor,
    blend_alpha: float,
    feature_names: list[str],
) -> float:
    history = [float(v) for v in history_values]
    for cohort_factor in cohort_factors:
        feature_row = make_history_features(history)
        feature_row["iso_child_total"] = float(row["iso_child_total"])
        feature_row["redev_완료수"] = float(row["redev_완료수"])
        feature_row["redev_진행중수"] = float(row["redev_진행중수"])
        feature_row["redev_예정수"] = float(row["redev_예정수"])
        feature_row["is_new_school"] = float(row["is_new_school"])
        feature_row["gu"] = str(row["gu"])
        X_step = pd.get_dummies(pd.DataFrame([feature_row]), columns=["gu"], dtype=float)
        X_step = X_step.reindex(columns=feature_names, fill_value=0.0)
        base_adj = feature_row["base_next_pred"] * (1.0 + blend_alpha * (float(cohort_factor) - 1.0))
        pred = float(np.clip(base_adj + model.predict(X_step)[0], 0, None))
        pred = stabilize_future_prediction(history[-1], pred)
        history.append(pred)
    return float(history[-1])


def predict_model2_recursive(
    history_values: list[float],
    cohort_factors: list[float],
    row: pd.Series,
    model: Pipeline,
    blend_alpha: float,
    feature_names: list[str],
) -> float:
    history = [float(v) for v in history_values]
    for cohort_factor in cohort_factors:
        feature_row = make_history_features(history)
        feature_row["is_new_school"] = float(row["is_new_school"])
        X_step = pd.DataFrame([feature_row])[feature_names]
        growth_pred = float(np.clip(model.predict(X_step)[0], np.log(0.5), np.log(1.5)))
        raw_pred = float(((history[-1] + 1.0) * np.exp(growth_pred)) - 1.0)
        pred = float(np.clip(raw_pred * (1.0 + blend_alpha * (float(cohort_factor) - 1.0)), 0, None))
        pred = stabilize_future_prediction(history[-1], pred)
        history.append(pred)
    return float(history[-1])


def evaluate_recursive_horizons(
    one_step_df: pd.DataFrame,
    recursive_df: pd.DataFrame,
    model1_alpha: float,
    model2_params: dict[str, float],
    model2_alpha: float,
) -> dict[str, object]:
    model1_features = list(build_model1_matrix(one_step_df).columns)
    model2_features = list(build_model2_matrix(one_step_df).columns)
    results: dict[str, object] = {
        "validation": "walk_forward_recursive",
        "horizons": {},
    }

    for horizon in sorted(int(h) for h in recursive_df["horizon"].unique().tolist()):
        horizon_df = recursive_df[recursive_df["horizon"] == horizon].reset_index(drop=True)
        wf_years = walk_forward_years(horizon_df)
        model1_oof = np.full(len(horizon_df), np.nan, dtype=float)
        model2_oof = np.full(len(horizon_df), np.nan, dtype=float)

        for year in wf_years:
            train_df = one_step_df[one_step_df["target_year"] < year].reset_index(drop=True)
            valid_mask = horizon_df["target_year"] == year
            valid_df = horizon_df.loc[valid_mask].reset_index(drop=True)
            if train_df.empty or valid_df.empty:
                continue

            X1_train = build_model1_matrix(train_df)
            y1_train = train_df["target_students"].to_numpy(dtype=float)
            base1_train = train_df["base_next_pred"].to_numpy(dtype=float) * (
                1.0 + model1_alpha * (train_df["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0)
            )
            model1 = LGBMRegressor(**LIGHTGBM_PARAMS)
            model1.fit(X1_train, y1_train - base1_train)

            X2_train = build_model2_matrix(train_df)
            last_train = train_df["last_students"].to_numpy(dtype=float)
            y2_train = np.log((train_df["target_students"].to_numpy(dtype=float) + 1.0) / (last_train + 1.0))
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
            model2.fit(X2_train, y2_train)

            valid_indices = np.where(valid_mask.to_numpy())[0]
            for local_idx, row in valid_df.iterrows():
                model1_oof[valid_indices[local_idx]] = predict_model1_recursive(
                    history_values=row["history_values"],
                    cohort_factors=row["cohort_factors"],
                    row=row,
                    model=model1,
                    blend_alpha=model1_alpha,
                    feature_names=model1_features,
                )
                model2_oof[valid_indices[local_idx]] = predict_model2_recursive(
                    history_values=row["history_values"],
                    cohort_factors=row["cohort_factors"],
                    row=row,
                    model=model2,
                    blend_alpha=model2_alpha,
                    feature_names=model2_features,
                )

        target = horizon_df["target_students"].to_numpy(dtype=float)
        model1_valid = np.isfinite(model1_oof)
        model2_valid = np.isfinite(model2_oof)

        model1_result_df = horizon_df.loc[model1_valid, ["학교ID", "학교명", "origin_year", "target_year", "target_students"]].copy()
        model1_result_df["prediction"] = model1_oof[model1_valid]
        model2_result_df = horizon_df.loc[model2_valid, ["학교ID", "학교명", "origin_year", "target_year", "target_students"]].copy()
        model2_result_df["prediction"] = model2_oof[model2_valid]

        results["horizons"][str(horizon)] = {
            "rows": int(len(horizon_df)),
            "walk_forward_years": wf_years,
            "model1": {
                "overall": regression_metrics(target[model1_valid], model1_oof[model1_valid]),
                "by_year": metrics_by_year(model1_result_df.rename(columns={"prediction": "pred"}), "pred"),
            },
            "model2": {
                "overall": regression_metrics(target[model2_valid], model2_oof[model2_valid]),
                "by_year": metrics_by_year(model2_result_df.rename(columns={"prediction": "pred"}), "pred"),
            },
        }

    mid_horizons = [results["horizons"][key] for key in ("2", "3") if key in results["horizons"]]
    if mid_horizons:
        results["mid_term_average"] = {
            "model1": {
                metric: float(np.mean([item["model1"]["overall"][metric] for item in mid_horizons]))
                for metric in ("r2", "mae", "rmse")
            },
            "model2": {
                metric: float(np.mean([item["model2"]["overall"][metric] for item in mid_horizons]))
                for metric in ("r2", "mae", "rmse")
            },
        }
    return results


def build_model1_matrix(df: pd.DataFrame) -> pd.DataFrame:
    feature_cols = [
        "history_count",
        "last_students",
        "prev_students",
        "prev2_students",
        "delta1",
        "delta2",
        "delta3",
        "pct1",
        "pct2",
        "weighted_slope",
        "recent_mean3",
        "recent_std3",
        "hist_mean",
        "hist_std",
        "level_to_mean_ratio",
        "base_next_pred",
        "iso_child_total",
        "redev_완료수",
        "redev_진행중수",
        "redev_예정수",
        "is_new_school",
    ]
    matrix = df[feature_cols + ["gu"]].copy()
    return pd.get_dummies(matrix, columns=["gu"], dtype=float)


def evaluate_model1(df: pd.DataFrame) -> tuple[dict[str, object], float, LGBMRegressor, list[str]]:
    X = build_model1_matrix(df)
    y = df["target_students"].to_numpy(dtype=float)
    target_years = df["target_year"].to_numpy(dtype=int)
    wf_years = walk_forward_years(df)
    best_result: dict[str, object] | None = None
    best_alpha = 0.0

    for blend in PROPHET_BLEND_GRID:
        oof = np.full(len(df), np.nan, dtype=float)
        for year in wf_years:
            train_idx = np.where(target_years < year)[0]
            valid_idx = np.where(target_years == year)[0]
            if len(train_idx) == 0 or len(valid_idx) == 0:
                continue
            base_train = df.iloc[train_idx]["base_next_pred"].to_numpy(dtype=float) * (
                1.0 + blend * (df.iloc[train_idx]["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0)
            )
            base_valid = df.iloc[valid_idx]["base_next_pred"].to_numpy(dtype=float) * (
                1.0 + blend * (df.iloc[valid_idx]["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0)
            )
            residual_train = y[train_idx] - base_train
            model = LGBMRegressor(**LIGHTGBM_PARAMS)
            model.fit(X.iloc[train_idx], residual_train)
            residual_pred = model.predict(X.iloc[valid_idx])
            oof[valid_idx] = np.clip(base_valid + residual_pred, 0, None)

        valid_mask = np.isfinite(oof)
        result_df = df.loc[valid_mask, ["학교ID", "학교명", "gu", "target_year", "target_students"]].copy()
        result_df["prediction"] = oof[valid_mask]
        overall = regression_metrics(y[valid_mask], oof[valid_mask])
        candidate = {
            "blend_alpha": blend,
            "validation": "walk_forward",
            "walk_forward_years": wf_years,
            "overall": overall,
            "by_year": metrics_by_year(result_df.rename(columns={"prediction": "pred"}), "pred"),
            "oof": oof,
        }
        if best_result is None or float(candidate["overall"]["r2"]) > float(best_result["overall"]["r2"]):
            best_result = candidate
            best_alpha = blend

    assert best_result is not None
    base_full = df["base_next_pred"].to_numpy(dtype=float) * (1.0 + best_alpha * (df["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0))
    residual_full = y - base_full
    final_model = LGBMRegressor(**LIGHTGBM_PARAMS)
    final_model.fit(X, residual_full)

    importances = (
        pd.DataFrame({"feature": X.columns, "importance": final_model.feature_importances_})
        .sort_values("importance", ascending=False)
        .head(10)
        .to_dict("records")
    )
    best_result["top_features"] = importances
    return best_result, best_alpha, final_model, list(X.columns)


def build_model2_matrix(df: pd.DataFrame) -> pd.DataFrame:
    return df[
        [
            "history_count",
            "last_students",
            "prev_students",
            "prev2_students",
            "delta1",
            "delta2",
            "delta3",
            "pct1",
            "pct2",
            "weighted_slope",
            "recent_mean3",
            "recent_std3",
            "hist_mean",
            "hist_std",
            "level_to_mean_ratio",
            "base_next_pred",
            "is_new_school",
        ]
    ].copy()


def evaluate_model2(df: pd.DataFrame) -> tuple[dict[str, object], dict[str, float], float, Pipeline, list[str]]:
    X = build_model2_matrix(df)
    feature_names = list(X.columns)
    last_students = df["last_students"].to_numpy(dtype=float)
    target_years = df["target_year"].to_numpy(dtype=int)
    wf_years = walk_forward_years(df)
    y = np.log((df["target_students"].to_numpy(dtype=float) + 1.0) / (last_students + 1.0))

    best_result: dict[str, object] | None = None
    best_params: dict[str, float] | None = None
    best_blend = 0.0

    for params in ELASTIC_GRID:
        for blend in PROPHET_BLEND_GRID:
            oof = np.full(len(df), np.nan, dtype=float)
            for year in wf_years:
                train_idx = np.where(target_years < year)[0]
                valid_idx = np.where(target_years == year)[0]
                if len(train_idx) == 0 or len(valid_idx) == 0:
                    continue
                model = Pipeline(
                    [
                        ("scaler", StandardScaler()),
                        (
                            "elastic",
                            ElasticNet(
                                alpha=float(params["alpha"]),
                                l1_ratio=float(params["l1_ratio"]),
                                max_iter=20000,
                                random_state=42,
                            ),
                        ),
                    ]
                )
                model.fit(X.iloc[train_idx], y[train_idx])
                growth_pred = model.predict(X.iloc[valid_idx])
                raw_pred = ((df.iloc[valid_idx]["last_students"].to_numpy(dtype=float) + 1.0) * np.exp(growth_pred)) - 1.0
                adjusted = raw_pred * (
                    1.0 + blend * (df.iloc[valid_idx]["cohort_factor_proxy"].to_numpy(dtype=float) - 1.0)
                )
                oof[valid_idx] = np.clip(adjusted, 0, None)

            valid_mask = np.isfinite(oof)
            result_df = df.loc[valid_mask, ["학교ID", "학교명", "gu", "target_year", "target_students"]].copy()
            result_df["prediction"] = oof[valid_mask]
            overall = regression_metrics(df.loc[valid_mask, "target_students"].to_numpy(dtype=float), oof[valid_mask])
            candidate = {
                "elastic_alpha": params["alpha"],
                "elastic_l1_ratio": params["l1_ratio"],
                "blend_alpha": blend,
                "validation": "walk_forward",
                "walk_forward_years": wf_years,
                "overall": overall,
                "by_year": metrics_by_year(result_df.rename(columns={"prediction": "pred"}), "pred"),
                "oof": oof,
            }
            if best_result is None or float(candidate["overall"]["r2"]) > float(best_result["overall"]["r2"]):
                best_result = candidate
                best_params = {"alpha": float(params["alpha"]), "l1_ratio": float(params["l1_ratio"])}
                best_blend = blend

    assert best_result is not None and best_params is not None
    final_model = Pipeline(
        [
            ("scaler", StandardScaler()),
            (
                "elastic",
                ElasticNet(
                    alpha=best_params["alpha"],
                    l1_ratio=best_params["l1_ratio"],
                    max_iter=20000,
                    random_state=42,
                ),
            ),
        ]
    )
    final_model.fit(X, y)
    coefs = final_model.named_steps["elastic"].coef_
    coef_df = (
        pd.DataFrame({"feature": feature_names, "coef": coefs, "abs_coef": np.abs(coefs)})
        .sort_values("abs_coef", ascending=False)
        .head(10)
        .to_dict("records")
    )
    best_result["top_features"] = coef_df
    return best_result, best_params, best_blend, final_model, feature_names


def build_future_rows(
    trend: pd.DataFrame,
    structural: pd.DataFrame,
    gu_future: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, list[float]]]:
    structural_map = structural.set_index("학교ID").to_dict("index")
    future_map = gu_future.set_index("gu").to_dict("index")
    rows: list[dict[str, float | int | str]] = []
    history_map: dict[str, list[float]] = {}
    for school_id, group in trend.groupby("학교ID", sort=False):
        group = group.sort_values("연도").reset_index(drop=True)
        meta = structural_map.get(school_id)
        if meta is None:
            continue
        history_values = group["학생수"].astype(float).tolist()
        history_map[str(school_id)] = history_values
        gu = str(group["gu"].iloc[0])
        future_info = future_map.get(gu, {})
        annual_2029 = float(future_info.get("annual_factor_2029", 1.0))
        annual_2031 = float(future_info.get("annual_factor_2031", 1.0))
        for target_year in range(2026, 2032):
            cohort_factor = annual_2029 if target_year <= 2029 else annual_2031
            features = make_history_features(history_values)
            row = {
                "학교ID": school_id,
                "학교명": str(group["학교명"].iloc[0]),
                "gu": gu,
                "target_year": target_year,
                "cohort_factor_proxy": cohort_factor,
            }
            row.update(features)
            row["iso_child_total"] = float(meta["iso_child_total"])
            row["redev_완료수"] = float(meta["redev_완료수"])
            row["redev_진행중수"] = float(meta["redev_진행중수"])
            row["redev_예정수"] = float(meta["redev_예정수"])
            row["is_new_school"] = float(meta["is_new_school"])
            rows.append(row)
            history_values = history_values + [history_values[-1]]
        history_map[str(school_id)] = group["학생수"].astype(float).tolist()
    return pd.DataFrame(rows), history_map


def recursive_forecast(
    trend: pd.DataFrame,
    structural: pd.DataFrame,
    gu_future: pd.DataFrame,
    model1: LGBMRegressor,
    model1_alpha: float,
    model1_features: list[str],
    model2: Pipeline,
    model2_alpha: float,
    model2_features: list[str],
) -> pd.DataFrame:
    structural_map = structural.set_index("학교ID").to_dict("index")
    future_map = gu_future.set_index("gu").to_dict("index")
    rows: list[dict[str, float | int | str]] = []

    for school_id, group in trend.groupby("학교ID", sort=False):
        group = group.sort_values("연도").reset_index(drop=True)
        meta = structural_map.get(school_id)
        if meta is None:
            continue
        gu = str(group["gu"].iloc[0])
        future_info = future_map.get(gu, {})
        annual_2029 = float(future_info.get("annual_factor_2029", 1.0))
        annual_2031 = float(future_info.get("annual_factor_2031", 1.0))
        history_model1 = group["학생수"].astype(float).tolist()
        history_model2 = group["학생수"].astype(float).tolist()
        out = {
            "학교ID": school_id,
            "학교명": str(group["학교명"].iloc[0]),
            "gu": gu,
            "current_students_2025": int(round(float(group["학생수"].iloc[-1]))),
            "cohort_change_2029": float(future_info.get("cohort_change_2029", 1.0)),
            "cohort_change_2031": float(future_info.get("cohort_change_2031", 1.0)),
        }
        for year in range(2026, 2032):
            cohort_factor = annual_2029 if year <= 2029 else annual_2031

            row1 = make_history_features(history_model1)
            row1["iso_child_total"] = float(meta["iso_child_total"])
            row1["redev_완료수"] = float(meta["redev_완료수"])
            row1["redev_진행중수"] = float(meta["redev_진행중수"])
            row1["redev_예정수"] = float(meta["redev_예정수"])
            row1["is_new_school"] = float(meta["is_new_school"])
            row1["gu"] = gu
            X1 = pd.get_dummies(pd.DataFrame([row1]), columns=["gu"], dtype=float)
            X1 = X1.reindex(columns=model1_features, fill_value=0.0)
            base_adj = row1["base_next_pred"] * (1.0 + model1_alpha * (cohort_factor - 1.0))
            pred1 = float(np.clip(base_adj + model1.predict(X1)[0], 0, None))
            pred1 = stabilize_future_prediction(history_model1[-1], pred1)
            history_model1.append(pred1)

            row2 = make_history_features(history_model2)
            row2["is_new_school"] = float(meta["is_new_school"])
            X2 = pd.DataFrame([row2])[model2_features]
            growth_pred2 = float(np.clip(model2.predict(X2)[0], np.log(0.5), np.log(1.5)))
            raw2 = float(((history_model2[-1] + 1.0) * np.exp(growth_pred2)) - 1.0)
            pred2 = float(np.clip(raw2 * (1.0 + model2_alpha * (cohort_factor - 1.0)), 0, None))
            pred2 = stabilize_future_prediction(history_model2[-1], pred2)
            history_model2.append(pred2)

            if year in (2029, 2031):
                out[f"model1_forecast_{year}"] = int(round(pred1))
                out[f"model2_forecast_{year}"] = int(round(pred2))

        rows.append(out)

    return pd.DataFrame(rows).sort_values(["gu", "학교명"]).reset_index(drop=True)


def write_markdown(
    model1_result: dict[str, object],
    model2_result: dict[str, object],
    model1_alpha: float,
    model2_params: dict[str, float],
    model2_alpha: float,
    recursive_result: dict[str, object],
) -> None:
    lines = [
        "# 학교별 학생수 예측 모델 비교",
        "",
        "## 검증 설정",
        "- 데이터: 2020~2025 학교별 학생수 시계열",
        "- 검증 단위: 학교별 1년 앞 예측 백테스트 행(최소 2년 이력 이후)",
        "- 분할 방식: walk-forward (2023, 2024, 2025를 각각 미래 연도로 검증)",
        "",
        "## 모델 1",
        "- 구조: 가중 선형추세 기본값 + LightGBM 잔차보정",
        f"- 구 Prophet 보정 가중치(alpha): {model1_alpha}",
        f"- R2: {model1_result['overall']['r2']:.4f}",
        f"- MAE: {model1_result['overall']['mae']:.2f}",
        f"- RMSE: {model1_result['overall']['rmse']:.2f}",
        "",
        "상위 설명 변수:",
    ]
    for item in model1_result["top_features"]:
        lines.append(f"- {item['feature']}: importance {item['importance']}")

    lines += [
        "",
        "## 모델 2",
        "- 구조: ElasticNet 시계열 피처 + 구 Prophet 보정",
        f"- ElasticNet alpha: {model2_params['alpha']}",
        f"- ElasticNet l1_ratio: {model2_params['l1_ratio']}",
        f"- 구 Prophet 보정 가중치(alpha): {model2_alpha}",
        f"- R2: {model2_result['overall']['r2']:.4f}",
        f"- MAE: {model2_result['overall']['mae']:.2f}",
        f"- RMSE: {model2_result['overall']['rmse']:.2f}",
        "",
        "상위 설명 변수:",
    ]
    for item in model2_result["top_features"]:
        lines.append(f"- {item['feature']}: coef {item['coef']:.6f}")

    winner = "모델 1" if model1_result["overall"]["r2"] >= model2_result["overall"]["r2"] else "모델 2"
    lines += [
        "",
        "## 결론",
        f"- R2 기준 우세 모델: {winner}",
        "- 모델 1은 추세선과 잔차보정이 분리되어 해석이 쉽고,",
        "- 모델 2는 계수가 직접 보여 설명력이 좋지만 비선형 보정은 약합니다.",
        "",
    ]
    if "mid_term_average" in recursive_result:
        lines += [
            "## 중기 재귀 검증",
            "- 기준: 1년 모델을 2년/3년 연속 적용한 walk-forward 백테스트",
            f"- 모델 1 평균 R2(2~3년): {recursive_result['mid_term_average']['model1']['r2']:.4f}",
            f"- 모델 2 평균 R2(2~3년): {recursive_result['mid_term_average']['model2']['r2']:.4f}",
            f"- 모델 1 평균 MAE(2~3년): {recursive_result['mid_term_average']['model1']['mae']:.2f}",
            f"- 모델 2 평균 MAE(2~3년): {recursive_result['mid_term_average']['model2']['mae']:.2f}",
            "",
        ]
    COMPARISON_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    trend, structural, gu_year, gu_future = load_frames()
    backtest_df = build_backtest_rows(trend, structural, gu_year)
    recursive_backtest_df = build_recursive_backtest_rows(trend, structural, gu_year)

    model1_result, model1_alpha, model1, model1_features = evaluate_model1(backtest_df)
    model2_result, model2_params, model2_alpha, model2, model2_features = evaluate_model2(backtest_df)
    recursive_result = evaluate_recursive_horizons(
        backtest_df,
        recursive_backtest_df,
        model1_alpha,
        model2_params,
        model2_alpha,
    )

    forecast_df = recursive_forecast(
        trend,
        structural,
        gu_future,
        model1,
        model1_alpha,
        model1_features,
        model2,
        model2_alpha,
        model2_features,
    )
    forecast_df.to_csv(FORECAST_CSV, index=False, encoding="utf-8-sig")

    summary = {
        "backtest_rows": int(len(backtest_df)),
        "recursive_backtest_rows": int(len(recursive_backtest_df)),
        "schools": int(backtest_df["학교ID"].nunique()),
        "model1": {
            "name": "weighted_trend_plus_lgbm_residual",
            "blend_alpha": model1_alpha,
            **{k: v for k, v in model1_result.items() if k != "oof"},
        },
        "model2": {
            "name": "elasticnet_timeseries_plus_prophet",
            "elastic_alpha": model2_params["alpha"],
            "elastic_l1_ratio": model2_params["l1_ratio"],
            "blend_alpha": model2_alpha,
            **{k: v for k, v in model2_result.items() if k != "oof"},
        },
        "recursive_walk_forward": recursive_result,
        "forecast_csv": str(FORECAST_CSV),
    }
    COMPARISON_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(model1_result, model2_result, model1_alpha, model2_params, model2_alpha, recursive_result)

    print("backtest rows:", len(backtest_df))
    print("recursive backtest rows:", len(recursive_backtest_df))
    print("model1 r2:", f"{model1_result['overall']['r2']:.4f}")
    print("model2 r2:", f"{model2_result['overall']['r2']:.4f}")
    if "mid_term_average" in recursive_result:
        print("model1 mid-term r2:", f"{recursive_result['mid_term_average']['model1']['r2']:.4f}")
        print("model2 mid-term r2:", f"{recursive_result['mid_term_average']['model2']['r2']:.4f}")
    print("json:", COMPARISON_JSON)
    print("md:", COMPARISON_MD)
    print("forecast:", FORECAST_CSV)


if __name__ == "__main__":
    main()
