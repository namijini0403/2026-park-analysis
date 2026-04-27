# -*- coding: utf-8 -*-
"""
STEP 1. 인천 보행 도로망 수집 (OSMnx)
STEP 2. 학교별 직선 500m 버퍼
STEP 3. 학교별 도보 500m 등시선 (isochrone)
"""

import sys, os
sys.stdout.reconfigure(encoding="utf-8")

import osmnx as ox
import networkx as nx
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point
from shapely.ops import unary_union

OUT = r"c:\2026_data_analysis_park\data\processed"
os.makedirs(OUT, exist_ok=True)

GRAPHML_PATH    = os.path.join(OUT, "incheon_walk_graph.graphml")
BUFFER_PATH     = os.path.join(OUT, "school_buffer_500m.geojson")
ISOCHRONE_PATH  = os.path.join(OUT, "school_isochrone_500m.geojson")
SCHOOLS_CSV     = os.path.join(OUT, "schools.csv")

# 분석 CRS: EPSG:5179 (Korean TM, 미터 단위)
CRS_METRIC = "EPSG:5179"
WALK_FILTER = (
    '["highway"~"footway|path|pedestrian|living_street|residential|service|steps"]'
    '["area"!~"yes"]'
    '["foot"!~"no"]'
)

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1. 인천 보행 도로망 수집
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1. OSMnx 인천 보행 도로망 수집")
print("=" * 60)

if os.path.exists(GRAPHML_PATH):
    print(f"  캐시 존재 → 로드: {GRAPHML_PATH}")
    G = ox.load_graphml(GRAPHML_PATH)
else:
    print("  OSM에서 수집 중 (수분 소요)...")
    G = ox.graph_from_place(
        "Incheon, South Korea",
        custom_filter=WALK_FILTER,
        retain_all=False,
        simplify=True,
    )
    ox.save_graphml(G, GRAPHML_PATH)
    print(f"  저장 완료: {GRAPHML_PATH}")

nodes, edges = ox.graph_to_gdfs(G)
print(f"  노드 수: {len(nodes):,}")
print(f"  엣지 수: {len(edges):,}")
print(f"  그래프 CRS: {nodes.crs}")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2. 직선 500m 버퍼
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 2. 학교별 직선 500m 버퍼")
print("=" * 60)

schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
print(f"  학교 수: {len(schools)}")

# 구 이름 추출 (주소에서)
def extract_gu(addr):
    for part in str(addr).split():
        if part.endswith("구") or part.endswith("군"):
            return part
    return "기타"

schools["gu"] = schools["소재지도로명주소"].apply(extract_gu)

# GeoDataFrame 생성 (WGS84)
gdf_schools = gpd.GeoDataFrame(
    schools,
    geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
    crs="EPSG:4326",
)

# 미터 단위 투영으로 변환
gdf_schools_m = gdf_schools.to_crs(CRS_METRIC)

# 500m 버퍼
gdf_buffer = gdf_schools_m.copy()
gdf_buffer["geometry"] = gdf_schools_m.geometry.buffer(500)

# 저장용 컬럼 정리
buffer_out = gdf_buffer[["학교ID", "학교명", "gu", "geometry"]].copy()
buffer_out = buffer_out.to_crs("EPSG:4326")   # GeoJSON은 WGS84
buffer_out.to_file(BUFFER_PATH, driver="GeoJSON")
print(f"  저장 완료: {BUFFER_PATH}")
print(f"  컬럼: {buffer_out.columns.tolist()}")
print(f"  샘플 면적(m²): {gdf_buffer['geometry'].area.iloc[0]:.0f}")  # ~785,398

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. 도보 500m 등시선 (ego_graph 기반)
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. 학교별 도보 500m 등시선")
print("=" * 60)

# 그래프를 EPSG:5179로 투영 (엣지 length가 미터 단위임을 확인)
# OSMnx 그래프 엣지 'length' 속성은 미터 단위 (WGS84 geodesic)
# → ego_graph에서 cutoff=500 (m) 로 직접 사용 가능

# 그래프를 undirected로 변환 (보행자는 양방향)
G_undirected = ox.convert.to_undirected(G)

nodes_gdf, _ = ox.graph_to_gdfs(G_undirected)
nodes_gdf_m = nodes_gdf.to_crs(CRS_METRIC)

WALK_DIST = 500  # 미터

records = []
total = len(gdf_schools)

for i, row in gdf_schools.iterrows():
    school_pt = row.geometry  # WGS84 Point

    # 가장 가까운 그래프 노드 snap
    nearest_node = ox.distance.nearest_nodes(
        G_undirected,
        X=school_pt.x,   # 경도
        Y=school_pt.y,   # 위도
    )

    # 도보 500m 이내 노드 집합 (Dijkstra, weight='length')
    subgraph = nx.ego_graph(
        G_undirected,
        nearest_node,
        radius=WALK_DIST,
        distance="length",
    )

    # 서브그래프 노드 좌표 → convex hull → isochrone polygon
    sub_nodes = nodes_gdf_m.loc[list(subgraph.nodes)]
    if len(sub_nodes) < 3:
        # 노드 수 부족 시 학교 중심 500m 원으로 대체
        pt_m = gdf_schools_m.loc[i, "geometry"]
        poly = pt_m.buffer(500)
    else:
        poly = sub_nodes.geometry.unary_union.convex_hull

    records.append({
        "학교ID":   row["학교ID"],
        "학교명":   row["학교명"],
        "gu":       row["gu"],
        "nearest_node": nearest_node,
        "node_count":   len(subgraph.nodes),
        "geometry": poly,
    })

    if (i % 50 == 0) or (i == total - 1):
        print(f"  [{i+1}/{total}] {row['학교명']} → 노드 {len(subgraph.nodes)}개")

# GeoDataFrame 저장
gdf_iso = gpd.GeoDataFrame(records, crs=CRS_METRIC)
gdf_iso_wgs = gdf_iso.to_crs("EPSG:4326")
gdf_iso_wgs.to_file(ISOCHRONE_PATH, driver="GeoJSON")

print(f"\n  저장 완료: {ISOCHRONE_PATH}")
print(f"  총 {len(gdf_iso)}개 등시선")
print(f"  노드 수 통계:")
print(f"    평균: {gdf_iso['node_count'].mean():.1f}")
print(f"    최소: {gdf_iso['node_count'].min()}")
print(f"    최대: {gdf_iso['node_count'].max()}")

# 면적 비교 (직선 vs 도보)
gdf_iso_m = gdf_iso.copy()
gdf_buffer_m = gdf_buffer[["학교ID", "geometry"]].rename(columns={"geometry": "buf_geom"})
merged = gdf_iso_m.merge(gdf_buffer_m, on="학교ID")

iso_areas = gdf_iso_m["geometry"].area
buf_area  = 500**2 * 3.14159  # ~785,398 m²
print(f"\n  면적 비교:")
print(f"    직선 500m 원 면적: {buf_area:,.0f} m²")
print(f"    도보 등시선 평균:  {iso_areas.mean():,.0f} m²")
print(f"    도보/직선 비율:    {iso_areas.mean()/buf_area:.2%}")

print()
print("=" * 60)
print("전체 완료")
print("=" * 60)
