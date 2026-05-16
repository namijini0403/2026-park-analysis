from __future__ import annotations

import ast
import json
import math
import re
import warnings
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data_processed"
ROUTE_CSV = ROOT / "output" / "candidate_barrier_routes_by_school.csv"
CANDIDATE_GEOJSON = DATA_DIR / "candidate_grid_final.geojson"
OUT_DIR = ROOT / "outputs" / "robust_xai"
APP_RECOMMENDATION_JSON = DATA_DIR / "robust_candidate_recommendations.json"
APP_SHAP_JSON = DATA_DIR / "robust_shap_candidate_explanations.json"

SEED = 42
N_SAMPLES = 1000
SCORE_COLUMNS = ["demand_score", "access_gap_score", "proximity_score"]


def warn(message: str, warnings_list: list[str]) -> None:
    warnings_list.append(message)
    print(f"[warning] {message}")


def clean_id(value: Any) -> str:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return ""
    return str(value).strip()


def to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    return text in {"1", "true", "t", "yes", "y", "예", "있음"}


def parse_linked_schools(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, list):
            flattened: list[str] = []
            for item in parsed:
                flattened.extend(parse_linked_schools(item))
            return flattened
    except (ValueError, SyntaxError):
        pass
    return [part.strip().strip("'\"") for part in re.split(r"[,|\[\]]+", text) if part.strip().strip("'\"")]


def load_candidate_properties(warnings_list: list[str]) -> pd.DataFrame:
    if not CANDIDATE_GEOJSON.exists():
        warn(f"candidate geojson not found: {CANDIDATE_GEOJSON}", warnings_list)
        return pd.DataFrame()

    with CANDIDATE_GEOJSON.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    rows = []
    for feature in payload.get("features", []):
        properties = dict(feature.get("properties") or {})
        properties["linked_schools"] = parse_linked_schools(properties.get("linked_schools"))
        rows.append(properties)

    frame = pd.DataFrame(rows)
    if "grid_id" not in frame.columns:
        warn("candidate geojson has no grid_id; robust merge cannot use candidate features.", warnings_list)
    return frame


def load_school_candidate_pairs(warnings_list: list[str]) -> pd.DataFrame:
    if not ROUTE_CSV.exists():
        warn(f"route csv not found: {ROUTE_CSV}", warnings_list)
        return pd.DataFrame()
    frame = pd.read_csv(ROUTE_CSV, encoding="utf-8-sig")
    required = {"school_id", "school_name", "grid_id"}
    missing = sorted(required - set(frame.columns))
    if missing:
        warn(f"route csv missing required columns: {missing}", warnings_list)
        return pd.DataFrame()
    return frame


def numeric_series(frame: pd.DataFrame, candidates: list[str]) -> tuple[pd.Series | None, str | None]:
    for column in candidates:
        if column in frame.columns:
            series = pd.to_numeric(frame[column], errors="coerce")
            if series.notna().any():
                return series, column
    return None, None


def robust_minmax(values: pd.Series, reverse: bool = False) -> pd.Series:
    numeric = pd.to_numeric(values, errors="coerce")
    if numeric.notna().sum() == 0:
        return pd.Series(np.nan, index=values.index)
    clipped = numeric.copy()
    if numeric.notna().sum() >= 20:
        lower = numeric.quantile(0.01)
        upper = numeric.quantile(0.99)
        if pd.notna(lower) and pd.notna(upper) and upper > lower:
            clipped = numeric.clip(lower, upper)
    min_value = clipped.min(skipna=True)
    max_value = clipped.max(skipna=True)
    if pd.isna(min_value) or pd.isna(max_value) or max_value == min_value:
        score = pd.Series(1.0, index=values.index)
    else:
        score = (clipped - min_value) / (max_value - min_value)
    if reverse:
        score = 1 - score
    return score.fillna(0.0).clip(0, 1)


