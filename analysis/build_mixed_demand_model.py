# -*- coding: utf-8 -*-
"""
혼합모델 최종 고정 버전 (2026-04-19)
Step A: 구별 cohort 유지계수 추정
Step B: 1km cohort 기반 예측
Step C: Prophet 총량 분배 → 1km
Step D: 혼합 (cohort 0.8/0.7 + prophet 0.2/0.3)
Step E: 250m 분배 (base share + LightGBM 보정)
Step F: candidate grid 반영
Step G: 재개발 경고 레이어
"""

from __future__ import annotations

import json
import tempfile
import zipfile
from pathlib import Path

import geopandas as gpd
import lightgbm as lgb
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
from scipy.stats import linregress
from shapely.geometry import Point
from sklearn.neighbors import BallTree

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data_processed"
RAW = BASE / "data_raw"
OUTPUT = BASE / "output"
OUTPUT.mkdir(exist_ok=True)

# 입력 파일
GU_TS_PATH = DATA / "incheon_gu_child_timeseries.csv"
GU_PROPHET_PATH = DATA / "gu_cohort_change_prophet.csv"
AGE_RATIO_PATH = DATA / "age_ratio_incheon.csv"
POP_1K_PATH = DATA / "population_grid_1k.csv"
POP_100M_PATH = DATA / "population_grid.csv"
SCHOOLS_PATH = DATA / "schools.csv"
SCHOOL_PRIORITY_PATH = DATA / "school_priority.csv"
CANDIDATE_PATH = DATA / "candidate_grid_xgb_v3.geojson"   # 1666개 (31 추가 후보지 포함)
CANDIDATE_V4_PATH = DATA / "candidate_grid_xgb_v4.geojson"  # 1635개 (nearest_park/pg_dist 있음)
CANDIDATE_ENRICHED_PATH = DATA / "candidate_grid_enriched_v2.geojson"
CANDIDATE_ALLOC_PATH = DATA / "candidate_grid_population_alloc_v1.csv"
REDEV_PATH = DATA / "redevelopment_geocoded.csv"
ZIP_DASA = RAW / "_grid_border_grid_2025_grid_다사_grid_다사.zip"
ZIP_NASA = RAW / "_grid_border_grid_2025_grid_나사_grid_나사.zip"

# 출력 파일
OUT_COHORT_RATIOS = DATA / "gu_cohort_ratios.csv"
OUT_1KM_COHORT = DATA / "grid_1km_cohort_pred.csv"
OUT_1KM_PROPHET = DATA / "grid_1km_prophet_alloc.csv"
OUT_1KM_FINAL = DATA / "grid_1km_final_pred.csv"
OUT_250M = DATA / "grid_250m_pred.csv"
OUT_CANDIDATE_GEOJSON = DATA / "candidate_grid_final.geojson"
OUT_CANDIDATE_CSV = DATA / "candidate_grid_final.csv"
OUT_LGBM_MODEL = DATA / "lgbm_spatial_distribution.pkl"
GRAPH_PATH = DATA / "incheon_walk_graph_v2.graphml"

CRS_PROJ = "EPSG:5179"
INCHEON_BOUNDS = (740634, 1899394, 946455, 2010915)

# 혼합 가중치 (고정, 변경 금지)
W_COHORT_2029 = 0.8
W_PROPHET_2029 = 0.2
W_COHORT_2031 = 0.7
W_PROPHET_2031 = 0.3

GU_NAME_MAP = {
    "2811000000": "중구",
    "2814000000": "동구",
    "2817700000": "미추홀구",
    "2818500000": "연수구",
    "2820000000": "남동구",
    "2823700000": "부평구",
    "2824500000": "계양구",
    "2826000000": "서구",
    "2871000000": "강화군",
    "2872000000": "옹진군",
}


# ──────────────────────────────────────────────
# 유틸리티
# ──────────────────────────────────────────────

def decode_member_name(raw_name: str) -> str:
    try:
        return raw_name.encode("cp437").decode("cp949")
    except Exception:
        return raw_name


def build_parent_1k_code(code: str) -> str:
    """100m 격자코드 → 부모 1km 격자코드"""
    prefix = code[:2]
    digits = code[2:]
    if len(digits) != 6:
        return code
    return f"{prefix}{digits[:2]}{digits[3:5]}"


def load_grid_polygons(size_token: str) -> gpd.GeoDataFrame:
    frames = []
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
                gdf = gdf.set_crs(CRS_PROJ)
            elif gdf.crs.to_string() != CRS_PROJ:
                gdf = gdf.to_crs(CRS_PROJ)
            gdf = gdf.cx[INCHEON_BOUNDS[0]:INCHEON_BOUNDS[2],
                         INCHEON_BOUNDS[1]:INCHEON_BOUNDS[3]].copy()
            frames.append(gdf[["GRID_CD", "geometry"]])
    merged = pd.concat(frames, ignore_index=True)
    return gpd.GeoDataFrame(merged, geometry="geometry", crs=CRS_PROJ)


def compute_age_shares(age_df: pd.DataFrame) -> dict:
    """age_ratio_incheon.csv → 연령 구간 비율 계산"""
    pop = dict(zip(age_df["age"], age_df["population"]))

    def _sum(*ages):
        return sum(pop.get(a, 0) for a in ages)

    total_0_5 = _sum(0, 1, 2, 3, 4, 5)
    total_6_12 = _sum(6, 7, 8, 9, 10, 11, 12)
    total_0_12 = total_0_5 + total_6_12

    return {
        # n_3_9 추정용: 0-5 내 3-5 비율, 6-12 내 6-9 비율
        "share_3_5_in_0_5": _sum(3, 4, 5) / total_0_5,
        "share_6_9_in_6_12": _sum(6, 7, 8, 9) / total_6_12,
        # n_1_7 추정용: 0-5 내 1-5 비율, 6-12 내 6-7 비율
        "share_1_5_in_0_5": _sum(1, 2, 3, 4, 5) / total_0_5,
        "share_6_7_in_6_12": _sum(6, 7) / total_6_12,
        # 0-12 내 6-12 비율 (r3/r5 계산용 스케일 팩터)
        "share_6_12_in_0_12": total_6_12 / total_0_12,
        "share_3_9_in_0_12": _sum(3, 4, 5, 6, 7, 8, 9) / total_0_12,
        "share_1_7_in_0_12": _sum(1, 2, 3, 4, 5, 6, 7) / total_0_12,
    }


