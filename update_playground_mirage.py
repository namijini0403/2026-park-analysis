# -*- coding: utf-8 -*-
"""
Append playground counts and mirage-type flags to school_priority.csv.

Playground definition:
- 시설유형 in ("놀이터", "어린이공원")

outlier_type:
- "착시" if either:
  A) buf_park_count >= 1 and iso_park_count == 0
  B) buf_playground_count >= 3 and iso_playground_count <= 1
- otherwise null
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data_processed"

PRIORITY_CSV = DATA / "school_priority.csv"
PARKS_CSV = DATA / "parks.csv"
ISO_PATH = DATA / "school_isochrone_500m.geojson"
BUF_PATH = DATA / "school_buffer_500m.geojson"

PLAYGROUND_TYPES = {"놀이터", "어린이공원"}


def build_points(parks: pd.DataFrame) -> gpd.GeoDataFrame:
    gdf = gpd.GeoDataFrame(
        parks.copy(),
        geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
        crs="EPSG:4326",
    )
    return gdf


def count_points(zone_gdf: gpd.GeoDataFrame, point_gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    school_id_col = "학교ID"
    joined = gpd.sjoin(
        point_gdf[["geometry"]],
        zone_gdf[[school_id_col, "geometry"]],
        how="right",
        predicate="within",
    )
    counted = (
        joined.groupby(school_id_col)
        .size()
        .reset_index(name="count")
    )
    return counted


def main() -> None:
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
    iso = gpd.read_file(ISO_PATH)
    buf = gpd.read_file(BUF_PATH)

    playgrounds = parks[parks["시설유형"].isin(PLAYGROUND_TYPES)].copy()
    gdf_playgrounds = build_points(playgrounds)

    iso_counts = count_points(iso, gdf_playgrounds).rename(columns={"count": "iso_playground_count"})
    buf_counts = count_points(buf, gdf_playgrounds).rename(columns={"count": "buf_playground_count"})

    keep_priority = priority.drop(columns=[c for c in ["iso_playground_count", "buf_playground_count"] if c in priority.columns])
    keep_priority = keep_priority.merge(iso_counts, on="학교ID", how="left")
    keep_priority = keep_priority.merge(buf_counts, on="학교ID", how="left")
    keep_priority["iso_playground_count"] = keep_priority["iso_playground_count"].fillna(0).astype(int)
    keep_priority["buf_playground_count"] = keep_priority["buf_playground_count"].fillna(0).astype(int)

    cond_a = (keep_priority["buf_park_count"] >= 1) & (keep_priority["iso_park_count"] == 0)
    cond_b = (keep_priority["buf_playground_count"] >= 3) & (keep_priority["iso_playground_count"] <= 1)
    keep_priority["outlier_type"] = np.where(cond_a | cond_b, "착시", pd.NA)

    insert_after = keep_priority.columns.get_loc("buf_park_area") + 1
    ordered = keep_priority.columns.tolist()
    for col in ["iso_playground_count", "buf_playground_count"]:
        ordered.remove(col)
    ordered[insert_after:insert_after] = ["iso_playground_count", "buf_playground_count"]
    keep_priority = keep_priority[ordered]

    keep_priority.to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")

    mirage = keep_priority[keep_priority["outlier_type"] == "착시"].copy()
    mirage = mirage.sort_values(["gu", "학교명"])
    print(f"Saved: {PRIORITY_CSV}")
    print(f"Playgrounds used: {len(playgrounds)}")
    print(f"Mirage schools: {len(mirage)}")
    print(
        mirage[
            [
                "학교명",
                "gu",
                "buf_park_count",
                "iso_park_count",
                "buf_playground_count",
                "iso_playground_count",
                "case_type",
                "priority_score",
            ]
        ].to_string(index=False)
    )


if __name__ == "__main__":
    main()