def add_scores(frame: pd.DataFrame, warnings_list: list[str]) -> tuple[pd.DataFrame, dict[str, str | None]]:
    demand, demand_column = numeric_series(
        frame,
        [
            "predicted_beneficiaries_2031",
            "potential_beneficiaries_2031",
            "walkshed_beneficiary_2031",
            "pred_beneficiary_2031",
            "xgb_predicted_2031",
            "forecast_2031",
            "predicted_child_2031",
            "child_2031",
            "predicted_beneficiaries_2029",
            "potential_beneficiaries_2029",
            "walkshed_beneficiary_2029",
            "pred_beneficiary_2029",
            "xgb_predicted_2029",
            "forecast_2029",
            "predicted_child_2029",
            "child_2029",
        ],
    )
    access_gap, access_column = numeric_series(
        frame,
        [
            "existing_active_park_distance_m",
            "nearest_active_park_dist_m",
            "nearest_park_dist_m",
            "active_park_distance_m",
            "distance_to_existing_park_m",
            "nearest_park_dist",
            "avg_park_dist_m",
        ],
    )
    proximity, proximity_column = numeric_series(
        frame,
        ["school_distance_m", "distance_to_school_m", "dist_to_school_m", "schoolDistM", "route_length_m", "nearest_school_dist"],
    )

    if demand is None:
        warn("future beneficiary column not found; demand_score filled with 0.", warnings_list)
        demand = pd.Series(0.0, index=frame.index)
    if access_gap is None:
        warn("active park distance column not found; access_gap_score filled with 0.", warnings_list)
        access_gap = pd.Series(0.0, index=frame.index)
    if proximity is None:
        warn("school-candidate distance column not found; proximity_score filled with 0.", warnings_list)
        proximity = pd.Series(0.0, index=frame.index)

    frame = frame.copy()
    frame["predicted_beneficiaries_used"] = pd.to_numeric(demand, errors="coerce").fillna(0.0)
    frame["demand_score"] = frame.groupby("school_id", group_keys=False)["predicted_beneficiaries_used"].apply(robust_minmax)
    frame["access_gap_score"] = frame.groupby("school_id", group_keys=False)[access_gap.name if access_gap.name else "predicted_beneficiaries_used"].apply(robust_minmax) if access_gap.name else robust_minmax(access_gap)
    frame["proximity_score"] = frame.groupby("school_id", group_keys=False)[proximity.name if proximity.name else "predicted_beneficiaries_used"].apply(lambda s: robust_minmax(s, reverse=True)) if proximity.name else robust_minmax(proximity, reverse=True)

    if access_gap.name is None:
        frame["access_gap_score"] = robust_minmax(access_gap)
    if proximity.name is None:
        frame["proximity_score"] = robust_minmax(proximity, reverse=True)

    return frame, {
        "demand_column": demand_column,
        "access_gap_column": access_column,
        "proximity_column": proximity_column,
        "normalization": "school-wise min-max with 1-99 percentile clipping when group sample size is at least 20",
    }


def mark_pareto(group: pd.DataFrame) -> pd.Series:
    values = group[SCORE_COLUMNS].to_numpy(dtype=float)
    pareto = np.ones(len(group), dtype=bool)
    if len(group) <= 1:
        return pd.Series(pareto, index=group.index)
    for idx, candidate in enumerate(values):
        dominated = np.all(values >= candidate, axis=1) & np.any(values > candidate, axis=1)
        dominated[idx] = False
        pareto[idx] = not dominated.any()
    return pd.Series(pareto, index=group.index)


def sampled_rank_metrics(group: pd.DataFrame, weights: np.ndarray) -> pd.DataFrame:
    if group.empty:
        return group
    values = group[SCORE_COLUMNS].to_numpy(dtype=float)
    scores = values @ weights.T
    order = np.argsort(-scores, axis=0)
    ranks = np.empty_like(order)
    for sample_idx in range(order.shape[1]):
        ranks[order[:, sample_idx], sample_idx] = np.arange(1, len(group) + 1)
    top_limit = min(5, len(group))
    result = group.copy()
    result["top1_count"] = (ranks <= 1).sum(axis=1)
    result["top3_count"] = (ranks <= min(3, len(group))).sum(axis=1)
    result["top5_count"] = (ranks <= top_limit).sum(axis=1)
    result["top5_stability_score"] = result["top5_count"] / weights.shape[0]
    result["mean_rank"] = ranks.mean(axis=1)
    result["rank_std"] = ranks.std(axis=1)
    result["best_rank"] = ranks.min(axis=1)
    result["worst_rank"] = ranks.max(axis=1)
    return result