# ──────────────────────────────────────────────
# STEP A: 구별 cohort 유지계수 추정
# ──────────────────────────────────────────────

def step_a_cohort_ratios(gu_ts: pd.DataFrame, age_shares: dict) -> pd.DataFrame:
    """
    r3_g(t) = Pop(6~12, g, t+3) / Pop(3~9, g, t)
    r5_g(t) = Pop(6~12, g, t+5) / Pop(1~7, g, t)

    child_0_12만 있으므로:
    Pop(6~12) ≈ child_0_12 × share_6_12_in_0_12
    Pop(3~9)  ≈ child_0_12 × share_3_9_in_0_12
    Pop(1~7)  ≈ child_0_12 × share_1_7_in_0_12
    """
    s612 = age_shares["share_6_12_in_0_12"]
    s39 = age_shares["share_3_9_in_0_12"]
    s17 = age_shares["share_1_7_in_0_12"]

    rows = []
    for gu_name, group in gu_ts.groupby("gu_name", sort=True):
        gdf = group.sort_values("year").set_index("year")["child_0_12"]

        # r3 슬라이딩 윈도우 (t, t+3)
        r3_series = {}
        for t in gdf.index:
            if (t + 3) in gdf.index and gdf[t] > 0:
                r3_series[t] = (gdf[t + 3] * s612) / (gdf[t] * s39)

        # r5 슬라이딩 윈도우 (t, t+5)
        r5_series = {}
        for t in gdf.index:
            if (t + 5) in gdf.index and gdf[t] > 0:
                r5_series[t] = (gdf[t + 5] * s612) / (gdf[t] * s17)

        def representative(series: dict, recent_n: int = 5) -> float:
            if not series:
                return 1.0
            vals = list(series.values())
            years = list(series.keys())
            mean = np.mean(vals)
            std = np.std(vals)
            cv = std / mean if mean > 0 else 0.0

            if cv < 0.10:
                # 최근 N개 가중평균 (최신에 더 큰 가중치)
                recent_vals = vals[-recent_n:]
                weights = np.arange(1, len(recent_vals) + 1, dtype=float)
                return float(np.average(recent_vals, weights=weights))
            else:
                # 추세 확인
                if len(vals) >= 3:
                    slope, intercept, r, p, _ = linregress(years, vals)
                    if abs(r) >= 0.5 and p < 0.2:
                        # 선형 외삽: 예측 연도 기준
                        next_year = max(years) + 1
                        extrapolated = slope * next_year + intercept
                        return max(float(extrapolated), 0.1)
                # fallback: 평균
                return float(mean)

        r3 = representative(r3_series)
        r5 = representative(r5_series)

        r3_vals = list(r3_series.values())
        r5_vals = list(r5_series.values())

        rows.append({
            "gu_name": gu_name,
            "r3_repr": round(r3, 6),
            "r5_repr": round(r5, 6),
            "r3_cv": round(np.std(r3_vals) / np.mean(r3_vals), 4) if r3_vals else np.nan,
            "r5_cv": round(np.std(r5_vals) / np.mean(r5_vals), 4) if r5_vals else np.nan,
            "r3_mean": round(np.mean(r3_vals), 6) if r3_vals else np.nan,
            "r5_mean": round(np.mean(r5_vals), 6) if r5_vals else np.nan,
            "r3_n": len(r3_vals),
            "r5_n": len(r5_vals),
        })

    out = pd.DataFrame(rows)
    out.to_csv(OUT_COHORT_RATIOS, index=False, encoding="utf-8-sig")
    print(f"[Step A] gu_cohort_ratios.csv 저장 ({len(out)}개 구)")
    return out


# ──────────────────────────────────────────────
# STEP B: 1km cohort 기반 예측
# ──────────────────────────────────────────────

def assign_gu_to_1km(pop1k: pd.DataFrame, grid_1k: gpd.GeoDataFrame,
                     schools: pd.DataFrame) -> pd.DataFrame:
    """
    1km 격자 → 구 매핑: 격자 중심점에서 가장 가까운 학교의 구 사용
    """
    # 1km 격자에 격자코드 기반 폴리곤 중심 연결
    grid_with_code = grid_1k.merge(
        pop1k[["격자코드"]], left_on="GRID_CD", right_on="격자코드", how="inner"
    ).copy()
    if grid_with_code.empty:
        return pop1k.assign(gu_name="미상")

    centroids = grid_with_code.geometry.centroid.to_crs("EPSG:4326")
    grid_lat = centroids.y.values
    grid_lon = centroids.x.values

    school_lat = schools["lat"].values
    school_lon = schools["lon"].values

    # BallTree 기반 최근접 학교 탐색
    school_coords = np.radians(np.column_stack([school_lat, school_lon]))
    grid_coords = np.radians(np.column_stack([grid_lat, grid_lon]))
    tree = BallTree(school_coords, metric="haversine")
    _, idx = tree.query(grid_coords, k=1)
    nearest_gu = schools["gu"].values[idx.flatten()]

    grid_gu = pd.DataFrame({
        "격자코드": grid_with_code["격자코드"].values,
        "gu_name": nearest_gu,
    })
    return pop1k.merge(grid_gu, on="격자코드", how="left")


