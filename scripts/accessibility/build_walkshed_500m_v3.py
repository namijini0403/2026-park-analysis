# -*- coding: utf-8 -*-
"""
학교별 도보 500m 도달권(walkshed) v3 — 정확 엣지 절단(exact edge trimming) 방식

기존 v2(OSMnx ego_graph + 엣지 25m 버퍼)의 한계
  1) 노드 기준 컷오프: 두 끝 노드가 모두 500m 안일 때만 엣지를 포함 → 500m 경계에 걸친 도로의
     도달 가능한 앞부분이 통째로 빠지거나(과소), 긴 단순화 엣지가 통째로 들어감(과대).
  2) 학교 중심점을 최근접 '노드'로 스냅 → 캠퍼스 중심~도로까지의 오프셋이 무시됨.
  3) 도로선 25m 버퍼 합집합 → 가시(tendril)형 폴리곤, 블록 내부 구멍, 분리 조각 중 최대 조각만 채택.

v3 방식
  - 학교 점을 최근접 '엣지'에 투영하고, 투영점까지의 직선거리 + 엣지 양끝까지의 선형거리를
    초기 비용으로 넣은 가상 출발 노드에서 다익스트라(cutoff=500m).
  - 각 엣지에 대해 도달 가능한 '부분'만 shapely substring으로 잘라 수집
    (전체 도달 조건: (d_u + d_v + len)/2 <= 500).
  - 부분 엣지 버퍼(BUFFER_M) 합집합 → 블록 내부 소구멍(HOLE_FILL_M2 이하) 채움 → 간소화.
    분리 조각은 모두 유지(모두 네트워크 거리 500m 이내이므로).
  - 결과는 500m+BUFFER_M 원으로 클립.
  - 기존 v2(OSMnx)·Valhalla 결과와 면적 비교표 출력.

입력
  --graph   OSMnx graphml (network_type=walk, retain_all=True)
  --schools schools.csv (학교ID, 학교명, 위도, 경도, 소재지도로명주소)
  --old-iso 기존 v2 geojson (비교용, 선택)
  --valhalla Valhalla geojson (비교용, 선택)
출력
  --out     geojson (EPSG:4326)
  --report  csv (학교별 면적·비율·비교)
"""
import argparse
import json
import math
import os
import sys
import time

sys.stdout.reconfigure(encoding="utf-8")

import geopandas as gpd
import networkx as nx
import numpy as np
import osmnx as ox
import pandas as pd
from shapely.geometry import LineString, Point, Polygon, MultiPolygon
from shapely.ops import substring, unary_union

CRS_METRIC = "EPSG:5179"
WALK_DIST = 500.0
BUFFER_M = 35.0          # 부분 엣지 버퍼 (보도 + 도로변 건물 전면부)
HOLE_FILL_M2 = 20000.0   # 이 면적 이하의 내부 구멍(블록 내부)은 채움
SIMPLIFY_M = 2.0
MIN_COMPONENT_NODES = 30  # 이보다 작은 고립 컴포넌트는 스냅 대상에서 제외
VIRTUAL = "__school_origin__"


def edge_linestring(G, u, v, data):
    """엣지 geometry를 u→v 방향의 LineString으로 반환."""
    geom = data.get("geometry")
    if geom is None:
        geom = LineString([(G.nodes[u]["x"], G.nodes[u]["y"]), (G.nodes[v]["x"], G.nodes[v]["y"])])
    ux, uy = G.nodes[u]["x"], G.nodes[u]["y"]
    first = geom.coords[0]
    last = geom.coords[-1]
    if (first[0] - ux) ** 2 + (first[1] - uy) ** 2 > (last[0] - ux) ** 2 + (last[1] - uy) ** 2:
        geom = LineString(list(geom.coords)[::-1])
    return geom


def fill_small_holes(poly, max_area):
    if poly.geom_type == "Polygon":
        holes = [h for h in poly.interiors if Polygon(h).area > max_area]
        return Polygon(poly.exterior, holes)
    if poly.geom_type == "MultiPolygon":
        return MultiPolygon([fill_small_holes(p, max_area) for p in poly.geoms])
    return poly


