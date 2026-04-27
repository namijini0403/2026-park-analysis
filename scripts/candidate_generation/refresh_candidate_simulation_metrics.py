from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd


BASE = Path(__file__).resolve().parents[2]
GRAPH_PATH = BASE / "data/processed" / "incheon_walk_graph_v2.graphml"
CANDIDATE_GEOJSON_PATH = BASE / "data/processed" / "candidate_grid_xgb_v4.geojson"
CANDIDATE_CSV_PATH = BASE / "data/processed" / "candidate_grid_xgb_v4.csv"
SCHOOL_FORECAST_PATH = BASE / "data/processed" / "school_enrollment_forecast_20260418_model1.csv"
PARKS_PATH = BASE / "data/processed" / "parks.csv"
PLAYGROUNDS_PATH = BASE / "data/processed" / "geocoded_playground.csv"


def parse_linked_schools(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if hasattr(value, "tolist"):
        converted = value.tolist()
        if isinstance(converted, list):
            return [str(item).strip() for item in converted if str(item).strip()]

    text = str(value).strip()
    if not text:
        return []

    matches = re.findall(r"np\.str_\('([^']+)'\)", text)
    if matches:
        return [item.strip() for item in matches if item.strip()]

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    return [item.strip() for item in re.findall(r"'([^']+)'", text) if item.strip()]


def _dedupe_points(
    frame: pd.DataFrame,
    lat_col: str,
    lng_col: str,
    priority_col: str,
    radius_m: float = 40.0,
) -> pd.DataFrame:
    if frame.empty:
        return frame.copy()

    gdf = gpd.GeoDataFrame(
        frame.copy(),
        geometry=gpd.points_from_xy(frame[lng_col], frame[lat_col]),
        crs="EPSG:4326",
    ).to_crs("EPSG:5179")

    kept_rows: list[int] = []
    taken = set()
    coords = list(zip(gdf.geometry.x.to_list(), gdf.geometry.y.to_list()))

    for idx in gdf.sort_values(priority_col, ascending=False).index:
        if idx in taken:
            continue
        kept_rows.append(idx)
        x0, y0 = coords[gdf.index.get_loc(idx)]
        for other_idx, (x1, y1) in zip(gdf.index, coords):
            if other_idx in taken:
                continue
            if ((x0 - x1) ** 2 + (y0 - y1) ** 2) ** 0.5 <= radius_m:
                taken.add(other_idx)

    return frame.loc[kept_rows].reset_index(drop=True)


def build_playground_source(
    playground_df: pd.DataFrame,
    parks_df: pd.DataFrame,
) -> pd.DataFrame:
    playground_cols = {
        "name": playground_df.columns[0],
        "gu": playground_df.columns[1],
        "lat": playground_df.columns[3],
        "lng": playground_df.columns[4],
    }
    park_cols = {
        "name": parks_df.columns[1],
        "kind": parks_df.columns[2],
        "lat": parks_df.columns[3],
        "lng": parks_df.columns[4],
        "gu": parks_df.columns[6],
        "facility": parks_df.columns[7],
    }

    explicit_public = parks_df.loc[
        parks_df[park_cols["kind"]].astype(str).eq("\ub180\uc774\ud130")
        | parks_df[park_cols["facility"]].astype(str).eq("\ub180\uc774\ud130"),
        [park_cols["name"], park_cols["gu"], park_cols["lat"], park_cols["lng"]],
    ].copy()
    explicit_public.columns = ["name", "gu", "lat", "lng"]
    explicit_public["source_type"] = "parks_playground"
    explicit_public["priority"] = 3

    explicit_geocoded = playground_df.loc[
        playground_df[playground_cols["lat"]].notna()
        & playground_df[playground_cols["lng"]].notna(),
        [
            playground_cols["name"],
            playground_cols["gu"],
            playground_cols["lat"],
            playground_cols["lng"],
        ],
    ].copy()
    explicit_geocoded.columns = ["name", "gu", "lat", "lng"]
    explicit_geocoded["source_type"] = "geocoded_playground"
    explicit_geocoded["priority"] = 2

    proxy_childrens_parks = parks_df.loc[
        parks_df[park_cols["kind"]].astype(str).eq("\uc5b4\ub9b0\uc774\uacf5\uc6d0")
        | parks_df[park_cols["facility"]].astype(str).eq("\uc5b4\ub9b0\uc774\uacf5\uc6d0"),
        [park_cols["name"], park_cols["gu"], park_cols["lat"], park_cols["lng"]],
    ].copy()
    proxy_childrens_parks.columns = ["name", "gu", "lat", "lng"]
    proxy_childrens_parks["source_type"] = "childrens_park_proxy"
    proxy_childrens_parks["priority"] = 1

    combined = pd.concat(
        [explicit_public, explicit_geocoded, proxy_childrens_parks],
        ignore_index=True,
    )
    combined = combined.dropna(subset=["lat", "lng"])
    combined["lat"] = pd.to_numeric(combined["lat"], errors="coerce")
    combined["lng"] = pd.to_numeric(combined["lng"], errors="coerce")
    combined = combined.dropna(subset=["lat", "lng"])
    combined = combined.drop_duplicates(subset=["name", "lat", "lng", "source_type"])
    combined = _dedupe_points(combined, "lat", "lng", "priority", radius_m=40.0)
    return combined


def build_distance_map(
    graph: nx.MultiDiGraph,
    undirected: nx.MultiGraph,
    source_df: pd.DataFrame,
    lat_col: str,
    lng_col: str,
) -> dict[int, float]:
    valid = source_df.dropna(subset=[lat_col, lng_col])
    source_nodes = {
        int(ox.distance.nearest_nodes(graph, float(row[lng_col]), float(row[lat_col])))
        for _, row in valid.iterrows()
    }
    return nx.multi_source_dijkstra_path_length(undirected, source_nodes, weight="length")


def main() -> None:
    graph = ox.load_graphml(GRAPH_PATH)
    undirected = ox.convert.to_undirected(graph)

    candidate_gdf = gpd.read_file(CANDIDATE_GEOJSON_PATH)
    candidate_df = pd.read_csv(CANDIDATE_CSV_PATH, encoding="utf-8-sig")
    forecast_df = pd.read_csv(SCHOOL_FORECAST_PATH, encoding="utf-8-sig")
    parks_df = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    playground_df = pd.read_csv(PLAYGROUNDS_PATH, encoding="utf-8-sig")
    playground_source_df = build_playground_source(playground_df, parks_df)

    school_name_col = forecast_df.columns[1]
    forecast_2029_col = forecast_df.columns[4]
    forecast_2031_col = forecast_df.columns[5]
    name_to_2029 = dict(zip(forecast_df[school_name_col], forecast_df[forecast_2029_col]))
    name_to_2031 = dict(zip(forecast_df[school_name_col], forecast_df[forecast_2031_col]))

    park_dist_map = build_distance_map(graph, undirected, parks_df, parks_df.columns[3], parks_df.columns[4])
    pg_dist_map = build_distance_map(graph, undirected, playground_source_df, "lat", "lng")

    corrected_rows: list[dict[str, Any]] = []
    for _, row in candidate_gdf.iterrows():
        linked_schools = parse_linked_schools(row.get("linked_schools"))
        corrected_2029 = int(round(sum(float(name_to_2029.get(name, 0)) for name in linked_schools)))
        corrected_2031 = int(round(sum(float(name_to_2031.get(name, 0)) for name in linked_schools)))

        candidate_node = int(ox.distance.nearest_nodes(graph, float(row["cx"]), float(row["cy"])))
        corrected_rows.append(
            {
                "grid_id": row["grid_id"],
                "linked_schools_norm": linked_schools,
                "original_forecast_2029": row.get("forecast_2029"),
                "original_forecast_2031": row.get("forecast_2031"),
                "original_xgb_predicted_2029": row.get("xgb_predicted_2029"),
                "original_xgb_predicted_2031": row.get("xgb_predicted_2031"),
                "forecast_2029": corrected_2029,
                "forecast_2031": corrected_2031,
                "xgb_predicted_2029": corrected_2029,
                "xgb_predicted_2031": corrected_2031,
                "nearest_park_dist": round(float(park_dist_map.get(candidate_node, 9999.0)), 1),
                "nearest_pg_dist": round(float(pg_dist_map.get(candidate_node, 9999.0)), 1),
            }
        )

    corrected_df = pd.DataFrame(corrected_rows)

    for frame in (candidate_gdf, candidate_df):
        frame["linked_schools"] = frame["linked_schools"].apply(parse_linked_schools)
        frame.drop(
            columns=[
                "linked_schools_norm",
                "original_forecast_2029",
                "original_forecast_2031",
                "original_xgb_predicted_2029",
                "original_xgb_predicted_2031",
                "nearest_park_dist",
                "nearest_pg_dist",
            ],
            inplace=True,
            errors="ignore",
        )

    candidate_gdf = candidate_gdf.merge(corrected_df, on="grid_id", how="left")
    candidate_df = candidate_df.drop(columns=["linked_schools"], errors="ignore").merge(
        corrected_df,
        on="grid_id",
        how="left",
    )

    candidate_gdf["linked_schools"] = candidate_gdf["linked_schools_norm"]
    candidate_df["linked_schools"] = candidate_df["linked_schools_norm"]
    candidate_gdf.drop(columns=["linked_schools_norm"], inplace=True, errors="ignore")
    candidate_df.drop(columns=["linked_schools_norm"], inplace=True, errors="ignore")

    candidate_gdf.to_file(CANDIDATE_GEOJSON_PATH, driver="GeoJSON")
    candidate_df.to_csv(CANDIDATE_CSV_PATH, index=False, encoding="utf-8-sig")

    print(
        json.dumps(
            {
                "candidates": int(len(candidate_gdf)),
                "forecast_2029_min": int(candidate_gdf["forecast_2029"].min()),
                "forecast_2029_max": int(candidate_gdf["forecast_2029"].max()),
                "nearest_park_dist_avg": round(float(candidate_gdf["nearest_park_dist"].mean()), 1),
                "nearest_pg_dist_avg": round(float(candidate_gdf["nearest_pg_dist"].mean()), 1),
                "playground_source_count": int(len(playground_source_df)),
                "playground_source_breakdown": {
                    str(key): int(value)
                    for key, value in playground_source_df["source_type"].value_counts().items()
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
