# -*- coding: utf-8 -*-
"""
실패한 181건 카카오 주소 검색 API로 재시도
- 기준: geocoded_playground.csv 에서 위도 NaN인 행
- 성공분만 parks.csv에 append
"""
import sys, os, time, warnings
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import geopandas as gpd
import requests
from dotenv import load_dotenv

load_dotenv(r"c:\2026_data_analysis_park\.env")
KAKAO_KEY = os.getenv("KAKAO_REST_KEY")

OUT = r"c:\2026_data_analysis_park\data\processed"
PARKS_CSV  = os.path.join(OUT, "parks.csv")
GEO_CSV    = os.path.join(OUT, "geocoded_playground.csv")
BACKUP_CSV = os.path.join(OUT, "parks_backup3.csv")

LAT_MIN, LAT_MAX = 37.2, 37.8
LON_MIN, LON_MAX = 126.3, 127.0
CRS = "EPSG:5179"

# ── 카카오 API 테스트 ─────────────────────────────────────────────────────
print("카카오 API 키 확인...")
test_url = "https://dapi.kakao.com/v2/local/search/address.json"
res = requests.get(test_url,
                   headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
                   params={"query": "인천광역시 남동구 구월동 1501"},
                   timeout=5)
if res.status_code == 200 and res.json().get("documents"):
    print(f"  키 유효: {KAKAO_KEY[:8]}... → 테스트 성공")
else:
    print(f"  HTTP {res.status_code}: {res.json()}")
    print("  카카오 API 인증 실패 → 스크립트 중단")
    sys.exit(1)

# ── 실패 행 로드 ─────────────────────────────────────────────────────────
geo_df = pd.read_csv(GEO_CSV, encoding="utf-8-sig")
print(f"\ngeocode_playground.csv: {len(geo_df)}행")
print(f"  위도 있음(기성공): {geo_df['위도'].notna().sum()}행")
print(f"  위도 NaN(재시도 대상): {geo_df['위도'].isna().sum()}행")

# 실패 행: 기존 스크립트에서 저장한 건 성공분만이므로 — 원본 주소 재구성 필요
# geocoded_playground.csv 구조 확인
print(f"\n컬럼: {geo_df.columns.tolist()}")

# 위도 NaN 행 = 이전에 저장되지 않은 것
# → 원본 파일들에서 주소 재추출 후 기성공 주소 제외
RAW = r"c:\2026_data_analysis_park\data\raw"

def clean_addr_junggu(s):
    s = str(s).strip()
    if " 인천 " in s:
        s = s[:s.index(" 인천 ")]
    return s

rows_all = []

df = pd.read_csv(os.path.join(RAW, "인천광역시 남동구_어린이놀이터 안전검사 결과_20250326.csv"), encoding="cp949")
for _, r in df.iterrows():
    addr_raw = str(r["위치"]).strip()
    addr = f"인천광역시 남동구 {addr_raw}" if not addr_raw.startswith("인천") else addr_raw
    rows_all.append({"시설명": str(r["공원명"]).strip(), "주소": addr, "gu": "남동구"})

df = pd.read_csv(os.path.join(RAW, "인천광역시 연수구_공원 어린이놀이터 현황_20250805.csv"), encoding="cp949")
for _, r in df.iterrows():
    rows_all.append({"시설명": str(r["공원명"]).strip(), "주소": str(r["소재지"]).strip(), "gu": "연수구"})

df = pd.read_csv(os.path.join(RAW, "인천광역시_중구_어린이놀이시설 현황_20250611.csv"), encoding="cp949")
df_out = df[df["실내외구분"] == "실외"]
for _, r in df_out.iterrows():
    rows_all.append({"시설명": str(r["놀이시설명"]).strip(),
                     "주소": clean_addr_junggu(r["주소"]), "gu": "중구"})

df_all = pd.DataFrame(rows_all).drop_duplicates(subset=["주소"]).reset_index(drop=True)

# 기성공 주소 제외
already_done = set(geo_df["주소"].dropna().tolist())
df_retry = df_all[~df_all["주소"].isin(already_done)].reset_index(drop=True)
print(f"\n재시도 대상: {len(df_retry)}건")

# ── 카카오로 재지오코딩 ───────────────────────────────────────────────────
print()
print("=" * 60)
print(f"카카오 지오코딩 재시도 ({len(df_retry)}건)")
print("=" * 60)

lats, lons = [], []
success = fail = 0

