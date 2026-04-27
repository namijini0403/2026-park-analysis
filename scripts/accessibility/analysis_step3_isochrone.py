# -*- coding: utf-8 -*-
"""
학교별 도보 500m 등시선 (isochrone) — OSMnx 기반 재작성
변경 이력:
  - network_type='walk' 으로 전환 (기존 footway-only 필터는 일반 보행 가능 도로를 누락시킴)
  - polygon: convex_hull → concave_hull(ratio=0.3) 으로 교체
    (convex_hull은 수로 등 실제 못 가는 영역을 포함하는 과대추정 문제)
  - 그래프 캐시: incheon_walk_graph_v2.graphml 에 저장
  - 출력: data_processed/school_isochrone_500m.geojson (기존 동일 파일 덮어쓰기)
"""

import sys, os
sys.stdout.reconfigure(encoding="utf-8")

import osmnx as ox
import networkx as nx
import geopandas as gpd
import pandas as pd
import shapely

OUT = r"c:\2026_data_analysis_park\data\processed"
GRAPHML_PATH   = os.path.join(OUT, "incheon_walk_graph_v2.graphml")
ISOCHRONE_PATH = os.path.join(OUT, "school_isochrone_500m.geojson")
SCHOOLS_CSV    = os.path.join(OUT, "schools.csv")

CRS_METRIC = "EPSG:5179"
WALK_DIST  = 500   # 미터
# concave_hull ratio: 0 = convex hull, 1 = 가장 좁은 오목 다각형
# 0.3 은 도심 보행 네트워크에서 실제 이동 가능 영역을 잘 근사함
CONCAVE_RATIO = 0.3

print("=" * 60)
print("STEP 3. 학교별 도보 500m 등시선 (OSMnx v2)")
print(f"  network_type: walk  |  polygon: concave_hull(ratio={CONCAVE_RATIO})")
print("=" * 60)

# ── 그래프 로드 / 다운로드 ─────────────────────────────────────────────────
if os.path.exists(GRAPHML_PATH):
    print(f"캐시 로드: {GRAPHML_PATH}")
    G = ox.load_graphml(GRAPHML_PATH)
else:
    print("OSM에서 인천 보행 네트워크 수집 중 (수 분 소요)...")
    print("  network_type='walk' — 일반 도로 + 전용 보행로 모두 포함")
    G = ox.graph_from_place(
        "Incheon, South Korea",
        network_type="walk",
        retain_all=False,
        simplify=True,
    )
    ox.save_graphml(G, GRAPHML_PATH)
    print(f"  저장: {GRAPHML_PATH}")

print(f"  노드: {G.number_of_nodes():,}  엣지: {G.number_of_edges():,}")

# ── 투영 + undirected ──────────────────────────────────────────────────────
G_proj = ox.project_graph(G, to_crs=CRS_METRIC)
G_u    = ox.convert.to_undirected(G_proj)
nodes_gdf, _ = ox.graph_to_gdfs(G_u)
print(f"  투영 완료: {CRS_METRIC}")

# ── 학교 로드 ──────────────────────────────────────────────────────────────
schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")

def extract_gu(addr):
    for part in str(addr).split():
        if part.endswith("구") or part.endswith("군"):
            return part
    return "기타"

schools["gu"] = schools["소재지도로명주소"].apply(extract_gu)

gdf_schools = gpd.GeoDataFrame(
    schools,
    geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
    crs="EPSG:4326",
).to_crs(CRS_METRIC)

# ── nearest_nodes 배치 처리 ────────────────────────────────────────────────
print(f"\nnearest_nodes 배치 처리 ({len(gdf_schools)}개)...")
nearest_nodes = ox.distance.nearest_nodes(
    G_u,
    X=gdf_schools.geometry.x.tolist(),
    Y=gdf_schools.geometry.y.tolist(),
)
print(f"  완료")

