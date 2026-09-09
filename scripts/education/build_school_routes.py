"""OSM walking routes to public park representative points, with explicit snap costs."""
import json
from pathlib import Path

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
from shapely.geometry import Point

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data_processed/education"


def main():
    graph = ox.project_graph(ox.load_graphml(ROOT.parent / "_cache/incheon_walk_graph_v3.graphml"), to_crs=5179)
    graph = ox.convert.to_undirected(graph)
    keep = set().union(*(c for c in nx.connected_components(graph) if len(c) >= 30))
    graph = graph.subgraph(keep).copy()
    parks = pd.read_csv(ROOT / "data_processed/parks_with_function_class.csv")
    parks = parks[(parks["시설유형"] != "놀이터") & parks["위도"].notna() & parks["경도"].notna()].copy().reset_index(drop=True)
    schools = pd.read_csv(OUT / "new_school_coords.csv")
    def snap(frame):
        points = gpd.GeoSeries(gpd.points_from_xy(frame["경도"], frame["위도"]), crs=4326).to_crs(5179)
        nodes = ox.distance.nearest_nodes(graph, X=points.x, Y=points.y)
        offsets = [point.distance(Point(graph.nodes[n]["x"], graph.nodes[n]["y"])) for point,n in zip(points,nodes)]
        return points, nodes, offsets
    pp, pn, po = snap(parks)
    sp, sn, so = snap(schools)
    # One reverse multi-park search replaces one whole-network search per school.
    # The virtual origin's edge costs preserve each park's representative-point offset.
    virtual = "__education_parks__"
    park_by_node = {}
    for j, node in enumerate(pn):
        if po[j] <= 150 and (node not in park_by_node or po[j] < po[park_by_node[node]]):
            park_by_node[node] = j
    for node, j in park_by_node.items():
        graph.add_edge(virtual, node, length=float(po[j]))
    distances, paths = nx.single_source_dijkstra(graph, virtual, cutoff=15000, weight="length")
    output = {}
    for i, school in schools.iterrows():
        result = {"method": "OSM 보행망·대표점 최근접 노드·양끝 연결거리 포함", "origin_snap_m": round(so[i],1),
                  "scope": "15km 이내 탐색, 양끝 보행망 연결거리 각각 150m 이하", "status": "no_valid_route_within_search_scope"}
        if sn[i] in distances and so[i] <= 150:
            distance = distances[sn[i]] + so[i]
            j = park_by_node[paths[sn[i]][1]]
            path = list(reversed(paths[sn[i]][1:]))
            straight = sp.iloc[i].distance(pp.iloc[j])
            route_points = [sp.iloc[i]] + [Point(graph.nodes[n]["x"],graph.nodes[n]["y"]) for n in path] + [pp.iloc[j]]
            ll = gpd.GeoSeries(route_points, crs=5179).to_crs(4326)
            result.update(status="available", park_id=str(parks.iloc[j]["관리번호"]), park_name=parks.iloc[j]["공원명"],
                          route_distance_m=round(distance,1), straight_distance_m=round(straight,1),
                          detour_ratio=round(distance/straight,3) if straight else None, destination_snap_m=round(po[j],1),
                          route_coordinates=[[p.x,p.y] for p in ll],
                          barrier_status="횡단보도·신호·통행허용 현장 확인 필요", destination_basis="공원 대표점; 출입구 아님")
        output[school["학교ID"]] = result
        if (i+1)%100==0: print(f"Routes {i+1}/{len(schools)}",flush=True)
    (OUT / "school_routes.json").write_text(json.dumps(output,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    print(f"Routes complete: {len(output)}",flush=True)


if __name__ == "__main__":
    main()