def recommendation_type(row: pd.Series, group: pd.DataFrame) -> str:
    rank_std_threshold = max(0.5, group["rank_std"].quantile(0.40))
    if row["top5_stability_score"] >= 0.8 and row["rank_std"] <= rank_std_threshold:
        return "stable"
    if row["demand_score"] >= group["demand_score"].quantile(0.80):
        return "demand_strong"
    if row["access_gap_score"] >= group["access_gap_score"].quantile(0.80):
        return "access_gap_reduction"
    if row["proximity_score"] >= group["proximity_score"].quantile(0.80):
        return "proximity_first"
    if row["top5_stability_score"] < 0.5 and max(row["demand_score"], row["access_gap_score"], row["proximity_score"]) >= 0.75:
        return "scenario_sensitive"
    if min(row["demand_score"], row["access_gap_score"], row["proximity_score"]) >= 0.45:
        return "balanced"
    return "scenario_sensitive"


def recommendation_reason(row: pd.Series) -> str:
    rec_type = row["recommendation_type"]
    if rec_type == "stable":
        return "다양한 정책 가중치 조합에서도 상위권에 안정적으로 포함되는 후보입니다."
    if rec_type == "demand_strong":
        return "미래 수혜 아동 수가 상대적으로 높아 수혜 극대화 관점에서 검토할 후보입니다."
    if rec_type == "access_gap_reduction":
        return "기존 활동가능공원과의 거리가 멀어 접근성 보완 효과가 큰 후보입니다."
    if rec_type == "proximity_first":
        return "학교와의 거리가 가까워 일상 이용 접근성을 우선할 때 유리한 후보입니다."
    if rec_type == "balanced":
        return "미래 수요, 접근성 보완성, 학교 근접성이 함께 중간 이상인 균형형 후보입니다."
    return "특정 조건에서는 우수하지만 가중치 변화에 따른 순위 변동성이 있어 현장 검토가 필요합니다."


def rank_group(group: pd.DataFrame) -> pd.DataFrame:
    ranked = group.copy()
    ranked["policy_filter_pass"] = ~(
        ranked.get("accident_hotspot_flag", False).map(to_bool)
        | ranked.get("redev_flag", False).map(to_bool)
    )
    ranked["ai_default_score"] = pd.to_numeric(ranked.get("existing_recommendation_score", ranked.get("priority_score_mixed", np.nan)), errors="coerce")
    ranked = ranked.sort_values(
        ["policy_filter_pass", "pareto_candidate", "top5_stability_score", "mean_rank", "rank_std", "ai_default_score"],
        ascending=[False, False, False, True, True, False],
        kind="mergesort",
    )
    ranked["robust_rank"] = np.arange(1, len(ranked) + 1)
    return ranked


