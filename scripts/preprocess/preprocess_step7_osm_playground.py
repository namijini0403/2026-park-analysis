# -*- coding: utf-8 -*-
"""
STEP 1. OSM에서 인천 놀이터 수집 (amenity/leisure = playground)
STEP 2. 기존 parks.csv와 50m 중복 제거
STEP 3. parks.csv append (백업: parks_backup3.csv)
"""
import sys, os, warnings
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import geopandas as gpd
import osmnx as ox
import numpy as np

OUT      = r"c:\2026_data_analysis_park\data\processed"
PARKS_CSV  = f"{OUT}/parks.csv"
BACKUP_CSV = f"{OUT}/parks_backup3.csv"
SCHOOLS_CSV = f"{OUT}/schools.csv"

CRS = "EPSG:5179"
LAT_MIN, LAT_MAX = 37.2, 37.8
LON_MIN, LON_MAX = 126.3, 127.0
DIST_THRESHOLD = 50  # m

PLACE = "Incheon, South Korea"

# ─────────────────────────────────────────────────────────────────────────────
# 보조: schools.csv 기반 gu 매핑 (nearest school gu)
# ─────────────────────────────────────────────────────────────────────────────
schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
gdf_schools = gpd.GeoDataFrame(
    schools,
    geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

def assign_gu_by_nearest_school(gdf_pts):
    """각 점에 대해 가장 가까운 학교의 gu 반환"""
    joined = gpd.sjoin_nearest(
        gdf_pts[["geometry"]],
        gdf_schools[["geometry", "소재지도로명주소"]],
        how="left",
        distance_col="_dist",
    )
    joined = joined[~joined.index.duplicated(keep="first")]
    # 소재지도로명주소에서 구명 추출 (예: "인천광역시 미추홀구 ...")
    def extract_gu(addr):
        if pd.isna(addr):
            return None
        parts = str(addr).split()
        for p in parts:
            if p.endswith("구") or p.endswith("군"):
                return p
        return None
    return joined["소재지도로명주소"].apply(extract_gu)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1. OSM 놀이터 수집
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1. OSM 놀이터 수집")
print("=" * 60)

gdfs_raw = []
for key, val in [("amenity", "playground"), ("leisure", "playground")]:
    print(f"  수집 중: {key}={val} ...")
    try:
        gdf = ox.features_from_place(PLACE, tags={key: val})
        print(f"    → {len(gdf)}건 수집")
        gdfs_raw.append(gdf)
    except Exception as e:
        print(f"    → 0건 (사유: {e})")

if not gdfs_raw:
    print("OSM 수집 실패 — 스크립트 종료")
    sys.exit(1)

gdf_osm = pd.concat(gdfs_raw)
gdf_osm = gdf_osm[~gdf_osm.index.duplicated(keep="first")]
print(f"\n합계 (중복 인덱스 제거): {len(gdf_osm)}건")
print(f"geometry 타입: {gdf_osm.geometry.geom_type.value_counts().to_dict()}")

# ─────────────────────────────────────────────────────────────────────────────
# 중심점 추출
# ─────────────────────────────────────────────────────────────────────────────
gdf_osm = gdf_osm.to_crs("EPSG:4326")
gdf_osm["_centroid"] = gdf_osm.geometry.centroid   # Point or Polygon → centroid
gdf_pts = gdf_osm.copy()
gdf_pts["geometry"] = gdf_pts["_centroid"]
gdf_pts = gdf_pts[gdf_pts.geometry.geom_type == "Point"].copy()

# 위도/경도
gdf_pts["경도"] = gdf_pts.geometry.x
gdf_pts["위도"] = gdf_pts.geometry.y

# 인천 범위 필터
gdf_pts = gdf_pts[
    gdf_pts["위도"].between(LAT_MIN, LAT_MAX) &
    gdf_pts["경도"].between(LON_MIN, LON_MAX)
].copy()
print(f"인천 범위 내 중심점: {len(gdf_pts)}건")

# 시설명
name_col = "name" if "name" in gdf_pts.columns else None
if name_col:
    gdf_pts["시설명"] = gdf_pts["name"].fillna("OSM놀이터").astype(str)
else:
    gdf_pts["시설명"] = "OSM놀이터"

# gu 매핑: addr:suburb / addr:quarter 우선, 없으면 nearest school
gdf_pts_5179 = gdf_pts.to_crs(CRS)
gu_from_school = assign_gu_by_nearest_school(gdf_pts_5179)

def extract_gu_from_tags(row):
    for col in ["addr:suburb", "addr:quarter", "addr:district"]:
        if col in row.index and pd.notna(row[col]):
            val = str(row[col])
            if val.endswith("구") or val.endswith("군"):
                return val
    return None

gdf_pts["gu_tag"] = [extract_gu_from_tags(row) for _, row in gdf_pts.iterrows()]
gu_school_arr = pd.array(gu_from_school.values, dtype=object)
gdf_pts["gu"] = gdf_pts["gu_tag"].where(gdf_pts["gu_tag"].notna(), other=gu_school_arr)
gdf_pts["시설유형"] = "놀이터_OSM"

print(f"\ngu 분포:")
print(gdf_pts["gu"].value_counts().to_string())

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2. 기존 parks.csv와 50m 중복 제거
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 2. 50m 중복 제거")
print("=" * 60)

parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
parks.to_csv(BACKUP_CSV, index=False, encoding="utf-8-sig")
print(f"백업: {BACKUP_CSV} ({len(parks)}행)")

gdf_parks = gpd.GeoDataFrame(
    parks,
    geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

gdf_new = gdf_pts_5179.copy()
gdf_new["시설명"] = gdf_pts["시설명"].values
gdf_new["위도"]   = gdf_pts["위도"].values
gdf_new["경도"]   = gdf_pts["경도"].values
gdf_new["gu"]     = gdf_pts["gu"].values
gdf_new["시설유형"] = "놀이터_OSM"
gdf_new = gdf_new.reset_index(drop=True)

gdf_joined = gpd.sjoin_nearest(
    gdf_new[["시설명","위도","경도","gu","시설유형","geometry"]],
    gdf_parks[["geometry"]],
    how="left",
    distance_col="dist_to_park",
)
gdf_joined = gdf_joined[~gdf_joined.index.duplicated(keep="first")]

duplicates = gdf_joined[gdf_joined["dist_to_park"] <= DIST_THRESHOLD]
standalone = gdf_joined[gdf_joined["dist_to_park"] >  DIST_THRESHOLD]
print(f"50m 이내 중복: {len(duplicates)}건  →  신규 추가 대상: {len(standalone)}건")

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. parks.csv append
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. parks.csv 업데이트")
print("=" * 60)

if len(standalone) > 0:
    existing_pg = parks[parks["관리번호"].astype(str).str.startswith("PLAYGROUND")]
    next_num = len(existing_pg)

    new_rows = standalone[["시설명", "위도", "경도", "gu", "시설유형"]].copy()
    new_rows = new_rows.rename(columns={"시설명": "공원명"})
    new_rows["관리번호"] = [f"OSM-{next_num+i:04d}" for i in range(len(new_rows))]
    new_rows["공원구분"] = "놀이터"
    new_rows["공원면적"] = None
    new_rows = new_rows[parks.columns]

    result = pd.concat([parks, new_rows], ignore_index=True)
else:
    result = parks.copy()

result.to_csv(PARKS_CSV, index=False, encoding="utf-8-sig")
print(f"parks.csv 저장: {len(result)}행  (+{len(standalone)}행 추가)")

print()
print("[gu별 신규 추가 현황]")
if len(standalone) > 0:
    print(standalone["gu"].value_counts().to_string())

print()
print(f"[parks.csv 시설유형 분포]")
print(result["시설유형"].value_counts().to_string())

print()
print("=" * 60)
print(f"완료: OSM 수집 {len(gdf_pts)}건 / 중복 제거 후 신규 {len(standalone)}건 추가 / parks.csv {len(result)}행")
print("=" * 60)
