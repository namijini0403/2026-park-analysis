# -*- coding: utf-8 -*-
"""
Train the requested XGBoost and LightGBM models and export forecast tables.

Assumption:
- population_grid_1k.csv does not contain gu identifiers, so we estimate a gu-level
  average 1km-grid total population by scaling school-level iso_child_total with the
  citywide child-share observed in population_grid_1k.csv.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from joblib import dump
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_squared_error,
    r2_score,
    roc_auc_score,
)
from sklearn.base import clone
from sklearn.model_selection import LeaveOneOut, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.cluster import KMeans
from xgboost import XGBRegressor

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
RAW = ROOT / "data/raw"

POP_GRID_CSV = DATA / "population_grid_1k.csv"
PRIORITY_CSV = DATA / "school_priority.csv"
GU_SUMMARY_CSV = DATA / "gu_summary.csv"
YEARLY_STUDENT_XLSX = RAW / "2025_연도별 학생수.xlsx"

FORECAST_CSV = DATA / "beneficiary_forecast.csv"
PRIORITY_ML_CSV = DATA / "priority_ml.csv"
SHAP_PNG = DATA / "shap_summary.png"
CASE_TYPE_MODEL_PKL = DATA / "lightgbm_case_type_best.pkl"

SCHOOL_ID_COL_IDX = 0
SCHOOL_NAME_COL_IDX = 1
GU_COL = "gu"
REDEV_COL_IDXS = [17, 18, 19]


CLUSTER_FEATURES = [
    "iso_park_count",
    "iso_park_area",
    "iso_child_total",
    "access_ratio",
    "gap_count",
]

REGRESSION_FEATURES = [
    "gu_avg_grid_total_pop",
    "redev_완료수",
    "redev_진행중수",
    "redev_예정수",
    "iso_park_count",
    "gap_count",
    "access_ratio",
    "cluster",
]

# Leakage-reduced LightGBM feature set:
# priority_score is derived from case_type and child-population thresholds, and
# variables such as gap_count / cluster / iso_park_count / access_ratio are
# directly or indirectly connected to that rule logic. We therefore keep only
# child_pop_quartile and redev_total for the final classifier.
CLASSIFICATION_FEATURES = [
    "child_pop_quartile",
    "redev_total",
]


def round_columns(df: pd.DataFrame, columns: Iterable[str], digits: int = 3) -> pd.DataFrame:
    for col in columns:
        if col in df.columns:
            df[col] = df[col].round(digits)
    return df


def build_cluster(df: pd.DataFrame) -> pd.Series:
    features = df[CLUSTER_FEATURES].copy()
    features["access_ratio"] = features["access_ratio"].fillna(0)
    scaled = StandardScaler().fit_transform(features)
    labels = KMeans(n_clusters=3, random_state=42, n_init=10).fit_predict(scaled)
    return pd.Series(labels, index=df.index, name="cluster")


def load_citywide_elementary_decline() -> dict[str, float]:
    yearly = pd.read_excel(YEARLY_STUDENT_XLSX, sheet_name="Sheet0")
    body = yearly.iloc[2:].copy()
    year_col, sido_col, elementary_col = body.columns[0], body.columns[1], body.columns[6]
    body = body[body[year_col].astype(str).str.fullmatch(r"\d{4}")]
    incheon = body[body[sido_col].astype(str) == "인천"].copy()

    elementary_2019 = float(incheon.loc[incheon[year_col].astype(str) == "2019", elementary_col].iloc[0])
    elementary_2024 = float(incheon.loc[incheon[year_col].astype(str) == "2024", elementary_col].iloc[0])
    annual_factor = (elementary_2024 / elementary_2019) ** (1 / 5)

    return {
        "elementary_2019": elementary_2019,
        "elementary_2024": elementary_2024,
        "annual_factor": annual_factor,
        "factor_2029": annual_factor**5,
        "factor_2031": annual_factor**7,
    }


def prepare_base_frame() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    pop = pd.read_csv(POP_GRID_CSV, encoding="utf-8-sig")
    schools = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    gu_summary = pd.read_csv(GU_SUMMARY_CSV, encoding="utf-8-sig")

    schools["access_ratio"] = schools["access_ratio"].fillna(0)
    schools["cluster"] = build_cluster(schools)
    schools["redev_total"] = schools[["redev_완료수", "redev_진행중수", "redev_예정수"]].sum(axis=1)
    schools["priority_binary"] = (schools["priority_score"] >= 3).astype(int)

    child_share = (pop["child_pop_0_5"] + pop["child_pop_6_12"]).sum() / pop["total_pop"].replace(0, np.nan).sum()
    schools["estimated_total_pop_from_grid"] = np.where(
        child_share > 0,
        schools["iso_child_total"] / child_share,
        np.nan,
    )

    gu_pop = (
        schools.groupby("gu", as_index=False)["estimated_total_pop_from_grid"]
        .mean()
        .rename(columns={"estimated_total_pop_from_grid": "gu_avg_grid_total_pop"})
    )
    schools = schools.merge(gu_pop, on="gu", how="left")

    gu_base = (
        schools.groupby("gu", as_index=False)
        .agg(
            gu_current_mean_child=("iso_child_total", "mean"),
            gu_current_total_child=("iso_child_total", "sum"),
            gu_redev_per_school=("redev_total", "mean"),
        )
        .merge(gu_summary[["gu", "total_school_count", "avg_gap_count"]], on="gu", how="left")
    )

    city_mean_child = gu_base["gu_current_mean_child"].mean()
    density_index = gu_base["gu_current_mean_child"] / city_mean_child

    gu_base["cohort_change_2029"] = np.clip(
        1.0 + 0.18 * (density_index - 1.0) + 0.015 * gu_base["gu_redev_per_school"],
        0.88,
        1.22,
    )
    gu_base["cohort_change_2031"] = np.clip(
        1.0 + 0.28 * (density_index - 1.0) + 0.025 * gu_base["gu_redev_per_school"],
        0.84,
        1.30,
    )

    schools = schools.merge(
        gu_base[["gu", "cohort_change_2029", "cohort_change_2031"]],
        on="gu",
        how="left",
    )
    return pop, schools, gu_base


def train_xgboost_forecast(schools: pd.DataFrame, pop: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    X = schools[REGRESSION_FEATURES].copy()
    y = schools["iso_child_total"].copy()

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.0,
        reg_lambda=1.0,
        min_child_weight=2,
        random_state=42,
        objective="reg:squarederror",
    )

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    oof_pred = cross_val_predict(model, X, y, cv=cv, method="predict")
    rmse = float(np.sqrt(mean_squared_error(y, oof_pred)))
    r2 = r2_score(y, oof_pred)

    model.fit(X, y)
    pred_current = model.predict(X)
    residual_std = float(np.std(y - oof_pred, ddof=1))

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X, show=False, plot_size=None)
    plt.title("XGBoost SHAP Summary")
    plt.tight_layout()
    plt.savefig(SHAP_PNG, dpi=180, bbox_inches="tight")
    plt.close()

    city_child_share = (pop["child_pop_0_5"] + pop["child_pop_6_12"]).sum() / pop["total_pop"].replace(0, np.nan).sum()
    forecast = schools[
        [
            "학교ID",
            "학교명",
            "gu",
            "iso_child_total",
            "cluster",
            "gu_avg_grid_total_pop",
            "redev_완료수",
            "redev_진행중수",
            "redev_예정수",
            "iso_park_count",
            "gap_count",
            "access_ratio",
            "cohort_change_2029",
            "cohort_change_2031",
        ]
    ].copy()
    forecast = forecast.rename(columns={"iso_child_total": "current_beneficiary"})
    forecast["predicted_current"] = np.clip(pred_current, 0, None).round().astype(int)
    forecast["forecast_2029"] = np.clip(
        forecast["predicted_current"] * forecast["cohort_change_2029"], 0, None
    ).round().astype(int)
    forecast["forecast_2031"] = np.clip(
        forecast["predicted_current"] * forecast["cohort_change_2031"], 0, None
    ).round().astype(int)
    forecast["confidence_low"] = np.clip(forecast["predicted_current"] - 1.96 * residual_std, 0, None).round().astype(int)
    forecast["confidence_high"] = np.clip(forecast["predicted_current"] + 1.96 * residual_std, 0, None).round().astype(int)
    forecast["citywide_child_share"] = round(city_child_share, 6)
    forecast["redev_flag"] = (forecast[["redev_완료수", "redev_진행중수", "redev_예정수"]].sum(axis=1) > 0).map(
        {True: "Y", False: "N"}
    )
    forecast = round_columns(
        forecast,
        ["gu_avg_grid_total_pop", "cohort_change_2029", "cohort_change_2031"],
        digits=3,
    )
    forecast.to_csv(FORECAST_CSV, index=False, encoding="utf-8-sig")

    shap_importance = pd.DataFrame(
        {
            "feature": X.columns,
            "mean_abs_shap": np.abs(shap_values).mean(axis=0),
        }
    ).sort_values("mean_abs_shap", ascending=False)

    metrics = {
        "rmse": float(rmse),
        "r2": float(r2),
        "child_share": float(city_child_share),
        "residual_std": residual_std,
    }
    print("\n=== XGBoost regression metrics ===")
    print(f"RMSE: {rmse:.3f}")
    print(f"R2:   {r2:.3f}")
    print("\nTop SHAP features:")
    print(shap_importance.head(8).to_string(index=False))

    return forecast, metrics


def train_lightgbm_priority(schools: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float], pd.DataFrame]:
    X = schools[CLASSIFICATION_FEATURES].copy()
    y = schools["priority_binary"].copy()

    numeric_features = ["access_ratio", "gap_count", "redev_total", "iso_park_count", "cluster"]
    categorical_features = ["child_pop_quartile"]

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "num",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                    ]
                ),
                numeric_features,
            ),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    model = LGBMClassifier(
        n_estimators=250,
        learning_rate=0.05,
        max_depth=4,
        num_leaves=15,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        class_weight="balanced",
        verbose=-1,
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_proba = cross_val_predict(pipeline, X, y, cv=cv, method="predict_proba")[:, 1]
    oof_pred = (oof_proba >= 0.5).astype(int)

    auc = roc_auc_score(y, oof_proba)
    acc = accuracy_score(y, oof_pred)
    f1 = f1_score(y, oof_pred)

    pipeline.fit(X, y)
    full_proba = pipeline.predict_proba(X)[:, 1]
    full_pred = (full_proba >= 0.5).astype(int)

    result = schools[
        [
            "학교ID",
            "학교명",
            "gu",
            "priority_score",
            "access_ratio",
            "gap_count",
            "child_pop_quartile",
            "redev_total",
            "iso_park_count",
            "cluster",
        ]
    ].copy()
    result["rule_based_priority_3plus"] = y
    result["ml_probability"] = full_proba
    result["ml_priority_3plus"] = full_pred
    result["mismatch_flag"] = (result["rule_based_priority_3plus"] != result["ml_priority_3plus"]).astype(int)
    result["mismatch_type"] = np.select(
        [
            (result["rule_based_priority_3plus"] == 1) & (result["ml_priority_3plus"] == 0),
            (result["rule_based_priority_3plus"] == 0) & (result["ml_priority_3plus"] == 1),
        ],
        [
            "rule_high_ml_low",
            "rule_low_ml_high",
        ],
        default="match",
    )
    result = round_columns(result, ["ml_probability", "access_ratio", "gap_count"], digits=4)
    result.to_csv(PRIORITY_ML_CSV, index=False, encoding="utf-8-sig")

    mismatches = result[result["mismatch_flag"] == 1].copy()

    print("\n=== LightGBM classification metrics ===")
    print(f"ROC AUC:  {auc:.3f}")
    print(f"Accuracy: {acc:.3f}")
    print(f"F1 score: {f1:.3f}")
    print(f"Mismatches: {len(mismatches)}")
    if not mismatches.empty:
        print("\nRule-based vs ML mismatch cases:")
        print(
            mismatches[
                [
                    "학교명",
                    "gu",
                    "priority_score",
                    "rule_based_priority_3plus",
                    "ml_probability",
                    "ml_priority_3plus",
                    "mismatch_type",
                ]
            ]
            .sort_values(["mismatch_type", "ml_probability"], ascending=[True, False])
            .to_string(index=False)
        )

    metrics = {
        "roc_auc": float(auc),
        "accuracy": float(acc),
        "f1": float(f1),
        "mismatch_count": int(len(mismatches)),
    }
    return result, metrics, mismatches


def prepare_base_frame_v2() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    pop = pd.read_csv(POP_GRID_CSV, encoding="utf-8-sig")
    schools = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    gu_summary = pd.read_csv(GU_SUMMARY_CSV, encoding="utf-8-sig")

    schools["access_ratio"] = schools["access_ratio"].fillna(0)
    schools["cluster"] = build_cluster(schools)
    schools["redev_total"] = schools.iloc[:, REDEV_COL_IDXS].sum(axis=1)
    schools["priority_binary"] = (schools["priority_score"] >= 3).astype(int)
    if "outlier_type" in schools.columns:
        schools["outlier_type"] = schools["outlier_type"].fillna("normal").replace("", "normal")
    else:
        schools["outlier_type"] = "normal"

    child_share = (pop["child_pop_0_5"] + pop["child_pop_6_12"]).sum() / pop["total_pop"].replace(0, np.nan).sum()
    schools["estimated_total_pop_from_grid"] = np.where(
        child_share > 0,
        schools["iso_child_total"] / child_share,
        np.nan,
    )

    gu_pop = (
        schools.groupby(GU_COL, as_index=False)["estimated_total_pop_from_grid"]
        .mean()
        .rename(columns={"estimated_total_pop_from_grid": "gu_avg_grid_total_pop"})
    )
    schools = schools.merge(gu_pop, on=GU_COL, how="left")

    gu_base = (
        schools.groupby(GU_COL, as_index=False)
        .agg(
            gu_current_mean_child=("iso_child_total", "mean"),
            gu_current_total_child=("iso_child_total", "sum"),
            gu_redev_per_school=("redev_total", "mean"),
        )
        .merge(gu_summary[[GU_COL, "total_school_count", "avg_gap_count"]], on=GU_COL, how="left")
    )

    city_mean_child = gu_base["gu_current_mean_child"].mean()
    density_index = gu_base["gu_current_mean_child"] / city_mean_child
    decline = load_citywide_elementary_decline()
    local_decline_pressure = np.minimum(density_index - 1.0, 0.0)
    gu_base["cohort_change_2029"] = np.clip(
        1.0 + 0.18 * (density_index - 1.0) + 0.015 * gu_base["gu_redev_per_school"],
        0.88,
        1.22,
    )
    gu_base["cohort_change_2031"] = np.clip(
        1.0 + 0.28 * (density_index - 1.0) + 0.025 * gu_base["gu_redev_per_school"],
        0.84,
        1.30,
    )
    gu_base["cohort_change_2029_base"] = np.clip(
        decline["factor_2029"] * (1.0 + 0.12 * local_decline_pressure),
        0.70,
        1.00,
    )
    gu_base["cohort_change_2031_base"] = np.clip(
        decline["factor_2031"] * (1.0 + 0.18 * local_decline_pressure),
        0.64,
        1.00,
    )
    gu_base["citywide_birth_factor_2029"] = decline["factor_2029"]
    gu_base["citywide_birth_factor_2031"] = decline["factor_2031"]

    schools = schools.merge(
        gu_base[
            [
                GU_COL,
                "cohort_change_2029",
                "cohort_change_2031",
                "cohort_change_2029_base",
                "cohort_change_2031_base",
                "citywide_birth_factor_2029",
                "citywide_birth_factor_2031",
            ]
        ],
        on=GU_COL,
        how="left",
    )
    return pop, schools, gu_base


def train_xgboost_forecast_v2(schools: pd.DataFrame, pop: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    school_id_col = schools.columns[SCHOOL_ID_COL_IDX]
    school_name_col = schools.columns[SCHOOL_NAME_COL_IDX]
    redev_cols = [schools.columns[idx] for idx in REDEV_COL_IDXS]

    X = pd.DataFrame(
        {
            "gu_avg_grid_total_pop": schools["gu_avg_grid_total_pop"],
            "redev_completed": schools[redev_cols[0]],
            "redev_in_progress": schools[redev_cols[1]],
            "redev_planned": schools[redev_cols[2]],
            "iso_park_count": schools["iso_park_count"],
            "gap_count": schools["gap_count"],
            "access_ratio": schools["access_ratio"],
            "cluster": schools["cluster"],
        }
    )
    y = schools["iso_child_total"].to_numpy(dtype=float)

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_alpha=0.0,
        reg_lambda=1.0,
        min_child_weight=2,
        random_state=42,
        objective="reg:squarederror",
    )

    loo = LeaveOneOut()
    oof_pred = np.zeros(len(X), dtype=float)
    fold_rmse_values = []
    fold_r2_values = []
    target_variance = float(np.mean((y - y.mean()) ** 2))

    for train_idx, test_idx in loo.split(X):
        fold_model = clone(model)
        fold_model.fit(X.iloc[train_idx], y[train_idx])
        pred = float(fold_model.predict(X.iloc[test_idx])[0])
        true_value = float(y[test_idx][0])
        error = true_value - pred
        oof_pred[test_idx[0]] = pred
        fold_rmse_values.append(abs(error))
        if target_variance > 0:
            fold_r2_values.append(1.0 - (error**2) / target_variance)

    loocv_rmse = float(np.sqrt(mean_squared_error(y, oof_pred)))
    loocv_r2 = float(r2_score(y, oof_pred))
    residual_std = float(np.std(y - oof_pred, ddof=1))

    model.fit(X, y)
    pred_current = model.predict(X)

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)
    plt.figure(figsize=(10, 6))
    shap.summary_plot(shap_values, X, show=False, plot_size=None)
    plt.title("XGBoost SHAP Summary")
    plt.tight_layout()
    plt.savefig(SHAP_PNG, dpi=180, bbox_inches="tight")
    plt.close()

    city_child_share = (pop["child_pop_0_5"] + pop["child_pop_6_12"]).sum() / pop["total_pop"].replace(0, np.nan).sum()
    forecast = schools[
        [
            school_id_col,
            school_name_col,
            GU_COL,
            "iso_child_total",
            "cluster",
            "gu_avg_grid_total_pop",
            redev_cols[0],
            redev_cols[1],
            redev_cols[2],
            "iso_park_count",
            "gap_count",
            "access_ratio",
            "cohort_change_2029",
            "cohort_change_2031",
            "cohort_change_2029_base",
            "cohort_change_2031_base",
            "citywide_birth_factor_2029",
            "citywide_birth_factor_2031",
        ]
    ].copy()
    forecast = forecast.rename(columns={"iso_child_total": "current_beneficiary"})
    forecast["predicted_current"] = np.clip(pred_current, 0, None).round().astype(int)
    forecast["redev_flag"] = (forecast[[redev_cols[1], redev_cols[2]]].sum(axis=1) > 0)
    forecast["forecast_2029_base"] = np.clip(
        forecast["predicted_current"] * forecast["cohort_change_2029_base"],
        0,
        None,
    ).round().astype(int)
    forecast["forecast_2031_base"] = np.clip(
        forecast["predicted_current"] * forecast["cohort_change_2031_base"],
        0,
        None,
    ).round().astype(int)
    forecast["forecast_2029_redev"] = np.where(
        forecast["redev_flag"],
        np.clip(forecast["predicted_current"] * forecast["cohort_change_2029"], 0, None).round(),
        forecast["forecast_2029_base"],
    ).astype(int)
    forecast["forecast_2031_redev"] = np.where(
        forecast["redev_flag"],
        np.clip(forecast["predicted_current"] * forecast["cohort_change_2031"], 0, None).round(),
        forecast["forecast_2031_base"],
    ).astype(int)
    forecast["forecast_2029"] = forecast["forecast_2029_redev"]
    forecast["forecast_2031"] = forecast["forecast_2031_redev"]
    forecast["confidence_low"] = np.clip(forecast["predicted_current"] - 1.96 * residual_std, 0, None).round().astype(int)
    forecast["confidence_high"] = np.clip(forecast["predicted_current"] + 1.96 * residual_std, 0, None).round().astype(int)
    forecast["citywide_child_share"] = round(city_child_share, 6)
    forecast["redev_flag"] = forecast["redev_flag"].astype(bool)
    forecast = round_columns(
        forecast,
        [
            "gu_avg_grid_total_pop",
            "cohort_change_2029",
            "cohort_change_2031",
            "cohort_change_2029_base",
            "cohort_change_2031_base",
            "citywide_birth_factor_2029",
            "citywide_birth_factor_2031",
        ],
        digits=3,
    )
    forecast.to_csv(FORECAST_CSV, index=False, encoding="utf-8-sig")

    shap_importance = pd.DataFrame(
        {"feature": X.columns, "mean_abs_shap": np.abs(shap_values).mean(axis=0)}
    ).sort_values("mean_abs_shap", ascending=False)

    metrics = {
        "loocv_rmse_overall": loocv_rmse,
        "loocv_rmse_mean": float(np.mean(fold_rmse_values)),
        "loocv_rmse_std": float(np.std(fold_rmse_values, ddof=1)),
        "loocv_r2_overall": loocv_r2,
        "loocv_r2_mean": float(np.mean(fold_r2_values)),
        "loocv_r2_std": float(np.std(fold_r2_values, ddof=1)),
        "child_share": float(city_child_share),
        "residual_std": residual_std,
    }

    print("\n=== XGBoost LOOCV metrics ===")
    print(f"Overall RMSE: {loocv_rmse:.3f}")
    print(f"Fold RMSE mean ± std: {metrics['loocv_rmse_mean']:.3f} ± {metrics['loocv_rmse_std']:.3f}")
    print(f"Overall R2: {loocv_r2:.3f}")
    print(f"Fold R2 contribution mean ± std: {metrics['loocv_r2_mean']:.3f} ± {metrics['loocv_r2_std']:.3f}")
    print("\nTop SHAP features:")
    print(shap_importance.head(8).to_string(index=False))

    return forecast, metrics


def train_lightgbm_priority_v2(schools: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float], pd.DataFrame]:
    school_id_col = schools.columns[SCHOOL_ID_COL_IDX]
    school_name_col = schools.columns[SCHOOL_NAME_COL_IDX]

    # Exclude schools without a valid case_type (e.g. separate-bundle islands)
    schools = schools[schools["case_type"].notna()].copy()

    feature_cols = CLASSIFICATION_FEATURES.copy()
    if "outlier_type" in schools.columns:
        feature_cols.append("outlier_type")

    X = schools[feature_cols].copy()
    y = (schools["case_type"].to_numpy(dtype=int) - 1)

    numeric_features = ["redev_total"]
    categorical_features = ["child_pop_quartile"]
    if "outlier_type" in feature_cols:
        categorical_features.append("outlier_type")

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline(steps=[("imputer", SimpleImputer(strategy="median"))]), numeric_features),
            (
                "cat",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="most_frequent")),
                        ("encoder", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
                    ]
                ),
                categorical_features,
            ),
        ]
    )

    pipeline = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            (
                "model",
                LGBMClassifier(
                    n_estimators=250,
                    learning_rate=0.05,
                    max_depth=4,
                    num_leaves=15,
                    subsample=0.9,
                    colsample_bytree=0.9,
                    random_state=42,
                    class_weight="balanced",
                    objective="multiclass",
                    num_class=4,
                    verbose=-1,
                ),
            ),
        ]
    )

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    oof_pred = np.full(len(X), -1, dtype=int)
    oof_proba = np.zeros((len(X), 4), dtype=float)
    fold_accuracies: list[float] = []
    best_pipeline = None
    best_accuracy = -1.0

    for fold_no, (train_idx, test_idx) in enumerate(cv.split(X, y), start=1):
        fold_pipeline = clone(pipeline)
        fold_pipeline.fit(X.iloc[train_idx], y[train_idx])
        fold_proba = fold_pipeline.predict_proba(X.iloc[test_idx])
        fold_pred = fold_pipeline.predict(X.iloc[test_idx]).astype(int)
        oof_proba[test_idx] = fold_proba
        oof_pred[test_idx] = fold_pred
        fold_acc = float(accuracy_score(y[test_idx], fold_pred))
        fold_accuracies.append(fold_acc)
        print(f"Fold {fold_no} validation accuracy: {fold_acc:.4f}")
        if fold_acc > best_accuracy:
            best_accuracy = fold_acc
            best_pipeline = fold_pipeline

    acc = float(accuracy_score(y, oof_pred))
    conf = confusion_matrix(y, oof_pred, labels=[0, 1, 2, 3])

    if best_pipeline is not None:
        dump(best_pipeline, CASE_TYPE_MODEL_PKL)

    base_cols = [school_id_col, school_name_col, GU_COL, "case_type", "priority_score", "child_pop_quartile", "redev_total"]
    if "outlier_type" in schools.columns:
        base_cols.append("outlier_type")
    result = schools[base_cols].copy()
    result["rule_based_case_type"] = y + 1
    result["ml_case_type"] = oof_pred + 1
    result["ml_prob_case1"] = oof_proba[:, 0]
    result["ml_prob_case2"] = oof_proba[:, 1]
    result["ml_prob_case3"] = oof_proba[:, 2]
    result["ml_prob_case4"] = oof_proba[:, 3]
    result["mismatch_flag"] = (result["rule_based_case_type"] != result["ml_case_type"]).astype(int)
    result["mismatch_type"] = np.where(
        result["mismatch_flag"] == 1,
        "rule_case_vs_ml_case",
        "match",
    )
    result = round_columns(
        result,
        ["ml_prob_case1", "ml_prob_case2", "ml_prob_case3", "ml_prob_case4"],
        digits=4,
    )
    result.to_csv(PRIORITY_ML_CSV, index=False, encoding="utf-8-sig")

    mismatches = result[result["mismatch_flag"] == 1].copy()

    print("\n=== LightGBM Stratified 5-fold metrics ===")
    print(f"Mean accuracy: {np.mean(fold_accuracies):.4f}")
    print(f"Overall OOF accuracy: {acc:.4f}")
    print(f"Mismatches: {len(mismatches)}")
    print("\nConfusion matrix (rows=true case 1-4, cols=pred case 1-4):")
    print(conf)
    if not mismatches.empty:
        print("\nMismatch cases with ml_probability:")
        print(
            mismatches[
                [
                    school_name_col,
                    GU_COL,
                    "case_type",
                    "ml_case_type",
                    "ml_prob_case1",
                    "ml_prob_case2",
                    "ml_prob_case3",
                    "ml_prob_case4",
                ]
            ]
            .sort_values([GU_COL, school_name_col], ascending=[True, True])
            .to_string(index=False)
        )

    metrics = {
        "accuracy": acc,
        "accuracy_mean": float(np.mean(fold_accuracies)),
        "accuracy_std": float(np.std(fold_accuracies, ddof=1)),
        "mismatch_count": int(len(mismatches)),
        "confusion_matrix": conf.tolist(),
        "best_fold_accuracy": float(best_accuracy),
    }
    return result, metrics, mismatches


def main() -> None:
    pop, schools, gu_base = prepare_base_frame_v2()
    forecast_df, forecast_metrics = train_xgboost_forecast_v2(schools, pop)
    priority_df, cls_metrics, mismatches = train_lightgbm_priority_v2(schools)

    print("\n=== Scenario multipliers by gu ===")
    print(
        round_columns(
            gu_base[
                [
                    "gu",
                    "gu_current_mean_child",
                    "gu_redev_per_school",
                    "cohort_change_2029_base",
                    "cohort_change_2031_base",
                    "cohort_change_2029",
                    "cohort_change_2031",
                ]
            ].copy(),
            [
                "gu_current_mean_child",
                "gu_redev_per_school",
                "cohort_change_2029_base",
                "cohort_change_2031_base",
                "cohort_change_2029",
                "cohort_change_2031",
            ],
            digits=3,
        ).to_string(index=False)
    )

    print("\n=== Output files ===")
    print(FORECAST_CSV)
    print(PRIORITY_ML_CSV)
    print(SHAP_PNG)

    print("\n=== Forecast preview ===")
    print(
        forecast_df[
            [
                "학교명",
                "gu",
                "current_beneficiary",
                "predicted_current",
                "forecast_2029_base",
                "forecast_2031_base",
                "forecast_2029_redev",
                "forecast_2031_redev",
                "redev_flag",
            ]
        ]
        .sort_values("forecast_2031_redev", ascending=False)
        .head(15)
        .to_string(index=False)
    )

    print("\n=== Priority ML preview ===")
    print(
        priority_df[
            ["학교명", "gu", "case_type", "ml_case_type", "ml_prob_case1", "ml_prob_case2", "ml_prob_case3", "ml_prob_case4", "mismatch_flag"]
        ]
        .sort_values(["mismatch_flag", "ml_prob_case2"], ascending=[False, False])
        .head(15)
        .to_string(index=False)
    )

    print("\n=== Summary metrics ===")
    print(
        pd.DataFrame(
            [
                {"model": "xgboost_regressor", **forecast_metrics},
                {"model": "lightgbm_classifier", **cls_metrics},
            ]
        ).to_string(index=False)
    )
    print(f"\nTotal mismatches exported: {len(mismatches)}")


if __name__ == "__main__":
    main()
