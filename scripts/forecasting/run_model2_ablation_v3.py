from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import shap
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import KFold
from xgboost import XGBRegressor

ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
OUTPUT = ROOT / "output"

PRIORITY_CSV = DATA / "school_priority.csv"
SCHOOLS_CSV = DATA / "schools.csv"
BENEFICIARY_CSV = DATA / "beneficiary_forecast.csv"

RESULTS_JSON = OUTPUT / "model2_ablation_results.json"
SUMMARY_MD = OUTPUT / "model2_ablation_summary.md"

BASE_FEATURES = [
    "gu_avg_grid_total_pop",
    "redev_완료수",
    "redev_진행중수",
    "redev_예정수",
    "nearest_park_dist_m",
    "iso_park_area",
    "buf_park_area",
    "is_new_school",
    "위도",
    "경도",
]

FORBIDDEN_FEATURES = {
    "student_slope",
    "case_type",
    "case_label",
    "priority_score",
    "priority_rank",
    "is_low_access_tag",
    "is_case_conflict_tag",
    "is_separate_bundle_tag",
}

ABLATIONS = {
    "baseline": {
        "drop_base_features": [],
        "use_gu_dummies": True,
        "use_coords": True,
    },
    "minus_gu_one_hot": {
        "drop_base_features": [],
        "use_gu_dummies": False,
        "use_coords": True,
    },
    "minus_coords": {
        "drop_base_features": ["위도", "경도"],
        "use_gu_dummies": True,
        "use_coords": False,
    },
    "minus_buf_park_area": {
        "drop_base_features": ["buf_park_area"],
        "use_gu_dummies": True,
        "use_coords": True,
    },
    "minus_gu_one_hot_minus_coords": {
        "drop_base_features": ["위도", "경도"],
        "use_gu_dummies": False,
        "use_coords": False,
    },
}


def load_model_frame() -> pd.DataFrame:
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")[["학교ID", "위도", "경도"]]
    beneficiary = pd.read_csv(BENEFICIARY_CSV, encoding="utf-8-sig")[["학교ID", "gu_avg_grid_total_pop"]]

    df = priority.merge(schools, on="학교ID", how="left")
    df = df.merge(beneficiary, on="학교ID", how="left")

    required = [
        "학교ID",
        "학교명",
        "gu",
        "iso_child_total",
        "gu_avg_grid_total_pop",
        "redev_완료수",
        "redev_진행중수",
        "redev_예정수",
        "nearest_park_dist_m",
        "iso_park_area",
        "buf_park_area",
        "is_new_school",
        "위도",
        "경도",
        "cohort_change_2029_prophet",
        "cohort_change_2031_prophet",
    ]
    missing_cols = [col for col in required if col not in df.columns]
    if missing_cols:
        raise ValueError(f"필수 컬럼 누락: {missing_cols}")

    strict_non_null = required.copy()
    null_counts = df[strict_non_null].isna().sum()
    null_counts = {k: int(v) for k, v in null_counts.items() if int(v) > 0}
    if null_counts:
        raise ValueError(f"학습 필수 컬럼 결측 발견: {null_counts}")

    df["target_2029"] = df["iso_child_total"] * df["cohort_change_2029_prophet"]
    df["target_2031"] = df["iso_child_total"] * df["cohort_change_2031_prophet"]
    return df


def build_feature_frame(df: pd.DataFrame, cohort_col: str, config: dict[str, object]) -> pd.DataFrame:
    drop_base = set(config["drop_base_features"])
    base_features = [feature for feature in BASE_FEATURES if feature not in drop_base]
    X_parts = [df[base_features].copy()]

    if not config["use_coords"]:
        X_parts[0] = X_parts[0].drop(columns=["위도", "경도"], errors="ignore")

    if config["use_gu_dummies"]:
        gu_dummies = pd.get_dummies(df["gu"], prefix="gu", drop_first=True, dtype=int)
        X_parts.append(gu_dummies)

    X_parts.append(df[[cohort_col]].copy())
    X = pd.concat(X_parts, axis=1)

    forbidden_used = sorted(FORBIDDEN_FEATURES.intersection(X.columns))
    if forbidden_used:
        raise ValueError(f"금지 피처가 학습 프레임에 포함됨: {forbidden_used}")
    return X


