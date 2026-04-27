# -*- coding: utf-8 -*-
"""Rebuild school_priority.csv from Valhalla isochrones."""

from __future__ import annotations

import os
import tempfile
import warnings
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

RAW = r"c:\2026_data_analysis_park\data\raw"
OUT = r"c:\2026_data_analysis_park\data\processed"
CRS = "EPSG:5179"

ISO_PATH = os.path.join(OUT, "school_isochrone_500m.geojson")
BUF_PATH = os.path.join(OUT, "school_buffer_500m.geojson")
PARKS_CSV = os.path.join(OUT, "parks.csv")
GRID_CSV = os.path.join(OUT, "population_grid_1k.csv")
SCHOOLS_CSV = os.path.join(OUT, "schools.csv")
OUT_CSV = os.path.join(OUT, "school_priority.csv")

ZIP_DASA = os.path.join(RAW, "_grid_border_grid_2025_grid_다사_grid_다사.zip")
ZIP_NASA = os.path.join(RAW, "_grid_border_grid_2025_grid_나사_grid_나사.zip")
INCHEON_BOUNDS = (740634, 1899394, 946455, 2010915)


def load_school_meta() -> pd.DataFrame:
    schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
    schools["gu"] = (
        schools["소재지도로명주소"]
        .astype(str)
        .str.extract(r"인천광역시\s+(\S+)", expand=False)
    )
    return schools[["학교ID", "학교명", "gu"]].drop_duplicates("학교ID")


def load_grid_polygons() -> gpd.GeoDataFrame:
    grid_frames: list[gpd.GeoDataFrame] = []
    for prefix, zip_path in [("nasa", ZIP_NASA), ("dasa", ZIP_DASA)]:
        with tempfile.TemporaryDirectory() as tmpdir:
            with zipfile.ZipFile(zip_path) as zf:
                for item in zf.infolist():
                    try:
                        decoded_name = item.filename.encode("cp437").decode("cp949")
                    except Exception:
                        decoded_name = item.filename
                    if "1K" not in decoded_name:
                        continue
                    ext = os.path.splitext(decoded_name)[1]
                    target = os.path.join(tmpdir, f"{prefix}_1k{ext}")
                    with open(target, "wb") as fh:
                        fh.write(zf.read(item.filename))

            shp_path = os.path.join(tmpdir, f"{prefix}_1k.shp")
            if not os.path.exists(shp_path):
                continue

            gdf = gpd.read_file(shp_path)
            if gdf.crs is None or gdf.crs.to_epsg() != 5179:
                gdf = gdf.to_crs(CRS)
            gdf = gdf.cx[
                INCHEON_BOUNDS[0] : INCHEON_BOUNDS[2],
                INCHEON_BOUNDS[1] : INCHEON_BOUNDS[3],
            ].copy()
            grid_frames.append(gdf[["GRID_CD", "geometry"]])

    grid = pd.concat(grid_frames, ignore_index=True)
    grid = gpd.GeoDataFrame(grid, geometry="geometry", crs=CRS)
    grid["grid_area"] = grid.geometry.area
    return grid


