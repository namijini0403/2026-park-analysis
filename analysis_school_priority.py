# -*- coding: utf-8 -*-
"""
공원 접근성 집계 + gap 산출 + case_type 분류
→ data_processed/school_priority.csv
"""
import sys, os, warnings, zipfile, tempfile
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import geopandas as gpd
import numpy as np

RAW = r"c:\2026_data_analysis_park\data_raw"
OUT = r"c:\2026_data_analysis_park\data_processed"
CRS = "EPSG:5179"

ISO_PATH    = os.path.join(OUT, "school_isochrone_500m.geojson")
BUF_PATH    = os.path.join(OUT, "school_buffer_500m.geojson")
PARKS_CSV   = os.path.join(OUT, "parks.csv")
GRID_CSV    = os.path.join(OUT, "population_grid_1k.csv")
SCHOOLS_CSV = os.path.join(OUT, "schools.csv")
OUT_CSV     = os.path.join(OUT, "school_priority.csv")

ZIP_DASA = os.path.join(RAW, "_grid_border_grid_2025_grid_다사_grid_다사.zip")
ZIP_NASA = os.path.join(RAW, "_grid_border_grid_2025_grid_나사_grid_나사.zip")
INCHEON_BOUNDS = (740634, 1899394, 946455, 2010915)  # EPSG:5179


# ─────────────────────────────────────────────────────────────────────────────
# 데이터 로드
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("데이터 로드")
print("=" * 60)

gdf_iso = gpd.read_file(ISO_PATH).to_crs(CRS)
gdf_buf = gpd.read_file(BUF_PATH).to_crs(CRS)
print(f"  등시선: {len(gdf_iso)}개  |  직선버퍼: {len(gdf_buf)}개")

parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
gdf_parks = gpd.GeoDataFrame(
    parks,
    geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)
print(f"  parks: {len(gdf_parks)}개  (시설유형: {parks['시설유형'].value_counts().to_dict()})")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1. 등시선/버퍼 내 공원 집계
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 1. 등시선/버퍼 내 공원 집계")
print("=" * 60)

def count_parks_in_zone(gdf_zone, gdf_pts, id_col="학교ID"):
    """각 구역(polygon) 내 점(공원) 수 및 면적 합 집계"""
    joined = gpd.sjoin(
        gdf_pts[["geometry", "공원면적", "시설유형"]],
        gdf_zone[[id_col, "geometry"]],
        how="right",
        predicate="within",
    )
    # 중복 인덱스 처리 (하나의 공원이 여러 구역에 할당되는 경우 없지만 방어)
    grp = joined.groupby(id_col).agg(
        park_count=("시설유형", "count"),
        park_area=("공원면적", "sum"),
    ).reset_index()
    return grp

iso_stats = count_parks_in_zone(gdf_iso, gdf_parks)
iso_stats.columns = ["학교ID", "iso_park_count", "iso_park_area"]

buf_stats = count_parks_in_zone(gdf_buf, gdf_parks)
buf_stats.columns = ["학교ID", "buf_park_count", "buf_park_area"]

# 학교 기본 정보와 조인
result = gdf_iso[["학교ID", "학교명", "gu"]].copy()
result = result.merge(iso_stats, on="학교ID", how="left")
result = result.merge(buf_stats, on="학교ID", how="left")
result[["iso_park_count","buf_park_count"]] = result[["iso_park_count","buf_park_count"]].fillna(0).astype(int)
result[["iso_park_area","buf_park_area"]]   = result[["iso_park_area","buf_park_area"]].fillna(0)

# access_ratio: 도보/직선 공원 수 비율 (직선 0이면 NaN)
result["access_ratio"] = np.where(
    result["buf_park_count"] > 0,
    result["iso_park_count"] / result["buf_park_count"],
    np.nan,
)

print(f"  iso_park_count 평균: {result['iso_park_count'].mean():.2f}")
print(f"  buf_park_count 평균: {result['buf_park_count'].mean():.2f}")
print(f"  공원 0개(등시선): {(result['iso_park_count']==0).sum()}개 학교")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2. 1K 격자 폴리곤 × 등시선 면적 비례 아동인구 집계
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 2. 아동인구 집계 (면적 비례 배분)")
print("=" * 60)

