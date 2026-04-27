# -*- coding: utf-8 -*-
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

PRIORITY_PATH = DATA / "school_priority.csv"
PARKS_PATH = DATA / "parks.csv"
ISO_PATH = DATA / "isochrone_valhalla.geojson"
BUF_PATH = DATA / "school_buffer_500m.geojson"

CRS_METRIC = "EPSG:5179"

ACCESS_LOW_MAX = 0.4
ACCESS_HIGH_MIN = 0.8
FALLBACK_DIST_M = 10_000
GEUMSAN_ID = "B000002962"
GAGYEONG_NAME = "가경공원"


def count_parks(zone_gdf: gpd.GeoDataFrame, park_gdf: gpd.GeoDataFrame, count_col: str, area_col: str) -> pd.DataFrame:
    park_hits = park_gdf[["공원면적", "geometry"]].copy()
    park_hits["park_hit"] = 1
    joined = gpd.sjoin(
        park_hits,
        zone_gdf[["학교ID", "geometry"]],
        how="right",
        predicate="within",
    )
    joined["park_hit"] = joined["park_hit"].fillna(0)
    joined["공원면적"] = joined["공원면적"].fillna(0.0)
    stats = (
        joined.groupby("학교ID", dropna=False)
        .agg(**{count_col: ("park_hit", "sum"), area_col: ("공원면적", "sum")})
        .reset_index()
    )
    stats[count_col] = stats[count_col].astype(int)
    return stats


def build_filtered_parks() -> gpd.GeoDataFrame:
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    keep_mask = parks["시설유형"].ne("놀이터") | parks["공원명"].eq(GAGYEONG_NAME)
    filtered = parks.loc[keep_mask].copy()
    gdf = gpd.GeoDataFrame(
        filtered,
        geometry=gpd.points_from_xy(filtered["경도"], filtered["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    return gdf


def classify_cases(df: pd.DataFrame) -> pd.DataFrame:
    nearest = pd.to_numeric(df["nearest_park_dist_m"], errors="coerce")
    iso_count = pd.to_numeric(df["iso_park_count"], errors="coerce").fillna(0).astype(int)
    quartile = df["child_pop_quartile"].astype(str)
    access = pd.to_numeric(df["access_ratio"], errors="coerce")

    is_fallback = nearest.ge(FALLBACK_DIST_M).fillna(False)
    is_island = df["gu"].eq("옹진군") | is_fallback

    case_type = pd.Series("", index=df.index, dtype="object")
    case_label = pd.Series("", index=df.index, dtype="object")

    active = ~is_island
    case1 = active & nearest.ge(500) & iso_count.eq(0) & quartile.eq("Q4")
    case2 = active & nearest.lt(500) & iso_count.ge(1) & quartile.isin(["Q3", "Q4"]) & access.lt(ACCESS_LOW_MAX)
    case3 = active & nearest.lt(500) & iso_count.ge(1) & access.ge(ACCESS_LOW_MAX) & access.lt(ACCESS_HIGH_MIN)
    case4 = active & nearest.lt(500) & iso_count.ge(1) & access.ge(ACCESS_HIGH_MIN)

    case_type.loc[case1] = "1"
    case_type.loc[case2] = "2"
    case_type.loc[case3] = "3"
    case_type.loc[case4] = "4"
    case_type.loc[active & case_type.eq("")] = "4"

    case_label_map = {
        "1": "공원 접근 불가",
        "2": "공원 있으나 접근성 낮음",
        "3": "접근 가능, 중간 수준",
        "4": "접근 양호",
    }
    case_label = case_type.map(case_label_map).fillna("")

    priority_map = {"1": 4, "2": 3, "3": 2, "4": 1}
    df["case_type"] = case_type
    df["case_label"] = case_label
    df["priority_score"] = case_type.map(priority_map)
    df["is_island_tag"] = is_island.astype(int)
    df["is_walk_fallback_tag"] = is_fallback.astype(int)
    return df


def main() -> None:
    base = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")

    iso = gpd.read_file(ISO_PATH).to_crs(CRS_METRIC)
    buf = gpd.read_file(BUF_PATH).to_crs(CRS_METRIC)
    parks = build_filtered_parks()

    iso_stats = count_parks(iso, parks, "iso_park_count", "iso_park_area")
    buf_stats = count_parks(buf, parks, "buf_park_count", "buf_park_area")

    result = base.drop(columns=["iso_park_count", "iso_park_area", "buf_park_count", "buf_park_area", "access_ratio"], errors="ignore")
    result = result.merge(iso_stats, on="학교ID", how="left")
    result = result.merge(buf_stats, on="학교ID", how="left")

    result["iso_park_count"] = result["iso_park_count"].fillna(0).astype(int)
    result["buf_park_count"] = result["buf_park_count"].fillna(0).astype(int)
    result["iso_park_area"] = result["iso_park_area"].fillna(0.0)
    result["buf_park_area"] = result["buf_park_area"].fillna(0.0)
    result["access_ratio"] = np.where(
        result["buf_park_count"] > 0,
        result["iso_park_count"] / result["buf_park_count"],
        np.nan,
    )

    # Limited override requested by user: Geumsan branch has no nearby public park.
    geumsan_mask = result["학교ID"].eq(GEUMSAN_ID)
    result.loc[geumsan_mask, ["nearest_park_dist_m", "iso_park_count", "iso_park_area", "buf_park_count", "buf_park_area", "access_ratio"]] = [np.nan, 0, 0.0, 0, 0.0, np.nan]

    result = classify_cases(result)
    result = result.sort_values("학교ID").reset_index(drop=True)
    result.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    case_counts = result.loc[result["is_island_tag"] == 0, "case_type"].value_counts().sort_index()
    print("saved:", PRIORITY_PATH)
    print("rows:", len(result))
    print("island_tag_count:", int(result["is_island_tag"].sum()))
    print("case_counts_non_island:", case_counts.to_dict())


if __name__ == "__main__":
    main()
