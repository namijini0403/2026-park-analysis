from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.ops import unary_union


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data_processed"
OUTPUT_DIR = BASE_DIR / "outputs" / "reports"
CRS_METRIC = "EPSG:5179"
BUFFER_500M_AREA_M2 = math.pi * 500**2
PLAYGROUND = "놀이터"
PUBLIC_PARK_EXCEPTIONS = {"가경공원", "수차공원"}


def metric_summary(series: pd.Series, decimals: int = 4) -> dict[str, float | int]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    return {
        "n": int(len(clean)),
        "mean": round(float(clean.mean()), decimals),
        "median": round(float(clean.median()), decimals),
        "sd": round(float(clean.std(ddof=1)), decimals),
        "min": round(float(clean.min()), decimals),
        "max": round(float(clean.max()), decimals),
    }


def park_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(DATA_DIR / "parks.csv", encoding="utf-8-sig")
    parks = parks[
        parks["시설유형"].ne(PLAYGROUND) | parks["공원명"].isin(PUBLIC_PARK_EXCEPTIONS)
    ].copy()
    parks["공원면적"] = pd.to_numeric(parks["공원면적"], errors="coerce").fillna(0)
    gdf = gpd.GeoDataFrame(
        parks,
        geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)

    radius = np.sqrt(gdf["공원면적"] / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def intersection_ratio_by_school(zone_gdf: gpd.GeoDataFrame, prefix: str) -> pd.DataFrame:
    parks_union = unary_union(park_polygons().geometry)
    rows: list[dict[str, object]] = []
    for row in zone_gdf[["학교ID", "학교명", "gu", "geometry"]].itertuples(index=False):
        zone_area = float(row.geometry.area) if row.geometry is not None else 0.0
        green_area = 0.0
        if zone_area > 0:
            intersection = row.geometry.intersection(parks_union)
            if not intersection.is_empty:
                green_area = float(intersection.area)
        rows.append(
            {
                "학교ID": row.학교ID,
                "학교명": row.학교명,
                "gu": row.gu,
                f"{prefix}_zone_area_m2": zone_area,
                f"{prefix}_green_intersection_area_m2": green_area,
                f"{prefix}_green_ratio_intersection_pct": green_area / zone_area * 100
                if zone_area > 0
                else np.nan,
            }
        )
    return pd.DataFrame(rows)


def loss_bucket(loss_pp: float) -> str:
    if loss_pp <= 0:
        return "walk_same_or_higher"
    if loss_pp < 1:
        return "0_1pp_loss"
    if loss_pp < 5:
        return "1_5pp_loss"
    if loss_pp < 10:
        return "5_10pp_loss"
    if loss_pp < 20:
        return "10_20pp_loss"
    if loss_pp < 50:
        return "20_50pp_loss"
    return "50pp_plus_loss"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    priority = pd.read_csv(DATA_DIR / "school_priority.csv", encoding="utf-8-sig")
    priority["case_type"] = pd.to_numeric(priority["case_type"], errors="coerce")
    priority["is_separate_bundle_tag"] = pd.to_numeric(
        priority["is_separate_bundle_tag"], errors="coerce"
    ).fillna(0).astype(int)
    priority["is_core_case"] = (
        priority["case_type"].notna() & priority["is_separate_bundle_tag"].eq(0)
    )
    priority["iso_green_ratio"] = pd.to_numeric(priority["iso_green_ratio"], errors="coerce")
    priority["buf_park_area"] = pd.to_numeric(priority["buf_park_area"], errors="coerce").fillna(0)

    buffer_gdf = gpd.read_file(DATA_DIR / "school_buffer_500m.geojson").to_crs(CRS_METRIC)
    radius = intersection_ratio_by_school(buffer_gdf, "radius_500m")

    out = priority[
        [
            "학교ID",
            "학교명",
            "gu",
            "case_type",
            "case_label",
            "is_separate_bundle_tag",
            "is_island_tag",
            "buf_park_count",
            "iso_park_count",
            "buf_park_area",
            "iso_park_area",
            "isochrone_area_m2",
            "iso_green_ratio",
            "iso_green_ratio_raw",
            "nearest_park_dist_m",
            "is_core_case",
        ]
    ].merge(radius, on=["학교ID", "학교명", "gu"], how="left")

    out["buffer_500m_area_m2"] = BUFFER_500M_AREA_M2
    out["old_buffer_green_ratio_raw"] = out["buf_park_area"] / BUFFER_500M_AREA_M2 * 100
    out["old_buffer_green_ratio_clipped"] = out["old_buffer_green_ratio_raw"].clip(0, 100)
    out["buffer_green_ratio"] = out["radius_500m_green_ratio_intersection_pct"].clip(0, 100)
    out["walk_green_ratio"] = out["iso_green_ratio"].clip(0, 100)
    out["walk_minus_buffer_pp"] = out["walk_green_ratio"] - out["buffer_green_ratio"]
    out["buffer_to_walk_loss_pp"] = out["buffer_green_ratio"] - out["walk_green_ratio"]
    out["retained_green_ratio_pct"] = np.where(
        out["buffer_green_ratio"] > 0,
        out["walk_green_ratio"] / out["buffer_green_ratio"] * 100,
        np.nan,
    )
    out["loss_bucket"] = out["buffer_to_walk_loss_pp"].apply(loss_bucket)
    out["old_ratio_exceeded_100"] = out["old_buffer_green_ratio_raw"].gt(100)
    out["old_ratio_was_clipped_to_100"] = out["old_buffer_green_ratio_clipped"].eq(100)
    out["old_minus_corrected_buffer_pp"] = (
        out["old_buffer_green_ratio_clipped"] - out["buffer_green_ratio"]
    )

    round_cols = [
        "buf_park_area",
        "iso_park_area",
        "isochrone_area_m2",
        "iso_green_ratio",
        "iso_green_ratio_raw",
        "nearest_park_dist_m",
        "radius_500m_zone_area_m2",
        "radius_500m_green_intersection_area_m2",
        "radius_500m_green_ratio_intersection_pct",
        "buffer_500m_area_m2",
        "old_buffer_green_ratio_raw",
        "old_buffer_green_ratio_clipped",
        "buffer_green_ratio",
        "walk_green_ratio",
        "walk_minus_buffer_pp",
        "buffer_to_walk_loss_pp",
        "retained_green_ratio_pct",
        "old_minus_corrected_buffer_pp",
    ]
    out[round_cols] = out[round_cols].round(4)
    out = out.sort_values("old_minus_corrected_buffer_pp", ascending=False)

    audit_path = OUTPUT_DIR / "radius_green_ratio_audit_20260504.csv"
    fixed_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_20260423.csv"
    summary_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_summary_20260423.json"
    md_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_summary_20260423.md"

    out.to_csv(audit_path, index=False, encoding="utf-8-sig")
    out.to_csv(fixed_path, index=False, encoding="utf-8-sig")

    core = out[out["is_core_case"]].copy()
    all_schools = out.copy()

    def make_summary(label: str, df: pd.DataFrame) -> dict[str, object]:
        return {
            "label": label,
            "schools": int(len(df)),
            "walk_green_ratio": metric_summary(df["walk_green_ratio"]),
            "corrected_buffer_green_ratio": metric_summary(df["buffer_green_ratio"]),
            "old_clipped_buffer_green_ratio": metric_summary(df["old_buffer_green_ratio_clipped"]),
            "old_minus_corrected_buffer_pp": metric_summary(df["old_minus_corrected_buffer_pp"]),
            "buffer_to_walk_loss_pp": metric_summary(df["buffer_to_walk_loss_pp"]),
            "old_ratio_exceeded_100": int(df["old_ratio_exceeded_100"].sum()),
            "old_ratio_was_clipped_to_100": int(df["old_ratio_was_clipped_to_100"].sum()),
            "old_overstated_by_10pp_plus": int(df["old_minus_corrected_buffer_pp"].ge(10).sum()),
            "loss_bucket_counts": df["loss_bucket"].value_counts().to_dict(),
        }

    summary = {
        "basis": {
            "walk_green_ratio": "Operational school_priority.csv iso_green_ratio. Sealed/manual walking green values are not modified.",
            "corrected_buffer_green_ratio": "Intersection area of estimated park polygons with each straight 500m school buffer / school buffer area * 100.",
            "old_problem": "Previous buf_park_area / pi*500^2 used the full area of intersecting parks, so large parks could push the ratio over 100 and then be clipped.",
        },
        "all_schools": make_summary("all_schools", all_schools),
        "core_case_schools": make_summary("core_case_schools", core),
        "top_old_overstatement_core": core.head(25).to_dict(orient="records"),
        "top_corrected_loss_core": core.sort_values("buffer_to_walk_loss_pp", ascending=False)
        .head(25)
        .to_dict(orient="records"),
        "outputs": {
            "audit_csv": str(audit_path.relative_to(BASE_DIR)),
            "fixed_csv": str(fixed_path.relative_to(BASE_DIR)),
            "json": str(summary_path.relative_to(BASE_DIR)),
            "markdown": str(md_path.relative_to(BASE_DIR)),
        },
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    rows = [
        "# Radius vs walk green ratio audit",
        "",
        "## Correction",
        "- Walk green ratio keeps the operational `iso_green_ratio`; sealed/manual values are not changed.",
        "- Straight-radius green ratio now uses park-buffer intersection area inside each 500m school buffer.",
        "- The previous clipped ratio is retained only as audit columns.",
        "",
        "## Counts",
        f"- All schools: old raw radius ratio >100 in {summary['all_schools']['old_ratio_exceeded_100']} / {summary['all_schools']['schools']} schools.",
        f"- Core case1-4: old raw radius ratio >100 in {summary['core_case_schools']['old_ratio_exceeded_100']} / {summary['core_case_schools']['schools']} schools.",
        f"- All schools: old clipped radius overstated corrected radius by 10pp+ in {summary['all_schools']['old_overstated_by_10pp_plus']} schools.",
        f"- Core case1-4: old clipped radius overstated corrected radius by 10pp+ in {summary['core_case_schools']['old_overstated_by_10pp_plus']} schools.",
        "",
        "## Corrected core stats",
        f"- Radius median {summary['core_case_schools']['corrected_buffer_green_ratio']['median']}%, SD {summary['core_case_schools']['corrected_buffer_green_ratio']['sd']}, min {summary['core_case_schools']['corrected_buffer_green_ratio']['min']}%, max {summary['core_case_schools']['corrected_buffer_green_ratio']['max']}%.",
        f"- Walk median {summary['core_case_schools']['walk_green_ratio']['median']}%, SD {summary['core_case_schools']['walk_green_ratio']['sd']}, min {summary['core_case_schools']['walk_green_ratio']['min']}%, max {summary['core_case_schools']['walk_green_ratio']['max']}%.",
        "",
        "## Outputs",
        f"- `{summary['outputs']['audit_csv']}`",
        f"- `{summary['outputs']['fixed_csv']}`",
        f"- `{summary['outputs']['json']}`",
    ]
    md_path.write_text("\n".join(rows), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