# 1K 격자 SHP에서 인천 격자 폴리곤 추출 (centroid 대신 실제 geometry 유지)
gdfs_shp = []
for label, zpath in [("나사", ZIP_NASA), ("다사", ZIP_DASA)]:
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zpath) as z:
            for item in z.infolist():
                try:   fname = item.filename.encode("cp437").decode("cp949")
                except: fname = item.filename
                if "1K" in fname:
                    ext = os.path.splitext(fname)[1]
                    with open(os.path.join(tmpdir, f"{label}_1K{ext}"), "wb") as f:
                        f.write(z.read(item.filename))
        shp = os.path.join(tmpdir, f"{label}_1K.shp")
        if os.path.exists(shp):
            gdf_shp = gpd.read_file(shp)
            # 이미 EPSG:5179 (TM)이므로 to_crs 불필요, bbox 필터만 적용
            if gdf_shp.crs is None or gdf_shp.crs.to_epsg() != 5179:
                gdf_shp = gdf_shp.to_crs(CRS)
            gdf_inch = gdf_shp.cx[
                INCHEON_BOUNDS[0]:INCHEON_BOUNDS[2],
                INCHEON_BOUNDS[1]:INCHEON_BOUNDS[3],
            ].copy()
            gdfs_shp.append(gdf_inch[["GRID_CD", "geometry"]])

gdf_grid_poly = pd.concat(gdfs_shp, ignore_index=True)
gdf_grid_poly = gpd.GeoDataFrame(gdf_grid_poly, geometry="geometry", crs=CRS)
gdf_grid_poly["grid_area"] = gdf_grid_poly.geometry.area
print(f"  1K 격자 폴리곤: {len(gdf_grid_poly)}개")

# 인구 파일과 조인
pop = pd.read_csv(GRID_CSV, encoding="utf-8-sig")
gdf_pop_poly = gdf_grid_poly.merge(pop, left_on="GRID_CD", right_on="격자코드", how="inner")
print(f"  인구-격자 매칭: {len(gdf_pop_poly)}/{len(pop)}")

# 등시선과 격자 폴리곤의 교차 → 면적 비례 배분
# overlay: 등시선 × 격자 격자 각 교차 조각 생성
iso_for_overlay = gdf_iso[["학교ID", "geometry"]].copy()
pop_for_overlay = gdf_pop_poly[["GRID_CD", "grid_area",
                                 "child_pop_0_5", "child_pop_6_12", "total_pop",
                                 "geometry"]].copy()

print("  등시선 × 격자 overlay 계산 중...")
overlay = gpd.overlay(iso_for_overlay, pop_for_overlay, how="intersection", keep_geom_type=False)
overlay["inter_area"] = overlay.geometry.area
# 교차 비율 (해당 격자에서 등시선이 덮는 비율)
overlay["weight"] = overlay["inter_area"] / overlay["grid_area"]
# 면적 비례 인구 배분
for col in ["child_pop_0_5", "child_pop_6_12", "total_pop"]:
    overlay[col] = overlay[col] * overlay["weight"]

pop_grp = overlay.groupby("학교ID").agg(
    iso_child_0_5  =("child_pop_0_5",  "sum"),
    iso_child_6_12 =("child_pop_6_12", "sum"),
    iso_total_pop  =("total_pop",       "sum"),
).reset_index()

result = result.merge(pop_grp, on="학교ID", how="left")
result[["iso_child_0_5","iso_child_6_12","iso_total_pop"]] = \
    result[["iso_child_0_5","iso_child_6_12","iso_total_pop"]].fillna(0)
# 정수로 반올림
result["iso_child_0_5"]  = result["iso_child_0_5"].round().astype(int)
result["iso_child_6_12"] = result["iso_child_6_12"].round().astype(int)
result["iso_total_pop"]  = result["iso_total_pop"].round().astype(int)
result["iso_child_total"] = result["iso_child_0_5"] + result["iso_child_6_12"]

print(f"  iso_child_total 평균: {result['iso_child_total'].mean():.0f}")
print(f"  iso_child_total 최대: {result['iso_child_total'].max()}")
print(f"  iso_child_total == 0: {(result['iso_child_total']==0).sum()}개 학교")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. gap 산출
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. gap 산출 (유사 규모 집단 평균)")
print("=" * 60)

# 0이 많아 qcut 중복 발생 가능 → rank 기반으로 4분위 강제 할당
result["child_pop_quartile"] = pd.qcut(
    result["iso_child_total"].rank(method="first"),
    q=4, labels=["Q1","Q2","Q3","Q4"]
)