def build_walkshed(G, edges_gdf, school_pt, nearest_edge):
    """school_pt: shapely Point(metric). nearest_edge: (u, v, key). 반환 (polygon, stats)."""
    u, v, k = nearest_edge
    data = G.get_edge_data(u, v, k)
    line = edge_linestring(G, u, v, data)
    proj = line.project(school_pt)            # u로부터 투영점까지 선형거리
    proj_pt = line.interpolate(proj)
    offset = school_pt.distance(proj_pt)     # 캠퍼스 중심 → 도로까지 직선 오프셋
    len_uv = line.length
    d_u0 = offset + proj
    d_v0 = offset + (len_uv - proj)

    # 가상 출발 노드
    G.add_node(VIRTUAL, x=school_pt.x, y=school_pt.y)
    G.add_edge(VIRTUAL, u, length=d_u0)
    G.add_edge(VIRTUAL, v, length=d_v0)
    try:
        dist = nx.single_source_dijkstra_path_length(G, VIRTUAL, cutoff=WALK_DIST, weight="length")
    finally:
        G.remove_node(VIRTUAL)
    dist.pop(VIRTUAL, None)

    pieces = []
    total_len = 0.0
    # 출발 엣지 자체: 투영점에서 양방향으로
    reach_u = max(0.0, WALK_DIST - offset)
    seg_a = substring(line, max(0.0, proj - reach_u), proj)
    seg_b = substring(line, proj, min(len_uv, proj + reach_u))
    for s in (seg_a, seg_b):
        if s.length > 0:
            pieces.append(s)
            total_len += s.length

    reached = set(dist.keys())
    if reached:
        sub = edges_gdf[edges_gdf.index.get_level_values("u").isin(reached) | edges_gdf.index.get_level_values("v").isin(reached)]
        for (eu, ev, ek), row in sub.iterrows():
            if (eu, ev, ek) == (u, v, k) or (ev, eu, ek) == (u, v, k):
                continue
            du = dist.get(eu, math.inf)
            dv = dist.get(ev, math.inf)
            geom = row.geometry
            # 방향 정렬
            ux, uy = G.nodes[eu]["x"], G.nodes[eu]["y"]
            c0, c1 = geom.coords[0], geom.coords[-1]
            if (c0[0] - ux) ** 2 + (c0[1] - uy) ** 2 > (c1[0] - ux) ** 2 + (c1[1] - uy) ** 2:
                geom = LineString(list(geom.coords)[::-1])
            L = geom.length
            if L <= 0:
                continue
            if du < math.inf and dv < math.inf and (du + dv + L) / 2.0 <= WALK_DIST:
                pieces.append(geom)
                total_len += L
                continue
            if du < WALK_DIST:
                a = min(L, WALK_DIST - du)
                if a > 0:
                    pieces.append(substring(geom, 0, a))
                    total_len += a
            if dv < WALK_DIST:
                b = min(L, WALK_DIST - dv)
                if b > 0:
                    pieces.append(substring(geom, L - b, L))
                    total_len += b

    if not pieces:
        poly = school_pt.buffer(WALK_DIST)
        method = "circle_fallback"
    else:
        merged = unary_union([p.buffer(BUFFER_M, cap_style="round", join_style="round") for p in pieces])
        merged = fill_small_holes(merged, HOLE_FILL_M2)
        merged = merged.buffer(0)
        clip = school_pt.buffer(WALK_DIST + BUFFER_M)
        poly = merged.intersection(clip).simplify(SIMPLIFY_M, preserve_topology=True)
        method = "exact_edge_trim_v3"

    stats = {
        "method": method,
        "offset_m": round(offset, 1),
        "reach_nodes": len(reached),
        "reach_edge_len_m": round(total_len, 1),
        "n_parts": len(poly.geoms) if poly.geom_type == "MultiPolygon" else 1,
    }
    return poly, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", required=True)
    ap.add_argument("--schools", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--report", required=True)
    ap.add_argument("--old-iso", default=None)
    ap.add_argument("--valhalla", default=None)
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    t0 = time.time()
    print("그래프 로드:", args.graph)
    G = ox.load_graphml(args.graph)
    G = ox.project_graph(G, to_crs=CRS_METRIC)
    G = ox.convert.to_undirected(G)
    # retain_all=True 그래프에는 학교 부지 내부의 고립된 소규모 보행로 조각이 남아 있어
    # 최근접 엣지 스냅이 그 조각에 걸리면 도달권이 극단적으로 작아진다.
    # → 노드 수 MIN_COMPONENT_NODES 미만의 고립 컴포넌트는 제거(섬 지역 네트워크는 충분히 크므로 유지).
    comps = [c for c in nx.connected_components(G) if len(c) >= MIN_COMPONENT_NODES]
    keep = set().union(*comps) if comps else set()
    dropped = G.number_of_nodes() - len(keep)
    G = G.subgraph(keep).copy()
    print(f"  노드 {G.number_of_nodes():,} 엣지 {G.number_of_edges():,}  (고립 소컴포넌트 노드 {dropped:,}개 제거, {time.time()-t0:.0f}s)")
    _, edges_gdf = ox.graph_to_gdfs(G)
    # 정렬된 geometry 보장을 위해 geometry 없는 엣지도 gdf에 직선으로 존재함

    schools = pd.read_csv(args.schools, encoding="utf-8-sig")
    if args.limit:
        schools = schools.head(args.limit)
    gs = gpd.GeoDataFrame(schools, geometry=gpd.points_from_xy(schools["경도"], schools["위도"]), crs="EPSG:4326").to_crs(CRS_METRIC)

    print("최근접 엣지 탐색...")
    ne = ox.distance.nearest_edges(G, X=gs.geometry.x.tolist(), Y=gs.geometry.y.tolist())

    old_area = {}
    if args.old_iso and os.path.exists(args.old_iso):
        old = gpd.read_file(args.old_iso).to_crs(CRS_METRIC)
        idcol = [c for c in old.columns if "ID" in c or "학교ID" in c][0]
        old_area = dict(zip(old[idcol], old.geometry.area))
    val_area = {}
    if args.valhalla and os.path.exists(args.valhalla):
        val = gpd.read_file(args.valhalla).to_crs(CRS_METRIC)
        idcol = [c for c in val.columns if "ID" in c or "학교ID" in c][0]
        val_area = dict(zip(val[idcol], val.geometry.area))

    circle = math.pi * WALK_DIST ** 2
    records, rows = [], []
    for i, (idx, row) in enumerate(gs.iterrows()):
        poly, st = build_walkshed(G, edges_gdf, row.geometry, tuple(ne[i]))
        sid = row["학교ID"]
        area = poly.area
        records.append({"학교ID": sid, "학교명": row["학교명"], **st, "area_m2": round(area), "area_ratio_to_circle": round(area / circle, 4), "geometry": poly})
        rows.append({
            "학교ID": sid, "학교명": row["학교명"], **st,
            "v3_area_m2": round(area), "v3_ratio": round(area / circle, 4),
            "v2_osmnx_area_m2": round(old_area.get(sid, float("nan"))),
            "valhalla_area_m2": round(val_area.get(sid, float("nan"))),
        })
        if (i + 1) % 25 == 0 or i + 1 == len(gs):
            print(f"  [{i+1}/{len(gs)}] {row['학교명']} area={area:,.0f} ratio={area/circle:.2f} offset={st['offset_m']}m parts={st['n_parts']}")

    out = gpd.GeoDataFrame(records, crs=CRS_METRIC).to_crs("EPSG:4326")
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    out.to_file(args.out, driver="GeoJSON")
    rep = pd.DataFrame(rows)
    rep["v3_vs_v2"] = (rep["v3_area_m2"] / rep["v2_osmnx_area_m2"]).round(3)
    rep["v3_vs_valhalla"] = (rep["v3_area_m2"] / rep["valhalla_area_m2"]).round(3)
    rep.to_csv(args.report, index=False, encoding="utf-8-sig")
    print("\n저장:", args.out, "/", args.report)
    print(f"면적비(원 대비) 평균 {rep['v3_ratio'].mean():.3f} 최소 {rep['v3_ratio'].min():.3f} 최대 {rep['v3_ratio'].max():.3f}")
    if old_area:
        print(f"v3/v2 중앙값 {rep['v3_vs_v2'].median():.3f}")
    if val_area:
        print(f"v3/valhalla 중앙값 {rep['v3_vs_valhalla'].median():.3f}")
    print(f"원 대체 fallback: {(rep['method']=='circle_fallback').sum()}개, 총 {time.time()-t0:.0f}s")


if __name__ == "__main__":
    main()