def make_model() -> XGBRegressor:
    return XGBRegressor(random_state=42)


def kfold_metrics(X: pd.DataFrame, y: pd.Series | np.ndarray) -> tuple[list[dict[str, float]], np.ndarray]:
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    y_arr = np.asarray(y, dtype=float)
    oof = np.zeros(len(X), dtype=float)
    fold_scores: list[dict[str, float]] = []

    for fold, (train_idx, valid_idx) in enumerate(kf.split(X), start=1):
        model = make_model()
        model.fit(X.iloc[train_idx], y_arr[train_idx])
        pred = model.predict(X.iloc[valid_idx])
        oof[valid_idx] = pred
        fold_scores.append(
            {
                "fold": fold,
                "mae": float(mean_absolute_error(y_arr[valid_idx], pred)),
                "r2": float(r2_score(y_arr[valid_idx], pred)),
            }
        )
    return fold_scores, oof


def fit_shap_summary(X: pd.DataFrame, y: pd.Series | np.ndarray) -> list[dict[str, float]]:
    model = make_model()
    model.fit(X, np.asarray(y, dtype=float))
    explainer = shap.TreeExplainer(model)
    shap_values = explainer(X)
    top5 = (
        pd.DataFrame(
            {
                "feature": X.columns,
                "mean_abs_shap": np.abs(shap_values.values).mean(axis=0),
            }
        )
        .sort_values("mean_abs_shap", ascending=False)
        .head(5)
        .to_dict("records")
    )
    return top5


def summarize_scores(folds: list[dict[str, float]]) -> dict[str, float]:
    return {
        "mae_mean": float(np.mean([item["mae"] for item in folds])),
        "r2_mean": float(np.mean([item["r2"] for item in folds])),
    }


def dominance_flags(top_features: list[dict[str, float]], prophet_feature: str) -> dict[str, object]:
    top_names = [item["feature"] for item in top_features]
    top_values = {item["feature"]: float(item["mean_abs_shap"]) for item in top_features}
    prophet_value = top_values.get(prophet_feature, 0.0)
    coord_sum = top_values.get("위도", 0.0) + top_values.get("경도", 0.0)
    redev_sum = (
        top_values.get("redev_완료수", 0.0)
        + top_values.get("redev_진행중수", 0.0)
        + top_values.get("redev_예정수", 0.0)
    )

    return {
        "top_features": top_names,
        "prophet_in_top5": prophet_feature in top_names,
        "coords_in_top5": any(name in {"위도", "경도"} for name in top_names),
        "redev_in_top5": any(name.startswith("redev_") for name in top_names),
        "prophet_mean_abs_shap": prophet_value,
        "coord_mean_abs_shap_sum": coord_sum,
        "redev_mean_abs_shap_sum": redev_sum,
    }


def choose_recommendation(results: dict[str, object]) -> tuple[str, list[str]]:
    candidates: list[tuple[str, float, list[str]]] = []
    for model_name, model_result in results.items():
        r2029 = model_result["2029"]
        r2031 = model_result["2031"]
        avg_r2 = (r2029["r2_mean"] + r2031["r2_mean"]) / 2
        avg_mae = (r2029["mae_mean"] + r2031["mae_mean"]) / 2
        redundancy_penalty = 0.0

        if r2029["dominance"]["coords_in_top5"] or r2031["dominance"]["coords_in_top5"]:
            redundancy_penalty += 0.03
        if r2029["dominance"]["prophet_in_top5"] and r2031["dominance"]["prophet_in_top5"]:
            redundancy_penalty += 0.01
        if "gu_" in " ".join(r2029["features"]) or "gu_" in " ".join(r2031["features"]):
            redundancy_penalty += 0.01

        score = avg_r2 - (avg_mae / 1000.0) - redundancy_penalty
        reasons = [
            f"평균 R² {avg_r2:.4f}",
            f"평균 MAE {avg_mae:.2f}",
        ]
        if redundancy_penalty > 0:
            reasons.append(f"중복 축 패널티 {redundancy_penalty:.2f}")
        candidates.append((model_name, score, reasons))

    candidates.sort(key=lambda item: item[1], reverse=True)
    return candidates[0][0], candidates[0][2]