q_means = result.groupby("child_pop_quartile", observed=True)[["iso_park_count","iso_park_area"]].mean()
print("  분위별 공원 평균:")
print(q_means.to_string())

result = result.merge(
    q_means.rename(columns={"iso_park_count":"expected_park_count","iso_park_area":"expected_park_area"}),
    on="child_pop_quartile", how="left"
)
result["gap_count"] = result["iso_park_count"] - result["expected_park_count"]
result["gap_area"]  = result["iso_park_area"]  - result["expected_park_area"]

print(f"\n  gap_count < 0 학교: {(result['gap_count']<0).sum()}개")
print(f"  gap_count 평균: {result['gap_count'].mean():.2f}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4. case_type 분류 + priority_score
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 4. case_type 분류")
print("=" * 60)

child_median = result["iso_child_total"].median()
child_q75    = result["iso_child_total"].quantile(0.75)
print(f"  iso_child_total 중앙값: {child_median:.0f}  /  75%: {child_q75:.0f}")

ct1 = (result["buf_park_count"] >= 2) & (result["iso_park_count"] <= 1)   # 행정 착시
ct2 = (result["gap_count"] < 0) & (result["iso_child_total"] > child_median)  # 인구 대비 부족
ct3 = (ct1 & ct2) | (result["iso_park_count"] == 0)  # 복합 취약 + 공원 전무

case_type = pd.Series("4", index=result.index)   # 기본: 양호
case_type[ct1 & ~ct3] = "1"
case_type[ct2 & ~ct3] = "2"
case_type[ct3]         = "3"
result["case_type"] = case_type

# priority_score
score = pd.Series(1, index=result.index)
score[result["case_type"] == "3"] = 3
score[(result["case_type"] == "1") | (result["case_type"] == "2")] = 2
score += (result["iso_child_total"] >= child_q75).astype(int)  # 상위 25% +1
result["priority_score"] = score

print()
print("  case_type별 학교 수:")
print(result["case_type"].value_counts().sort_index().to_string())


# ─────────────────────────────────────────────────────────────────────────────
# 저장
# ─────────────────────────────────────────────────────────────────────────────
keep_cols = [
    "학교ID", "학교명", "gu",
    "iso_park_count", "iso_park_area",
    "buf_park_count", "buf_park_area",
    "access_ratio",
    "iso_child_total", "iso_child_6_12",
    "child_pop_quartile",
    "expected_park_count", "gap_count",
    "expected_park_area",  "gap_area",
    "case_type", "priority_score",
]
result[keep_cols].to_csv(OUT_CSV, index=False, encoding="utf-8-sig")
print()
print(f"저장 완료: {OUT_CSV}")


# ─────────────────────────────────────────────────────────────────────────────
# 출력 요약
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("결과 요약")
print("=" * 60)

print("\n[case_type별 학교 수]")
ct_cnt = result["case_type"].value_counts().sort_index()
labels = {"1":"행정착시","2":"인구대비부족","3":"복합취약","4":"양호"}
for k, v in ct_cnt.items():
    print(f"  case {k} ({labels.get(k,'?')}): {v}개")

print("\n[우선지원 대상 — priority_score 3·4점]")
priority = result[result["priority_score"] >= 3].sort_values(
    ["priority_score","gap_count"], ascending=[False, True]
)[["학교명","gu","case_type","priority_score","iso_park_count","gap_count","iso_child_total"]]
print(priority.to_string(index=False))

print("\n[미추홀구 학교 집계]")
mich = result[result["gu"] == "미추홀구"].sort_values("priority_score", ascending=False)
print(mich[["학교명","case_type","priority_score","iso_park_count","gap_count","iso_child_total"]].to_string(index=False))
print(f"\n  미추홀구 case_type 분포:")
print(mich["case_type"].value_counts().sort_index().to_string())

print("\n[gu별 평균 iso_park_count / access_ratio]")
gu_stats = result.groupby("gu").agg(
    학교수=("학교명","count"),
    평균iso공원수=("iso_park_count","mean"),
    평균access_ratio=("access_ratio","mean"),
    평균gap_count=("gap_count","mean"),
).round(2)
print(gu_stats.sort_values("평균iso공원수").to_string())