def make_surrogate_explanations(frame: pd.DataFrame, warnings_list: list[str]) -> tuple[pd.DataFrame, list[dict[str, Any]], str]:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.ensemble import RandomForestRegressor

    feature_candidates = [
        "candidate_child_current",
        "w_hat",
        "nearest_park_dist",
        "avg_park_dist_m",
        "nearest_pg_dist",
        "route_length_m",
        "motorway",
        "trunk",
        "primary",
        "secondary",
        "tertiary",
        "linked_school_count",
        "worst_case_type",
        "redev_flag_numeric",
        "has_large_apt_numeric",
        "demand_score",
        "access_gap_score",
        "proximity_score",
    ]
    model_frame = frame.copy()
    redev_source = model_frame["redev_flag"] if "redev_flag" in model_frame.columns else pd.Series(False, index=model_frame.index)
    apt_source = model_frame["has_large_apt"] if "has_large_apt" in model_frame.columns else pd.Series(False, index=model_frame.index)
    model_frame["redev_flag_numeric"] = redev_source.map(to_bool).astype(int)
    model_frame["has_large_apt_numeric"] = apt_source.map(to_bool).astype(int)
    feature_columns = [column for column in feature_candidates if column in model_frame.columns]
    X = model_frame[feature_columns].apply(pd.to_numeric, errors="coerce").fillna(0.0)
    y = pd.to_numeric(model_frame["predicted_beneficiaries_used"], errors="coerce").fillna(0.0)

    if len(X) < 5 or len(feature_columns) < 2:
        warn("not enough candidate rows/features for surrogate explainability; using score columns only.", warnings_list)
        feature_columns = SCORE_COLUMNS
        X = model_frame[feature_columns].fillna(0.0)

    model = RandomForestRegressor(n_estimators=180, random_state=SEED, min_samples_leaf=2, n_jobs=1)
    model.fit(X, y)
    expected_value = float(np.mean(model.predict(X)))
    method = "surrogate_random_forest_shap"

    shap_values: np.ndarray | None = None
    try:
        import shap

        explainer = shap.TreeExplainer(model)
        shap_values = np.asarray(explainer.shap_values(X), dtype=float)
        base_value = explainer.expected_value
        if isinstance(base_value, (list, np.ndarray)):
            expected_value = float(np.asarray(base_value).ravel()[0])
    except Exception as error:  # pragma: no cover - environment-dependent fallback
        warn(f"SHAP failed; using surrogate contribution proxy: {error}", warnings_list)
        method = "surrogate_feature_contribution_proxy"
        centered = X - X.mean(axis=0)
        scale = X.std(axis=0).replace(0, 1)
        importance = pd.Series(model.feature_importances_, index=feature_columns)
        shap_values = (centered / scale * importance).to_numpy(dtype=float)

    assert shap_values is not None
    abs_mean = np.abs(shap_values).mean(axis=0)
    importance = pd.DataFrame({"feature": feature_columns, "mean_abs_shap": abs_mean}).sort_values("mean_abs_shap", ascending=False)

    plt.figure(figsize=(8, 5))
    importance.head(12).iloc[::-1].plot.barh(x="feature", y="mean_abs_shap", legend=False, color="#2563eb")
    plt.title("Surrogate SHAP feature importance")
    plt.tight_layout()
    plt.savefig(OUT_DIR / "shap_feature_importance.png", dpi=160)
    plt.close()

    sample_idx = frame.sort_values(["robust_rank", "top5_stability_score"], ascending=[True, False]).head(250).index
    summary_values = shap_values[frame.index.get_indexer(sample_idx)]
    plt.figure(figsize=(8, 5))
    plt.boxplot([summary_values[:, i] for i in range(len(feature_columns))], tick_labels=feature_columns, vert=False, showfliers=False)
    plt.title("Candidate SHAP summary")
    plt.tight_layout()
    plt.savefig(OUT_DIR / "shap_summary.png", dpi=160)
    plt.close()

    explanations: list[dict[str, Any]] = []
    top_waterfall_keys: set[tuple[str, str]] = set(
        tuple(item)
        for item in frame.sort_values(["robust_rank", "top5_stability_score"], ascending=[True, False])
        .groupby("school_id")
        .head(1)[["school_id", "grid_id"]]
        .head(5)
        .astype(str)
        .to_numpy()
        .tolist()
    )

    for row_position, (_, row) in enumerate(frame.iterrows()):
        values = shap_values[row_position]
        feature_payload = []
        for feature, value, contribution in zip(feature_columns, X.iloc[row_position].tolist(), values):
            feature_payload.append(
                {
                    "feature": feature,
                    "value": round(float(value), 4),
                    "shap_value": round(float(contribution), 4),
                }
            )
        positive = sorted([item for item in feature_payload if item["shap_value"] > 0], key=lambda item: item["shap_value"], reverse=True)[:3]
        negative = sorted([item for item in feature_payload if item["shap_value"] < 0], key=lambda item: item["shap_value"])[:3]
        tag = diagnostic_tag(positive, negative, feature_payload)
        explanation_text = build_shap_text(tag)
        waterfall_path = ""
        key = (clean_id(row.get("school_id")), clean_id(row.get("grid_id")))
        if key in top_waterfall_keys:
            safe_name = re.sub(r"[^A-Za-z0-9_가-힣-]+", "_", f"{key[0]}_{key[1]}")
            file_name = f"shap_waterfall_{safe_name}.png"
            waterfall_path = f"outputs/robust_xai/{file_name}"
            plot_waterfall(feature_payload, expected_value, float(row["predicted_beneficiaries_used"]), OUT_DIR / file_name)
        explanations.append(
            {
                "candidate_id": clean_id(row.get("grid_id")),
                "school_id": clean_id(row.get("school_id")),
                "school_name": clean_id(row.get("school_name")),
                "predicted_beneficiaries": round(float(row["predicted_beneficiaries_used"]), 2),
                "diagnostic_tag": tag,
                "positive_drivers": positive,
                "negative_drivers": negative,
                "explanation_text": explanation_text,
                "shap_waterfall_image_path": waterfall_path,
                "explainability_method": method,
            }
        )

    explanation_frame = pd.DataFrame(explanations)
    return explanation_frame, explanations, method


