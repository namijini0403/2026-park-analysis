from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_processed"
LEGACY_DATA = ROOT / "data" / "processed"
REPORTS = ROOT / "outputs" / "reports"

CRS_METRIC = "EPSG:5179"
CONNECTIVITY_BUFFER_M = 15
MIN_ADDED_AREA_M2 = 500
BUFFER_500M_AREA_M2 = math.pi * 500**2
PLAYGROUND = "놀이터"
PUBLIC_PARK_EXCEPTIONS = {"가경공원", "수차공원"}

COL_SCHOOL_ID = "학교ID"
COL_SCHOOL_NAME = "학교명"

MANUAL_GREEN_RATIO_BY_ID = {
    "B000003143",
    "B000003144",
    "B000003145",
    "B000026504",
    "B000003048",
    "B000002990",
}

FIELD_REVIEW_PROTECTED_IDS = {
    "B000003143",
    "B000003144",
    "B000025206",
    "B000002963",
    "B000002981",
    "B000025246",
    "B000002959",
    "B000025189",
    "B000025236",
    "B000003158",
    "B000026504",
    "B000003048",
    "B000003123",
    "B000003077",
    "B000002990",
    "B000003145",
    "B000003029",
    "B000003102",
    "B000003132",
}


def metric_summary(series: pd.Series, decimals: int = 4) -> dict[str, float | int]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    if clean.empty:
        return {"n": 0}
    return {
        "n": int(len(clean)),
        "mean": round(float(clean.mean()), decimals),
        "median": round(float(clean.median()), decimals),
        "sd": round(float(clean.std(ddof=1)), decimals),
        "min": round(float(clean.min()), decimals),
        "max": round(float(clean.max()), decimals),
    }


def clean_geometry(geom: BaseGeometry | None) -> BaseGeometry | None:
    if geom is None or geom.is_empty:
        return geom
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom


