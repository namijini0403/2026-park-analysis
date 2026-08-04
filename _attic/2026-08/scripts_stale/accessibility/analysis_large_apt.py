# -*- coding: utf-8 -*-
"""
학교 반경 300m 내 대단지 아파트 존재 프록시 계산

원천:
- data_raw/인천광역시_공동주택내 체육시설 정보제공_20201130.csv

출력:
- data_processed/school_priority.csv 의 has_large_apt 컬럼 갱신

주의:
- 현재 로컬 원천에 세대수 컬럼이 없어, 공동주택 내 체육시설 점데이터를
  대단지 아파트 존재의 보수적 프록시로 사용한다.
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
RAW = ROOT / "data/raw"
PROCESSED = ROOT / "data/processed"

SCHOOLS_PATH = PROCESSED / "schools.csv"
PRIORITY_PATH = PROCESSED / "school_priority.csv"
APT_PATH = next(RAW.glob("*공동주택내 체육시설 정보제공_20201130.csv"))

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"
CRS_APT = "EPSG:5186"
BUFFER_M = 300


def main() -> None:
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    apt = pd.read_csv(APT_PATH, encoding="cp949")

    gdf_schools = gpd.GeoDataFrame(
        schools.copy(),
        geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)

    gdf_schools["geometry"] = gdf_schools.geometry.buffer(BUFFER_M)

    gdf_apt = gpd.GeoDataFrame(
        apt.copy(),
        geometry=gpd.points_from_xy(apt["X좌표"], apt["Y좌표"]),
        crs=CRS_APT,
    ).to_crs(CRS_METRIC)

    joined = gpd.sjoin(
        gdf_schools[["학교ID", "geometry"]],
        gdf_apt[["정식명칭", "geometry"]],
        how="left",
        predicate="intersects",
    )

    has_large_apt = (
        joined.groupby("학교ID")["정식명칭"]
        .apply(lambda s: bool(s.notna().any()))
        .rename("has_large_apt")
        .reset_index()
    )

    priority = priority.drop(columns=["has_large_apt"], errors="ignore")
    priority = priority.merge(has_large_apt, on="학교ID", how="left")
    priority["has_large_apt"] = priority["has_large_apt"].fillna(False)
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    print(f"source rows: {len(apt)}")
    print(f"schools: {len(schools)}")
    print(f"has_large_apt True: {int(priority['has_large_apt'].sum())}")


if __name__ == "__main__":
    main()
