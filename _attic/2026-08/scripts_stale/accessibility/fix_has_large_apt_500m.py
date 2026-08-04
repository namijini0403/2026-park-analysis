# -*- coding: utf-8 -*-
from pathlib import Path

import geopandas as gpd
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
PROCESSED = ROOT / "data/processed"

PRIORITY_PATH = PROCESSED / "school_priority.csv"
SCHOOLS_PATH = PROCESSED / "schools.csv"
LARGE_PATH = PROCESSED / "large_apt_complexes_2025.csv"
DIFF_PATH = PROCESSED / "has_large_apt_diff.csv"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"
BUFFER_M = 500

TARGETS = [
    "인천송담초등학교",
    "인천은송초등학교",
    "인천문남초등학교",
    "인천박문초등학교",
]


def main() -> None:
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    large = pd.read_csv(LARGE_PATH, encoding="utf-8-sig")

    old_has = (
        priority["has_large_apt"].copy()
        if "has_large_apt" in priority.columns
        else pd.Series(False, index=priority.index)
    )

    geocoded = large.dropna(subset=["경도", "위도"]).copy()

    gdf_schools = gpd.GeoDataFrame(
        schools.copy(),
        geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)
    gdf_schools["geometry"] = gdf_schools.geometry.buffer(BUFFER_M)

    gdf_large = gpd.GeoDataFrame(
        geocoded.copy(),
        geometry=gpd.points_from_xy(
            geocoded["경도"].astype(float),
            geocoded["위도"].astype(float),
        ),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)

    joined = gpd.sjoin(
        gdf_schools[["학교ID", "학교명", "geometry"]],
        gdf_large[["단지명", "geometry"]],
        how="left",
        predicate="intersects",
    )

    new_has = (
        joined.groupby(["학교ID", "학교명"])["단지명"]
        .apply(lambda s: bool(s.notna().any()))
        .rename("has_large_apt")
        .reset_index()
    )

    priority = priority.drop(columns=["has_large_apt"], errors="ignore")
    priority = priority.merge(new_has, on=["학교ID", "학교명"], how="left")
    priority["has_large_apt"] = priority["has_large_apt"].fillna(False)
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    diff = priority[["학교ID", "학교명", "gu", "has_large_apt"]].copy()
    diff["old_has_large_apt"] = old_has.fillna(False).astype(bool).values
    diff = diff[diff["old_has_large_apt"] != diff["has_large_apt"]]
    diff.to_csv(DIFF_PATH, index=False, encoding="utf-8-sig")

    print(f"has_large_apt True: {int(priority['has_large_apt'].sum())}")
    print(f"changed schools: {len(diff)}")
    print(priority[priority["학교명"].isin(TARGETS)][["학교명", "has_large_apt"]].to_string(index=False))


if __name__ == "__main__":
    main()
