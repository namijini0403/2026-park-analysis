# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
OUTPUT = ROOT / "output"

GRAPHML_PATH = DATA / "incheon_walk_graph.graphml"
SCHOOLS_PATH = DATA / "schools.csv"
PARKS_PATH = DATA / "parks.csv"
NEAREST_OUT = DATA / "school_nearest_park.csv"
PRIORITY_PATH = DATA / "school_priority.csv"
SEALED_JSON = OUTPUT / "sealed_nearest_park_dist.json"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"


def build_points(df: pd.DataFrame, x_col: str, y_col: str) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df[x_col], df[y_col]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)


def make_park_label(name: str, lat: float, lon: float) -> str:
    return f"{name}_{lat:.3f}_{lon:.3f}"


def load_sealed_ids() -> set[str]:
    sealed = json.loads(SEALED_JSON.read_text(encoding="utf-8"))
    return set(sealed.keys())


def main() -> None:
    sealed_ids = load_sealed_ids()

    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    old_nearest = pd.read_csv(NEAREST_OUT, encoding="utf-8-sig")

    parks = parks.loc[parks["시설유형"] != "놀이터"].copy()
    if parks.empty:
        raise ValueError("시설유형 != '놀이터' 조건을 적용한 뒤 공원 데이터가 비었습니다.")

    gdf_schools = build_points(schools, "경도", "위도")
    gdf_parks = build_points(parks, "경도", "위도")
    gdf_parks["nearest_park_name"] = gdf_parks.apply(
        lambda row: make_park_label(str(row["공원명"]), float(row["위도"]), float(row["경도"])),
        axis=1,
    )

    graph = ox.load_graphml(GRAPHML_PATH)
    graph_proj = ox.project_graph(graph, to_crs=CRS_METRIC)
    graph_proj = ox.convert.to_undirected(graph_proj)

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

    park_records = list(
        gdf_parks[["nearest_node", "nearest_park_name", "공원명", "위도", "경도"]].itertuples(index=False, name=None)
    )

    records: list[dict[str, object]] = []
    for idx, row in enumerate(gdf_schools.itertuples(index=False), start=1):
        lengths = nx.single_source_dijkstra_path_length(graph_proj, row.nearest_node, weight="length")

        best_dist = None
        best_record = None
        for park_node, park_label, park_name, park_lat, park_lon in park_records:
            dist = lengths.get(park_node)
            if dist is None:
                continue
            if best_dist is None or dist < best_dist:
                best_dist = dist
                best_record = (park_label, park_name, park_lat, park_lon)

        records.append(
            {
                "학교ID": row.학교ID,
                "학교명": row.학교명,
                "nearest_park_name": best_record[0] if best_record else "",
                "nearest_park_dist_m": round(float(best_dist), 1) if best_dist is not None else None,
                "nearest_park_lat": float(best_record[2]) if best_record else None,
                "nearest_park_lon": float(best_record[3]) if best_record else None,
            }
        )

        if idx % 100 == 0 or idx == len(gdf_schools):
            print(f"[{idx}/{len(gdf_schools)}] processed")

    nearest_df = pd.DataFrame(records)

    # Preserve all existing sealed rows verbatim.
    if sealed_ids:
        sealed_rows = old_nearest.loc[old_nearest["학교ID"].isin(sealed_ids)].copy()
        nearest_df = nearest_df.loc[~nearest_df["학교ID"].isin(sealed_ids)].copy()
        nearest_df = pd.concat([nearest_df, sealed_rows], ignore_index=True)

    nearest_df = nearest_df.sort_values("학교ID").reset_index(drop=True)
    nearest_df.to_csv(NEAREST_OUT, index=False, encoding="utf-8-sig")

    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    nearest_dist = nearest_df[["학교ID", "nearest_park_dist_m"]].drop_duplicates("학교ID")
    priority = priority.drop(columns=["nearest_park_dist_m"], errors="ignore")
    priority = priority.merge(nearest_dist, on="학교ID", how="left")

    # Restore sealed distances after merge so manual/null seals survive.
    if sealed_ids:
        old_priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
        sealed_priority = old_priority.loc[old_priority["학교ID"].isin(sealed_ids), ["학교ID", "nearest_park_dist_m"]]
        for row in sealed_priority.itertuples(index=False):
            priority.loc[priority["학교ID"] == row.학교ID, "nearest_park_dist_m"] = row.nearest_park_dist_m

    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    print(f"saved nearest rows: {len(nearest_df)}")
    print(f"parks used (시설유형 != 놀이터): {len(parks)}")
    print(f"sealed rows preserved: {len(sealed_ids)}")


if __name__ == "__main__":
    main()
