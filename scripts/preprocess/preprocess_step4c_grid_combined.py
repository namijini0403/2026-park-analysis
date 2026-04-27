# -*- coding: utf-8 -*-
"""
population_grid.csv 재생성 (나사 + 다사 통합)
- 나사 SHP: 기존 incheon_grid_codes.csv 재활용
- 다사 SHP: 인천(행정코드 28) 격자코드 새로 추출
- census 나사_100M + 다사_100M → 인천 필터링 → 통합 저장
"""

import zipfile, os, sys, io, csv, tempfile
import pandas as pd
import geopandas as gpd

sys.stdout.reconfigure(encoding="utf-8")

RAW  = r"c:\2026_data_analysis_park\data\raw"
OUT  = r"c:\2026_data_analysis_park\data\processed"
os.makedirs(OUT, exist_ok=True)

ZIP_DASA_SHP  = os.path.join(RAW, "_grid_border_grid_2025_grid_다사_grid_다사.zip")
ZIP_NASA_SHP  = os.path.join(RAW, "_grid_border_grid_2025_grid_나사_grid_나사.zip")
ZIP_POP       = os.path.join(RAW, "_census_reqdoc_1775457003738.zip")

EXISTING_CODES = os.path.join(OUT, "incheon_grid_codes.csv")
OUT_POP        = os.path.join(OUT, "population_grid.csv")
OUT_CODES_DASA = os.path.join(OUT, "incheon_grid_codes_dasa.csv")


# ──────────────────────────────────────────────────────────────────────────────
# 1단계: 나사 인천 격자코드 (기존 캐시 사용)
# ──────────────────────────────────────────────────────────────────────────────
print("=== 1단계: 나사 인천 격자코드 로드 ===")
nasa_codes_df = pd.read_csv(EXISTING_CODES, encoding="utf-8-sig")
nasa_incheon = set(nasa_codes_df["격자코드"].astype(str).tolist())
print(f"나사 인천 격자코드: {len(nasa_incheon)}개")


# ──────────────────────────────────────────────────────────────────────────────
# 2단계: 다사 SHP → 인천 격자코드 추출 (공간 필터링)
# 다사 SHP는 행정코드 컬럼 없음 → Incheon 학교 좌표 기반 convex hull + buffer로 필터
# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 2단계: 다사 SHP에서 인천 격자코드 추출 (공간 필터) ===")

from shapely.geometry import Point
from shapely.ops import unary_union

SCHOOLS_CSV = os.path.join(OUT, "schools.csv")

dasa_incheon = set()

# Incheon 경계 polygon 생성 (학교 좌표 convex hull + 10km buffer)
schools_df = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
school_points = gpd.GeoDataFrame(
    schools_df,
    geometry=gpd.points_from_xy(schools_df["경도"], schools_df["위도"]),
    crs="EPSG:4326"
).to_crs("EPSG:5179")

incheon_hull = school_points.geometry.unary_union.convex_hull
incheon_boundary = incheon_hull.buffer(10_000)   # 10km buffer (외곽 격자 포함)
print(f"  Incheon boundary (EPSG:5179 기준):")
print(f"  bounds = {incheon_boundary.bounds}")

with tempfile.TemporaryDirectory() as tmpdir:
    with zipfile.ZipFile(ZIP_DASA_SHP) as z:
        for item in z.infolist():
            try:
                fname = item.filename.encode("cp437").decode("cp949")
            except Exception:
                fname = item.filename
            if "100M" in fname or "100M" in item.filename:
                data = z.read(item.filename)
                ext = os.path.splitext(fname)[1]
                out_path = os.path.join(tmpdir, f"dasa_100M{ext}")
                with open(out_path, "wb") as f:
                    f.write(data)

    shp_path = os.path.join(tmpdir, "dasa_100M.shp")
    if not os.path.exists(shp_path):
        print(f"ERROR: dasa_100M.shp 없음")
        sys.exit(1)

    # 다사 SHP의 DBF는 UTF-8 (.cpg=UTF-8) → encoding 미지정으로 자동 감지
    gdf = gpd.read_file(shp_path)
    print(f"  다사 SHP: {len(gdf):,}행 / CRS: {gdf.crs}")

    # CRS 맞추기
    if gdf.crs.to_epsg() != 5179:
        gdf = gdf.to_crs("EPSG:5179")

    # bbox 사전 필터 (속도 최적화)
    minx, miny, maxx, maxy = incheon_boundary.bounds
    gdf_bbox = gdf.cx[minx:maxx, miny:maxy]
    print(f"  bbox 1차 필터 후: {len(gdf_bbox):,}개")

    # 정확한 공간 교차 필터
    from shapely.geometry import mapping
    import geopandas as gpd2
    incheon_gs = gpd.GeoSeries([incheon_boundary], crs="EPSG:5179")
    gdf_incheon = gdf_bbox[gdf_bbox.geometry.intersects(incheon_boundary)]
    print(f"  공간 교차 필터 후(인천 다사 격자): {len(gdf_incheon):,}개")

    gdf_incheon = gdf_incheon.copy()
    sample_codes = gdf_incheon["GRID_CD"].head(5).tolist()
    print(f"  GRID_CD 샘플: {sample_codes}")

    dasa_incheon = set(gdf_incheon["GRID_CD"].astype(str).tolist())
    pd.DataFrame({"격자코드": sorted(dasa_incheon)}).to_csv(
        OUT_CODES_DASA, encoding="utf-8-sig", index=False
    )
    print(f"  다사 인천 격자코드 저장: {OUT_CODES_DASA} ({len(dasa_incheon)}개)")

