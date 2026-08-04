from __future__ import annotations

import ast
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_processed"
OUTPUT = ROOT / "outputs" / "track2_validation"
LEGACY_DATA = Path(r"C:\2026_data_analysis_park\data\processed")

RANDOM_SEED = 42
BACKTEST_YEARS = [2021, 2022, 2023, 2024, 2025]


FILES_TO_AUDIT = [
    DATA / "population_grid.csv",
    DATA / "population_grid_1k.csv",
    DATA / "grid_1km_cohort_pred.csv",
    DATA / "grid_1km_prophet_alloc.csv",
    DATA / "grid_1km_final_pred.csv",
    DATA / "grid_250m_pred.csv",
    DATA / "candidate_grid_final.csv",
    DATA / "candidate_grid_population_alloc_v1.csv",
    DATA / "beneficiary_forecast.csv",
    DATA / "beneficiary_forecast_v3.csv",
    DATA / "school_priority.csv",
    ROOT / "output" / "candidate_population_model_metrics_20260419.json",
    ROOT / "outputs" / "robust_xai" / "robust_candidate_recommendations.csv",
    LEGACY_DATA / "incheon_gu_child_timeseries.csv",
]


def safe_num(value: Any, default: float = np.nan) -> float:
    try:
        result = float(value)
    except Exception:
        return default
    return result if np.isfinite(result) else default


def wape(y_true: pd.Series | np.ndarray, y_pred: pd.Series | np.ndarray) -> float:
    true = np.asarray(y_true, dtype=float)
    pred = np.asarray(y_pred, dtype=float)
    denom = float(np.sum(np.abs(true)))
    if denom <= 0:
        return float("nan")
    return float(np.sum(np.abs(true - pred)) / denom)


def rmse(y_true: pd.Series | np.ndarray, y_pred: pd.Series | np.ndarray) -> float:
    return float(math.sqrt(mean_squared_error(y_true, y_pred)))


def read_csv_if_exists(path: Path, **kwargs: Any) -> pd.DataFrame | None:
    if not path.exists() or path.stat().st_size == 0:
        return None
    return pd.read_csv(path, encoding="utf-8-sig", **kwargs)


def infer_unit(columns: list[str], path: Path) -> str:
    name = path.name.lower()
    colset = set(columns)
    if "gu_name" in colset or "gu" in colset and "grid_id" not in colset and "학교ID" not in colset:
        if "year" in colset or "연도" in colset:
            return "구-연도"
    if "grid_id" in colset:
        return "250m 후보지/격자"
    if "격자코드" in colset and any("1km" in name for _ in [0]):
        return "1km 격자"
    if "격자코드" in colset:
        return "인구 격자"
    if "학교ID" in colset or "school_id" in colset:
        return "학교/학교-후보지"
    if path.suffix.lower() == ".json":
        return "모델 요약 JSON"
    return "기타"


def find_columns(columns: list[str], needles: list[str]) -> list[str]:
    result = []
    for col in columns:
        lowered = col.lower()
        if any(needle.lower() in lowered for needle in needles):
            result.append(col)
    return result


def audit_data() -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for path in FILES_TO_AUDIT:
        rel = str(path) if not path.is_relative_to(ROOT) else str(path.relative_to(ROOT))
        if not path.exists():
            rows.append(
                {
                    "file": rel,
                    "exists": False,
                    "rows": 0,
                    "unit": "missing",
                    "year_range": "",
                    "actual_or_reference_columns": "",
                    "prediction_columns": "",
                    "validation_possible": "불가",
                    "note": "파일 없음",
                }
            )
            continue

        if path.suffix.lower() == ".json":
            try:
                obj = json.loads(path.read_text(encoding="utf-8"))
                rows.append(
                    {
                        "file": rel,
                        "exists": True,
                        "rows": "",
                        "unit": "모델 요약 JSON",
                        "year_range": "2021~2025" if "prophet_backtest" in obj else "",
                        "actual_or_reference_columns": "요약 지표만 존재",
                        "prediction_columns": "요약 지표만 존재",
                        "validation_possible": "부분 가능",
                        "note": "행 단위 예측값은 JSON에 없음",
                    }
                )
            except Exception as exc:
                rows.append({"file": rel, "exists": True, "rows": "", "unit": "JSON", "year_range": "", "actual_or_reference_columns": "", "prediction_columns": "", "validation_possible": "불가", "note": f"JSON 읽기 실패: {exc}"})
            continue

        df = read_csv_if_exists(path, nrows=200000)
        if df is None:
            rows.append({"file": rel, "exists": True, "rows": 0, "unit": "empty", "year_range": "", "actual_or_reference_columns": "", "prediction_columns": "", "validation_possible": "불가", "note": "빈 파일"})
            continue

        columns = list(df.columns)
        year_cols = find_columns(columns, ["year", "연도"])
        years: list[int] = []
        for col in year_cols:
            vals = pd.to_numeric(df[col], errors="coerce").dropna()
            years.extend([int(v) for v in vals.tolist() if 1900 <= int(v) <= 2100])
        year_range = f"{min(years)}~{max(years)}" if years else ""
        actual_cols = find_columns(columns, ["actual", "current", "child_pop", "iso_child", "기준", "학생수", "child_0_12", "candidate_child"])
        pred_cols = find_columns(columns, ["pred", "forecast", "beneficiary", "walkshed", "xgb"])
        possible = "가능" if year_range and actual_cols and pred_cols else "부분 가능" if actual_cols or pred_cols else "불가"
        if path.name == "incheon_gu_child_timeseries.csv":
            possible = "가능"
        rows.append(
            {
                "file": rel,
                "exists": True,
                "rows": int(len(df)),
                "unit": infer_unit(columns, path),
                "year_range": year_range,
                "actual_or_reference_columns": ", ".join(actual_cols[:8]),
                "prediction_columns": ", ".join(pred_cols[:8]),
                "validation_possible": possible,
                "note": f"columns={len(columns)}",
            }
        )
    return pd.DataFrame(rows)


