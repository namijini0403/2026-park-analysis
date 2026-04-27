# -*- coding: utf-8 -*-
"""
놀이터 데이터 통합 → parks.csv 병합
STEP 1: 각 파일 읽기 (좌표 있는 파일 직접 / 없는 파일은 공원명 매칭)
STEP 2: 통합 전처리
STEP 3: parks.csv와 50m 공간 중복 제거
STEP 4: parks.csv 덮어쓰기
"""
import sys, os, warnings
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

RAW = r"c:\2026_data_analysis_park\data\raw"
OUT = r"c:\2026_data_analysis_park\data\processed"
CRS = "EPSG:5179"

PARKS_CSV   = os.path.join(OUT, "parks.csv")
BACKUP_CSV  = os.path.join(OUT, "parks_backup.csv")

# 인천 좌표 범위
LAT_MIN, LAT_MAX = 37.2, 37.8
LON_MIN, LON_MAX = 126.3, 127.0

# ─────────────────────────────────────────────────────────────────────────────
# parks.csv 로드 (공원명 매칭용 + 백업용)
# ─────────────────────────────────────────────────────────────────────────────
parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
parks_backup = parks.copy()
parks_backup.to_csv(BACKUP_CSV, index=False, encoding="utf-8-sig")
print(f"백업 저장: {BACKUP_CSV}")
print(f"parks.csv 원본: {len(parks)}행\n")

# parks에 시설유형 컬럼 추가 (없는 경우)
if "시설유형" not in parks.columns:
    parks["시설유형"] = parks["공원구분"]


# ─────────────────────────────────────────────────────────────────────────────
# 파일별 파서
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1+2. 파일별 읽기 및 전처리")
print("=" * 60)

all_pg = []  # 통합될 놀이터 리스트

# ── A. 미추홀구 (좌표 직접) ───────────────────────────────────────────────
df = pd.read_csv(os.path.join(RAW, "인천광역시 미추홀구_공원 어린이놀이터 현황_20240805.csv"),
                 encoding="cp949")
pg_michuhol = pd.DataFrame({
    "시설명": df["기관명"].astype(str).str.strip(),
    "위도":   pd.to_numeric(df["위도"], errors="coerce"),
    "경도":   pd.to_numeric(df["경도"], errors="coerce"),
    "gu":     "미추홀구",
    "시설유형": "놀이터",
})
print(f"미추홀구 원본: {len(pg_michuhol)}행 → ", end="")
pg_michuhol = pg_michuhol.dropna(subset=["위도", "경도"])
pg_michuhol = pg_michuhol[
    pg_michuhol["위도"].between(LAT_MIN, LAT_MAX) &
    pg_michuhol["경도"].between(LON_MIN, LON_MAX)
]
print(f"정제 후: {len(pg_michuhol)}행")
all_pg.append(pg_michuhol)

# ── B. 서구 (좌표 직접) ───────────────────────────────────────────────────
df = pd.read_csv(os.path.join(RAW, "인천광역시 서구_공원 어린이놀이터 현황_20260113.csv"),
                 encoding="utf-8-sig")
pg_seo = pd.DataFrame({
    "시설명": df["공원명"].astype(str).str.strip(),
    "위도":   pd.to_numeric(df["위도"], errors="coerce"),
    "경도":   pd.to_numeric(df["경도"], errors="coerce"),
    "gu":     "서구",
    "시설유형": "놀이터",
})
print(f"서구 원본: {len(pg_seo)}행 → ", end="")
pg_seo = pg_seo.dropna(subset=["위도", "경도"])
pg_seo = pg_seo[
    pg_seo["위도"].between(LAT_MIN, LAT_MAX) &
    pg_seo["경도"].between(LON_MIN, LON_MAX)
]
print(f"정제 후: {len(pg_seo)}행")
all_pg.append(pg_seo)

# ── C. 남동구 (좌표 없음 → parks.csv 공원명 매칭) ─────────────────────────
df = pd.read_csv(os.path.join(RAW, "인천광역시 남동구_어린이놀이터 안전검사 결과_20250326.csv"),
                 encoding="cp949")
parks_namdong = parks[parks["gu"] == "남동구"][["공원명", "위도", "경도"]].copy()
# 공원명 정규화 (공백·특수문자 제거)
def norm(s):
    return str(s).replace(" ", "").replace("(", "").replace(")", "").lower()

parks_namdong["name_key"] = parks_namdong["공원명"].apply(norm)
df["name_key"] = df["공원명"].apply(norm)

