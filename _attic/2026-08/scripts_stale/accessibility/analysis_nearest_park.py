# -*- coding: utf-8 -*-
"""
학교별 최근접 공원 최단 도보 거리 계산

입력:
- data_processed/incheon_walk_graph.graphml
- data_processed/schools.csv
- data_processed/parks.csv

출력:
- data_processed/school_nearest_park.csv
- data_processed/school_priority.csv (nearest_park_dist_m 컬럼 갱신)
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

import networkx as nx
import osmnx as ox
import pandas as pd
import geopandas as gpd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

GRAPHML_PATH = DATA / "incheon_walk_graph_v2.graphml"
SCHOOLS_PATH = DATA / "schools.csv"
PARKS_PATH = DATA / "parks.csv"
NEAREST_OUT = DATA / "school_nearest_park.csv"
PRIORITY_PATH = DATA / "school_priority.csv"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"


def build_points(df: pd.DataFrame, x_col: str, y_col: str) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df[x_col], df[y_col]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)


def main() -> None:
    print("학교별 최근접 공원 도보 거리 계산 시작")

    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")

    gdf_schools = build_points(schools, "경도", "위도")
    gdf_parks = build_points(parks, "경도", "위도")

    print(f"학교 수: {len(gdf_schools)}")
    print(f"공원 수: {len(gdf_parks)}")

    print("그래프 로드 및 투영 중...")
    graph = ox.load_graphml(GRAPHML_PATH)
    graph_proj = ox.project_graph(graph, to_crs=CRS_METRIC)
    graph_proj = ox.convert.to_undirected(graph_proj)

    print(
        f"그래프 노드/엣지: {graph_proj.number_of_nodes():,} / {graph_proj.number_of_edges():,}"
    )

    print("학교/공원 nearest node snap 중...")
    gdf_schools["nearest_node"] = ox.distance.nearest_nodes(
        graph_proj,
        X=gdf_schools.geometry.x.to_list(),
        Y=gdf_schools.geometry.y.to_list(),
    )
    gdf_parks["nearest_node"] = ox.distance.nearest_nodes(
        graph_proj,
        X=gdf_parks.geometry.x.to_list(),
        Y=gdf_parks.geometry.y.to_list(),
    )

    park_nodes = defaultdict(list)
    for row in gdf_parks.itertuples(index=False):
        park_nodes[row.nearest_node].append(row.공원명)

    park_node_set = set(park_nodes.keys())
    records: list[dict[str, object]] = []

    for idx, row in enumerate(gdf_schools.itertuples(index=False), start=1):
        distances = nx.single_source_dijkstra_path_length(
            graph_proj,
            row.nearest_node,
            weight="length",
        )

        best_node = None
        best_dist = None
        for node, dist in distances.items():
            if node not in park_node_set:
                continue
            if best_dist is None or dist < best_dist:
                best_node = node
                best_dist = dist

        nearest_name = ""
        nearest_dist = None
        if best_node is not None:
            candidate_names = sorted(park_nodes[best_node])
            nearest_name = candidate_names[0]
            nearest_dist = round(float(best_dist), 1)

        records.append(
            {
                "학교ID": row.학교ID,
                "학교명": row.학교명,
                "nearest_park_name": nearest_name,
                "nearest_park_dist_m": nearest_dist,
            }
        )

        if idx % 25 == 0 or idx == len(gdf_schools):
            print(f"[{idx}/{len(gdf_schools)}] {row.학교명}")

    nearest_df = pd.DataFrame(records)
    nearest_df.to_csv(NEAREST_OUT, index=False, encoding="utf-8-sig")
    print(f"저장 완료: {NEAREST_OUT}")

    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    priority = priority.drop(columns=["nearest_park_dist_m"], errors="ignore")
    priority = priority.merge(
        nearest_df[["학교ID", "nearest_park_dist_m"]],
        on="학교ID",
        how="left",
    )
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")
    print(f"갱신 완료: {PRIORITY_PATH}")

    print(
        nearest_df[["nearest_park_dist_m"]]
        .describe()
        .to_string()
    )


if __name__ == "__main__":
    main()