def make_summary_md(results: dict[str, object], recommended: str, reasons: list[str]) -> str:
    lines = [
        "# Model 2 v3 Ablation Summary",
        "",
        "## 실험 목적",
        "- 지역성/공원성 중복 가능성이 있는 축을 제거하면서 성능과 설명력의 균형을 비교했다.",
        "- 타겟 정의는 유지했고 `student_slope`와 결과 변수 계열은 피처에서 제외했다.",
        "",
        "## 모델별 성능",
        "| 모델 | 2029 R² | 2029 MAE | 2031 R² | 2031 MAE |",
        "|---|---:|---:|---:|---:|",
    ]

    for model_name, model_result in results.items():
        r2029 = model_result["2029"]
        r2031 = model_result["2031"]
        lines.append(
            f"| {model_name} | {r2029['r2_mean']:.4f} | {r2029['mae_mean']:.4f} | "
            f"{r2031['r2_mean']:.4f} | {r2031['mae_mean']:.4f} |"
        )

    lines.extend(
        [
            "",
            "## 중복 축 제거 효과",
        ]
    )

    baseline = results["baseline"]
    for model_name, model_result in results.items():
        if model_name == "baseline":
            continue
        delta_r2_2029 = model_result["2029"]["r2_mean"] - baseline["2029"]["r2_mean"]
        delta_r2_2031 = model_result["2031"]["r2_mean"] - baseline["2031"]["r2_mean"]
        lines.append(
            f"- {model_name}: 2029 R² {delta_r2_2029:+.4f}, 2031 R² {delta_r2_2031:+.4f}"
        )

    lines.extend(
        [
            "",
            "## 추천 조합",
            f"- 추천 모델: `{recommended}`",
            f"- 추천 사유: {', '.join(reasons)}",
            "",
            "## 해석 메모",
        ]
    )

    for model_name, model_result in results.items():
        d2029 = model_result["2029"]["dominance"]
        d2031 = model_result["2031"]["dominance"]
        lines.append(
            f"- {model_name}: 2029 top5={', '.join(d2029['top_features'])} / "
            f"2031 top5={', '.join(d2031['top_features'])}"
        )

    return "\n".join(lines) + "\n"


def main() -> None:
    df = load_model_frame()
    results: dict[str, object] = {}

    for model_name, config in ABLATIONS.items():
        model_result: dict[str, object] = {}
        for year, cohort_col, target_col in [
            ("2029", "cohort_change_2029_prophet", "target_2029"),
            ("2031", "cohort_change_2031_prophet", "target_2031"),
        ]:
            X = build_feature_frame(df, cohort_col, config)
            folds, _ = kfold_metrics(X, df[target_col])
            top5 = fit_shap_summary(X, df[target_col])
            summary = summarize_scores(folds)
            model_result[year] = {
                "features": list(X.columns),
                "feature_count": len(X.columns),
                "fold_scores": folds,
                **summary,
                "top5_shap_features": top5,
                "dominance": dominance_flags(top5, cohort_col),
            }
        results[model_name] = model_result

    recommended, reasons = choose_recommendation(results)
    payload = {
        "target_definition": {
            "2029": "iso_child_total * cohort_change_2029_prophet",
            "2031": "iso_child_total * cohort_change_2031_prophet",
        },
        "student_slope_handling": "excluded_not_imputed_structural_missing_for_new_schools",
        "forbidden_features_checked": sorted(FORBIDDEN_FEATURES),
        "ablation_results": results,
        "recommended_model": {
            "name": recommended,
            "reasons": reasons,
        },
    }

    RESULTS_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    SUMMARY_MD.write_text(make_summary_md(results, recommended, reasons), encoding="utf-8")

    print(f"Saved {RESULTS_JSON}")
    print(f"Saved {SUMMARY_MD}")
    print(f"Recommended: {recommended}")


if __name__ == "__main__":
    main()
