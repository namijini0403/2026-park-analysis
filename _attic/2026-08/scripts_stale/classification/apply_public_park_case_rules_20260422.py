from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd


BASE = Path(r"C:\2026_data_analysis_park")
DATA = BASE / "data/processed"
OUTPUT = BASE / "output"

GRAPH_PATH = DATA / "incheon_walk_graph_v2.graphml"
SCHOOLS_PATH = DATA / "schools.csv"
PARKS_PATH = DATA / "parks.csv"
PRIORITY_PATH = DATA / "school_priority.csv"
NEAREST_PATH = DATA / "school_nearest_park.csv"
GU_SUMMARY_PATH = DATA / "gu_summary.csv"
SEALED_PATH = OUTPUT / "sealed_nearest_park_dist.json"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"

COL_SCHOOL_ID = "\ud559\uad50ID"
COL_SCHOOL_NAME = "\ud559\uad50\uba85"
COL_LAT = "\uc704\ub3c4"
COL_LON = "\uacbd\ub3c4"
COL_PARK_ID = "\uad00\ub9ac\ubc88\ud638"
COL_PARK_NAME = "\uacf5\uc6d0\uba85"
COL_PARK_TYPE = "\uc2dc\uc124\uc720\ud615"
COL_PARK_AREA = "\uacf5\uc6d0\uba74\uc801"

PLAYGROUND = "\ub180\uc774\ud130"
PUBLIC_PARK_EXCEPTIONS = {"\uac00\uacbd\uacf5\uc6d0", "\uc218\ucc28\uacf5\uc6d0"}
SEPARATE_GU = {"\uac15\ud654\uad70", "\uc639\uc9c4\uad70"}

CASE_LABELS = {
    "1": "\uacf5\uc6d0 \uc811\uadfc \ubd88\uac00",
    "2": "\uc811\uadfc \uac00\ub2a5\ud558\ub098 \ub179\uc9c0 \ubd80\uc871",
    "3": "\uc811\uadfc \uac00\ub2a5, \uc911\uac04 \uc218\uc900",
    "4": "\uc811\uadfc \uc591\ud638",
}
CASE_SCORES = {"1": 4, "2": 3, "3": 2, "4": 1}
QUARTILE_SCORES = {"Q4": 4, "Q3": 3, "Q2": 2, "Q1": 1}

CITY_BRANCH_CASE_OVERRIDES = {
    "B000002962": {
        "case_type": "1",
        "case_label": CASE_LABELS["1"],
        "priority_score": 4,
        "nearest_park_dist_m": 1587.3,
        "iso_park_count": 0,
        "iso_park_area": 0.0,
        "iso_green_ratio": 0.0,
        "green_bucket": "",
        "is_separate_bundle_tag": 0,
        "is_low_access_tag": 0,
        "is_case_conflict_tag": 0,
    },
    "B000003132": {
        "case_type": "3",
        "case_label": CASE_LABELS["3"],
        "priority_score": 2,
        "nearest_park_dist_m": 342.8,
        "green_bucket": "middle",
        "is_separate_bundle_tag": 0,
        "is_low_access_tag": 1,
        "is_case_conflict_tag": 0,
    },
}


def as_float(value: object, fallback: float = 0.0) -> float:
    numeric = pd.to_numeric(value, errors="coerce")
    if pd.isna(numeric):
        return fallback
    return float(numeric)


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")


def public_parks(parks: pd.DataFrame) -> pd.DataFrame:
    mask = parks[COL_PARK_TYPE].ne(PLAYGROUND) | parks[COL_PARK_NAME].isin(PUBLIC_PARK_EXCEPTIONS)
    result = parks.loc[mask].copy()
    result[COL_PARK_AREA] = pd.to_numeric(result[COL_PARK_AREA], errors="coerce").fillna(0.0)
    result = result.drop_duplicates(
        subset=[COL_PARK_ID, COL_PARK_NAME, COL_LAT, COL_LON, COL_PARK_AREA]
    )
    return result.reset_index(drop=True)


def build_points(df: pd.DataFrame, lon_col: str, lat_col: str) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df[lon_col], df[lat_col]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)


