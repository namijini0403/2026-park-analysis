# -*- coding: utf-8 -*-
from pathlib import Path

import geopandas as gpd
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

PRIORITY_CSV = DATA / "school_priority.csv"
PARKS_CSV = DATA / "parks.csv"
ISO_PATH = DATA / "isochrone_valhalla.geojson"
BUF_PATH = DATA / "school_buffer_500m.geojson"

PARK_TYPES = {"근린공원", "소공원", "수변공원"}
PLAYGROUND_TYPES = {"놀이터", "어린이공원"}


def build_points(df: pd.DataFrame) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df["경도"], df["위도"]),
        crs="EPSG:4326",
    )


def count_points(zone_gdf: gpd.GeoDataFrame, point_gdf: gpd.GeoDataFrame, output_col: str) -> pd.DataFrame:
    joined = gpd.sjoin(
        point_gdf[["geometry"]],
        zone_gdf[["학교ID", "geometry"]],
        how="right",
        predicate="within",
    )
    return joined.groupby("학교ID").size().reset_index(name=output_col)


def main() -> None:
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
    iso = gpd.read_file(ISO_PATH)
    buf = gpd.read_file(BUF_PATH)

    old_cols = priority[[
        "학교ID",
        "학교명",
        "iso_park_count",
        "iso_playground_count",
        "buf_park_count",
        "buf_playground_count",
    ]].copy()

    park_points = build_points(parks[parks["시설유형"].isin(PARK_TYPES)].copy())
    playground_points = build_points(parks[parks["시설유형"].isin(PLAYGROUND_TYPES)].copy())

    iso_park = count_points(iso, park_points, "iso_park_count")
    iso_pg = count_points(iso, playground_points, "iso_playground_count")
    buf_park = count_points(buf, park_points, "buf_park_count")
    buf_pg = count_points(buf, playground_points, "buf_playground_count")

    updated = priority.drop(
        columns=["iso_park_count", "iso_playground_count", "buf_park_count", "buf_playground_count"],
        errors="ignore",
    )
    updated = updated.merge(iso_park, on="학교ID", how="left")
    updated = updated.merge(iso_pg, on="학교ID", how="left")
    updated = updated.merge(buf_park, on="학교ID", how="left")
    updated = updated.merge(buf_pg, on="학교ID", how="left")

    for col in ["iso_park_count", "iso_playground_count", "buf_park_count", "buf_playground_count"]:
        updated[col] = updated[col].fillna(0).astype(int)

    updated.to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")

    merged = old_cols.merge(
        updated[[
            "학교ID",
            "학교명",
            "iso_park_count",
            "iso_playground_count",
            "buf_park_count",
            "buf_playground_count",
        ]],
        on=["학교ID", "학교명"],
        suffixes=("_old", "_new"),
    )

    change_masks = {}
    for col in ["iso_park_count", "iso_playground_count", "buf_park_count", "buf_playground_count"]:
        change_masks[col] = merged[f"{col}_old"] != merged[f"{col}_new"]

    any_change = change_masks["iso_park_count"] | change_masks["iso_playground_count"] | change_masks["buf_park_count"] | change_masks["buf_playground_count"]
    changed = merged[any_change].copy()

    print(f"updated schools: {len(changed)}")
    for col in ["iso_park_count", "iso_playground_count", "buf_park_count", "buf_playground_count"]:
        print(f"{col} changed: {int(change_masks[col].sum())}")

    if not changed.empty:
        changed["abs_delta_sum"] = (
            (changed["iso_park_count_new"] - changed["iso_park_count_old"]).abs()
            + (changed["iso_playground_count_new"] - changed["iso_playground_count_old"]).abs()
            + (changed["buf_park_count_new"] - changed["buf_park_count_old"]).abs()
            + (changed["buf_playground_count_new"] - changed["buf_playground_count_old"]).abs()
        )
        preview = changed.sort_values(["abs_delta_sum", "학교명"], ascending=[False, True]).head(20)
        cols = [
            "학교명",
            "iso_park_count_old", "iso_park_count_new",
            "iso_playground_count_old", "iso_playground_count_new",
            "buf_park_count_old", "buf_park_count_new",
            "buf_playground_count_old", "buf_playground_count_new",
        ]
        print(preview[cols].to_string(index=False))


if __name__ == "__main__":
    main()
