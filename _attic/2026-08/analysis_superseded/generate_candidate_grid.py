import geopandas as gpd
import pandas as pd
import numpy as np
from shapely.geometry import box, Point
from shapely.ops import unary_union

BASE = "c:/2026_data_analysis_park/"

# 1. case1/2/3 학교 isochrone union (후보지 생성 생활권 마스크)
iso = gpd.read_file(BASE + "data_processed/school_isochrone_500m.geojson")
priority = pd.read_csv(BASE + "data_processed/school_priority_case_system_20260411.csv")

case123_names = priority[priority["case_type"].isin([1.0, 2.0, 3.0])]["학교명"].tolist()
iso_case123 = iso[iso["학교명"].isin(case123_names)].copy()
mask = unary_union(iso_case123.geometry)
print(f"case1/2/3 isochrone union 완료: {len(iso_case123)}개")

# 2. 마스크 bbox 기준 250m 격자 생성 (WGS84 근사, 약 0.00225도 = 250m)
minx, miny, maxx, maxy = mask.bounds
step = 0.00225  # 위도 기준 250m 근사

xs = np.arange(minx, maxx, step)
ys = np.arange(miny, maxy, step)

cells = []
for x in xs:
    for y in ys:
        cell = box(x, y, x+step, y+step)
        cx, cy = x + step/2, y + step/2
        cells.append({"geometry": cell, "cx": cx, "cy": cy})

grid = gpd.GeoDataFrame(cells, crs="EPSG:4326")
print(f"전체 격자 수: {len(grid)}")

# 3. 마스크 내부 격자만 필터
grid_masked = grid[grid.geometry.intersects(mask)].copy()
grid_masked = grid_masked.reset_index(drop=True)
grid_masked["grid_id"] = ["CG_{:05d}".format(i) for i in range(len(grid_masked))]
print(f"마스크 내 격자 수: {len(grid_masked)}")

# 4. 각 격자에 연결된 학교 붙이기 (500m 생활권 내 학교명 리스트)
iso_case123 = iso_case123.reset_index(drop=True)

def get_linked_schools(geom):
    return [
        row["학교명"] for _, row in iso_case123.iterrows()
        if geom.intersects(row["geometry"])
    ]

grid_masked["linked_schools"] = grid_masked["geometry"].apply(get_linked_schools)
grid_masked["linked_school_count"] = grid_masked["linked_schools"].apply(len)

# 5. beneficiary_forecast에서 잠재수요 붙이기
forecast = pd.read_csv(BASE + "data_processed/beneficiary_forecast.csv")
print("\n=== beneficiary_forecast 컬럼 ===")
print(forecast.columns.tolist())
print(forecast.head(3))

# 6. 저장
out = grid_masked[["grid_id","cx","cy","linked_schools","linked_school_count","geometry"]]
out.to_file(BASE + "data_processed/candidate_grid_raw_v2.geojson", driver="GeoJSON")
print("\n저장 완료: candidate_grid_raw_v2.geojson")
print(out[["grid_id","cx","cy","linked_school_count"]].head(10))