def prophet_predict(train: pd.DataFrame, target_year: int) -> float:
    frame = train.copy()
    frame["ds"] = pd.to_datetime(frame["year"].astype(str) + "-12-31")
    frame = frame.rename(columns={"child_0_12": "y"})[["ds", "y"]]
    model = Prophet(
        changepoint_prior_scale=0.3,
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
    )
    model.fit(frame)
    pred = model.predict(pd.DataFrame({"ds": [pd.Timestamp(f"{target_year}-12-31")]}))
    return max(float(pred["yhat"].iloc[0]), 0.0)


def prophet_predict_many(train: pd.DataFrame, target_years: list[int]) -> dict[int, float]:
    frame = train.copy()
    frame["ds"] = pd.to_datetime(frame["year"].astype(str) + "-12-31")
    frame = frame.rename(columns={"child_0_12": "y"})[["ds", "y"]]
    model = Prophet(
        changepoint_prior_scale=0.3,
        yearly_seasonality=False,
        weekly_seasonality=False,
        daily_seasonality=False,
    )
    model.fit(frame)
    future = pd.DataFrame({"ds": [pd.Timestamp(f"{year}-12-31") for year in target_years]})
    pred = model.predict(future)
    return {
        int(ts.year): max(float(yhat), 0.0)
        for ts, yhat in zip(pd.to_datetime(pred["ds"]), pred["yhat"])
    }