def compute_public_nearest() -> pd.DataFrame:
    schools = read_csv(SCHOOLS_PATH)
    parks = public_parks(read_csv(PARKS_PATH))
    old_nearest = read_csv(NEAREST_PATH)
    sealed = json.loads(SEALED_PATH.read_text(encoding="utf-8"))
    sealed_ids = set(sealed.keys())

    graph = ox.load_graphml(GRAPH_PATH)
    graph = ox.project_graph(graph, to_crs=CRS_METRIC)
    graph = ox.convert.to_undirected(graph)

    school_gdf = build_points(schools, COL_LON, COL_LAT)
    park_gdf = build_points(parks, COL_LON, COL_LAT)
    school_gdf["nearest_node"] = ox.distance.nearest_nodes(
        graph,
        X=school_gdf.geometry.x.to_list(),
        Y=school_gdf.geometry.y.to_list(),
    )
    park_gdf["nearest_node"] = ox.distance.nearest_nodes(
        graph,
        X=park_gdf.geometry.x.to_list(),
        Y=park_gdf.geometry.y.to_list(),
    )

    node_to_park: dict[object, dict[str, object]] = {}
    for _, row in park_gdf.iterrows():
        node = row["nearest_node"]
        area = as_float(row[COL_PARK_AREA], 0.0)
        current = node_to_park.get(node)
        if current is None or area > as_float(current.get(COL_PARK_AREA), 0.0):
            node_to_park[node] = {
                "nearest_park_name": row[COL_PARK_NAME],
                "nearest_park_dist_m": np.nan,
                COL_PARK_AREA: area,
            }

    park_nodes = list(node_to_park.keys())
    records: list[dict[str, object]] = []
    for idx, (_, row) in enumerate(school_gdf.iterrows(), start=1):
        school_id = row[COL_SCHOOL_ID]
        school_name = row[COL_SCHOOL_NAME]
        try:
            dist, path = nx.multi_source_dijkstra(
                graph,
                sources=park_nodes,
                target=row["nearest_node"],
                weight="length",
            )
            park = node_to_park[path[0]]
            final_dist = as_float(sealed.get(school_id), round(float(dist), 1)) if school_id in sealed_ids else round(float(dist), 1)
            records.append(
                {
                    COL_SCHOOL_ID: school_id,
                    COL_SCHOOL_NAME: school_name,
                    "nearest_park_name": park["nearest_park_name"],
                    "nearest_park_dist_m": final_dist,
                }
            )
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            fallback_name = ""
            if school_id in sealed_ids:
                sealed_row = old_nearest.loc[old_nearest[COL_SCHOOL_ID].eq(school_id)].head(1)
                if not sealed_row.empty:
                    fallback_name = sealed_row.iloc[0].get("nearest_park_name", "")
            records.append(
                {
                    COL_SCHOOL_ID: school_id,
                    COL_SCHOOL_NAME: school_name,
                    "nearest_park_name": fallback_name,
                    "nearest_park_dist_m": as_float(sealed.get(school_id), np.nan) if school_id in sealed_ids else np.nan,
                }
            )

        if idx % 50 == 0 or idx == len(school_gdf):
            print(f"[nearest public park] {idx}/{len(school_gdf)}")

    nearest = pd.DataFrame(records).sort_values(COL_SCHOOL_ID).reset_index(drop=True)
    nearest.to_csv(NEAREST_PATH, index=False, encoding="utf-8-sig")
    print(
        f"saved public nearest: {NEAREST_PATH} rows={len(nearest)} "
        f"parks={len(parks)} sealed={len(sealed_ids)}"
    )
    return nearest