def load_public_park_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(DATA / "parks.csv", encoding="utf-8-sig")
    parks = parks[
        parks["시설유형"].ne(PLAYGROUND) | parks["공원명"].isin(PUBLIC_PARK_EXCEPTIONS)
    ].copy()
    parks["공원면적"] = pd.to_numeric(parks["공원면적"], errors="coerce").fillna(0)
    parks = parks[pd.to_numeric(parks["위도"], errors="coerce").notna()]
    parks = parks[pd.to_numeric(parks["경도"], errors="coerce").notna()]

    gdf = gpd.GeoDataFrame(
        parks,
        geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    radius = np.sqrt(gdf["공원면적"] / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def load_residential_polygons() -> gpd.GeoDataFrame:
    path = DATA / "incheon_residential_osm.geojson"
    if not path.exists():
        path = LEGACY_DATA / "incheon_residential_osm.geojson"
    if not path.exists():
        raise FileNotFoundError(
            "incheon_residential_osm.geojson not found in data_processed or data/processed"
        )
    gdf = gpd.read_file(path).to_crs(CRS_METRIC)
    gdf["geometry"] = gdf.geometry.apply(clean_geometry)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf["residential_area_m2"] = gdf.geometry.area
    # Keep apartment/residential blocks that are large enough to represent a
    # meaningful internal walking permeability correction.
    return gdf[gdf["residential_area_m2"].ge(250)].copy()


def large_apt_counts(buffer_gdf: gpd.GeoDataFrame) -> pd.DataFrame:
    apt = pd.read_csv(DATA / "large_apt_complexes_2025.csv", encoding="utf-8-sig")
    apt["세대수"] = pd.to_numeric(apt["세대수"], errors="coerce").fillna(0)
    apt = apt[
        apt["세대수"].ge(500)
        & pd.to_numeric(apt["위도"], errors="coerce").notna()
        & pd.to_numeric(apt["경도"], errors="coerce").notna()
    ].copy()
    apt_gdf = gpd.GeoDataFrame(
        apt,
        geometry=gpd.points_from_xy(apt["경도"], apt["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)

    rows: list[dict[str, object]] = []
    for row in buffer_gdf[[COL_SCHOOL_ID, "geometry"]].itertuples(index=False):
        hits = apt_gdf[apt_gdf.geometry.within(row.geometry)]
        rows.append(
            {
                COL_SCHOOL_ID: row.학교ID,
                "large_apt_count_500m": int(len(hits)),
                "large_apt_households_500m": int(hits["세대수"].sum()),
            }
        )
    return pd.DataFrame(rows)


def park_intersection_stats(
    zone: BaseGeometry,
    parks_gdf: gpd.GeoDataFrame,
    parks_union: BaseGeometry,
) -> tuple[float, int]:
    if zone is None or zone.is_empty:
        return 0.0, 0
    intersection = zone.intersection(parks_union)
    green_area = 0.0 if intersection.is_empty else float(intersection.area)

    park_count = 0
    for park_geom in parks_gdf.geometry:
        if not zone.intersection(park_geom).is_empty:
            park_count += 1
    return green_area, park_count


def build_adjustment() -> tuple[pd.DataFrame, gpd.GeoDataFrame, pd.DataFrame, dict[str, object]]:
    priority = pd.read_csv(DATA / "school_priority.csv", encoding="utf-8-sig")
    for col in [
        "case_type",
        "is_separate_bundle_tag",
        "iso_green_ratio",
        "iso_park_area",
        "iso_park_count",
        "isochrone_area_m2",
        "buf_park_area",
    ]:
        if col in priority.columns:
            priority[col] = pd.to_numeric(priority[col], errors="coerce")

    iso_gdf = gpd.read_file(DATA / "school_isochrone_500m.geojson").to_crs(CRS_METRIC)
    buffer_gdf = gpd.read_file(DATA / "school_buffer_500m.geojson").to_crs(CRS_METRIC)
    residential_gdf = load_residential_polygons()
    parks_gdf = load_public_park_polygons()
    parks_union = unary_union(parks_gdf.geometry)
    apt_counts = large_apt_counts(buffer_gdf)

    rows: list[dict[str, object]] = []
    adjusted_features: list[dict[str, object]] = []
    blocked_park_rows: list[dict[str, object]] = []

    res_sindex = residential_gdf.sindex
    parks_sindex = parks_gdf.sindex
    buffer_lookup = buffer_gdf.set_index(COL_SCHOOL_ID)
    priority_lookup = priority.set_index(COL_SCHOOL_ID)

    for iso_row in iso_gdf.itertuples(index=False):
        school_id = getattr(iso_row, COL_SCHOOL_ID)
        school_name = getattr(iso_row, COL_SCHOOL_NAME)
        gu = getattr(iso_row, "gu", None)
        buffer_geom = buffer_lookup.loc[school_id, "geometry"]
        iso_geom = clean_geometry(iso_row.geometry)
        if iso_geom is None or iso_geom.is_empty:
            iso_geom = buffer_geom.intersection(buffer_geom.buffer(0))

        is_protected = school_id in FIELD_REVIEW_PROTECTED_IDS
        is_manual_green = school_id in MANUAL_GREEN_RATIO_BY_ID
        gap_geom = buffer_geom.difference(iso_geom)
        added_geom = None
        added_area = 0.0
        connected_residential_count = 0

        if not is_protected and not gap_geom.is_empty:
            search_geom = gap_geom
            candidate_idx = list(res_sindex.query(search_geom, predicate="intersects"))
            pieces: list[BaseGeometry] = []
            connected_zone = iso_geom.buffer(CONNECTIVITY_BUFFER_M)
            for idx in candidate_idx:
                residential_geom = residential_gdf.geometry.iloc[idx]
                if not residential_geom.intersects(connected_zone):
                    continue
                piece = residential_geom.intersection(gap_geom)
                if piece.is_empty:
                    continue
                area = float(piece.area)
                if area < MIN_ADDED_AREA_M2:
                    continue
                pieces.append(piece)
                connected_residential_count += 1
            if pieces:
                added_geom = unary_union(pieces)
                if not added_geom.is_empty:
                    added_area = float(added_geom.area)

        adjusted_geom = iso_geom if added_geom is None or added_geom.is_empty else iso_geom.union(added_geom)
        adjusted_geom = clean_geometry(adjusted_geom)

        osm_walk_area = float(iso_geom.area)
        adjusted_walk_area = float(adjusted_geom.area) if adjusted_geom is not None else osm_walk_area
        apt_added_green_area, apt_added_park_count = (
            park_intersection_stats(added_geom, parks_gdf, parks_union)
            if added_geom is not None and not added_geom.is_empty
            else (0.0, 0)
        )
        adjusted_green_area, adjusted_park_count = park_intersection_stats(
            adjusted_geom, parks_gdf, parks_union
        )
        current_green_ratio = float(priority_lookup.loc[school_id, "iso_green_ratio"])
        adjusted_green_ratio = (
            adjusted_green_area / adjusted_walk_area * 100.0
            if adjusted_walk_area > 0
            else 0.0
        )
        if is_protected:
            adjusted_green_area = float(priority_lookup.loc[school_id, "iso_park_area"])
            adjusted_park_count = int(priority_lookup.loc[school_id, "iso_park_count"])
            adjusted_green_ratio = current_green_ratio
        radius_green_ratio = (
            float(priority_lookup.loc[school_id, "buf_park_area"]) / BUFFER_500M_AREA_M2 * 100.0
        )
        apt_gap_ratio = added_area / BUFFER_500M_AREA_M2 if BUFFER_500M_AREA_M2 > 0 else 0.0

        near_park_idx = list(parks_sindex.query(added_geom, predicate="intersects")) if added_area > 0 else []
        for idx in near_park_idx:
            park = parks_gdf.iloc[idx]
            overlap = added_geom.intersection(park.geometry)
            if overlap.is_empty:
                continue
            blocked_park_rows.append(
                {
                    COL_SCHOOL_ID: school_id,
                    COL_SCHOOL_NAME: school_name,
                    "gu": gu,
                    "공원명": park.get("공원명"),
                    "시설유형": park.get("시설유형"),
                    "공원면적_원본": park.get("공원면적"),
                    "apt_added_park_intersect_m2": round(float(overlap.area), 4),
                }
            )

        rows.append(
            {
                COL_SCHOOL_ID: school_id,
                COL_SCHOOL_NAME: school_name,
                "gu": gu,
                "case_type": priority_lookup.loc[school_id, "case_type"],
                "is_separate_bundle_tag": priority_lookup.loc[school_id, "is_separate_bundle_tag"],
                "green_fix_protected": int(is_protected),
                "green_fix_manual_ratio": int(is_manual_green),
                "osm_walk_area_m2": round(osm_walk_area, 4),
                "straight_buffer_area_m2": round(float(buffer_geom.area), 4),
                "osm_walk_area_ratio_to_buffer": round(osm_walk_area / float(buffer_geom.area), 6),
                "connected_residential_count": connected_residential_count,
                "apt_added_area_m2": round(added_area, 4),
                "apt_gap_ratio": round(apt_gap_ratio, 6),
                "adjusted_walk_area_m2": round(adjusted_walk_area, 4),
                "adjusted_walk_area_ratio_to_buffer": round(
                    adjusted_walk_area / float(buffer_geom.area), 6
                ),
                "current_walk_green_area_m2": round(float(priority_lookup.loc[school_id, "iso_park_area"]), 4),
                "current_walk_green_ratio": round(current_green_ratio, 6),
                "apt_added_green_area_m2": round(apt_added_green_area, 4),
                "apt_added_park_count": int(apt_added_park_count),
                "adjusted_walk_green_area_m2": round(adjusted_green_area, 4),
                "adjusted_walk_park_count": int(adjusted_park_count),
                "apt_adjusted_walk_green_ratio": round(adjusted_green_ratio, 6),
                "apt_adjusted_green_delta_pp": round(adjusted_green_ratio - current_green_ratio, 6),
                "radius_green_ratio": round(radius_green_ratio, 6),
                "radius_to_walk_loss_pp": round(radius_green_ratio - current_green_ratio, 6),
                "radius_to_adjusted_loss_pp": round(radius_green_ratio - adjusted_green_ratio, 6),
                "apt_permeability_flag": int(
                    (not is_protected) and (added_area >= 5000 or apt_gap_ratio >= 0.01)
                ),
            }
        )
        adjusted_features.append(
            {
                COL_SCHOOL_ID: school_id,
                COL_SCHOOL_NAME: school_name,
                "gu": gu,
                "apt_added_area_m2": round(added_area, 4),
                "apt_adjusted_walk_green_ratio": round(adjusted_green_ratio, 6),
                "geometry": adjusted_geom,
            }
        )

    result = pd.DataFrame(rows).merge(apt_counts, on=COL_SCHOOL_ID, how="left")
    result["large_apt_count_500m"] = result["large_apt_count_500m"].fillna(0).astype(int)
    result["large_apt_households_500m"] = (
        result["large_apt_households_500m"].fillna(0).astype(int)
    )
    result["apt_adjustment_candidate"] = (
        result["green_fix_protected"].eq(0)
        & result["apt_permeability_flag"].eq(1)
        & (
            result["radius_to_walk_loss_pp"].ge(5)
            | result["large_apt_count_500m"].ge(1)
            | result["apt_added_park_count"].ge(1)
        )
    ).astype(int)

    adjusted_gdf = gpd.GeoDataFrame(adjusted_features, geometry="geometry", crs=CRS_METRIC).to_crs(
        "EPSG:4326"
    )
    blocked_parks = pd.DataFrame(blocked_park_rows)

    core = result[
        pd.to_numeric(result["case_type"], errors="coerce").notna()
        & pd.to_numeric(result["is_separate_bundle_tag"], errors="coerce").fillna(0).eq(0)
    ].copy()
    summary = {
        "method": {
            "gap": "straight 500m buffer minus current OSM/Valhalla walking 500m isochrone",
            "added_area": "OSM residential/apartment polygon area inside the gap, only when connected to the current walk isochrone buffered by 15m",
            "operational_case_values": "iso_green_ratio and case_type are not overwritten; apt-adjusted values are scenario columns.",
        },
        "all_schools": {
            "schools": int(len(result)),
            "protected_schools": int(result["green_fix_protected"].sum()),
            "apt_permeability_flag": int(result["apt_permeability_flag"].sum()),
            "apt_adjustment_candidate": int(result["apt_adjustment_candidate"].sum()),
            "with_added_parks": int(result["apt_added_park_count"].gt(0).sum()),
            "apt_added_area_m2": metric_summary(result["apt_added_area_m2"]),
            "apt_adjusted_green_delta_pp": metric_summary(result["apt_adjusted_green_delta_pp"]),
        },
        "core_case_schools": {
            "schools": int(len(core)),
            "protected_schools": int(core["green_fix_protected"].sum()),
            "apt_permeability_flag": int(core["apt_permeability_flag"].sum()),
            "apt_adjustment_candidate": int(core["apt_adjustment_candidate"].sum()),
            "with_added_parks": int(core["apt_added_park_count"].gt(0).sum()),
            "apt_added_area_m2": metric_summary(core["apt_added_area_m2"]),
            "current_walk_green_ratio": metric_summary(core["current_walk_green_ratio"]),
            "apt_adjusted_walk_green_ratio": metric_summary(core["apt_adjusted_walk_green_ratio"]),
            "apt_adjusted_green_delta_pp": metric_summary(core["apt_adjusted_green_delta_pp"]),
            "radius_to_walk_loss_pp": metric_summary(core["radius_to_walk_loss_pp"]),
            "radius_to_adjusted_loss_pp": metric_summary(core["radius_to_adjusted_loss_pp"]),
        },
        "top_added_area_core": core.sort_values("apt_added_area_m2", ascending=False)
        .head(20)
        .to_dict(orient="records"),
    }
    return result, adjusted_gdf, blocked_parks, summary


def update_priority_sidecar_columns(adjustment: pd.DataFrame) -> None:
    priority_path = DATA / "school_priority.csv"
    priority = pd.read_csv(priority_path, encoding="utf-8-sig")
    update_cols = [
        "apt_blocked_m2",
        "apt_gap_ratio",
        "blocked_park_count",
        "blocked_park_intersect_m2",
        "current_green_ratio",
        "corrected_green_ratio",
        "green_ratio_delta",
        "iso_green_ratio_before_apt",
    ]
    for col in update_cols:
        if col not in priority.columns:
            priority[col] = np.nan
        priority[col] = pd.to_numeric(priority[col], errors="coerce").astype(float)

    mapped = adjustment.set_index(COL_SCHOOL_ID)
    for idx, row in priority.iterrows():
        school_id = row[COL_SCHOOL_ID]
        if school_id not in mapped.index:
            continue
        item = mapped.loc[school_id]
        priority.at[idx, "apt_blocked_m2"] = round(float(item["apt_added_area_m2"]), 4)
        priority.at[idx, "apt_gap_ratio"] = round(float(item["apt_gap_ratio"]), 6)
        priority.at[idx, "blocked_park_count"] = int(item["apt_added_park_count"])
        priority.at[idx, "blocked_park_intersect_m2"] = round(
            float(item["apt_added_green_area_m2"]), 4
        )
        priority.at[idx, "current_green_ratio"] = round(float(item["current_walk_green_ratio"]), 6)
        priority.at[idx, "corrected_green_ratio"] = round(
            float(item["apt_adjusted_walk_green_ratio"]), 6
        )
        priority.at[idx, "green_ratio_delta"] = round(
            float(item["apt_adjusted_green_delta_pp"]), 6
        )
        priority.at[idx, "iso_green_ratio_before_apt"] = round(
            float(item["current_walk_green_ratio"]), 6
        )

    priority.to_csv(priority_path, index=False, encoding="utf-8-sig")


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    adjustment, adjusted_gdf, blocked_parks, summary = build_adjustment()

    adjustment_path = DATA / "school_walk_500m_apartment_adjustment_20260504.csv"
    adjusted_geojson_path = DATA / "school_isochrone_500m_apt_adjusted_20260504.geojson"
    blocked_parks_path = DATA / "blocked_parks_by_apt_adjustment_20260504.csv"
    summary_path = REPORTS / "school_walk_500m_apartment_adjustment_summary_20260504.json"

    adjustment.to_csv(adjustment_path, index=False, encoding="utf-8-sig")
    adjusted_geojson_path.write_text(adjusted_gdf.to_json(), encoding="utf-8")
    blocked_parks.to_csv(blocked_parks_path, index=False, encoding="utf-8-sig")
    update_priority_sidecar_columns(adjustment)

    summary["outputs"] = {
        "adjustment_csv": str(adjustment_path.relative_to(ROOT)),
        "adjusted_isochrone_geojson": str(adjusted_geojson_path.relative_to(ROOT)),
        "blocked_parks_csv": str(blocked_parks_path.relative_to(ROOT)),
        "summary_json": str(summary_path.relative_to(ROOT)),
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
