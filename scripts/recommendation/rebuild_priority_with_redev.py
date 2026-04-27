# -*- coding: utf-8 -*-
"""Rebuild school_priority.csv with Valhalla isochrones and redevelopment counts."""

from __future__ import annotations

import os

import geopandas as gpd
import pandas as pd

from analysis_school_priority import OUT, build_priority_base

REDEV_CSV = os.path.join(OUT, "redevelopment.csv")
OUT_CSV = os.path.join(OUT, "school_priority.csv")


def map_redev_stage(value: object) -> str:
    text = str(value).strip()
    if text == "준공":
        return "완료"
    if text == "착공":
        return "진행중"
    return "예정"


def main() -> None:
    result = build_priority_base()

    redev = pd.read_csv(REDEV_CSV, encoding="utf-8-sig")
    redev["단계"] = redev["진행단계"].apply(map_redev_stage)
    redev = redev.dropna(subset=["위도", "경도"]).copy()
    gdf_redev = gpd.GeoDataFrame(
        redev,
        geometry=gpd.points_from_xy(redev["경도"], redev["위도"]),
        crs="EPSG:4326",
    ).to_crs("EPSG:5179")
    gdf_iso = gpd.read_file(os.path.join(OUT, "isochrone_valhalla.geojson")).to_crs("EPSG:5179")

    joined = gpd.sjoin(
        gdf_redev[["구역명", "단계", "geometry"]],
        gdf_iso[["학교ID", "geometry"]],
        how="inner",
        predicate="within",
    )

    for stage, col in [("완료", "redev_완료수"), ("진행중", "redev_진행중수"), ("예정", "redev_예정수")]:
        counts = (
            joined.loc[joined["단계"] == stage]
            .groupby("학교ID")
            .size()
            .reset_index(name=col)
        )
        result = result.merge(counts, on="학교ID", how="left")
        result[col] = result[col].fillna(0).astype(int)

    def summarize_status(row: pd.Series) -> str:
        if row["redev_완료수"] >= 1:
            return "완료포함"
        if row["redev_진행중수"] >= 1:
            return "진행중포함"
        if row["redev_예정수"] >= 1:
            return "예정만"
        return "없음"

    result["redev_status"] = result.apply(summarize_status, axis=1)
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
            "redev_완료수",
            "redev_진행중수",
            "redev_예정수",
            "redev_status",
        ]
    ].sort_values("학교ID").reset_index(drop=True)
    result.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUT_CSV}")
    print(f"rows: {len(result)}")
    print(f"duplicate 학교ID: {int(result['학교ID'].duplicated().sum())}")


if __name__ == "__main__":
    main()