for i, row in df_retry.iterrows():
    res = requests.get(
        "https://dapi.kakao.com/v2/local/search/address.json",
        headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
        params={"query": row["주소"]},
        timeout=5,
    )
    lat = lon = None
    if res.status_code == 200:
        docs = res.json().get("documents", [])
        if docs:
            lat = float(docs[0]["y"])
            lon = float(docs[0]["x"])

    lats.append(lat)
    lons.append(lon)
    if lat is not None:
        success += 1
    else:
        fail += 1

    if (i + 1) % 50 == 0 or (i + 1) == len(df_retry):
        print(f"  [{i+1:3d}/{len(df_retry)}] 성공 {success} / 실패 {fail}")

    time.sleep(0.1)

df_retry = df_retry.copy()
df_retry["위도"]    = lats
df_retry["경도"]    = lons
df_retry["geo_src"] = ["kakao" if lat else "fail" for lat in lats]
df_retry["시설유형"] = "놀이터"

print(f"\n결과: 시도 {len(df_retry)} / 성공 {success} / 실패 {fail}")

# ── 후처리 + 중복 제거 ───────────────────────────────────────────────────
df_new = df_retry.dropna(subset=["위도","경도"]).copy()
df_new = df_new[
    df_new["위도"].between(LAT_MIN, LAT_MAX) &
    df_new["경도"].between(LON_MIN, LON_MAX)
].reset_index(drop=True)
print(f"인천 범위 내 좌표 성공: {len(df_new)}행")

parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
parks.to_csv(BACKUP_CSV, index=False, encoding="utf-8-sig")
print(f"parks.csv 백업: {BACKUP_CSV} ({len(parks)}행)")

gdf_new = gpd.GeoDataFrame(
    df_new,
    geometry=gpd.points_from_xy(df_new["경도"], df_new["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

gdf_parks = gpd.GeoDataFrame(
    parks,
    geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

gdf_joined = gpd.sjoin_nearest(
    gdf_new, gdf_parks[["geometry"]],
    how="left", distance_col="dist_to_park",
)
gdf_joined = gdf_joined[~gdf_joined.index.duplicated(keep="first")]

duplicates = gdf_joined[gdf_joined["dist_to_park"] <= 50]
standalone = gdf_joined[gdf_joined["dist_to_park"] >  50]
print(f"50m 중복 제거: {len(duplicates)}행  →  신규 추가: {len(standalone)}행")

# ── parks.csv append ─────────────────────────────────────────────────────
if len(standalone) > 0:
    existing_pg = parks[parks["관리번호"].astype(str).str.startswith("PLAYGROUND")]
    next_num = len(existing_pg)

    new_rows = standalone[["시설명","위도","경도","gu","시설유형"]].copy()
    new_rows = new_rows.rename(columns={"시설명":"공원명"})
    new_rows["관리번호"] = [f"PLAYGROUND-{next_num+i:04d}" for i in range(len(new_rows))]
    new_rows["공원구분"] = "놀이터"
    new_rows["공원면적"] = None
    new_rows = new_rows[parks.columns]

    result = pd.concat([parks, new_rows], ignore_index=True)
else:
    result = parks.copy()

result.to_csv(PARKS_CSV, index=False, encoding="utf-8-sig")

# geocoded_playground.csv 에 성공분 추가
if len(df_new) > 0:
    save_cols = ["시설명","gu","주소","위도","경도","시설유형","geo_src"]
    existing_geo = pd.read_csv(GEO_CSV, encoding="utf-8-sig")
    updated_geo = pd.concat([existing_geo, df_new[save_cols]], ignore_index=True)
    updated_geo.to_csv(GEO_CSV, index=False, encoding="utf-8-sig")
    print(f"geocoded_playground.csv 업데이트: {len(updated_geo)}행")

# ── 최종 통계 ────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("최종 통계")
print("=" * 60)
print(f"재시도: {len(df_retry)}건  성공: {success}건  실패: {fail}건")
print(f"신규 추가: {len(standalone)}행")
print(f"parks.csv 최종: {len(result)}행")
print()
pg_all = result[result["시설유형"] == "놀이터"]
print("[gu별 놀이터 수]")
print(pg_all["gu"].value_counts().to_string())
michuhol_pg   = result[(result["gu"]=="미추홀구") & (result["시설유형"]=="놀이터")]
michuhol_park = result[(result["gu"]=="미추홀구") & (result["시설유형"]!="놀이터")]
print(f"\n미추홀구: 공원 {len(michuhol_park)}개 / 놀이터 {len(michuhol_pg)}개 / 합계 {len(michuhol_park)+len(michuhol_pg)}개")