def build_backtest_rows(gu_ts: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    city = gu_ts.groupby("year", as_index=False)["child_0_12"].sum().sort_values("year")
    city = city.set_index("year")["child_0_12"].to_dict()

    for gu_name, group in gu_ts.groupby("gu_name", sort=True):
        group = group.sort_values("year").copy()
        for target_year in BACKTEST_YEARS:
            train = group[group["year"] < target_year].copy()
            actual = group.loc[group["year"] == target_year, "child_0_12"]
            if len(train) < 5 or actual.empty:
                continue

            last = float(train["child_0_12"].iloc[-1])
            prev = float(train["child_0_12"].iloc[-2]) if len(train) >= 2 else last
            growth = last / prev if prev > 0 else 1.0
            city_last = safe_num(city.get(int(train["year"].iloc[-1])), np.nan)
            city_prev = safe_num(city.get(int(train["year"].iloc[-2])) if len(train) >= 2 else city_last, np.nan)
            city_growth = city_last / city_prev if np.isfinite(city_prev) and city_prev > 0 else 1.0

            proposed = prophet_predict(train, target_year)
            rows.append(
                {
                    "gu_name": gu_name,
                    "target_year": int(target_year),
                    "actual": float(actual.iloc[0]),
                    "baseline_recent_value": last,
                    "baseline_gu_growth": max(last * growth, 0.0),
                    "baseline_city_growth": max(last * city_growth, 0.0),
                    "proposed_prophet": proposed,
                }
            )
    result = pd.DataFrame(rows)
    for col in ["baseline_recent_value", "baseline_gu_growth", "baseline_city_growth", "proposed_prophet"]:
        result[f"{col}_residual"] = result[col] - result["actual"]
        result[f"{col}_residual_rate"] = np.where(result["actual"] > 0, result[f"{col}_residual"] / result["actual"], np.nan)
    return result


def build_multistep_backtest_rows(gu_ts: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    city = gu_ts.groupby("year", as_index=False)["child_0_12"].sum().sort_values("year")
    city = city.set_index("year")["child_0_12"].to_dict()

    # origin 2020 is included so the 2025 target can provide a 5-year ahead stress case.
    origin_years = [2020, 2021, 2022, 2023, 2024]
    for gu_name, group in gu_ts.groupby("gu_name", sort=True):
        group = group.sort_values("year").copy()
        for origin_year in origin_years:
            train = group[group["year"] <= origin_year].copy()
            target_years = [
                int(year)
                for year in group.loc[group["year"] > origin_year, "year"].tolist()
                if int(year) <= 2025
            ]
            if len(train) < 5 or not target_years:
                continue

            last = float(train["child_0_12"].iloc[-1])
            prev = float(train["child_0_12"].iloc[-2]) if len(train) >= 2 else last
            gu_growth = last / prev if prev > 0 else 1.0
            city_last = safe_num(city.get(origin_year), np.nan)
            city_prev = safe_num(city.get(origin_year - 1), np.nan)
            city_growth = city_last / city_prev if np.isfinite(city_prev) and city_prev > 0 else 1.0
            proposed_by_year = prophet_predict_many(train, target_years)

            for target_year in target_years:
                actual = group.loc[group["year"] == target_year, "child_0_12"]
                if actual.empty:
                    continue
                horizon = target_year - origin_year
                rows.append(
                    {
                        "gu_name": gu_name,
                        "origin_year": int(origin_year),
                        "target_year": int(target_year),
                        "horizon": int(horizon),
                        "actual": float(actual.iloc[0]),
                        "baseline_recent_value": last,
                        "baseline_gu_growth": max(last * (gu_growth**horizon), 0.0),
                        "baseline_city_growth": max(last * (city_growth**horizon), 0.0),
                        "proposed_prophet": proposed_by_year[target_year],
                    }
                )

    result = pd.DataFrame(rows)
    for col in ["baseline_recent_value", "baseline_gu_growth", "baseline_city_growth", "proposed_prophet"]:
        result[f"{col}_residual"] = result[col] - result["actual"]
        result[f"{col}_residual_rate"] = np.where(result["actual"] > 0, result[f"{col}_residual"] / result["actual"], np.nan)
    return result


def multistep_metric_rows(backtest: pd.DataFrame) -> pd.DataFrame:
    model_map = {
        "Baseline 1": ("baseline_recent_value", "최근값 유지"),
        "Baseline 2": ("baseline_gu_growth", "구별 origin 직전 증감률 horizon 누적 적용"),
        "Baseline 2-city": ("baseline_city_growth", "인천 전체 origin 직전 증감률 horizon 누적 적용"),
        "Proposed": ("proposed_prophet", "구별 Prophet 직접 multi-step 예측"),
    }
    rows: list[dict[str, Any]] = []
    for model, (col, note) in model_map.items():
        for horizon, group in backtest.groupby("horizon", sort=True):
            rows.append(
                {
                    "model": model,
                    "horizon": int(horizon),
                    "n": int(len(group)),
                    "origin_years": f"{int(group['origin_year'].min())}~{int(group['origin_year'].max())}",
                    "target_years": f"{int(group['target_year'].min())}~{int(group['target_year'].max())}",
                    "mae": mean_absolute_error(group["actual"], group[col]),
                    "wape": wape(group["actual"], group[col]),
                    "rmse": rmse(group["actual"], group[col]),
                    "note": note,
                }
            )
    return pd.DataFrame(rows)


def write_multistep_md(
    metrics: pd.DataFrame,
    filename: str = "track2_multistep_horizon.md",
    title: str = "Track 2 multi-step ahead backtest",
    note: str = "주의: 5년 ahead는 origin 2020 -> target 2025의 10개 구 행만 포함한 스트레스 테스트입니다.",
) -> None:
    pivot = metrics.pivot(index="horizon", columns="model", values="wape").reset_index()
    lines = [
        f"# {title}",
        "",
        "구별 0~12세 총량 기준입니다. Origin year까지의 과거만 학습하고, 이후 target year를 horizon별로 직접 비교했습니다.",
        "",
        "- Baseline 1: origin year 최근값 유지",
        "- Baseline 2: 구별 origin 직전 1년 증감률을 horizon만큼 누적 적용",
        "- Proposed: origin year까지 학습한 Prophet으로 각 target year 직접 예측",
        "",
        "| Horizon | n | Baseline 1 WAPE | Baseline 2 WAPE | Baseline 2-city WAPE | Proposed WAPE | Winner |",
        "|---:|---:|---:|---:|---:|---:|---|",
    ]
    for row in pivot.itertuples(index=False):
        horizon = int(row.horizon)
        h_metrics = metrics[metrics["horizon"] == horizon]
        n = int(h_metrics["n"].iloc[0])
        values = {
            "Baseline 1": float(getattr(row, "Baseline_1", np.nan)) if hasattr(row, "Baseline_1") else float(h_metrics.loc[h_metrics["model"] == "Baseline 1", "wape"].iloc[0]),
            "Baseline 2": float(h_metrics.loc[h_metrics["model"] == "Baseline 2", "wape"].iloc[0]),
            "Baseline 2-city": float(h_metrics.loc[h_metrics["model"] == "Baseline 2-city", "wape"].iloc[0]),
            "Proposed": float(h_metrics.loc[h_metrics["model"] == "Proposed", "wape"].iloc[0]),
        }
        winner = min(values.items(), key=lambda item: item[1])[0]
        lines.append(
            f"| {horizon} | {n} | {values['Baseline 1'] * 100:.2f}% | {values['Baseline 2'] * 100:.2f}% | "
            f"{values['Baseline 2-city'] * 100:.2f}% | {values['Proposed'] * 100:.2f}% | {winner} |"
        )
    lines.extend(
        [
            "",
            note,
        ]
    )
    (OUTPUT / filename).write_text("\n".join(lines) + "\n", encoding="utf-8")


def metric_rows(backtest: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    model_map = {
        "Baseline 1": ("baseline_recent_value", "최근값 유지"),
        "Baseline 2": ("baseline_gu_growth", "구별 직전 증감률 적용"),
        "Baseline 2-city": ("baseline_city_growth", "인천 전체 직전 증감률 적용"),
        "Proposed": ("proposed_prophet", "구별 Prophet 총량 예측"),
    }
    rows: list[dict[str, Any]] = []
    for model, (col, note) in model_map.items():
        for target_year, group in backtest.groupby("target_year", sort=True):
            rows.append(
                {
                    "model": model,
                    "target_year": int(target_year),
                    "unit": "gu_total",
                    "mae": mean_absolute_error(group["actual"], group[col]),
                    "wape": wape(group["actual"], group[col]),
                    "rmse": rmse(group["actual"], group[col]),
                    "note": note,
                }
            )
        rows.append(
            {
                "model": model,
                "target_year": "all",
                "unit": "gu_total",
                "mae": mean_absolute_error(backtest["actual"], backtest[col]),
                "wape": wape(backtest["actual"], backtest[col]),
                "rmse": rmse(backtest["actual"], backtest[col]),
                "note": note,
            }
        )

    # Baseline 3 is spatial fixed-share distribution. Future spatial ground truth is unavailable.
    rows.append(
        {
            "model": "Baseline 3",
            "target_year": "2029/2031",
            "unit": "250m_grid_distribution",
            "mae": np.nan,
            "wape": np.nan,
            "rmse": np.nan,
            "note": "고정 공간비율 배분. 격자별 미래 기준값 부재로 후행 정확도 계산 불가; Proposed와 운영 예측 분포/순위 비교만 가능",
        }
    )
    metrics = pd.DataFrame(rows)
    return metrics[metrics["model"].eq("Proposed")].copy(), metrics


def parse_schools(value: Any) -> list[str]:
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return []
    text = str(value).strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, list):
            result: list[str] = []
            for item in parsed:
                if isinstance(item, str):
                    if item.startswith("[") and item.endswith("]"):
                        result.extend(parse_schools(item))
                    else:
                        result.append(item.strip())
            return [item for item in result if item]
    except Exception:
        pass
    return [part.strip().strip("'").strip('"') for part in text.strip("[]").split(",") if part.strip()]


def top_overlap(a: pd.Series, b: pd.Series, k: int) -> tuple[int, float]:
    top_a = set(a.sort_values(ascending=False).head(k).index)
    top_b = set(b.sort_values(ascending=False).head(k).index)
    inter = len(top_a & top_b)
    union = len(top_a | top_b)
    return inter, inter / union if union else float("nan")


def rank_stability(backtest: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for year, group in backtest.groupby("target_year", sort=True):
        frame = group.set_index("gu_name")
        inter, jac = top_overlap(frame["actual"], frame["proposed_prophet"], min(3, len(frame)))
        rows.append(
            {
                "unit": "gu_total_backtest",
                "target_year": int(year),
                "spearman_r": frame["actual"].corr(frame["proposed_prophet"], method="spearman"),
                "top_k": min(3, len(frame)),
                "top_k_overlap": inter,
                "top_k_jaccard": jac,
                "note": "구별 0~12세 총량 실제값 vs Prophet 예측값",
            }
        )

    candidate = read_csv_if_exists(DATA / "candidate_grid_final.csv")
    if candidate is not None:
        candidate = candidate.copy()
        candidate["pred2031"] = pd.to_numeric(candidate.get("walkshed_beneficiary_2031"), errors="coerce")
        if candidate["pred2031"].isna().all():
            candidate["pred2031"] = pd.to_numeric(candidate.get("pred_beneficiary_2031"), errors="coerce")
        candidate["current_child"] = pd.to_numeric(candidate.get("candidate_child_current"), errors="coerce")
        valid = candidate.dropna(subset=["current_child", "pred2031"]).set_index("grid_id")
        for k in [50, 85, max(1, int(round(len(valid) * 0.10)))]:
            inter, jac = top_overlap(valid["current_child"], valid["pred2031"], min(k, len(valid)))
            rows.append(
                {
                    "unit": "candidate_grid_current_vs_2031",
                    "target_year": 2031,
                    "spearman_r": valid["current_child"].corr(valid["pred2031"], method="spearman"),
                    "top_k": min(k, len(valid)),
                    "top_k_overlap": inter,
                    "top_k_jaccard": jac,
                    "note": "현재 후보지 기준 아동수 vs 2031 후보지 예측 수혜값",
                }
            )

        school_rows: list[dict[str, Any]] = []
        for _, row in valid.reset_index().iterrows():
            schools = parse_schools(row.get("linked_schools"))
            if not schools:
                continue
            share = safe_num(row["pred2031"], 0.0) / len(schools)
            for school in schools:
                school_rows.append({"school_name": school, "pred2031": share})
        school_pred = pd.DataFrame(school_rows).groupby("school_name", as_index=False)["pred2031"].sum()
        priority = read_csv_if_exists(DATA / "school_priority.csv")
        if priority is not None and not school_pred.empty:
            school_actual = priority[["학교명", "iso_child_total"]].rename(columns={"학교명": "school_name"})
            joined = school_actual.merge(school_pred, on="school_name", how="inner").set_index("school_name")
            for k in [50, 85, max(1, int(round(len(joined) * 0.10)))]:
                inter, jac = top_overlap(joined["iso_child_total"], joined["pred2031"], min(k, len(joined)))
                rows.append(
                    {
                        "unit": "school_walkshed_proxy",
                        "target_year": 2031,
                        "spearman_r": joined["iso_child_total"].corr(joined["pred2031"], method="spearman"),
                        "top_k": min(k, len(joined)),
                        "top_k_overlap": inter,
                        "top_k_jaccard": jac,
                        "note": "현재 학교 도보권 아동수 vs 연결 후보지 2031 예측값 합산",
                    }
                )
    return pd.DataFrame(rows)


def perturb_candidates(backtest: pd.DataFrame) -> pd.DataFrame:
    recommendations = read_csv_if_exists(ROOT / "outputs" / "robust_xai" / "robust_candidate_recommendations.csv")
    if recommendations is None:
        return pd.DataFrame()

    demand = pd.to_numeric(recommendations["predicted_beneficiaries_used"], errors="coerce")
    frame = recommendations.loc[demand.notna(), ["school_id", "school_name", "grid_id"]].copy()
    frame["base_demand"] = demand[demand.notna()].astype(float).to_numpy()
    frame["candidate_key"] = frame["school_id"].astype(str) + "::" + frame["grid_id"].astype(str)
    frame = frame.drop_duplicates("candidate_key").reset_index(drop=True)

    residual_rates = pd.to_numeric(backtest["proposed_prophet_residual_rate"], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna().to_numpy()
    if len(residual_rates) == 0:
        return pd.DataFrame()

    rng = np.random.default_rng(RANDOM_SEED)
    n = len(frame)
    base_order = frame.sort_values("base_demand", ascending=False).reset_index(drop=True)
    base_rank = pd.Series(np.arange(1, n + 1), index=base_order["candidate_key"])
    k_values = [50, 85, max(1, int(round(n * 0.10)))]
    sim_rows: list[dict[str, Any]] = []

    for k in k_values:
        base_top = set(base_order.head(k)["candidate_key"])
        jaccards: list[float] = []
        retentions: list[float] = []
        rank_changes: list[float] = []
        for _ in range(1000):
            sampled = rng.choice(residual_rates, size=n, replace=True)
            perturbed = np.clip(frame["base_demand"].to_numpy(dtype=float) * (1.0 + sampled), 0.0, None)
            sim = frame[["candidate_key"]].copy()
            sim["perturbed"] = perturbed
            sim_order = sim.sort_values("perturbed", ascending=False).reset_index(drop=True)
            sim_top = set(sim_order.head(k)["candidate_key"])
            inter = len(base_top & sim_top)
            union = len(base_top | sim_top)
            jaccards.append(inter / union if union else float("nan"))
            retentions.append(inter / k if k else float("nan"))
            sim_rank = pd.Series(np.arange(1, n + 1), index=sim_order["candidate_key"])
            changes = [abs(float(sim_rank[key]) - float(base_rank[key])) for key in base_top if key in sim_rank]
            rank_changes.append(float(np.mean(changes)) if changes else float("nan"))

        sim_rows.append(
            {
                "k": k,
                "n_sim": 1000,
                "mean_jaccard": float(np.nanmean(jaccards)),
                "median_jaccard": float(np.nanmedian(jaccards)),
                "mean_retention": float(np.nanmean(retentions)),
                "median_retention": float(np.nanmedian(retentions)),
                "mean_rank_change": float(np.nanmean(rank_changes)),
                "rank_change_iqr": float(np.nanquantile(rank_changes, 0.75) - np.nanquantile(rank_changes, 0.25)),
                "p10_jaccard": float(np.nanquantile(jaccards, 0.10)),
                "p90_jaccard": float(np.nanquantile(jaccards, 0.90)),
                "note": "구별 Prophet backtest residual_rate를 후보 수요에 무작위 적용",
            }
        )
    return pd.DataFrame(sim_rows)


def write_audit_md(audit: pd.DataFrame) -> None:
    lines = [
        "# Track 2 검증 데이터 가용성 감사",
        "",
        "격자 단위 기준값은 주민등록 또는 공공 인구자료를 공간 단위로 배분한 정책 분석용 기준값이며, 개별 아동 위치의 실측값을 의미하지 않는다.",
        "",
        "| 파일 | 단위 | 연도범위 | 실제/기준값 컬럼 | 예측값 컬럼 | 검증 가능 여부 | 비고 |",
        "|---|---|---|---|---|---|---|",
    ]
    for row in audit.itertuples(index=False):
        lines.append(
            f"| `{row.file}` | {row.unit} | {row.year_range} | {row.actual_or_reference_columns} | "
            f"{row.prediction_columns} | {row.validation_possible} | {row.note} |"
        )
    (OUTPUT / "track2_validation_data_audit.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def fmt_pct(v: float) -> str:
    return "" if not np.isfinite(v) else f"{v * 100:.2f}%"


def write_summary(
    backtest_metrics: pd.DataFrame,
    baseline: pd.DataFrame,
    rank: pd.DataFrame,
    perturb: pd.DataFrame,
) -> None:
    proposed_all = baseline[(baseline["model"] == "Proposed") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    base1_all = baseline[(baseline["model"] == "Baseline 1") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    base2_all = baseline[(baseline["model"] == "Baseline 2") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    cand_rank = rank[(rank["unit"] == "candidate_grid_current_vs_2031") & (rank["top_k"] == 85)]
    school_rank = rank[(rank["unit"] == "school_walkshed_proxy") & (rank["top_k"] == 85)]
    pert85 = perturb[perturb["k"] == 85]

    lines = [
        "# Track 2 지역 아동수 예측 검증 요약",
        "",
        "## 1. 데이터 가용성",
        "- 사용 데이터: 구별 0~12세 시계열, 1km/250m 격자 예측, 후보지 수혜 예측, 학교 도보권 현재 아동수.",
        "- 검증 가능 단위: 구별 총량 후행검증, 후보지/학교 도보권 현재 기준값 대비 순위 안정성, 후보 수요 perturbation 안정성.",
        "- 제한사항: 250m 격자 또는 후보지 단위의 다년도 관측값은 현재 저장소에 없어 격자 단위 미래값의 직접 후행검증은 불가.",
        "- 주의 문구: 격자 단위 기준값은 공공 인구자료의 공간 배분값이며 개별 아동 위치 실측값이 아니다.",
        "",
        "## 2. 후행검증 결과",
        f"- MAE: {proposed_all.mae:.1f}명",
        f"- WAPE: {fmt_pct(float(proposed_all.wape))}",
        f"- RMSE: {proposed_all.rmse:.1f}명",
        "- 핵심 해석: Track 2의 직접 후행검증은 구별 총량 Prophet 예측에서 가능하며, 격자/후보지 단위는 다년도 기준값 부재로 순위·안정성 검증으로 보완했다.",
        "",
        "## 3. Baseline 비교",
        f"- 가장 단순한 baseline: 최근값 유지 WAPE {fmt_pct(float(base1_all.wape))}",
        f"- 구별 직전 증감률 baseline: WAPE {fmt_pct(float(base2_all.wape))}",
        f"- Proposed: WAPE {fmt_pct(float(proposed_all.wape))}",
        "- Baseline 3와 Proposed 차이: Baseline 3는 고정 공간비율 배분이고, Proposed는 cohort/Prophet 총량과 `w_hat` 공간 보정으로 후보지 수요분포를 조정한다. 단, 미래 격자 기준값이 없어 정확도 수치가 아니라 운영 분포 비교로만 해석한다.",
        "",
        "## 4. 정책 단위 순위 안정성",
        f"- 후보지 current-vs-2031 Spearman: {cand_rank.iloc[0].spearman_r:.3f}" if not cand_rank.empty else "- 후보지 current-vs-2031 Spearman: 산출 불가",
        f"- 학교 도보권 proxy Spearman: {school_rank.iloc[0].spearman_r:.3f}" if not school_rank.empty else "- 학교 도보권 proxy Spearman: 산출 불가",
        f"- Top-K overlap(K=85): 후보지 {int(cand_rank.iloc[0].top_k_overlap)}/85, 학교 {int(school_rank.iloc[0].top_k_overlap)}/85" if not cand_rank.empty and not school_rank.empty else "- Top-K overlap: 산출 불가",
        "- 해석: 후보지/학교 단위 순위는 실측 미래값 검증이 아니라 현재 정책 기준값과 미래 예측 수요의 순위 일관성 점검이다.",
        "",
        "## 5. 후보 추천 안정성",
        "- perturbation 방식: 구별 Prophet 후행검증 residual rate를 후보지 수요에 1,000회 무작위 적용.",
        f"- Top-K 유지율(K=85): {fmt_pct(float(pert85.iloc[0].mean_retention))}" if not pert85.empty else "- Top-K 유지율: 산출 불가",
        f"- Jaccard(K=85): 평균 {pert85.iloc[0].mean_jaccard:.3f}, 중앙값 {pert85.iloc[0].median_jaccard:.3f}" if not pert85.empty else "- Jaccard: 산출 불가",
        "- 해석: 수요 예측 오차를 반영해 흔들어도 상위 후보군의 상당 부분이 유지되는지를 보는 안정성 검증이다.",
        "",
        "## 6. PPT에 넣을 핵심 문장",
        "- 본문용 1문장: Track 2는 개별 격자의 미래 아동수 절대값을 단정하기보다, 구별 총량 후행검증과 후보지 순위 안정성 검증으로 정책 우선순위가 안정적인지 확인했다.",
        "- 부록용 1문장: 구별 Prophet 후행검증의 Proposed WAPE와 MAE를 제시하고, 격자/후보지 단위는 현재 기준값 대비 Spearman 및 잔차 perturbation Top-K 유지율로 보완 검증했다.",
        "- 한계 문장: 후보지·250m 격자 단위의 다년도 실제 관측값은 없어, 격자 기준값은 공공 인구자료를 공간 배분한 정책 분석용 기준값으로 해석해야 한다.",
    ]
    (OUTPUT / "track2_validation_summary.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_ppt_numbers(baseline: pd.DataFrame, rank: pd.DataFrame, perturb: pd.DataFrame) -> None:
    proposed_all = baseline[(baseline["model"] == "Proposed") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    base1_all = baseline[(baseline["model"] == "Baseline 1") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    base2_all = baseline[(baseline["model"] == "Baseline 2") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    base2c_all = baseline[(baseline["model"] == "Baseline 2-city") & (baseline["target_year"].astype(str) == "all")].iloc[0]
    cand_rank = rank[(rank["unit"] == "candidate_grid_current_vs_2031") & (rank["top_k"] == 85)]
    school_rank = rank[(rank["unit"] == "school_walkshed_proxy") & (rank["top_k"] == 85)]
    pert85 = perturb[perturb["k"] == 85]

    lines = [
        "# PPT 삽입용 숫자",
        "",
        "## 본문 슬라이드용",
        f"- Backtest MAE: {proposed_all.mae:.1f}명",
        f"- Backtest WAPE: {fmt_pct(float(proposed_all.wape))}",
        f"- 학교 도보권 Spearman: {school_rank.iloc[0].spearman_r:.3f}" if not school_rank.empty else "- 학교 도보권 Spearman: 산출 불가",
        f"- 후보지 Spearman: {cand_rank.iloc[0].spearman_r:.3f}" if not cand_rank.empty else "- 후보지 Spearman: 산출 불가",
        f"- Top-K 후보 유지율(K=85): {fmt_pct(float(pert85.iloc[0].mean_retention))}" if not pert85.empty else "- Top-K 후보 유지율: 산출 불가",
        "- Perturbation 횟수: 1,000회",
        "",
        "## 부록 슬라이드용",
        f"- Baseline 1 WAPE: {fmt_pct(float(base1_all.wape))}",
        f"- Baseline 2 WAPE: {fmt_pct(float(base2_all.wape))}",
        f"- Baseline 2-city WAPE: {fmt_pct(float(base2c_all.wape))}",
        "- Baseline 3 WAPE: 미래 격자 기준값 부재로 산출 불가",
        f"- Proposed WAPE: {fmt_pct(float(proposed_all.wape))}",
        f"- Proposed 개선율 vs Baseline 1: {(1 - float(proposed_all.wape) / float(base1_all.wape)) * 100:.1f}%",
        f"- Proposed 개선율 vs Baseline 2: {(1 - float(proposed_all.wape) / float(base2_all.wape)) * 100:.1f}%",
        "- Spatial hold-out 결과: 미수행",
        "",
        "## 주의 문장",
        "- 격자 단위 검증 기준값은 주민등록 또는 공공 인구자료를 공간 단위로 배분한 정책 분석용 기준값이며, 개별 아동 위치의 실측값을 의미하지 않는다.",
    ]
    (OUTPUT / "track2_ppt_numbers.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    audit = audit_data()
    audit.to_csv(OUTPUT / "track2_validation_data_audit.csv", index=False, encoding="utf-8-sig")
    write_audit_md(audit)

    gu_ts_path = DATA / "incheon_gu_child_timeseries.csv"
    if not gu_ts_path.exists():
        gu_ts_path = LEGACY_DATA / "incheon_gu_child_timeseries.csv"
    if not gu_ts_path.exists():
        raise FileNotFoundError("구별 아동수 시계열 파일이 없어 Track 2 후행검증을 수행할 수 없습니다.")

    gu_ts = pd.read_csv(gu_ts_path, encoding="utf-8-sig")
    gu_ts["year"] = pd.to_numeric(gu_ts["year"], errors="coerce").astype("Int64")
    gu_ts["child_0_12"] = pd.to_numeric(gu_ts["child_0_12"], errors="coerce")
    gu_ts = gu_ts.dropna(subset=["gu_name", "year", "child_0_12"]).copy()
    gu_ts["year"] = gu_ts["year"].astype(int)

    backtest = build_backtest_rows(gu_ts)
    backtest.to_csv(OUTPUT / "track2_backtest_rows.csv", index=False, encoding="utf-8-sig")
    proposed_metrics, baseline = metric_rows(backtest)
    proposed_metrics.to_csv(OUTPUT / "track2_backtest_metrics.csv", index=False, encoding="utf-8-sig")
    baseline.to_csv(OUTPUT / "track2_baseline_comparison.csv", index=False, encoding="utf-8-sig")

    multistep = build_multistep_backtest_rows(gu_ts)
    multistep.to_csv(OUTPUT / "track2_multistep_backtest_rows.csv", index=False, encoding="utf-8-sig")
    multistep_metrics = multistep_metric_rows(multistep)
    multistep_metrics.to_csv(OUTPUT / "track2_multistep_horizon_metrics.csv", index=False, encoding="utf-8-sig")
    write_multistep_md(multistep_metrics)

    multistep_2021plus = multistep[multistep["origin_year"] >= 2021].copy()
    multistep_2021plus.to_csv(OUTPUT / "track2_multistep_backtest_rows_origin2021plus.csv", index=False, encoding="utf-8-sig")
    multistep_2021plus_metrics = multistep_metric_rows(multistep_2021plus)
    multistep_2021plus_metrics.to_csv(OUTPUT / "track2_multistep_horizon_metrics_origin2021plus.csv", index=False, encoding="utf-8-sig")
    write_multistep_md(
        multistep_2021plus_metrics,
        filename="track2_multistep_horizon_origin2021plus.md",
        title="Track 2 multi-step ahead backtest, origin 2021+",
        note="주의: 사용자가 예시로 든 2021까지 학습 -> 2022~2025 구조에 맞춘 표입니다. 이 범위에서는 최대 4년 ahead까지만 산출됩니다.",
    )

    rank = rank_stability(backtest)
    rank.to_csv(OUTPUT / "track2_policy_rank_stability.csv", index=False, encoding="utf-8-sig")

    perturb = perturb_candidates(backtest)
    perturb.to_csv(OUTPUT / "track2_candidate_perturbation.csv", index=False, encoding="utf-8-sig")

    write_summary(proposed_metrics, baseline, rank, perturb)
    write_ppt_numbers(baseline, rank, perturb)
    print(
        json.dumps(
            {
                "output_dir": str(OUTPUT),
                "backtest_rows": len(backtest),
                "multistep_rows": len(multistep),
                "perturb_rows": len(perturb),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
