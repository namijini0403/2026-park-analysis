from __future__ import annotations

import json
import math
import tempfile
import zipfile
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pandas as pd
from prophet import Prophet
from shapely.geometry import box
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data_processed"
RAW = BASE / "data_raw"
OUTPUT = BASE / "output"

CANDIDATE_PATH = DATA / "candidate_grid_xgb_v4.geojson"
CANDIDATE_CSV_PATH = DATA / "candidate_grid_xgb_v4.csv"
VERSIONED_GEOJSON_PATH = DATA / "candidate_grid_population_alloc_v1.geojson"
VERSIONED_CSV_PATH = DATA / "candidate_grid_population_alloc_v1.csv"
METRICS_JSON_PATH = OUTPUT / "candidate_population_model_metrics_20260419.json"
METRICS_MD_PATH = OUTPUT / "candidate_population_model_metrics_20260419.md"

SCHOOL_PRIORITY_PATH = DATA / "school_priority.csv"
GU_FORECAST_PATH = DATA / "gu_cohort_change_prophet.csv"
GU_TS_PATH = DATA / "incheon_gu_child_timeseries.csv"
POP_1K_PATH = DATA / "population_grid_1k.csv"
POP_100M_PATH = DATA / "population_grid.csv"

ZIP_DASA = RAW / "_grid_border_grid_2025_grid_다사_grid_다사.zip"
ZIP_NASA = RAW / "_grid_border_grid_2025_grid_나사_grid_나사.zip"

CRS_PROJECTED = "EPSG:5179"
INCHEON_BOUNDS = (740634, 1899394, 946455, 2010915)
YEARS_BACKTEST = [2021, 2022, 2023, 2024, 2025]