def apply_case_rules(nearest: pd.DataFrame) -> pd.DataFrame:
    priority = read_csv(PRIORITY_PATH)
    parks = public_parks(read_csv(PARKS_PATH))
    park_area_by_name = parks.groupby(COL_PARK_NAME)[COL_PARK_AREA].max().to_dict()

    priority = priority.drop(columns=["nearest_park_dist_m"], errors="ignore")
    priority = priority.merge(
        nearest[[COL_SCHOOL_ID, "nearest_park_name", "nearest_park_dist_m"]],
        on=COL_SCHOOL_ID,
        how="left",
    )

    priority["is_separate_bundle_tag"] = priority["gu"].isin(SEPARATE_GU).astype(int)
    priority.loc[
        priority[COL_SCHOOL_ID].isin(CITY_BRANCH_CASE_OVERRIDES.keys()),
        "is_separate_bundle_tag",
    ] = 0

    for col in ["iso_park_count", "iso_park_area", "buf_park_count", "isochrone_area_m2"]:
        priority[col] = pd.to_numeric(priority[col], errors="coerce").fillna(0.0)
    priority["iso_park_count"] = priority["iso_park_count"].astype(int)
    priority["buf_park_count"] = priority["buf_park_count"].astype(int)

    nearest_dist = pd.to_numeric(priority["nearest_park_dist_m"], errors="coerce")
    zero_area_accessible = (
        priority["is_separate_bundle_tag"].eq(0)
        & nearest_dist.lt(500)
        & priority["iso_park_area"].eq(0)
    )
    for idx, row in priority.loc[zero_area_accessible].iterrows():
        area = as_float(park_area_by_name.get(row.get("nearest_park_name")), 0.0)
        if area <= 0:
            continue
        safe_area = min(area, as_float(row.get("isochrone_area_m2"), area))
        priority.at[idx, "iso_park_area"] = safe_area
        priority.at[idx, "iso_park_area_raw"] = safe_area
        if as_float(priority.at[idx, "iso_park_count"], 0) < 1:
            priority.at[idx, "iso_park_count"] = 1
            priority.at[idx, "iso_park_count_raw"] = max(
                as_float(priority.at[idx, "iso_park_count_raw"], 0),
                1,
            )

    priority["iso_green_ratio_raw"] = np.where(
        priority["isochrone_area_m2"] > 0,
        (priority["iso_park_area"] / priority["isochrone_area_m2"]) * 100.0,
        0.0,
    )
    priority["iso_green_ratio"] = priority["iso_green_ratio_raw"].clip(lower=0.0, upper=100.0)
    priority["access_ratio"] = np.where(
        priority["buf_park_count"] > 0,
        priority["iso_park_count"] / priority["buf_park_count"],
        0.0,
    )
    priority["is_low_access_tag"] = (
        priority["iso_park_count"].ge(1) & priority["access_ratio"].le(0.5)
    ).astype(int)

    active = priority["is_separate_bundle_tag"].eq(0)
    hard_case1 = (
        active
        & nearest_dist.ge(500)
        & priority["iso_park_count"].eq(0)
        & priority["iso_green_ratio"].eq(0)
    )
    candidate = active & ~hard_case1 & (priority["iso_park_count"].ge(1) | nearest_dist.lt(500))

    priority["green_bucket"] = pd.NA
    priority.loc[candidate & priority["iso_green_ratio"].lt(1), "green_bucket"] = "low"
    priority.loc[
        candidate & priority["iso_green_ratio"].ge(1) & priority["iso_green_ratio"].lt(5),
        "green_bucket",
    ] = "middle"
    priority.loc[candidate & priority["iso_green_ratio"].ge(5), "green_bucket"] = "high"

    priority["is_case_conflict_tag"] = (
        active
        & (
            (nearest_dist.lt(500) & priority["iso_park_count"].eq(0))
            | (nearest_dist.ge(500) & priority["iso_park_count"].ge(1))
        )
    ).astype(int)

    priority["case_type"] = pd.NA
    priority.loc[hard_case1, "case_type"] = "1"
    priority.loc[candidate & priority["green_bucket"].eq("low"), "case_type"] = "2"
    priority.loc[candidate & priority["green_bucket"].eq("middle"), "case_type"] = "3"
    priority.loc[candidate & priority["green_bucket"].eq("high"), "case_type"] = "4"
    priority["case_label"] = priority["case_type"].map(CASE_LABELS)
    priority["priority_score"] = priority["case_type"].map(CASE_SCORES)
    priority.loc[priority["is_separate_bundle_tag"].eq(1), "case_label"] = "\ubcc4\ub3c4 \ubb36\uc74c"
    priority.loc[priority["is_separate_bundle_tag"].eq(1), "priority_score"] = pd.NA

    for school_id, overrides in CITY_BRANCH_CASE_OVERRIDES.items():
        mask = priority[COL_SCHOOL_ID].eq(school_id)
        for key, value in overrides.items():
            priority.loc[mask, key] = value

    priority["priority_rank"] = pd.NA
    for case_type in ["1", "2", "3", "4"]:
        mask = priority["case_type"].astype(str).eq(case_type) & priority["is_separate_bundle_tag"].eq(0)
        if not mask.any():
            continue
        subset = priority.loc[mask].copy()
        if "final_quartile" in subset.columns:
            subset["_quartile_score"] = subset["final_quartile"].map(QUARTILE_SCORES).fillna(0)
        else:
            subset["_quartile_score"] = 0
        subset["_green_sort"] = pd.to_numeric(subset["iso_green_ratio"], errors="coerce").fillna(0)
        subset["_play_sort"] = pd.to_numeric(subset.get("iso_playground_count", 0), errors="coerce").fillna(0)
        subset["_dist_sort"] = pd.to_numeric(subset["nearest_park_dist_m"], errors="coerce").fillna(0)
        subset["_slope_sort"] = pd.to_numeric(subset.get("student_slope", 0), errors="coerce").fillna(0)
        subset = subset.sort_values(
            ["_quartile_score", "_green_sort", "_play_sort", "_dist_sort", "_slope_sort", COL_SCHOOL_NAME],
            ascending=[False, True, True, False, False, True],
        )
        priority.loc[subset.index, "priority_rank"] = range(1, len(subset) + 1)

    priority["is_island_tag"] = priority["gu"].eq("\uc639\uc9c4\uad70").astype(int)
    priority = priority.drop(columns=["nearest_park_name"], errors="ignore")
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")
    print(f"saved priority: {PRIORITY_PATH} rows={len(priority)}")
    return priority