def diagnostic_tag(positive: list[dict[str, Any]], negative: list[dict[str, Any]], all_features: list[dict[str, Any]]) -> str:
    positive_names = " ".join(item["feature"] for item in positive)
    abs_sum = sum(abs(item["shap_value"]) for item in all_features) or 1.0
    max_share = max(abs(item["shap_value"]) for item in all_features) / abs_sum
    if max_share >= 0.55:
        return "uncertainty_attention"
    if re.search(r"redev|apt|future|cohort|forecast", positive_names):
        return "development_dependent"
    if re.search(r"park|green|access|gap", positive_names):
        return "access_gap_driven"
    return "stable_demand"


def build_shap_text(tag: str) -> str:
    if tag == "development_dependent":
        return "이 후보지는 예상 수혜 아동 수가 높게 예측되었지만, 재개발/대단지 또는 미래 추세 변수의 기여가 커 현장 확인이 필요한 미래 개발 의존형 후보입니다."
    if tag == "access_gap_driven":
        return "이 후보지는 기존 활동가능공원 접근성 부족과 후보지 보완성이 함께 작용하여 접근성 보완형 후보로 해석됩니다."
    if tag == "uncertainty_attention":
        return "이 후보지는 특정 단일 변수의 설명 기여가 커 예측값 해석 시 현장 맥락과 데이터 품질 확인이 필요합니다."
    return "이 후보지는 현재 아동 규모와 후보지 주변 수요 변수가 예측값을 높여 안정 수요형 후보로 해석됩니다."