# 1차: 정확 매칭
merged_nd = df.merge(parks_namdong[["name_key","위도","경도"]], on="name_key", how="left")

# 2차: 미매칭 → parks명이 놀이터명에 포함(contains) 방식으로 보완
unmatched_mask = merged_nd["위도"].isna()
if unmatched_mask.sum() > 0:
    for idx in merged_nd[unmatched_mask].index:
        pg_name = merged_nd.loc[idx, "name_key"]
        hit = parks_namdong[parks_namdong["name_key"].apply(lambda x: x in pg_name or pg_name.startswith(x))]
        if len(hit) > 0:
            merged_nd.loc[idx, "위도"] = hit.iloc[0]["위도"]
            merged_nd.loc[idx, "경도"] = hit.iloc[0]["경도"]

matched = merged_nd.dropna(subset=["위도","경도"])
unmatched_nd = len(df) - len(matched)

pg_namdong = pd.DataFrame({
    "시설명": matched["공원명"].astype(str).str.strip(),
    "위도":   matched["위도"],
    "경도":   matched["경도"],
    "gu":     "남동구",
    "시설유형": "놀이터",
})
print(f"남동구 원본: {len(df)}행 → 공원명 매칭 성공: {len(pg_namdong)}행 / 미매칭(좌표없음): {unmatched_nd}행")
all_pg.append(pg_namdong)

# ── D. 연수구 (좌표 없음 → parks.csv 공원명 매칭) ─────────────────────────
df = pd.read_csv(os.path.join(RAW, "인천광역시 연수구_공원 어린이놀이터 현황_20250805.csv"),
                 encoding="cp949")
parks_yeonsu = parks[parks["gu"] == "연수구"][["공원명", "위도", "경도"]].copy()
parks_yeonsu["name_key"] = parks_yeonsu["공원명"].apply(norm)
df["name_clean"] = df["공원명"].str.replace(" 놀이터", "", regex=False).str.replace("놀이터", "", regex=False)
df["name_key"] = df["name_clean"].apply(norm)

merged_ys = df.merge(parks_yeonsu[["name_key","위도","경도"]], on="name_key", how="left")

# contains 보완
unmatched_mask = merged_ys["위도"].isna()
if unmatched_mask.sum() > 0:
    for idx in merged_ys[unmatched_mask].index:
        pg_name = merged_ys.loc[idx, "name_key"]
        hit = parks_yeonsu[parks_yeonsu["name_key"].apply(lambda x: x in pg_name or pg_name.startswith(x))]
        if len(hit) > 0:
            merged_ys.loc[idx, "위도"] = hit.iloc[0]["위도"]
            merged_ys.loc[idx, "경도"] = hit.iloc[0]["경도"]

matched_ys = merged_ys.dropna(subset=["위도","경도"])
unmatched_ys = len(df) - len(matched_ys)

pg_yeonsu = pd.DataFrame({
    "시설명": matched_ys["공원명"].astype(str).str.strip(),
    "위도":   matched_ys["위도"],
    "경도":   matched_ys["경도"],
    "gu":     "연수구",
    "시설유형": "놀이터",
})
print(f"연수구 원본: {len(df)}행 → 공원명 매칭 성공: {len(pg_yeonsu)}행 / 미매칭(좌표없음): {unmatched_ys}행")
all_pg.append(pg_yeonsu)

# ── E. 중구 (좌표 없음, 주소 기반 — 실외만 필터) ─────────────────────────
df = pd.read_csv(os.path.join(RAW, "인천광역시_중구_어린이놀이시설 현황_20250611.csv"),
                 encoding="cp949")
# 실외만 유지
df_out = df[df["실내외구분"] == "실외"].copy() if "실내외구분" in df.columns else df.copy()
parks_junggu = parks[parks["gu"] == "중구"][["공원명", "위도", "경도"]].copy()
parks_junggu["name_key"] = parks_junggu["공원명"].apply(norm)
df_out["name_key"] = df_out["놀이시설명"].apply(norm)

merged_jg = df_out.merge(parks_junggu[["name_key","위도","경도"]], on="name_key", how="left")
matched_jg = merged_jg.dropna(subset=["위도","경도"])
unmatched_jg = len(df_out) - len(matched_jg)