def step_b_1km_cohort(pop1k: pd.DataFrame, cohort_ratios: pd.DataFrame,
                      age_shares: dict, gu_ts: pd.DataFrame) -> pd.DataFrame:
    """
    n_3_9 = child_pop_0_5 × share_3_5_in_0_5 + child_pop_6_12 × share_6_9_in_6_12
    n_1_7 = child_pop_0_5 × share_1_5_in_0_5 + child_pop_6_12 × share_6_7_in_6_12

    gu 수준 cohort 목표치 계산 후, 격자 내 n_3_9/n_1_7 비율로 분배:
    gu_target_2029 = actual_2024 × r3 × share_3_9_in_0_12
    pred_2029_cohort_i = (n_3_9_i / Σn_3_9_in_gu) × gu_target_2029

    → 격자 수준 예측이 실제 구별 아동 인구와 정합성 유지
    """
    s39 = age_shares["share_3_9_in_0_12"]
    s17 = age_shares["share_1_7_in_0_12"]

    r_map = cohort_ratios.set_index("gu_name")[["r3_repr", "r5_repr"]]

    # 실제 2024 구별 아동 인구
    actual_map = (
        gu_ts[gu_ts["year"] == gu_ts["year"].max()]
        .set_index("gu_name")["child_0_12"]
        .to_dict()
    )

    df = pop1k.copy()
    df["n_3_9"] = (
        df["child_pop_0_5"] * age_shares["share_3_5_in_0_5"]
        + df["child_pop_6_12"] * age_shares["share_6_9_in_6_12"]
    )
    df["n_1_7"] = (
        df["child_pop_0_5"] * age_shares["share_1_5_in_0_5"]
        + df["child_pop_6_12"] * age_shares["share_6_7_in_6_12"]
    )

    df = df.merge(r_map, on="gu_name", how="left")
    df["r3_repr"] = df["r3_repr"].fillna(1.0)
    df["r5_repr"] = df["r5_repr"].fillna(1.0)
    df["actual_2024"] = df["gu_name"].map(actual_map).fillna(0.0)

    # 구별 cohort 목표치 (실제 인구 기반 앵커)
    df["gu_target_2029"] = df["actual_2024"] * df["r3_repr"] * s39
    df["gu_target_2031"] = df["actual_2024"] * df["r5_repr"] * s17

    # 구별 n_3_9, n_1_7 합계 (분모)
    gu_n39_sum = df.groupby("gu_name")["n_3_9"].transform("sum")
    gu_n17_sum = df.groupby("gu_name")["n_1_7"].transform("sum")

    # 격자별 share → 구 목표치 비례 배분
    df["share_n39"] = np.where(gu_n39_sum > 0, df["n_3_9"] / gu_n39_sum, 0.0)
    df["share_n17"] = np.where(gu_n17_sum > 0, df["n_1_7"] / gu_n17_sum, 0.0)

    df["pred_2029_cohort"] = (df["share_n39"] * df["gu_target_2029"]).clip(lower=0)
    df["pred_2031_cohort"] = (df["share_n17"] * df["gu_target_2031"]).clip(lower=0)

    # 검증: 구별 합계 ≈ gu_target (gu_target은 구별 1개 고정값)
    _pred_sum = df.groupby("gu_name")["pred_2029_cohort"].sum()
    _target = df.groupby("gu_name")["gu_target_2029"].first()
    max_err = (_pred_sum - _target).abs().max()
    assert max_err < 0.01, f"Step B 구별 합계 보존 실패: {max_err}"

    out = df[["격자코드", "gu_name", "total_pop", "child_pop_0_5", "child_pop_6_12",
              "n_3_9", "n_1_7", "r3_repr", "r5_repr",
              "gu_target_2029", "gu_target_2031",
              "pred_2029_cohort", "pred_2031_cohort"]]
    out.to_csv(OUT_1KM_COHORT, index=False, encoding="utf-8-sig")
    print(f"[Step B] grid_1km_cohort_pred.csv 저장 ({len(out)}개 격자)")
    return out


# ──────────────────────────────────────────────
# STEP C: Prophet 총량 분배 → 1km
# ──────────────────────────────────────────────

def step_c_prophet_alloc(cohort_1km: pd.DataFrame,
                         gu_prophet: pd.DataFrame,
                         age_shares: dict) -> pd.DataFrame:
    """
    share_1km = pred_1km_cohort / Σ(pred_1km_cohort in gu)
    pred_1km_prophet_alloc = share_1km × pred_gu_prophet_6_12

    Prophet은 0-12세 총량 예측 → 6-12세 스케일로 변환 후 사용:
    pred_gu_prophet_6_12 = predicted_2029 × share_6_12_in_0_12
    (cohort 예측과 동일 단위 유지)
    """
    s612 = age_shares["share_6_12_in_0_12"]
    prophet_map = gu_prophet.set_index("gu_name")[["predicted_2029", "predicted_2031"]]

    df = cohort_1km.copy()

    # 구별 cohort 합계
    gu_cohort_sum = (
        df.groupby("gu_name")[["pred_2029_cohort", "pred_2031_cohort"]]
        .sum()
        .rename(columns={"pred_2029_cohort": "gu_cohort_sum_2029",
                         "pred_2031_cohort": "gu_cohort_sum_2031"})
    )
    df = df.merge(gu_cohort_sum, on="gu_name", how="left")
    df = df.merge(prophet_map, on="gu_name", how="left")

    # Prophet 0-12 → 6-12 변환
    df["prophet_6_12_2029"] = df["predicted_2029"].fillna(
        df["pred_2029_cohort"] / (s612 + 1e-9)
    ) * s612
    df["prophet_6_12_2031"] = df["predicted_2031"].fillna(
        df["pred_2031_cohort"] / (s612 + 1e-9)
    ) * s612

    # share 계산 (cohort 기반 공간 비율)
    df["share_2029"] = np.where(
        df["gu_cohort_sum_2029"] > 0,
        df["pred_2029_cohort"] / df["gu_cohort_sum_2029"],
        0.0,
    )
    df["share_2031"] = np.where(
        df["gu_cohort_sum_2031"] > 0,
        df["pred_2031_cohort"] / df["gu_cohort_sum_2031"],
        0.0,
    )

    df["pred_2029_prophet"] = (df["share_2029"] * df["prophet_6_12_2029"]).clip(lower=0)
    df["pred_2031_prophet"] = (df["share_2031"] * df["prophet_6_12_2031"]).clip(lower=0)

    out = df[["격자코드", "gu_name", "pred_2029_cohort", "pred_2031_cohort",
              "pred_2029_prophet", "pred_2031_prophet"]]
    out.to_csv(OUT_1KM_PROPHET, index=False, encoding="utf-8-sig")
    print(f"[Step C] grid_1km_prophet_alloc.csv 저장 ({len(out)}개 격자)")
    return out


# ──────────────────────────────────────────────
# STEP D: 혼합모델
# ──────────────────────────────────────────────