def plot_waterfall(features: list[dict[str, Any]], expected_value: float, prediction: float, target: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    top = sorted(features, key=lambda item: abs(item["shap_value"]), reverse=True)[:8]
    labels = [item["feature"] for item in top]
    values = [item["shap_value"] for item in top]
    colors = ["#dc2626" if value > 0 else "#2563eb" for value in values]
    plt.figure(figsize=(8, 4.8))
    plt.barh(labels[::-1], values[::-1], color=colors[::-1])
    plt.axvline(0, color="#111827", linewidth=0.8)
    plt.title(f"Prediction {prediction:.1f} / base {expected_value:.1f}")
    plt.tight_layout()
    plt.savefig(target, dpi=160)
    plt.close()


def enrich_for_app(frame: pd.DataFrame, explanation_frame: pd.DataFrame) -> pd.DataFrame:
    shap_cols = [
        "candidate_id",
        "school_id",
        "diagnostic_tag",
        "positive_drivers",
        "negative_drivers",
        "explanation_text",
        "shap_waterfall_image_path",
    ]
    merged = frame.merge(
        explanation_frame[shap_cols],
        left_on=["school_id", "grid_id"],
        right_on=["school_id", "candidate_id"],
        how="left",
    )
    merged = merged.rename(
        columns={
            "diagnostic_tag": "shap_diagnostic_tag",
            "positive_drivers": "shap_positive_drivers",
            "negative_drivers": "shap_negative_drivers",
            "explanation_text": "shap_explanation_text",
        }
    )
    return merged


def main() -> None:
    warnings_list: list[str] = []
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    candidates = load_candidate_properties(warnings_list)
    routes = load_school_candidate_pairs(warnings_list)
    if routes.empty or candidates.empty:
        raise SystemExit("Missing candidate input data; robust recommendation skipped.")

    merged = routes.merge(candidates, on="grid_id", how="left", suffixes=("_route", ""))
    merge_success = int(merged["cx"].notna().sum()) if "cx" in merged.columns else 0
    merge_fail = int(len(merged) - merge_success)
    if merge_fail:
        warn(f"candidate feature merge failed for {merge_fail} of {len(merged)} school-candidate rows.", warnings_list)

    merged["candidate_id"] = merged["grid_id"].map(clean_id)
    merged["school_id"] = merged["school_id"].map(clean_id)
    merged["school_name"] = merged["school_name"].map(clean_id)
    merged["route_length_m"] = pd.to_numeric(merged.get("route_length_m"), errors="coerce")
    merged = merged[merged["school_id"].ne("") & merged["grid_id"].notna()].copy()

    scored, metadata = add_scores(merged, warnings_list)
    scored["pareto_candidate"] = False
    for _, group in scored.groupby("school_id", sort=False):
        scored.loc[group.index, "pareto_candidate"] = mark_pareto(group)

    rng = np.random.default_rng(SEED)
    weights = rng.dirichlet([1, 1, 1], size=N_SAMPLES)
    ranked_parts = []
    for _, group in scored.groupby("school_id", sort=False):
        group_ranked = sampled_rank_metrics(group, weights)
        group_ranked = rank_group(group_ranked)
        group_ranked["recommendation_type"] = group_ranked.apply(lambda row: recommendation_type(row, group_ranked), axis=1)
        ranked_parts.append(group_ranked)
    ranked = pd.concat(ranked_parts, ignore_index=False)
    ranked["robust_recommendation_reason"] = ranked.apply(recommendation_reason, axis=1)

    explanation_frame, explanations, explainability_method = make_surrogate_explanations(ranked, warnings_list)
    app_frame = enrich_for_app(ranked, explanation_frame)

    keep_columns = [
        "school_id",
        "school_name",
        "grid_id",
        "candidate_id",
        "cx",
        "cy",
        "predicted_beneficiaries_used",
        "demand_score",
        "access_gap_score",
        "proximity_score",
        "pareto_candidate",
        "top1_count",
        "top3_count",
        "top5_count",
        "top5_stability_score",
        "mean_rank",
        "rank_std",
        "best_rank",
        "worst_rank",
        "robust_rank",
        "recommendation_type",
        "robust_recommendation_reason",
        "shap_diagnostic_tag",
        "shap_positive_drivers",
        "shap_negative_drivers",
        "shap_explanation_text",
        "shap_waterfall_image_path",
    ]
    for column in keep_columns:
        if column not in app_frame.columns:
            app_frame[column] = None

    output_frame = app_frame[keep_columns].sort_values(["school_id", "robust_rank", "grid_id"])
    csv_path = OUT_DIR / "robust_candidate_recommendations.csv"
    json_path = OUT_DIR / "robust_candidate_recommendations.json"
    shap_path = OUT_DIR / "shap_candidate_explanations.json"
    summary_path = OUT_DIR / "run_summary.json"

    output_frame.to_csv(csv_path, index=False, encoding="utf-8-sig")
    records = json.loads(output_frame.to_json(orient="records", force_ascii=False))
    json_path.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    shap_path.write_text(json.dumps(explanations, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    APP_RECOMMENDATION_JSON.write_text(json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    APP_SHAP_JSON.write_text(json.dumps(explanations, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    summary = {
        "input_candidate_geojson": str(CANDIDATE_GEOJSON.relative_to(ROOT)),
        "input_route_csv": str(ROUTE_CSV.relative_to(ROOT)),
        "rows": int(len(output_frame)),
        "schools": int(output_frame["school_id"].nunique()),
        "merge_success": merge_success,
        "merge_fail": merge_fail,
        "score_metadata": metadata,
        "weight_samples": N_SAMPLES,
        "weight_seed": SEED,
        "explainability_method": explainability_method,
        "warnings": warnings_list,
        "outputs": [
            str(csv_path.relative_to(ROOT)),
            str(json_path.relative_to(ROOT)),
            str(shap_path.relative_to(ROOT)),
            "outputs/robust_xai/shap_summary.png",
            "outputs/robust_xai/shap_feature_importance.png",
            str(APP_RECOMMENDATION_JSON.relative_to(ROOT)),
            str(APP_SHAP_JSON.relative_to(ROOT)),
        ],
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    warnings.filterwarnings("ignore", category=FutureWarning)
    main()