def update_gu_summary(priority: pd.DataFrame) -> pd.DataFrame:
    active = priority[priority["is_separate_bundle_tag"].eq(0)].copy()
    summary = (
        active.groupby("gu", dropna=False)
        .agg(
            total_schools=(COL_SCHOOL_ID, "count"),
            case1_count=("case_type", lambda s: (s.astype(str) == "1").sum()),
            case2_count=("case_type", lambda s: (s.astype(str) == "2").sum()),
            case3_count=("case_type", lambda s: (s.astype(str) == "3").sum()),
            case4_count=("case_type", lambda s: (s.astype(str) == "4").sum()),
            avg_nearest_park_dist=("nearest_park_dist_m", "mean"),
            avg_iso_green_ratio=("iso_green_ratio", "mean"),
            avg_access_ratio=("access_ratio", "mean"),
        )
        .reset_index()
    )
    for col in ["avg_nearest_park_dist", "avg_iso_green_ratio", "avg_access_ratio"]:
        summary[col] = summary[col].round(3)
    summary.to_csv(GU_SUMMARY_PATH, index=False, encoding="utf-8-sig")
    print(f"saved gu summary: {GU_SUMMARY_PATH} rows={len(summary)}")
    return summary


def print_checks(priority: pd.DataFrame, nearest: pd.DataFrame) -> None:
    names = ["\uc778\ucc9c\uc2e0\uad11\ucd08", "\uc778\ucc9c\uc2e0\ud765\ucd08", "\uc778\ucc9c\uc601\uc885\ucd08\ub4f1\ud559\uad50\uae08\uc0b0\ubd84\uad50\uc7a5", "\uc778\ucc9c\uacc4\uc591\ucd08\ub4f1\ud559\uad50\uc0c1\uc57c\ubd84\uad50\uc7a5"]
    check_nearest = nearest[nearest[COL_SCHOOL_NAME].isin(names)]
    print("\n[nearest checks]")
    print(check_nearest[[COL_SCHOOL_ID, COL_SCHOOL_NAME, "nearest_park_name", "nearest_park_dist_m"]].to_string(index=False))
    check_priority = priority[priority[COL_SCHOOL_NAME].isin(names)]
    cols = [
        COL_SCHOOL_ID,
        COL_SCHOOL_NAME,
        "gu",
        "nearest_park_dist_m",
        "iso_park_count",
        "iso_green_ratio",
        "iso_playground_count",
        "case_type",
        "case_label",
        "priority_rank",
        "is_case_conflict_tag",
    ]
    print("\n[case checks]")
    print(check_priority[cols].to_string(index=False))
    print("\n[case counts]")
    print(priority["case_type"].astype(str).value_counts(dropna=False).sort_index().to_string())
    print("\n[separate bundle count]")
    print(int(priority["is_separate_bundle_tag"].sum()))


def main() -> None:
    nearest = compute_public_nearest()
    priority = apply_case_rules(nearest)
    update_gu_summary(priority)
    print_checks(priority, nearest)


if __name__ == "__main__":
    main()