def step_d_mix(prophet_alloc: pd.DataFrame) -> pd.DataFrame:
    """
    pred_2029_final = 0.8 × cohort + 0.2 × prophet
    pred_2031_final = 0.7 × cohort + 0.3 × prophet
    """
    df = prophet_alloc.copy()
    df["pred_2029_1km"] = (
        W_COHORT_2029 * df["pred_2029_cohort"]
        + W_PROPHET_2029 * df["pred_2029_prophet"]
    ).clip(lower=0)
    df["pred_2031_1km"] = (
        W_COHORT_2031 * df["pred_2031_cohort"]
        + W_PROPHET_2031 * df["pred_2031_prophet"]
    ).clip(lower=0)

    # 검증: NaN / inf 제거
    assert not df["pred_2029_1km"].isna().any(), "NaN in pred_2029_1km"
    assert not df["pred_2031_1km"].isna().any(), "NaN in pred_2031_1km"
    assert (df["pred_2029_1km"] >= 0).all(), "음수 in pred_2029_1km"
    assert (df["pred_2031_1km"] >= 0).all(), "음수 in pred_2031_1km"

    # 참고용 괴리 출력
    gu_stats = df.groupby("gu_name").agg(
        cohort_2029=("pred_2029_cohort", "sum"),
        prophet_2029=("pred_2029_prophet", "sum"),
        final_2029=("pred_2029_1km", "sum"),
    )
    gu_stats["divergence"] = abs(gu_stats["cohort_2029"] - gu_stats["prophet_2029"]) / (
        gu_stats["cohort_2029"].replace(0, np.nan)
    )
    print("[Step D] 구별 cohort vs prophet 괴리 (참고용):")
    print(gu_stats[["cohort_2029", "prophet_2029", "divergence"]].round(3).to_string())

    out = df[["격자코드", "gu_name", "pred_2029_cohort", "pred_2031_cohort",
              "pred_2029_prophet", "pred_2031_prophet",
              "pred_2029_1km", "pred_2031_1km"]]
    out.to_csv(OUT_1KM_FINAL, index=False, encoding="utf-8-sig")
    print(f"[Step D] grid_1km_final_pred.csv 저장")
    return out


# ──────────────────────────────────────────────
# STEP E: 250m 분배 (base + LightGBM correction)
# ──────────────────────────────────────────────