# ── 등시선 생성 ────────────────────────────────────────────────────────────
print("\n등시선 생성 중...")
records = []
fallback_count = 0
total = len(gdf_schools)

_, edges_gdf = ox.graph_to_gdfs(G_u)   # 전체 엣지 (CRS_METRIC), index: (u, v, key)

for i, (idx, row) in enumerate(gdf_schools.iterrows()):
    nn = nearest_nodes[i]

    subgraph = nx.ego_graph(
        G_u,
        nn,
        radius=WALK_DIST,
        distance="length",
    )

    # 엣지 기반 polygon: 도달 가능한 모든 도로선에 25m 버퍼 후 union
    # (노드 기반 convex_hull 은 simplified 그래프에서 실제 이동 범위를 심각하게 과소추정)
    reachable_nodes = set(subgraph.nodes())
    sub_edges = edges_gdf.loc[
        edges_gdf.index.get_level_values("u").isin(reachable_nodes) &
        edges_gdf.index.get_level_values("v").isin(reachable_nodes)
    ]

    if not sub_edges.empty:
        poly = sub_edges.geometry.buffer(25).union_all()
        # MultiPolygon → 가장 큰 Polygon 선택
        if poly.geom_type == "MultiPolygon":
            poly = max(poly.geoms, key=lambda g: g.area)
    else:
        # 엣지 없음 → 학교 중심 500m 원
        poly = row.geometry.buffer(WALK_DIST)
        fallback_count += 1

    records.append({
        "학교ID":       row["학교ID"],
        "학교명":       row["학교명"],
        "gu":           row["gu"],
        "nearest_node": nn,
        "node_count":   len(subgraph.nodes()),
        "geometry":     poly,
    })

    if (i + 1) % 50 == 0 or (i + 1) == total:
        print(f"  [{i+1:3d}/{total}] {row['학교명']} — 노드 {len(subgraph.nodes())}개")

print(f"\n  원 대체 fallback: {fallback_count}개")

# ── 저장 ──────────────────────────────────────────────────────────────────
gdf_iso = gpd.GeoDataFrame(records, crs=CRS_METRIC)
gdf_iso_wgs = gdf_iso.to_crs("EPSG:4326")
gdf_iso_wgs.to_file(ISOCHRONE_PATH, driver="GeoJSON")

print(f"\n저장 완료: {ISOCHRONE_PATH}")
print(f"  총 {len(gdf_iso)}개 등시선")

import numpy as np
iso_areas  = gdf_iso.geometry.area
THEORETICAL = np.pi * WALK_DIST ** 2   # ~785,398 m²
ratios = iso_areas / THEORETICAL

print(f"\n[면적 통계]")
print(f"  이론값(500m 원): {THEORETICAL:>12,.0f} m²")
print(f"  평균:            {iso_areas.mean():>12,.0f} m²  ({ratios.mean():.1%})")
print(f"  최소:            {iso_areas.min():>12,.0f} m²  ({ratios.min():.1%})")
print(f"  최대:            {iso_areas.max():>12,.0f} m²  ({ratios.max():.1%})")
print(f"  이론값 40% 미만: {(ratios < 0.4).sum()}개")

print(f"\n[노드 수 통계]")
nc = gdf_iso["node_count"]
print(f"  평균: {nc.mean():.1f}  최소: {nc.min()}  최대: {nc.max()}")

# ── 문제 학교 확인 ─────────────────────────────────────────────────────────
print("\n[문제 학교 확인]")
target = ["인천은송초등학교", "인천송담초등학교", "인천미송초등학교", "인천연수초등학교"]
sub = gdf_iso[gdf_iso["학교명"].isin(target)][["학교명", "node_count", "geometry"]]
sub = sub.copy()
sub["area_m2"] = sub.geometry.area
sub["ratio"] = sub["area_m2"] / THEORETICAL
print(sub[["학교명", "node_count", "area_m2", "ratio"]].to_string(index=False))

print("\n완료")
