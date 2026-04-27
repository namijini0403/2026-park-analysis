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
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    text = str(value or "").strip()
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


def resolve_distance_map(
    graph: nx.MultiDiGraph,
    source_df: pd.DataFrame,
    lat_col: str,
    lng_col: str,
) -> dict[int, float]:
    valid = source_df.dropna(subset=[lat_col, lng_col]).copy()
    source_nodes = {
        int(ox.distance.nearest_nodes(graph, float(row[lng_col]), float(row[lat_col])))
        for _, row in valid.iterrows()
    }
    undirected = ox.convert.to_undirected(graph)
    return nx.multi_source_dijkstra_path_length(undirected, source_nodes, weight="length")


def main() -> None:
    graph = ox.load_graphml(GRAPH_PATH)
    candidate_gdf = gpd.read_file(CANDIDATE_GEOJSON_PATH)
    candidate_df = pd.read_csv(CANDIDATE_CSV_PATH, encoding="utf-8-sig")
    forecast_df = pd.read_csv(SCHOOL_FORECAST_PATH, encoding="utf-8-sig")
    parks_df = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    playground_df = pd.read_csv(PLAYGROUNDS_PATH, encoding="utf-8-sig")

    school_name_col = forecast_df.columns[1]
    forecast_2029_col = forecast_df.columns[4]
    forecast_2031_col = forecast_df.columns[5]
    name_to_2029 = dict(zip(forecast_df[school_name_col], forecast_df[forecast_2029_col]))
    name_to_2031 = dict(zip(forecast_df[school_name_col], forecast_df[forecast_2031_col]))

    park_dist_map = resolve_distance_map(graph, parks_df, "위도", "경도")
    pg_dist_map = resolve_distance_map(graph, playground_df, "위도", "경도")

    corrected_rows: list[dict[str, Any]] = []
    for _, row in candidate_gdf.iterrows():
        linked_schools = parse_linked_schools(row.get("linked_schools"))
        corrected_2029 = int(round(sum(float(name_to_2029.get(name, 0)) for name in linked_schools)))
        corrected_2031 = int(round(sum(float(name_to_2031.get(name, 0)) for name in linked_schools)))

        candidate_node = int(ox.distance.nearest_nodes(graph, float(row["cx"]), float(row["cy"])))
        nearest_park_walk = round(float(park_dist_map.get(candidate_node, 9999.0)), 1)
        nearest_pg_walk = round(float(pg_dist_map.get(candidate_node, 9999.0)), 1)

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
                "nearest_park_dist": nearest_park_walk,
                "nearest_pg_dist": nearest_pg_walk,
            }
        )

    corrected_df = pd.DataFrame(corrected_rows)

    for frame in (candidate_gdf, candidate_df):
      frame["linked_schools"] = frame["linked_schools"].apply(parse_linked_schools)

    for frame in (candidate_gdf, candidate_df):
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
        corrected_df.drop(columns=["linked_schools_norm"]),
        on="grid_id",
        how="left",
    )

    candidate_gdf["linked_schools"] = candidate_gdf["linked_schools_norm"]
    candidate_df["linked_schools"] = corrected_df["linked_schools_norm"]

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
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