def step_e_250m_distribution(
    candidates: gpd.GeoDataFrame,
    grid_1k: gpd.GeoDataFrame,
    final_1km: pd.DataFrame,
    pop_1k: pd.DataFrame,
    pop_100m: pd.DataFrame,
    alloc_v1: pd.DataFrame,
) -> pd.DataFrame:
    """
    E-1. base share: w_base = pop_candidate / Σ(pop_candidates in parent 1km)
    E-2. LightGBM: 공간 특성 기반 보정 → w_hat = w_base × exp(f(X))
    E-3. 정규화 후 최종 분배
    """
    # --- 후보지 → 부모 1km 매핑 ---
    cand_proj = candidates.to_crs(CRS_PROJ).copy()
    cand_proj["cand_area"] = cand_proj.geometry.area

    grid_1k_with_pop = grid_1k.merge(
        pop_1k[["격자코드", "total_pop", "child_pop_0_5", "child_pop_6_12"]],
        left_on="GRID_CD", right_on="격자코드", how="inner"
    ).copy()
    grid_1k_with_pop["child_pop_total"] = (
        grid_1k_with_pop["child_pop_0_5"] + grid_1k_with_pop["child_pop_6_12"]
    )
    grid_1k_with_pop["child_ratio_1km"] = np.where(
        grid_1k_with_pop["total_pop"] > 0,
        grid_1k_with_pop["child_pop_total"] / grid_1k_with_pop["total_pop"],
        0.0,
    )
    grid_1k_with_pop["grid_area"] = grid_1k_with_pop.geometry.area

    # 후보지 ∩ 1km 격자 중첩
    overlay = gpd.overlay(
        cand_proj[["grid_id", "cand_area", "geometry"]],
        grid_1k_with_pop[["GRID_CD", "grid_area", "total_pop",
                           "child_pop_total", "child_ratio_1km", "geometry"]],
        how="intersection", keep_geom_type=False,
    )
    overlay["inter_area"] = overlay.geometry.area
    overlay["weight_in_1km"] = np.where(
        overlay["grid_area"] > 0,
        overlay["inter_area"] / overlay["grid_area"],
        0.0,
    )
    # 가장 많이 겹치는 1km 격자를 부모로 선택
    parent_1km = (
        overlay.sort_values("inter_area", ascending=False)
        .groupby("grid_id", as_index=False)
        .first()[["grid_id", "GRID_CD", "total_pop", "child_pop_total", "child_ratio_1km"]]
        .rename(columns={"GRID_CD": "parent_1km_code",
                         "total_pop": "parent_total_pop",
                         "child_pop_total": "parent_child_total",
                         "child_ratio_1km": "child_ratio_1km"})
    )

    # 후보지 총인구 (100m 격자 기반 역산)
    pop_100m_norm = pop_100m.rename(columns={"총인구": "total_pop_100m"}).copy()
    pop_100m_norm["parent_1k_code"] = pop_100m_norm["격자코드"].apply(build_parent_1k_code)

    # 후보지 내 100m 격자 집계로 후보지 총인구 추정
    cand_100m = grid_1k  # reuse for overlay with 100m
    # 단순화: cx, cy 기반 후보지 총인구는 parent 1km 내 비율로 추정
    # candidates에 total_pop 없으면 parent 1km total_pop의 1/n 사용
    candidates_df = candidates.drop(columns="geometry").copy()
    candidates_df = candidates_df.merge(parent_1km, on="grid_id", how="left")

    # v1 모델에서 후보지 총인구 가져오기 (base share용)
    if "candidate_total_pop_current" in alloc_v1.columns:
        pop_per_cand = alloc_v1[["grid_id", "candidate_total_pop_current"]].copy()
        candidates_df = candidates_df.merge(pop_per_cand, on="grid_id", how="left")
        candidates_df["cand_pop"] = candidates_df["candidate_total_pop_current"].fillna(0)
    else:
        candidates_df["cand_pop"] = 0.0

    # base share: 후보지 인구 비율 (인구 없으면 균등 배분)
    gu_pop_sum = candidates_df.groupby("parent_1km_code")["cand_pop"].transform("sum")
    n_in_group = candidates_df.groupby("parent_1km_code")["cand_pop"].transform("count")
    candidates_df["w_base"] = np.where(
        gu_pop_sum > 0,
        candidates_df["cand_pop"] / gu_pop_sum,
        1.0 / n_in_group,
    )

    # --- 1km 혼합 예측 merge ---
    candidates_df = candidates_df.merge(
        final_1km[["격자코드", "pred_2029_1km", "pred_2031_1km"]],
        left_on="parent_1km_code", right_on="격자코드", how="left",
    )
    candidates_df["pred_2029_1km"] = candidates_df["pred_2029_1km"].fillna(0.0)
    candidates_df["pred_2031_1km"] = candidates_df["pred_2031_1km"].fillna(0.0)

    # --- E-2. LightGBM 보정 ---
    feature_cols = [
        "nearest_park_dist", "nearest_pg_dist", "nearest_apt_dist",
        "nearest_school_dist", "park_count_500m", "cx", "cy",
    ]
    # child_ratio_1km 추가
    if "child_ratio_1km" in candidates_df.columns:
        feature_cols.append("child_ratio_1km")

    # gu 인코딩
    gu_map = {g: i for i, g in enumerate(candidates_df["gu"].dropna().unique())} if "gu" in candidates_df.columns else {}
    candidates_df["gu_code"] = candidates_df["gu"].map(gu_map).fillna(-1).astype(int) if "gu" in candidates_df.columns else 0
    feature_cols.append("gu_code")

    X = candidates_df[feature_cols].fillna(0).values
    y_log_child_ratio = np.log(candidates_df["child_ratio_1km"].clip(lower=1e-6))

    valid_mask = ~np.isnan(y_log_child_ratio)
    if valid_mask.sum() < 10:
        print("[Step E] LightGBM 학습 데이터 부족 → base share 사용")
        candidates_df["lgbm_correction"] = 0.0
    else:
        model = lgb.LGBMRegressor(
            n_estimators=100,
            max_depth=4,
            min_child_samples=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            verbose=-1,
        )
        model.fit(X[valid_mask], y_log_child_ratio[valid_mask])

        import joblib
        joblib.dump(model, OUT_LGBM_MODEL)
        print(f"[Step E] LightGBM 모델 저장: {OUT_LGBM_MODEL}")

        candidates_df["lgbm_correction"] = model.predict(X)

        # SHAP 시각화 (저장)
        try:
            import shap, matplotlib.pyplot as plt
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(X[valid_mask])
            plt.figure(figsize=(8, 5))
            shap.summary_plot(shap_vals, X[valid_mask],
                              feature_names=feature_cols, show=False)
            plt.tight_layout()
            plt.savefig(DATA / "shap_spatial_summary.png", dpi=120)
            plt.close()
            print("[Step E] shap_spatial_summary.png 저장")
        except Exception as e:
            print(f"[Step E] SHAP 시각화 실패 (무시): {e}")

    # --- w_hat 계산 및 정규화 ---
    candidates_df["w_raw"] = candidates_df["w_base"] * np.exp(
        candidates_df["lgbm_correction"].fillna(0)
    )

    # 1km 그룹 내 정규화
    group_sum = candidates_df.groupby("parent_1km_code")["w_raw"].transform("sum")
    candidates_df["w_hat"] = np.where(
        group_sum > 0, candidates_df["w_raw"] / group_sum, candidates_df["w_base"]
    )

    # 검증: 그룹 내 w_hat 합 = 1
    group_w_sum = candidates_df.groupby("parent_1km_code")["w_hat"].sum()
    assert (group_w_sum - 1.0).abs().max() < 1e-6, "w_hat 정규화 실패"

    # --- 최종 분배 ---
    candidates_df["pred_2029_250m"] = (
        candidates_df["w_hat"] * candidates_df["pred_2029_1km"]
    ).clip(lower=0)
    candidates_df["pred_2031_250m"] = (
        candidates_df["w_hat"] * candidates_df["pred_2031_1km"]
    ).clip(lower=0)

    # 검증: 250m 합 ≈ 1km 합
    _250m_sum = candidates_df.groupby("parent_1km_code")["pred_2029_250m"].sum()
    _1km_ref = candidates_df.groupby("parent_1km_code")["pred_2029_1km"].first()
    max_err = (_250m_sum - _1km_ref).abs().max()
    print(f"[Step E] 총량 보존 검증: 최대 오차 = {max_err:.4f}")

    out_cols = ["grid_id", "parent_1km_code", "w_base", "w_hat",
                "pred_2029_1km", "pred_2031_1km",
                "pred_2029_250m", "pred_2031_250m"]
    out = candidates_df[[c for c in out_cols if c in candidates_df.columns]]
    out.to_csv(OUT_250M, index=False, encoding="utf-8-sig")
    print(f"[Step E] grid_250m_pred.csv 저장 ({len(out)}개 후보지)")
    return candidates_df


# ──────────────────────────────────────────────
# STEP F: candidate grid 반영
# ──────────────────────────────────────────────

def step_f_candidate_grid(
    candidates: gpd.GeoDataFrame,
    distribution: pd.DataFrame,
    alloc_v1: pd.DataFrame,
) -> gpd.GeoDataFrame:
    """
    pred_beneficiary_2029, pred_beneficiary_2031 필드 추가
    """
    pred = distribution[["grid_id", "pred_2029_250m", "pred_2031_250m",
                          "parent_1km_code", "w_hat"]].copy()
    pred = pred.rename(columns={
        "pred_2029_250m": "pred_beneficiary_2029",
        "pred_2031_250m": "pred_beneficiary_2031",
    })

    meta_cols = [
        "grid_id", "gu", "candidate_child_current",
        "priority_score", "candidate_rank",
        "nearest_park_dist", "nearest_pg_dist",
        "worst_case_type", "avg_park_dist_m",
        "avg_playground_count", "land_feasibility_level",
        "linked_schools", "linked_school_count",
    ]
    candidate_meta_cols = [c for c in meta_cols if c in candidates.columns]
    candidate_meta = candidates[candidate_meta_cols].copy()

    v1_avail = [c for c in meta_cols if c in alloc_v1.columns]
    v1_sub = alloc_v1[v1_avail].copy()

    final_gdf = candidates[["grid_id", "cx", "cy", "geometry"]].copy()
    final_gdf = final_gdf.merge(pred, on="grid_id", how="left")
    final_gdf = final_gdf.merge(candidate_meta, on="grid_id", how="left")
    final_gdf = final_gdf.merge(v1_sub, on="grid_id", how="left", suffixes=("", "_alloc"))

    for col in meta_cols:
        alloc_col = f"{col}_alloc"
        if col == "grid_id" or alloc_col not in final_gdf.columns:
            continue
        final_gdf[col] = final_gdf[col].where(final_gdf[col].notna(), final_gdf[alloc_col])
        final_gdf.drop(columns=[alloc_col], inplace=True)

    # 수요 기반 우선순위 재산출
    case_mult = np.where(final_gdf.get("worst_case_type", pd.Series(0)) == 1.0, 1.5, 1.0)
    final_gdf["priority_score_mixed"] = (
        (final_gdf["pred_beneficiary_2029"].fillna(0) * 0.6
         + final_gdf["pred_beneficiary_2031"].fillna(0) * 0.4)
        * case_mult
    ).round(3)
    final_gdf["candidate_rank_mixed"] = (
        final_gdf["priority_score_mixed"]
        .rank(method="first", ascending=False)
        .astype(int)
    )

    final_gdf["demand_model_version"] = "mixed_cohort_prophet_lgbm_v1_20260419"
    return final_gdf


