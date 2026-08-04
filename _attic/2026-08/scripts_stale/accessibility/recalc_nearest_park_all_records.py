from __future__ import annotations

from pathlib import Path

import networkx as nx
import osmnx as ox
import pandas as pd
import geopandas as gpd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

GRAPHML_PATH = DATA / "incheon_walk_graph.graphml"
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


def make_park_label(name: str, lat: float, lon: float) -> str:
    return f"{name}_{lat:.3f}_{lon:.3f}"


def main() -> None:
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")

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
    park_node_set = {record[0] for record in park_records}

    records: list[dict[str, object]] = []

    for idx, row in enumerate(gdf_schools.itertuples(index=False), start=1):
        lengths = nx.single_source_dijkstra_path_length(
            graph_proj,
            row.nearest_node,
            weight="length",
        )

        school_lat = row.geometry.y  # projected coords
        school_lon = row.geometry.x

        best_dist = None
        best_record = None
        for park_node, park_label, park_name, park_lat, park_lon in park_records:
            if park_node not in park_node_set:
                continue
            dist = lengths.get(park_node)
            if dist is None:
                continue
            # same-node collapse: graph returns 0 but school≠park physically
            # fall back to Euclidean distance in projected CRS (EPSG:5179, unit=m)
            if dist == 0 and park_node == row.nearest_node:
                park_geom = gdf_parks[
                    (gdf_parks["위도"].astype(float).round(6) == round(float(park_lat), 6)) &
                    (gdf_parks["경도"].astype(float).round(6) == round(float(park_lon), 6))
                ]
                if not park_geom.empty:
                    px, py = park_geom.geometry.iloc[0].x, park_geom.geometry.iloc[0].y
                    dist = ((school_lon - px) ** 2 + (school_lat - py) ** 2) ** 0.5
                    if dist < 1:  # truly same point, keep 0
                        dist = 0
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
    nearest_df.to_csv(NEAREST_OUT, index=False, encoding="utf-8-sig")

    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    priority = priority.drop(columns=["nearest_park_dist_m"], errors="ignore")
    priority = priority.merge(
        nearest_df[["학교ID", "nearest_park_dist_m"]],
        on="학교ID",
        how="left",
    )
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    changed = int(nearest_df["nearest_park_dist_m"].notna().sum())
    print(f"saved nearest rows: {changed}")


if __name__ == "__main__":
    main()