pg_junggu = pd.DataFrame({
    "시설명": matched_jg["놀이시설명"].astype(str).str.strip(),
    "위도":   matched_jg["위도"],
    "경도":   matched_jg["경도"],
    "gu":     "중구",
    "시설유형": "놀이터",
})
print(f"중구 원본: {len(df)}행 → 실외: {len(df_out)}행 → 공원명 매칭: {len(pg_junggu)}행 / 미매칭: {unmatched_jg}행")
all_pg.append(pg_junggu)


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. 통합 + 공간 중복 제거
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. 공간 중복 제거 (parks.csv 50m 이내 제거)")
print("=" * 60)

df_pg = pd.concat(all_pg, ignore_index=True)
df_pg = df_pg.dropna(subset=["위도", "경도"])
df_pg = df_pg.drop_duplicates(subset=["위도", "경도"])
print(f"통합 놀이터 원본 (좌표 보유): {len(df_pg)}행")

# GeoDataFrame 변환 (EPSG:5179)
gdf_pg = gpd.GeoDataFrame(
    df_pg,
    geometry=gpd.points_from_xy(df_pg["경도"], df_pg["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

gdf_parks = gpd.GeoDataFrame(
    parks,
    geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

# sjoin_nearest: 각 놀이터에서 가장 가까운 공원까지 거리
gdf_pg_joined = gpd.sjoin_nearest(
    gdf_pg,
    gdf_parks[["geometry"]],
    how="left",
    distance_col="dist_to_park",
)

# 인덱스 중복(한 놀이터가 여러 공원에 매칭) → 가장 가까운 것만 유지
gdf_pg_joined = gdf_pg_joined[
    ~gdf_pg_joined.index.duplicated(keep="first")
]

dist_threshold = 50  # m
duplicates  = gdf_pg_joined[gdf_pg_joined["dist_to_park"] <= dist_threshold]
standalone  = gdf_pg_joined[gdf_pg_joined["dist_to_park"] >  dist_threshold]

print(f"  parks.csv 50m 이내 중복: {len(duplicates)}행 → 제거")
print(f"  독립 놀이터 (신규 추가):  {len(standalone)}행")

if len(standalone) > 0:
    print("\n  독립 놀이터 목록:")
    for _, r in standalone.iterrows():
        print(f"    [{r['gu']}] {r['시설명']}  ({r['위도']:.6f}, {r['경도']:.6f})"
              f"  dist={r['dist_to_park']:.0f}m")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4. parks.csv 통합 저장
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 4. parks.csv 통합 저장")
print("=" * 60)

# 기존 parks에 시설유형 컬럼 추가 (이미 추가됨 위에서)
# 독립 놀이터를 parks 형식으로 변환
if len(standalone) > 0:
    new_rows = standalone[["시설명", "위도", "경도", "gu", "시설유형"]].copy()
    new_rows = new_rows.rename(columns={"시설명": "공원명"})
    new_rows["관리번호"] = "PLAYGROUND-" + new_rows.reset_index(drop=True).index.astype(str).str.zfill(4)
    new_rows["공원구분"] = "놀이터"
    new_rows["공원면적"] = None
    # 순서 맞추기
    new_rows = new_rows[parks.columns]
    result = pd.concat([parks, new_rows], ignore_index=True)
else:
    result = parks.copy()

result.to_csv(PARKS_CSV, index=False, encoding="utf-8-sig")

# ── 결과 출력 ────────────────────────────────────────────────────────────────
print(f"\n저장 완료: {PARKS_CSV}")
print(f"\n[통합 요약]")
print(f"  통합 전 공원 수:     {len(parks_backup):>5}행")
print(f"  놀이터 원본 수:      {len(df_pg):>5}행 (좌표 보유)")
print(f"  공원명 매칭 실패:    {unmatched_nd + unmatched_ys + unmatched_jg:>5}행 (좌표 없어 제외)")
print(f"  공원과 중복 제거:    {len(duplicates):>5}행 (50m 이내)")
print(f"  신규 추가 놀이터:    {len(standalone):>5}행")
print(f"  최종 parks.csv:     {len(result):>5}행")

print(f"\n[gu별 놀이터 수 (신규 추가분)]")
if len(standalone) > 0:
    print(standalone["gu"].value_counts().to_string())
else:
    print("  없음 (모두 기존 공원과 중복)")

print(f"\n[parks.csv gu별 전체 행수]")
print(result["gu"].value_counts().to_string())

michuhol_pg = result[(result["gu"] == "미추홀구") & (result["시설유형"] == "놀이터")]
michuhol_park = result[(result["gu"] == "미추홀구") & (result["시설유형"] != "놀이터")]
print(f"\n미추홀구: 공원 {len(michuhol_park)}개 / 놀이터 {len(michuhol_pg)}개")
