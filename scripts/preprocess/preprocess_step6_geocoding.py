# -*- coding: utf-8 -*-
"""
놀이터 지오코딩 (좌표 없는 3개 파일)
- 카카오 REST API (OPEN_MAP_AND_LOCAL 활성화 필요)
- Fallback: Nominatim (OSM) — 현재 사용
저장: data_processed/geocoded_playground.csv
     data_processed/parks.csv (업데이트)
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

RAW = r"c:\2026_data_analysis_park\data\raw"
OUT = r"c:\2026_data_analysis_park\data\processed"

PARKS_CSV    = os.path.join(OUT, "parks.csv")
BACKUP_CSV   = os.path.join(OUT, "parks_backup2.csv")
GEO_OUT      = os.path.join(OUT, "geocoded_playground.csv")

LAT_MIN, LAT_MAX = 37.2, 37.8
LON_MIN, LON_MAX = 126.3, 127.0
CRS = "EPSG:5179"


# ─────────────────────────────────────────────────────────────────────────────
# 지오코딩 함수 (카카오 우선 → Nominatim fallback)
# ─────────────────────────────────────────────────────────────────────────────
def geocode_kakao(address):
    url = "https://dapi.kakao.com/v2/local/search/address.json"
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    params = {"query": address}
    try:
        res = requests.get(url, headers=headers, params=params, timeout=5)
        if res.status_code == 200:
            docs = res.json().get("documents", [])
            if docs:
                return float(docs[0]["y"]), float(docs[0]["x"])
    except Exception:
        pass
    return None, None

def geocode_nominatim(address):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": address, "format": "json", "limit": 1,
              "countrycodes": "kr", "addressdetails": 0}
    headers = {"User-Agent": "IncheonParkAnalysis/1.0 (educational research)"}
    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        data = res.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception:
        pass
    return None, None

def geocode(address):
    """카카오 시도 → 실패 시 Nominatim fallback"""
    lat, lon = geocode_kakao(address)
    if lat is not None:
        return lat, lon, "kakao"
    lat, lon = geocode_nominatim(address)
    if lat is not None:
        return lat, lon, "nominatim"
    return None, None, "fail"


# ─────────────────────────────────────────────────────────────────────────────
# 입력 파일 읽기 및 주소 정규화
# ─────────────────────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1. 파일 읽기 및 주소 정규화")
print("=" * 60)

rows = []

# 남동구 (위치 컬럼 = 지번만 → 'インcheon 남동구' prefix 추가)
df = pd.read_csv(os.path.join(RAW, "인천광역시 남동구_어린이놀이터 안전검사 결과_20250326.csv"),
                 encoding="cp949")
for _, r in df.iterrows():
    addr_raw = str(r["위치"]).strip()
    addr = f"인천광역시 남동구 {addr_raw}" if not addr_raw.startswith("인천") else addr_raw
    rows.append({"시설명": str(r["공원명"]).strip(), "주소": addr, "gu": "남동구"})
print(f"남동구: {len(df)}행")

# 연수구 (소재지 = 전체 주소)
df = pd.read_csv(os.path.join(RAW, "인천광역시 연수구_공원 어린이놀이터 현황_20250805.csv"),
                 encoding="cp949")
for _, r in df.iterrows():
    rows.append({"시설명": str(r["공원명"]).strip(), "주소": str(r["소재지"]).strip(), "gu": "연수구"})
print(f"연수구: {len(df)}행")

# 중구 (실외만, 주소 중복 제거 — "주소 주소" 형태 처리)
df = pd.read_csv(os.path.join(RAW, "인천광역시_중구_어린이놀이시설 현황_20250611.csv"),
                 encoding="cp949")
df_out = df[df["실내외구분"] == "실외"].copy()
def clean_addr(s):
    s = str(s).strip()
    # "인천광역시 중구 X  인천 중구 X" 형태 → 앞부분만
    if " 인천 " in s:
        s = s[:s.index(" 인천 ")]
    return s
for _, r in df_out.iterrows():
    rows.append({"시설명": str(r["놀이시설명"]).strip(),
                 "주소": clean_addr(r["주소"]), "gu": "중구"})
print(f"중구 실외: {len(df_out)}행 (전체 {len(df)}행)")

df_all = pd.DataFrame(rows)
df_all = df_all.drop_duplicates(subset=["주소"]).reset_index(drop=True)
print(f"\n중복 주소 제거 후: {len(df_all)}행")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2. 지오코딩
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"STEP 2. 지오코딩 ({len(df_all)}건)")
print("=" * 60)

lats, lons, sources = [], [], []
success = fail = kakao_cnt = nomi_cnt = 0

for i, row in df_all.iterrows():
    lat, lon, src = geocode(row["주소"])
    lats.append(lat)
    lons.append(lon)
    sources.append(src)

    if src != "fail":
        success += 1
        if src == "kakao":   kakao_cnt += 1
        else:                nomi_cnt  += 1
    else:
        fail += 1

    if (i + 1) % 50 == 0 or (i + 1) == len(df_all):
        print(f"  [{i+1:3d}/{len(df_all)}] 성공 {success} / 실패 {fail}")

    # 요청 간격
    time.sleep(0.15)   # Nominatim: 1초 1건 권고 → 완화해서 0.15s 간격

df_all["위도"]  = lats
df_all["경도"]  = lons
df_all["geo_src"] = sources
df_all["시설유형"] = "놀이터"

print(f"\n[지오코딩 결과]")
print(f"  시도: {len(df_all)}건  성공: {success}건  실패: {fail}건")
print(f"  카카오: {kakao_cnt}건  Nominatim: {nomi_cnt}건")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. 후처리 + 공간 중복 제거
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. 후처리 + parks.csv 중복 제거")
print("=" * 60)

# 좌표 성공 + 인천 범위 필터
df_geo = df_all.dropna(subset=["위도", "경도"]).copy()
df_geo = df_geo[
    df_geo["위도"].between(LAT_MIN, LAT_MAX) &
    df_geo["경도"].between(LON_MIN, LON_MAX)
].reset_index(drop=True)
print(f"좌표 보유 + 인천 범위 내: {len(df_geo)}행")

# parks.csv 로드
parks = pd.read_csv(PARKS_CSV, encoding="utf-8-sig")
parks.to_csv(BACKUP_CSV, index=False, encoding="utf-8-sig")
print(f"parks.csv 백업: {BACKUP_CSV} ({len(parks)}행)")

# GeoDataFrame 변환
gdf_new = gpd.GeoDataFrame(
    df_geo,
    geometry=gpd.points_from_xy(df_geo["경도"], df_geo["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

gdf_parks = gpd.GeoDataFrame(
    parks,
    geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)

# sjoin_nearest
gdf_joined = gpd.sjoin_nearest(
    gdf_new,
    gdf_parks[["geometry"]],
    how="left",
    distance_col="dist_to_park",
)
gdf_joined = gdf_joined[~gdf_joined.index.duplicated(keep="first")]

duplicates = gdf_joined[gdf_joined["dist_to_park"] <= 50]
standalone = gdf_joined[gdf_joined["dist_to_park"] >  50]
print(f"50m 중복 제거: {len(duplicates)}행  →  신규 추가: {len(standalone)}행")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4. parks.csv 업데이트
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 4. parks.csv 업데이트")
print("=" * 60)

# 신규 놀이터를 parks 컬럼 형식으로 변환
if len(standalone) > 0:
    # 기존 PLAYGROUND 번호 이어받기
    existing_pg = parks[parks["관리번호"].astype(str).str.startswith("PLAYGROUND")]
    next_num = len(existing_pg)

    new_rows = standalone[["시설명", "위도", "경도", "gu", "시설유형"]].copy()
    new_rows = new_rows.rename(columns={"시설명": "공원명"})
    new_rows["관리번호"] = [
        f"PLAYGROUND-{next_num + i:04d}" for i in range(len(new_rows))
    ]
    new_rows["공원구분"] = "놀이터"
    new_rows["공원면적"] = None
    new_rows = new_rows[parks.columns]

    result = pd.concat([parks, new_rows], ignore_index=True)
else:
    result = parks.copy()

result.to_csv(PARKS_CSV, index=False, encoding="utf-8-sig")

# 지오코딩 결과 별도 저장 (신규 추가분)
if len(standalone) > 0:
    save_cols = ["시설명", "gu", "주소", "위도", "경도", "시설유형", "geo_src"]
    standalone[save_cols].to_csv(GEO_OUT, index=False, encoding="utf-8-sig")
    print(f"geocoded_playground.csv 저장: {GEO_OUT}")
else:
    df_geo[["시설명","gu","주소","위도","경도","시설유형","geo_src"]].to_csv(
        GEO_OUT, index=False, encoding="utf-8-sig")
    print(f"geocoded_playground.csv 저장 (전체 지오코딩 결과): {GEO_OUT}")


# ─────────────────────────────────────────────────────────────────────────────
# 최종 통계 출력
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("최종 통계")
print("=" * 60)
print(f"지오코딩 시도: {len(df_all)}건")
print(f"  성공: {success}건  (카카오 {kakao_cnt} / Nominatim {nomi_cnt})")
print(f"  실패: {fail}건")
print(f"50m 중복 제거: {len(duplicates)}행")
print(f"신규 추가:     {len(standalone)}행")
print(f"parks.csv 최종: {len(result)}행")
print()
print("[gu별 놀이터 수 (전체 parks.csv)]")
pg_all = result[result["시설유형"] == "놀이터"]
print(pg_all["gu"].value_counts().to_string())
print()
michuhol_pg   = result[(result["gu"] == "미추홀구") & (result["시설유형"] == "놀이터")]
michuhol_park = result[(result["gu"] == "미추홀구") & (result["시설유형"] != "놀이터")]
print(f"미추홀구: 공원 {len(michuhol_park)}개 / 놀이터 {len(michuhol_pg)}개 / 합계 {len(michuhol_park)+len(michuhol_pg)}개")