print(f"\n나사 인천: {len(nasa_incheon)}개 / 다사 인천: {len(dasa_incheon)}개")


# ──────────────────────────────────────────────────────────────────────────────
# 3단계: census 인구 파일 읽기 및 필터링
# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 3단계: 인구 파일 읽기 ===")

def read_pop_csv(zip_obj, filename):
    raw = zip_obj.read(filename)
    rows = list(csv.reader(raw.decode("cp949").splitlines()))
    print(f"  {filename}: {len(rows)}행")
    return rows

with zipfile.ZipFile(ZIP_POP) as z:
    nasa_rows = read_pop_csv(z, "2024년_인구_나사_100M.csv")
    dasa_rows = read_pop_csv(z, "2024년_인구_다사_100M.csv")


# ──────────────────────────────────────────────────────────────────────────────
# 4단계: to_in_001(총인구), to_in_007, to_in_008 추출 + 인천 필터
# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 4단계: 인천 필터링 ===")

# 다사 SHP에서 코드 못 얻은 경우 → 인구파일 내 다사 전체 코드 집합 임시 사용
if dasa_incheon is None:
    dasa_all_codes = set(r[1] for r in dasa_rows if len(r) >= 2)
    print(f"  SHP 필터 실패 → 다사 인구파일 전체 코드 {len(dasa_all_codes)}개 사용 (수동 검수 필요)")
    dasa_filter = dasa_all_codes
else:
    dasa_filter = dasa_incheon

TARGET_CODES = {"to_in_001", "to_in_007", "to_in_008"}

def extract_pop(rows, filter_codes, label):
    """Long format → wide format (격자코드별 항목코드 피벗)"""
    records = {}
    for r in rows:
        if len(r) < 4:
            continue
        _, grid, code, val = r[0], r[1], r[2], r[3]
        if code not in TARGET_CODES:
            continue
        if grid not in filter_codes:
            continue
        if grid not in records:
            records[grid] = {}
        records[grid][code] = val
    print(f"  {label}: {len(records)}개 격자 추출")
    return records

nasa_records = extract_pop(nasa_rows, nasa_incheon, "나사")
dasa_records = extract_pop(dasa_rows, dasa_filter, "다사")


# ──────────────────────────────────────────────────────────────────────────────
# 5단계: 통합 및 저장
# ──────────────────────────────────────────────────────────────────────────────
print("\n=== 5단계: 통합 저장 ===")

combined = []
for grid, vals in {**nasa_records, **dasa_records}.items():
    combined.append({
        "격자코드":  grid,
        "총인구":    int(vals.get("to_in_001", 0)),
        "남성인구":  int(vals.get("to_in_007", 0)),
        "여성인구":  int(vals.get("to_in_008", 0)),
        "격자구분":  "나사" if grid.startswith("나사") else "다사",
    })

df_out = pd.DataFrame(combined)
df_out = df_out.sort_values("격자코드").reset_index(drop=True)
df_out.to_csv(OUT_POP, encoding="utf-8-sig", index=False)

print(f"저장 완료: {OUT_POP}")
print(f"  총 격자 수: {len(df_out):,}")
print(f"  나사: {(df_out['격자구분']=='나사').sum():,}개 / 다사: {(df_out['격자구분']=='다사').sum():,}개")
print(f"  총인구 합계: {df_out['총인구'].sum():,}명")
print(f"  인구>0 격자: {(df_out['총인구']>0).sum():,}개")
print(f"\n컬럼: {df_out.columns.tolist()}")
print(f"\n[나사 샘플]")
print(df_out[df_out['격자구분']=='나사'].head(3).to_string())
print(f"\n[다사 샘플]")
print(df_out[df_out['격자구분']=='다사'].head(3).to_string())


# ──────────────────────────────────────────────────────────────────────────────
# 부록: 연령별 항목코드 목록 출력 (1K 파일 기준)
# ──────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("부록: 연령별 항목코드 목록 (2024년_인구_나사_1K.csv 기준)")
print("="*60)

with zipfile.ZipFile(ZIP_POP) as z:
    raw1k = z.read("2024년_인구_나사_1K.csv")
rows1k = list(csv.reader(raw1k.decode("cp949").splitlines()))
all_codes_1k = sorted(set(r[2] for r in rows1k if len(r) >= 3))

print(f"\n전체 항목코드 수: {len(all_codes_1k)}개\n")

print("[to_in 계열] - 총인구/성별")
for c in all_codes_1k:
    if c.startswith("to_in"):
        print(f"  {c}")

print("\n[in_age 계열] - 연령별 코드")
age_codes = [c for c in all_codes_1k if c.startswith("in_age")]
# 3줄로 나눠 출력
chunk = 15
for i in range(0, len(age_codes), chunk):
    print("  " + "  ".join(age_codes[i:i+chunk]))

print(f"\n연령코드 규칙 (추정):")
print("  in_age_001 ~ in_age_020 : 전체 연령대(5세 구간)")
print("  in_age_001=0~4세, in_age_002=5~9세, in_age_003=10~14세 ...")
print("  in_age_021              : 전체 100세 이상")
print("  in_age_031 ~ in_age_050 : 남성 연령대(5세 구간)")
print("  in_age_061 ~ in_age_080 : 여성 연령대(5세 구간)")
print("  in_age_051 / in_age_081 : 남성/여성 100세 이상")

print("\n[100M 해상도에서 제공되는 코드]")
codes_100m = sorted(set(r[2] for r in nasa_rows if len(r) >= 3))
for c in codes_100m:
    print(f"  {c}")
print("  ※ 100M 격자는 개인정보 보호로 총인구/남녀 3개 코드만 제공")