# ──────────────────────────────────────────────
# STEP G: 후보지 중심 500m 보행권 잠재수요 집계
# ──────────────────────────────────────────────

def step_g_candidate_walkshed_demand(
    final_gdf: gpd.GeoDataFrame,
    walk_radius_m: float = 500.0,
) -> gpd.GeoDataFrame:
    """
    후보지별 250m 인접 예측값은 유지하고,
    후보지 중심 보행 500m 안에 들어오는 후보 셀들의 예측값 합을
    walkshed_beneficiary_2029/2031 으로 추가한다.
    """
    if not GRAPH_PATH.exists():
        print(f"[Step G] 보행 그래프 없음: {GRAPH_PATH.name}, 500m 보행권 집계 생략")
        out = final_gdf.copy()
        out["walkshed_beneficiary_2029"] = out["pred_beneficiary_2029"].fillna(0.0)
        out["walkshed_beneficiary_2031"] = out["pred_beneficiary_2031"].fillna(0.0)
        return out

    print(f"[Step G] 후보지 중심 {int(walk_radius_m)}m 보행권 잠재수요 집계 중...")
    graph = ox.load_graphml(GRAPH_PATH)
    if not isinstance(graph, nx.MultiDiGraph):
        graph = nx.MultiDiGraph(graph)

    out = final_gdf.copy()
    out["cx"] = pd.to_numeric(out["cx"], errors="coerce")
    out["cy"] = pd.to_numeric(out["cy"], errors="coerce")
    out["pred_beneficiary_2029"] = pd.to_numeric(out["pred_beneficiary_2029"], errors="coerce").fillna(0.0)
    out["pred_beneficiary_2031"] = pd.to_numeric(out["pred_beneficiary_2031"], errors="coerce").fillna(0.0)

    valid_mask = out["cx"].notna() & out["cy"].notna()
    if not valid_mask.any():
        out["walkshed_beneficiary_2029"] = 0.0
        out["walkshed_beneficiary_2031"] = 0.0
        return out

    valid = out.loc[valid_mask].copy()
    node_ids = ox.distance.nearest_nodes(graph, X=valid["cx"].to_numpy(), Y=valid["cy"].to_numpy())
    valid["nearest_walk_node"] = pd.Series(node_ids, index=valid.index, dtype="int64")

    node_to_candidate_idx: dict[int, list[int]] = {}
    for idx, node_id in zip(valid.index.tolist(), valid["nearest_walk_node"].tolist()):
        node_to_candidate_idx.setdefault(int(node_id), []).append(idx)

    node_demand_2029 = {
        node_id: float(valid.loc[indexes, "pred_beneficiary_2029"].sum())
        for node_id, indexes in node_to_candidate_idx.items()
    }
    node_demand_2031 = {
        node_id: float(valid.loc[indexes, "pred_beneficiary_2031"].sum())
        for node_id, indexes in node_to_candidate_idx.items()
    }

    unique_nodes = list(node_to_candidate_idx.keys())
    walkshed_sum_2029: dict[int, float] = {}
    walkshed_sum_2031: dict[int, float] = {}
    total_nodes = len(unique_nodes)

    for i, node_id in enumerate(unique_nodes, start=1):
        reachable = nx.single_source_dijkstra_path_length(
            graph,
            int(node_id),
            cutoff=walk_radius_m,
            weight="length",
        )
        reachable_nodes = reachable.keys()
        walkshed_sum_2029[node_id] = float(sum(node_demand_2029.get(int(target), 0.0) for target in reachable_nodes))
        walkshed_sum_2031[node_id] = float(sum(node_demand_2031.get(int(target), 0.0) for target in reachable_nodes))
        if i % 250 == 0 or i == total_nodes:
            print(f"  - {i}/{total_nodes} 후보 노드 집계 완료")

    valid["walkshed_beneficiary_2029"] = valid["nearest_walk_node"].map(walkshed_sum_2029).fillna(valid["pred_beneficiary_2029"])
    valid["walkshed_beneficiary_2031"] = valid["nearest_walk_node"].map(walkshed_sum_2031).fillna(valid["pred_beneficiary_2031"])

    out["walkshed_beneficiary_2029"] = 0.0
    out["walkshed_beneficiary_2031"] = 0.0
    out.loc[valid.index, "walkshed_beneficiary_2029"] = valid["walkshed_beneficiary_2029"]
    out.loc[valid.index, "walkshed_beneficiary_2031"] = valid["walkshed_beneficiary_2031"]

    print(
        "[Step G] 500m 보행권 잠재수요 범위:",
        f"2029 {out['walkshed_beneficiary_2029'].min():.1f} ~ {out['walkshed_beneficiary_2029'].max():.1f},",
        f"2031 {out['walkshed_beneficiary_2031'].min():.1f} ~ {out['walkshed_beneficiary_2031'].max():.1f}",
    )
    return out


# ──────────────────────────────────────────────
# STEP H: 재개발 경고 레이어
# ──────────────────────────────────────────────