def parse_linked_schools(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if hasattr(value, "tolist"):
        converted = value.tolist()
        if isinstance(converted, list):
            return [str(item).strip() for item in converted if str(item).strip()]

    text = str(value).strip()
    if not text:
        return []

    if "np.str_(" in text:
        matches = []
        for part in text.split("np.str_("):
            if "'" in part:
                matches.append(part.split("'")[1].strip())
        if matches:
            return [item for item in matches if item]

    if text.startswith("[") and text.endswith("]"):
        inner = text[1:-1].strip()
        if not inner:
            return []
        return [item.strip().strip("'").strip('"') for item in inner.split(",") if item.strip()]

    return [text]


def decode_member_name(raw_name: str) -> str:
    try:
        return raw_name.encode("cp437").decode("cp949")
    except Exception:
        return raw_name


def load_grid_polygons(size_token: str, clip_bounds: tuple[float, float, float, float] | None = None) -> gpd.GeoDataFrame:
    frames: list[gpd.GeoDataFrame] = []
    for prefix, zip_path in [("nasa", ZIP_NASA), ("dasa", ZIP_DASA)]:
        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(zip_path) as zf:
                for item in zf.infolist():
                    decoded_name = decode_member_name(item.filename)
                    if size_token not in decoded_name.upper():
                        continue
                    ext = Path(decoded_name).suffix
                    target = Path(tmpdir) / f"{prefix}_{size_token.lower()}{ext}"
                    target.write_bytes(zf.read(item.filename))

            shp_path = Path(tmpdir) / f"{prefix}_{size_token.lower()}.shp"
            if not shp_path.exists():
                continue

            gdf = gpd.read_file(shp_path)
            if gdf.crs is None:
                gdf = gdf.set_crs(CRS_PROJECTED)
            elif gdf.crs.to_string() != CRS_PROJECTED:
                gdf = gdf.to_crs(CRS_PROJECTED)

            bounds = clip_bounds or INCHEON_BOUNDS
            gdf = gdf.cx[bounds[0] : bounds[2], bounds[1] : bounds[3]].copy()
            frames.append(gdf[["GRID_CD", "geometry"]])

    merged = pd.concat(frames, ignore_index=True)
    result = gpd.GeoDataFrame(merged, geometry="geometry", crs=CRS_PROJECTED)
    result["grid_area"] = result.geometry.area
    return result


def normalize_population_100m(df: pd.DataFrame) -> pd.DataFrame:
    result = df.rename(columns={"총인구": "total_pop"}).copy()
    result["격자코드"] = result["격자코드"].astype(str)
    result["total_pop"] = pd.to_numeric(result["total_pop"], errors="coerce").fillna(0.0)
    result["parent_1k_code"] = result["격자코드"].apply(build_parent_1k_code)
    return result[["격자코드", "total_pop", "parent_1k_code"]]


def normalize_population_1k(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["격자코드"] = result["격자코드"].astype(str)
    for col in ["total_pop", "child_pop_0_5", "child_pop_6_12"]:
        result[col] = pd.to_numeric(result[col], errors="coerce").fillna(0.0)
    result["child_pop_total"] = result["child_pop_0_5"] + result["child_pop_6_12"]
    return result[["격자코드", "total_pop", "child_pop_0_5", "child_pop_6_12", "child_pop_total"]]


def build_parent_1k_code(code: str) -> str:
    prefix = code[:2]
    digits = code[2:]
    if len(digits) != 6:
        return code
    return f"{prefix}{digits[:2]}{digits[3:5]}"


def compute_candidate_current_child(
    candidates: gpd.GeoDataFrame,
    pop100_poly: gpd.GeoDataFrame,
) -> pd.DataFrame:
    overlay = gpd.overlay(
        candidates[["grid_id", "geometry"]],
        pop100_poly[["GRID_CD", "grid_area", "total_pop", "estimated_child_current", "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )
    overlay["inter_area"] = overlay.geometry.area
    overlay["weight"] = np.where(overlay["grid_area"] > 0, overlay["inter_area"] / overlay["grid_area"], 0.0)
    overlay["weighted_total_pop"] = overlay["total_pop"] * overlay["weight"]
    overlay["weighted_child_current"] = overlay["estimated_child_current"] * overlay["weight"]
    grouped = (
        overlay.groupby("grid_id", as_index=False)
        .agg(
            candidate_total_pop_current=("weighted_total_pop", "sum"),
            candidate_child_current=("weighted_child_current", "sum"),
        )
    )
    grouped["candidate_total_pop_current"] = grouped["candidate_total_pop_current"].round(3)
    grouped["candidate_child_current"] = grouped["candidate_child_current"].round(3)
    return grouped


def assign_candidate_gu(candidate_df: pd.DataFrame, school_priority: pd.DataFrame) -> pd.DataFrame:
    name_to_gu = school_priority.drop_duplicates("학교명").set_index("학교명")["gu"].to_dict()
    gu_values = []
    assignment_methods = []
    for schools in candidate_df["linked_schools"]:
        counts: dict[str, int] = {}
        for school_name in schools:
            gu = name_to_gu.get(school_name)
            if gu:
                counts[gu] = counts.get(gu, 0) + 1
        if not counts:
            gu_values.append("")
            assignment_methods.append("missing")
            continue
        chosen = sorted(counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
        gu_values.append(chosen)
        assignment_methods.append("linked_school_majority")
    result = candidate_df.copy()
    result["gu"] = gu_values
    result["gu_assignment_method"] = assignment_methods
    return result


def build_prophet_backtest_metrics(gu_ts: pd.DataFrame) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    for gu_name, group in gu_ts.groupby("gu_name", sort=True):
        group = group.sort_values("year").copy()
        for target_year in YEARS_BACKTEST:
            train = group[group["year"] < target_year].copy()
            actual = group.loc[group["year"] == target_year, "child_0_12"]
            if len(train) < 5 or actual.empty:
                continue

            train["ds"] = pd.to_datetime(train["year"].astype(str) + "-12-31")
            train = train.rename(columns={"child_0_12": "y"})[["ds", "y"]]
            model = Prophet(
                changepoint_prior_scale=0.3,
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
            )
            model.fit(train)
            forecast = model.predict(pd.DataFrame({"ds": [pd.Timestamp(f"{target_year}-12-31")]}))
            yhat = float(forecast["yhat"].iloc[0])
            rows.append(
                {
                    "gu_name": gu_name,
                    "year": target_year,
                    "actual": float(actual.iloc[0]),
                    "predicted": max(yhat, 0.0),
                }
            )

    backtest_df = pd.DataFrame(rows)
    if backtest_df.empty:
        return {"row_count": 0}

    actual = backtest_df["actual"].to_numpy(dtype=float)
    pred = backtest_df["predicted"].to_numpy(dtype=float)
    rmse = math.sqrt(mean_squared_error(actual, pred))
    mape = float(np.mean(np.abs((actual - pred) / np.where(actual == 0, np.nan, actual))) * 100)
    by_year = (
        backtest_df.groupby("year", as_index=False)
        .apply(
            lambda group: pd.Series(
                {
                    "mae": float(mean_absolute_error(group["actual"], group["predicted"])),
                    "rmse": float(math.sqrt(mean_squared_error(group["actual"], group["predicted"]))),
                    "r2": float(r2_score(group["actual"], group["predicted"])) if len(group) >= 2 else float("nan"),
                }
            )
        )
        .reset_index(drop=True)
    )
    return {
        "row_count": int(len(backtest_df)),
        "years": sorted(backtest_df["year"].unique().tolist()),
        "mae": float(mean_absolute_error(actual, pred)),
        "rmse": float(rmse),
        "r2": float(r2_score(actual, pred)),
        "mape_pct": float(np.nan_to_num(mape)),
        "by_year": by_year.to_dict(orient="records"),
    }


def build_spatial_consistency_metrics(pop100_poly: gpd.GeoDataFrame, pop1k: pd.DataFrame) -> dict[str, Any]:
    current = (
        pop100_poly.groupby("parent_1k_code", as_index=False)
        .agg(reconstructed_child_current=("estimated_child_current", "sum"))
        .merge(
            pop1k[["격자코드", "child_pop_total"]],
            left_on="parent_1k_code",
            right_on="격자코드",
            how="inner",
        )
    )
    current["abs_error"] = (current["reconstructed_child_current"] - current["child_pop_total"]).abs()
    rmse = math.sqrt(mean_squared_error(current["child_pop_total"], current["reconstructed_child_current"]))
    return {
        "row_count": int(len(current)),
        "mae": float(mean_absolute_error(current["child_pop_total"], current["reconstructed_child_current"])),
        "rmse": float(rmse),
        "max_abs_error": float(current["abs_error"].max()),
        "median_abs_error": float(current["abs_error"].median()),
        "exact_match_ratio_pct": float((current["abs_error"] < 1e-6).mean() * 100),
    }


def build_summary_markdown(metrics: dict[str, Any]) -> str:
    prophet = metrics["prophet_backtest"]
    spatial = metrics["spatial_consistency"]
    coverage = metrics["candidate_coverage"]
    return "\n".join(
        [
            "# 후보지 잠재수혜인원 모델 지표",
            "",
            "## 모델 구조",
            "- 구별 Prophet으로 2029/2031 아동 총량 예측",
            "- 1km 격자 아동인구를 100m 총인구 비율로 세분화",
            "- 후보지 250m 폴리곤에 중첩되는 100m 추정 아동인구를 합산",
            "- 후보지 현재 아동규모에 구별 성장계수를 곱해 2029/2031 잠재수혜인원 산출",
            "",
            "## Prophet 백테스트",
            f"- 검증 행 수: {prophet.get('row_count', 0)}",
            f"- MAE: {prophet.get('mae', 0):.2f}",
            f"- RMSE: {prophet.get('rmse', 0):.2f}",
            f"- R2: {prophet.get('r2', 0):.4f}",
            f"- MAPE(%): {prophet.get('mape_pct', 0):.2f}",
            "",
            "## 공간 배분 일관성",
            f"- 1km 검증 행 수: {spatial.get('row_count', 0)}",
            f"- MAE: {spatial.get('mae', 0):.4f}",
            f"- RMSE: {spatial.get('rmse', 0):.4f}",
            f"- 최대 절대오차: {spatial.get('max_abs_error', 0):.4f}",
            f"- 정확 일치 비율(%): {spatial.get('exact_match_ratio_pct', 0):.2f}",
            "",
            "## 후보지 커버리지",
            f"- 전체 후보지 수: {coverage.get('candidate_count', 0)}",
            f"- 후보지 현재 추정 아동수 합: {coverage.get('candidate_child_sum_current', 0):,.1f}",
            f"- 연결 가능한 구 2025 아동수 합: {coverage.get('gu_child_sum_2025', 0):,.1f}",
            f"- 후보지 커버 비율(%): {coverage.get('coverage_ratio_pct', 0):.2f}",
        ]
    )


def main() -> None:
    candidate_gdf = gpd.read_file(CANDIDATE_PATH)
    candidate_gdf["linked_schools"] = candidate_gdf["linked_schools"].apply(parse_linked_schools)
    candidate_gdf = candidate_gdf.to_crs(CRS_PROJECTED)

    minx, miny, maxx, maxy = candidate_gdf.total_bounds
    clip_bounds = (minx - 1000, miny - 1000, maxx + 1000, maxy + 1000)

    school_priority = pd.read_csv(SCHOOL_PRIORITY_PATH, encoding="utf-8-sig")
    gu_forecast = pd.read_csv(GU_FORECAST_PATH, encoding="utf-8-sig")
    gu_ts = pd.read_csv(GU_TS_PATH, encoding="utf-8-sig")
    pop_1k = normalize_population_1k(pd.read_csv(POP_1K_PATH, encoding="utf-8-sig"))
    pop_100m = normalize_population_100m(pd.read_csv(POP_100M_PATH, encoding="utf-8-sig"))

    grid_1k = load_grid_polygons("1K", clip_bounds=clip_bounds)
    grid_100m = load_grid_polygons("100M", clip_bounds=clip_bounds)

    pop100_poly = grid_100m.merge(pop_100m, left_on="GRID_CD", right_on="격자코드", how="inner")
    pop1k_poly = grid_1k.merge(pop_1k, left_on="GRID_CD", right_on="격자코드", how="inner")

    parent_totals = (
        pop100_poly.groupby("parent_1k_code", as_index=False)["total_pop"]
        .sum()
        .rename(columns={"total_pop": "parent_total_pop_100m_sum"})
    )
    pop100_poly = pop100_poly.merge(parent_totals, on="parent_1k_code", how="left")
    pop100_poly = pop100_poly.merge(
        pop1k_poly[["GRID_CD", "child_pop_total"]].rename(columns={"GRID_CD": "parent_1k_code"}),
        on="parent_1k_code",
        how="left",
    )
    pop100_poly["estimated_child_current"] = np.where(
        pop100_poly["parent_total_pop_100m_sum"] > 0,
        pop100_poly["child_pop_total"] * pop100_poly["total_pop"] / pop100_poly["parent_total_pop_100m_sum"],
        0.0,
    )

    candidate_current = compute_candidate_current_child(candidate_gdf, pop100_poly)

    candidate_df = candidate_gdf.drop(columns="geometry").copy()
    candidate_df = candidate_df.merge(candidate_current, on="grid_id", how="left")
    candidate_df["candidate_total_pop_current"] = candidate_df["candidate_total_pop_current"].fillna(0.0)
    candidate_df["candidate_child_current"] = candidate_df["candidate_child_current"].fillna(0.0)
    candidate_df = assign_candidate_gu(candidate_df, school_priority)

    gu_actual_2025 = (
        gu_ts[gu_ts["year"] == 2025][["gu_name", "child_0_12"]]
        .rename(columns={"gu_name": "gu", "child_0_12": "actual_2025"})
        .copy()
    )
    gu_growth = gu_forecast.rename(
        columns={
            "gu_name": "gu",
            "predicted_2029": "gu_predicted_2029",
            "predicted_2031": "gu_predicted_2031",
        }
    )[["gu", "gu_predicted_2029", "gu_predicted_2031"]]
    gu_model = gu_growth.merge(gu_actual_2025, on="gu", how="left")
    gu_model["gu_growth_factor_2029"] = np.where(
        gu_model["actual_2025"] > 0,
        gu_model["gu_predicted_2029"] / gu_model["actual_2025"],
        1.0,
    )
    gu_model["gu_growth_factor_2031"] = np.where(
        gu_model["actual_2025"] > 0,
        gu_model["gu_predicted_2031"] / gu_model["actual_2025"],
        1.0,
    )

    candidate_df = candidate_df.merge(gu_model, on="gu", how="left")
    candidate_df["forecast_2029"] = (
        candidate_df["candidate_child_current"] * candidate_df["gu_growth_factor_2029"].fillna(1.0)
    ).round().astype(int)
    candidate_df["forecast_2031"] = (
        candidate_df["candidate_child_current"] * candidate_df["gu_growth_factor_2031"].fillna(1.0)
    ).round().astype(int)
    candidate_df["xgb_predicted_2029"] = candidate_df["forecast_2029"]
    candidate_df["xgb_predicted_2031"] = candidate_df["forecast_2031"]
    candidate_df["demand_label"] = "잠재수혜인원 예측"
    candidate_df["demand_note"] = "구별 Prophet 총량과 1km 아동인구·100m 총인구 비례배분을 결합한 잠재수혜인원입니다."
    candidate_df["demand_model_version"] = "gu_prophet_grid_alloc_v1_20260419"

    # Preserve the previous candidate demand values for auditability.
    for legacy_col, source_candidates in {
        "legacy_forecast_2029": ["forecast_2029_y", "forecast_2029"],
        "legacy_forecast_2031": ["forecast_2031_y", "forecast_2031"],
        "legacy_xgb_predicted_2029": ["xgb_predicted_2029_y", "xgb_predicted_2029_x", "xgb_predicted_2029"],
        "legacy_xgb_predicted_2031": ["xgb_predicted_2031_y", "xgb_predicted_2031_x", "xgb_predicted_2031"],
    }.items():
        value = None
        for source in source_candidates:
            if source in candidate_gdf.columns:
                candidate_df[legacy_col] = candidate_gdf[source]
                value = source
                break
        if value is None:
            candidate_df[legacy_col] = np.nan

    priority_multiplier = np.where(candidate_df["worst_case_type"] == 1.0, 1.5, 1.0)
    candidate_df["priority_score"] = (
        (candidate_df["forecast_2029"] * 0.6 + candidate_df["forecast_2031"] * 0.4) * priority_multiplier
    ).round(3)
    candidate_df = candidate_df.sort_values(["priority_score", "forecast_2029", "grid_id"], ascending=[False, False, True]).reset_index(drop=True)
    candidate_df["candidate_rank"] = np.arange(1, len(candidate_df) + 1)

    keep_columns = [
        "grid_id",
        "cx",
        "cy",
        "gu",
        "gu_assignment_method",
        "linked_schools",
        "linked_school_count",
        "worst_case_type",
        "avg_green_ratio",
        "avg_playground_count",
        "avg_park_dist_m",
        "land_feasibility_level",
        "priority_score",
        "candidate_rank",
        "candidate_total_pop_current",
        "candidate_child_current",
        "gu_predicted_2029",
        "gu_predicted_2031",
        "actual_2025",
        "gu_growth_factor_2029",
        "gu_growth_factor_2031",
        "legacy_forecast_2029",
        "legacy_forecast_2031",
        "legacy_xgb_predicted_2029",
        "legacy_xgb_predicted_2031",
        "forecast_2029",
        "forecast_2031",
        "xgb_predicted_2029",
        "xgb_predicted_2031",
        "nearest_park_dist",
        "nearest_pg_dist",
        "demand_label",
        "demand_note",
        "demand_model_version",
    ]
    for col in keep_columns:
        if col not in candidate_df.columns:
            candidate_df[col] = np.nan

    final_gdf = candidate_gdf[["grid_id", "geometry"]].merge(candidate_df[keep_columns], on="grid_id", how="left")
    final_gdf = gpd.GeoDataFrame(final_gdf, geometry="geometry", crs=CRS_PROJECTED).to_crs("EPSG:4326")
    final_df = final_gdf.drop(columns="geometry")

    VERSIONED_GEOJSON_PATH.unlink(missing_ok=True)
    VERSIONED_CSV_PATH.unlink(missing_ok=True)
    final_gdf.to_file(VERSIONED_GEOJSON_PATH, driver="GeoJSON")
    final_df.to_csv(VERSIONED_CSV_PATH, index=False, encoding="utf-8-sig")
    active_replace = False

    prophet_metrics = build_prophet_backtest_metrics(gu_ts)
    spatial_metrics = build_spatial_consistency_metrics(pop100_poly, pop_1k)
    coverage_df = candidate_df.merge(gu_actual_2025, on="gu", how="left", suffixes=("", "_dup"))
    coverage_summary = (
        coverage_df.groupby("gu", as_index=False)
        .agg(candidate_child_current=("candidate_child_current", "sum"), actual_2025=("actual_2025", "first"))
    )
    coverage_summary["coverage_ratio"] = np.where(
        coverage_summary["actual_2025"] > 0,
        coverage_summary["candidate_child_current"] / coverage_summary["actual_2025"],
        np.nan,
    )
    metrics = {
        "model_version": "gu_prophet_grid_alloc_v1_20260419",
        "candidate_count": int(len(final_df)),
        "prophet_backtest": prophet_metrics,
        "spatial_consistency": spatial_metrics,
        "candidate_coverage": {
            "candidate_count": int(len(final_df)),
            "candidate_child_sum_current": float(candidate_df["candidate_child_current"].sum()),
            "gu_child_sum_2025": float(coverage_summary["actual_2025"].fillna(0).sum()),
            "coverage_ratio_pct": float(
                100
                * candidate_df["candidate_child_current"].sum()
                / max(coverage_summary["actual_2025"].fillna(0).sum(), 1.0)
            ),
            "by_gu": coverage_summary.round(4).to_dict(orient="records"),
        },
        "forecast_ranges": {
            "forecast_2029_min": int(final_df["forecast_2029"].min()),
            "forecast_2029_max": int(final_df["forecast_2029"].max()),
            "forecast_2031_min": int(final_df["forecast_2031"].min()),
            "forecast_2031_max": int(final_df["forecast_2031"].max()),
        },
        "active_file_replace_succeeded": active_replace,
    }
    METRICS_JSON_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    METRICS_MD_PATH.write_text(build_summary_markdown(metrics), encoding="utf-8")

    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