def _apply_park_buffer(point_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """공원면적에서 반경을 추산해 centroid를 폴리곤으로 변환.

    parks.csv는 공원 중심점만 저장하므로, 면적 기반 원형 버퍼를 적용해야
    대형 공원(수변공원·근린공원)의 경계가 등시선과 교차하는 경우를 카운트할 수 있다.
    면적이 없는 놀이터(NaN)는 최소 10m 버퍼만 적용한다.
    """
    gdf = point_gdf.copy()
    radius = np.sqrt(gdf["공원면적"].fillna(0) / np.pi)
    radius = radius.clip(lower=10)  # 최소 10m
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def count_parks_in_zone(zone_gdf: gpd.GeoDataFrame, point_gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    # centroid → 면적 기반 원형 폴리곤으로 변환 후 intersects 사용
    # (within 사용 시 대형 공원의 centroid가 등시선 경계 밖에 있으면 누락됨)
    park_poly_gdf = _apply_park_buffer(point_gdf)
    joined = gpd.sjoin(
        park_poly_gdf[["geometry", "공원면적", "시설유형"]],
        zone_gdf[["학교ID", "geometry"]],
        how="right",
        predicate="intersects",
    )
    stats = (
        joined.groupby("학교ID")
        .agg(
            park_count=("시설유형", "count"),
            park_area=("공원면적", "sum"),
        )
        .reset_index()
    )
    return stats


def build_priority_base() -> pd.DataFrame:
    gdf_iso = gpd.read_file(ISO_PATH).to_crs(CRS)
    gdf_buf = gpd.read_file(BUF_PATH).to_crs(CRS)
    school_meta = load_school_meta()

    parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
    gdf_parks = gpd.GeoDataFrame(
        parks,
        geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS)

    iso_stats = count_parks_in_zone(gdf_iso, gdf_parks)
    iso_stats.columns = ["학교ID", "iso_park_count", "iso_park_area"]
    buf_stats = count_parks_in_zone(gdf_buf, gdf_parks)
    buf_stats.columns = ["학교ID", "buf_park_count", "buf_park_area"]

    result = gdf_iso[["학교ID", "학교명"]].copy()
    result = result.merge(
        school_meta.rename(columns={"학교명": "학교명_meta"}),
        on="학교ID",
        how="left",
    )
    result["학교명"] = result["학교명"].fillna(result["학교명_meta"])
    result = result.drop(columns=["학교명_meta"])
    result = result.merge(iso_stats, on="학교ID", how="left")
    result = result.merge(buf_stats, on="학교ID", how="left")
    result[["iso_park_count", "buf_park_count"]] = (
        result[["iso_park_count", "buf_park_count"]].fillna(0).astype(int)
    )
    result[["iso_park_area", "buf_park_area"]] = result[["iso_park_area", "buf_park_area"]].fillna(0.0)
    result["access_ratio"] = np.where(
        result["buf_park_count"] > 0,
        result["iso_park_count"] / result["buf_park_count"],
        np.nan,
    )

    grid = load_grid_polygons()
    pop = pd.read_csv(GRID_CSV, encoding="utf-8-sig")
    pop_poly = grid.merge(pop, left_on="GRID_CD", right_on="격자코드", how="inner")

    overlay = gpd.overlay(
        gdf_iso[["학교ID", "geometry"]],
        pop_poly[["GRID_CD", "grid_area", "child_pop_0_5", "child_pop_6_12", "total_pop", "geometry"]],
        how="intersection",
        keep_geom_type=False,
    )
    overlay["inter_area"] = overlay.geometry.area
    overlay["weight"] = overlay["inter_area"] / overlay["grid_area"]
    for col in ["child_pop_0_5", "child_pop_6_12", "total_pop"]:
        overlay[col] = overlay[col] * overlay["weight"]

    pop_grp = (
        overlay.groupby("학교ID")
        .agg(
            iso_child_0_5=("child_pop_0_5", "sum"),
            iso_child_6_12=("child_pop_6_12", "sum"),
            iso_total_pop=("total_pop", "sum"),
        )
        .reset_index()
    )
    result = result.merge(pop_grp, on="학교ID", how="left")
    result[["iso_child_0_5", "iso_child_6_12", "iso_total_pop"]] = (
        result[["iso_child_0_5", "iso_child_6_12", "iso_total_pop"]].fillna(0)
    )
    result["iso_child_0_5"] = result["iso_child_0_5"].round().astype(int)
    result["iso_child_6_12"] = result["iso_child_6_12"].round().astype(int)
    result["iso_total_pop"] = result["iso_total_pop"].round().astype(int)
    result["iso_child_total"] = result["iso_child_0_5"] + result["iso_child_6_12"]

    result["child_pop_quartile"] = pd.qcut(
        result["iso_child_total"].rank(method="first"),
        q=4,
        labels=["Q1", "Q2", "Q3", "Q4"],
    )
    q_means = result.groupby("child_pop_quartile", observed=True)[["iso_park_count", "iso_park_area"]].mean()
    result = result.merge(
        q_means.rename(
            columns={
                "iso_park_count": "expected_park_count",
                "iso_park_area": "expected_park_area",
            }
        ),
        on="child_pop_quartile",
        how="left",
    )
    result["gap_count"] = result["iso_park_count"] - result["expected_park_count"]
    result["gap_area"] = result["iso_park_area"] - result["expected_park_area"]

    ct3 = (result["iso_park_count"] == 0) & (result["buf_park_count"] == 0)
    ct2 = (result["child_pop_quartile"] == "Q4") & (result["iso_park_count"] <= 1)
    ct1 = (result["buf_park_count"] >= 1) & (result["iso_park_count"] == 0)
    result["case_type"] = "4"
    result.loc[ct1, "case_type"] = "1"
    result.loc[ct2, "case_type"] = "2"
    result.loc[ct3, "case_type"] = "3"
    result["priority_score"] = 1
    result.loc[result["case_type"] == "1", "priority_score"] = 2
    result.loc[result["case_type"] == "2", "priority_score"] = 3
    result.loc[result["case_type"] == "3", "priority_score"] = 4

    result = result[
        [
            "학교ID",
            "학교명",
            "gu",
            "iso_park_count",
            "iso_park_area",
            "buf_park_count",
            "buf_park_area",
            "access_ratio",
            "iso_child_total",
            "iso_child_6_12",
            "child_pop_quartile",
            "expected_park_count",
            "gap_count",
            "expected_park_area",
            "gap_area",
            "case_type",
            "priority_score",
        ]
    ].sort_values("학교ID").reset_index(drop=True)

    if result["gu"].isna().any():
        missing = result.loc[result["gu"].isna(), ["학교ID", "학교명"]]
        raise ValueError(f"gu missing after schools.csv join: {missing.to_dict('records')[:5]}")

    return result


def main() -> None:
    result = build_priority_base()
    result.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUT_CSV}")
    print(f"rows: {len(result)}")
    print(f"duplicate 학교ID: {int(result['학교ID'].duplicated().sum())}")


if __name__ == "__main__":
    main()