def step_h_redev_warning(
    final_gdf: gpd.GeoDataFrame,
    redev: pd.DataFrame,
) -> gpd.GeoDataFrame:
    """
    후보지 중심 500m 내 재개발 구역 존재 여부 확인
    우선순위: planned > ongoing > completed > none
    모델 변수로 사용하지 않고 경고 레이어로만 처리
    """
    # 재개발 데이터 GeoDataFrame 변환
    redev_valid = redev.dropna(subset=["경도", "위도"]).copy()
    if redev_valid.empty:
        final_gdf["redev_flag"] = False
        final_gdf["redev_level"] = "none"
        final_gdf["redev_warning_text"] = ""
        return final_gdf

    redev_gdf = gpd.GeoDataFrame(
        redev_valid,
        geometry=gpd.points_from_xy(redev_valid["경도"], redev_valid["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_PROJ)

    cand_proj = final_gdf.to_crs(CRS_PROJ).copy()
    cand_proj["cx_proj"] = cand_proj.geometry.centroid.x
    cand_proj["cy_proj"] = cand_proj.geometry.centroid.y

    REDEV_RADIUS_M = 500

    # 상태 우선순위 매핑
    def classify_status(status: str) -> tuple[str, int]:
        if isinstance(status, str):
            if any(x in status for x in ["예정", "계획", "수립"]):
                return "planned", 3
            if any(x in status for x in ["시행", "진행", "공사"]):
                return "ongoing", 2
            if any(x in status for x in ["완료", "준공", "입주"]):
                return "completed", 1
        return "unknown", 0

    redev_coords = redev_gdf.geometry.apply(lambda p: (p.x, p.y)).tolist()
    redev_statuses = redev_gdf.get("사업단계", redev_gdf.get("진행단계",
                                    pd.Series([""] * len(redev_gdf)))).tolist()

    results_flag = []
    results_level = []
    results_text = []

    for _, row in cand_proj.iterrows():
        cx, cy = row["cx_proj"], row["cy_proj"]
        best_priority = -1
        best_level = "none"
        warnings = []

        for (rx, ry), status in zip(redev_coords, redev_statuses):
            dist = ((cx - rx) ** 2 + (cy - ry) ** 2) ** 0.5
            if dist <= REDEV_RADIUS_M:
                level, priority = classify_status(status)
                warnings.append(f"{level}({dist:.0f}m)")
                if priority > best_priority:
                    best_priority = priority
                    best_level = level

        results_flag.append(len(warnings) > 0)
        results_level.append(best_level)
        results_text.append(
            f"500m 내 재개발 {len(warnings)}건: {', '.join(warnings[:3])}"
            if warnings else ""
        )

    final_gdf = final_gdf.copy()
    final_gdf["redev_flag"] = results_flag
    final_gdf["redev_level"] = results_level
    final_gdf["redev_warning_text"] = results_text

    n_flagged = sum(results_flag)
    print(f"[Step G] 재개발 경고: {n_flagged}개 후보지 ({100*n_flagged/len(final_gdf):.1f}%)")
    return final_gdf


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────

def main() -> None:
    print("=== 혼합모델 수혜인구 예측 파이프라인 시작 ===\n")

    # 기본 데이터 로드
    gu_ts = pd.read_csv(GU_TS_PATH, encoding="utf-8-sig")
    gu_prophet = pd.read_csv(GU_PROPHET_PATH, encoding="utf-8-sig")
    age_ratio = pd.read_csv(AGE_RATIO_PATH, encoding="utf-8-sig")
    pop_1k_raw = pd.read_csv(POP_1K_PATH, encoding="utf-8-sig")
    pop_100m_raw = pd.read_csv(POP_100M_PATH, encoding="utf-8-sig")
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    school_priority = pd.read_csv(SCHOOL_PRIORITY_PATH, encoding="utf-8-sig")
    candidates = gpd.read_file(CANDIDATE_PATH)
    alloc_v1 = pd.read_csv(CANDIDATE_ALLOC_PATH, encoding="utf-8-sig")

    # v4에서 nearest_park_dist, nearest_pg_dist merge
    if CANDIDATE_V4_PATH.exists():
        v4 = gpd.read_file(CANDIDATE_V4_PATH)
        v4_extra = ["grid_id"] + [c for c in ["nearest_park_dist", "nearest_pg_dist"]
                    if c in v4.columns and c not in candidates.columns]
        if len(v4_extra) > 1:
            candidates = candidates.merge(v4[v4_extra], on="grid_id", how="left")
            print(f"v4 피처 merge: {v4_extra[1:]}")

    # gu 할당: alloc_v1에서 가져오고 신규 후보지는 linked_schools로 추론
    if "gu" not in candidates.columns or candidates["gu"].isna().all():
        sp_name_col = school_priority.columns[1] if len(school_priority.columns) > 1 else "학교명"
        school_gu_map = school_priority.set_index(sp_name_col)["gu"].to_dict() \
            if "gu" in school_priority.columns else {}

        import re as _re
        def _infer_gu(val: str) -> str:
            if isinstance(val, str):
                names = [a or b for a, b in _re.findall(r"'([^']+)'|\"([^\"]+)\"", val)]
            elif isinstance(val, list):
                names = [str(x) for x in val]
            else:
                return ""
            for name in names:
                gu = school_gu_map.get(name.strip())
                if gu:
                    return gu
            return ""

        gu_from_alloc = alloc_v1[["grid_id", "gu"]].set_index("grid_id")["gu"].to_dict()
        candidates["gu"] = candidates["grid_id"].map(gu_from_alloc)
        missing_mask = candidates["gu"].isna() | (candidates["gu"] == "")
        candidates.loc[missing_mask, "gu"] = candidates.loc[missing_mask, "linked_schools"].apply(_infer_gu)
        n_assigned = missing_mask.sum()
        if n_assigned > 0:
            print(f"신규 후보지 gu 추론: {n_assigned}개")
    elif "gu" in candidates.columns:
        gu_from_alloc = alloc_v1[["grid_id", "gu"]].set_index("grid_id")["gu"].to_dict()
        missing_mask = candidates["gu"].isna() | (candidates["gu"] == "")
        candidates.loc[missing_mask, "gu"] = candidates.loc[missing_mask, "grid_id"].map(gu_from_alloc)

    # enriched_v2에서 추가 피처 merge (nearest_school_dist, nearest_apt_dist, park_count_500m)
    if CANDIDATE_ENRICHED_PATH.exists():
        enriched = gpd.read_file(CANDIDATE_ENRICHED_PATH)
        extra_cols = ["grid_id"] + [c for c in
                      ["nearest_school_dist", "nearest_apt_dist", "park_count_500m"]
                      if c in enriched.columns and c not in candidates.columns]
        if len(extra_cols) > 1:
            candidates = candidates.merge(enriched[extra_cols], on="grid_id", how="left")
            print(f"enriched_v2 피처 merge: {extra_cols[1:]}")

    redev = pd.read_csv(REDEV_PATH, encoding="utf-8-sig") if REDEV_PATH.exists() else pd.DataFrame()

    # 컬럼명 정규화
    pop_1k_raw.columns = [c if c in ["total_pop", "child_pop_0_5", "child_pop_6_12"]
                          else ("격자코드" if i == 0 else c)
                          for i, c in enumerate(pop_1k_raw.columns)]
    pop_100m_raw.columns = [c if c in ["총인구"]
                            else ("격자코드" if i == 0 else c)
                            for i, c in enumerate(pop_100m_raw.columns)]
    pop_100m_raw["총인구"] = pd.to_numeric(pop_100m_raw.get("총인구", pop_100m_raw.iloc[:, 1]), errors="coerce").fillna(0)

    # schools 컬럼명 정규화 (위도/경도)
    lat_col, lon_col = [], []
    for c in schools.columns:
        try:
            numeric = pd.to_numeric(schools[c], errors="coerce").dropna()
            if len(numeric) > 0:
                if numeric.between(33, 43).mean() > 0.8:
                    lat_col.append(c)
                elif numeric.between(124, 132).mean() > 0.8:
                    lon_col.append(c)
        except Exception:
            pass
    schools = schools.rename(columns={
        lat_col[0]: "lat", lon_col[0]: "lon"
    }) if lat_col and lon_col else schools

    # school_priority에서 gu 매핑
    sp_id_col = school_priority.columns[0]
    schools_id_col = schools.columns[0]
    school_gu = school_priority[[sp_id_col, "gu"]].rename(columns={sp_id_col: schools_id_col})
    schools = schools.merge(school_gu, on=schools_id_col, how="left")
    schools["gu"] = schools["gu"].fillna("서구")  # fallback

    # age shares 계산
    age_shares = compute_age_shares(age_ratio)
    print(f"연령 구간 비율 계산 완료: n_3_9_shares = ({age_shares['share_3_5_in_0_5']:.4f}, {age_shares['share_6_9_in_6_12']:.4f})")

    # STEP A
    cohort_ratios = step_a_cohort_ratios(gu_ts, age_shares)

    # 1km 격자 shapefiles 로드
    print("\n1km 격자 폴리곤 로드 중...")
    grid_1k = load_grid_polygons("1K")
    print(f"  1km 격자: {len(grid_1k)}개")

    # 1km 격자 → gu 매핑
    pop_1k = pop_1k_raw.copy()
    pop_1k["격자코드"] = pop_1k["격자코드"].astype(str)
    pop_1k = assign_gu_to_1km(pop_1k, grid_1k, schools)

    # STEP B
    cohort_1km = step_b_1km_cohort(pop_1k, cohort_ratios, age_shares, gu_ts)

    # STEP C
    prophet_alloc = step_c_prophet_alloc(cohort_1km, gu_prophet, age_shares)

    # STEP D
    final_1km = step_d_mix(prophet_alloc)

    # STEP E
    pop_100m_norm = pop_100m_raw.rename(columns={pop_100m_raw.columns[0]: "격자코드"})[["격자코드", "총인구"]].copy()
    pop_100m_norm["격자코드"] = pop_100m_norm["격자코드"].astype(str)

    distribution = step_e_250m_distribution(
        candidates, grid_1k, final_1km, pop_1k, pop_100m_norm, alloc_v1
    )

    # STEP F
    final_gdf = step_f_candidate_grid(candidates, distribution, alloc_v1)

    # STEP G
    final_gdf = step_g_candidate_walkshed_demand(final_gdf)

    # STEP H
    if not redev.empty:
        final_gdf = step_h_redev_warning(final_gdf, redev)
    else:
        final_gdf["redev_flag"] = False
        final_gdf["redev_level"] = "none"
        final_gdf["redev_warning_text"] = ""
        print("[Step H] 재개발 데이터 없음, 경고 레이어 스킵")

    # 최종 저장
    final_gdf_wgs = final_gdf.to_crs("EPSG:4326")
    geojson_tmp = OUT_CANDIDATE_GEOJSON.with_name(
        f"{OUT_CANDIDATE_GEOJSON.stem}.{next(tempfile._get_candidate_names())}.tmp.geojson"
    )
    csv_tmp = OUT_CANDIDATE_CSV.with_name(
        f"{OUT_CANDIDATE_CSV.stem}.{next(tempfile._get_candidate_names())}.tmp.csv"
    )
    final_gdf_wgs.to_file(geojson_tmp, driver="GeoJSON")
    final_gdf_wgs.drop(columns="geometry").to_csv(
        csv_tmp, index=False, encoding="utf-8-sig"
    )
    geojson_tmp.replace(OUT_CANDIDATE_GEOJSON)
    csv_tmp.replace(OUT_CANDIDATE_CSV)

    print(f"\n=== 파이프라인 완료 ===")
    print(f"  후보지: {len(final_gdf)}개")
    print(f"  예측 범위 (2029): {final_gdf['pred_beneficiary_2029'].min():.0f} ~ {final_gdf['pred_beneficiary_2029'].max():.0f}")
    print(f"  예측 범위 (2031): {final_gdf['pred_beneficiary_2031'].min():.0f} ~ {final_gdf['pred_beneficiary_2031'].max():.0f}")
    print(f"  500m 보행권 범위 (2029): {final_gdf['walkshed_beneficiary_2029'].min():.0f} ~ {final_gdf['walkshed_beneficiary_2029'].max():.0f}")
    print(f"  500m 보행권 범위 (2031): {final_gdf['walkshed_beneficiary_2031'].min():.0f} ~ {final_gdf['walkshed_beneficiary_2031'].max():.0f}")
    print(f"  산출물:")
    for p in [OUT_COHORT_RATIOS, OUT_1KM_COHORT, OUT_1KM_PROPHET,
              OUT_1KM_FINAL, OUT_250M, OUT_CANDIDATE_GEOJSON, OUT_CANDIDATE_CSV]:
        if p.exists():
            print(f"    OK {p.name}")


if __name__ == "__main__":
    main()
