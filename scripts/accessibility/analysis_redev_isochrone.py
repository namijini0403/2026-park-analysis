# -*- coding: utf-8 -*-
"""
STEP 1. redevelopment.csv 지오코딩 (캐시 활용 + 실패분 재시도)
         → redevelopment.csv에 위도/경도 컬럼 추가 후 덮어쓰기
STEP 2. 미추홀구 우선지원 5개교 등시선 × 재개발 중심점 교차 분석
STEP 3. 전체 학교 nearby_redev_count 재산출 (등시선 500m 기준)
         → school_priority.csv 업데이트
"""
import sys, os, time, re, warnings
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import geopandas as gpd
import requests
from dotenv import load_dotenv

load_dotenv(r"c:\2026_data_analysis_park\.env")
KAKAO_KEY = os.getenv("KAKAO_REST_KEY")

OUT          = r"c:\2026_data_analysis_park\data\processed"
REDEV_CSV    = f"{OUT}/redevelopment.csv"
REDEV_GEO    = f"{OUT}/redevelopment_geocoded.csv"
ISO_PATH     = f"{OUT}/school_isochrone_500m.geojson"
PRIORITY_CSV = f"{OUT}/school_priority.csv"
CRS          = "EPSG:5179"

TARGET_SCHOOLS = [
    "인천주안초등학교", "인천남부초등학교", "인천주안남초등학교",
    "인천석암초등학교", "인천대화초등학교",
]


# ─────────────────────────────────────────────────────────────────────────────
# 카카오 API 확인
# ─────────────────────────────────────────────────────────────────────────────
print("카카오 API 확인...")
res = requests.get(
    "https://dapi.kakao.com/v2/local/search/address.json",
    headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
    params={"query": "인천광역시 미추홀구 주안동"},
    timeout=5,
)
if not (res.status_code == 200 and res.json().get("documents")):
    print(f"  HTTP {res.status_code} → 스크립트 중단")
    sys.exit(1)
print(f"  키 유효: {KAKAO_KEY[:8]}...")


# ─────────────────────────────────────────────────────────────────────────────
# 지오코딩 함수 (3가지 쿼리 시도)
# ─────────────────────────────────────────────────────────────────────────────
def kakao_geocode(query):
    try:
        r = requests.get(
            "https://dapi.kakao.com/v2/local/search/address.json",
            headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
            params={"query": query},
            timeout=5,
        )
        docs = r.json().get("documents", []) if r.status_code == 200 else []
        if docs:
            return float(docs[0]["y"]), float(docs[0]["x"])
    except Exception:
        pass
    return None, None


def build_queries(gu, loc):
    """위치 문자열로부터 카카오 검색 쿼리 3가지 생성"""
    # [전국 확장] from scripts.config.region_config import CITY_NAME
    prefix = f"인천광역시 {gu} "
    loc = str(loc).strip()

    queries = []

    # 1) '일원' 이전 + '및' 이전 첫 번지 주소
    part = re.split(r'\s*(일원|및)\s*', loc)[0].strip()
    queries.append(prefix + part)

    # 2) 첫 번째 번지 번호만 (숫자-숫자 형태 or 숫자번지)
    m = re.search(r'(\d[\d\-]*)\s*번지', loc)
    if m:
        dong = re.split(r'\d', loc)[0].strip()
        queries.append(prefix + dong + " " + m.group(1) + "번지")

    # 3) 도로명 주소 패턴 (로/길 포함 시)
    m2 = re.search(r'[\w가-힣]+(?:로|길)\s*\d+', loc)
    if m2:
        queries.append(prefix + m2.group(0))

    return queries


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1-A. 캐시 로드 + 실패분 재시도
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 1. 재개발 구역 지오코딩")
print("=" * 60)

geo = pd.read_csv(REDEV_GEO, encoding="utf-8-sig")
print(f"캐시 로드: {len(geo)}행  (좌표 있음: {geo['위도'].notna().sum()} / 없음: {geo['위도'].isna().sum()})")

need = geo[geo["위도"].isna()].copy()
print(f"재시도 대상: {len(need)}건")

if len(need) > 0:
    success = fail = 0
    for idx, row in need.iterrows():
        queries = build_queries(row["구명"], row["위치"])
        lat = lon = None
        for q in queries:
            lat, lon = kakao_geocode(q)
            if lat is not None:
                break
            time.sleep(0.05)

        if lat is not None:
            geo.loc[idx, "위도"] = lat
            geo.loc[idx, "경도"] = lon
            success += 1
        else:
            fail += 1
        time.sleep(0.12)

    print(f"재시도 결과: 성공 {success} / 실패 {fail}")
    geo.to_csv(REDEV_GEO, index=False, encoding="utf-8-sig")
    print(f"캐시 업데이트: {REDEV_GEO}")

redev_valid = geo.dropna(subset=["위도", "경도"]).copy()
print(f"\n최종 좌표 확보: {len(redev_valid)} / {len(geo)}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1-B. redevelopment.csv 덮어쓰기 (위도/경도 컬럼 추가)
# ─────────────────────────────────────────────────────────────────────────────
redev_orig = pd.read_csv(REDEV_CSV, encoding="utf-8-sig")
# 기존 위도/경도 컬럼 제거 후 새로 병합
for col in ["위도", "경도"]:
    if col in redev_orig.columns:
        redev_orig.drop(columns=[col], inplace=True)

redev_updated = redev_orig.merge(
    geo[["구명", "구역명", "위치", "위도", "경도"]],
    on=["구명", "구역명", "위치"],
    how="left",
)
redev_updated.to_csv(REDEV_CSV, index=False, encoding="utf-8-sig")
print(f"redevelopment.csv 업데이트: {REDEV_CSV}")
print(f"  위도 있음: {redev_updated['위도'].notna().sum()} / 전체: {len(redev_updated)}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2. 등시선 × 재개발 중심점 공간 교차
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 2. 등시선 × 재개발 중심점 교차 분석")
print("=" * 60)

# 등시선 로드
gdf_iso = gpd.read_file(ISO_PATH).to_crs(CRS)
print(f"등시선: {len(gdf_iso)}개")

# 재개발 중심점 GeoDataFrame
gdf_redev = gpd.GeoDataFrame(
    redev_valid,
    geometry=gpd.points_from_xy(redev_valid["경도"], redev_valid["위도"]),
    crs="EPSG:4326",
).to_crs(CRS)
print(f"재개발 중심점: {len(gdf_redev)}개")

# 공간 조인: 재개발 중심점 within 등시선
joined = gpd.sjoin(
    gdf_redev[["구명", "구역명", "geometry"]],
    gdf_iso[["학교ID", "학교명", "gu", "geometry"]],
    how="inner",
    predicate="within",
)
print(f"교차 쌍: {len(joined)}건 (재개발 중심점 within 등시선)")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2-A. 우선지원 5개교 상세 출력
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("우선지원 5개교 등시선 내 재개발 구역")
print("=" * 60)

for school in TARGET_SCHOOLS:
    sub = joined[joined["학교명"] == school]
    print(f"\n[{school}]")
    print(f"  등시선 내 재개발 구역: {len(sub)}개")
    if len(sub) > 0:
        for _, r in sub.iterrows():
            print(f"    - {r['구명']} {r['구역명']}")
    else:
        print("    (없음 — 등시선이 재개발 구역 중심점을 포함하지 않음)")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3. 전체 학교 nearby_redev_count 산출 (등시선 기준)
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("STEP 3. 전체 학교 nearby_redev_count 재산출 (등시선 기준)")
print("=" * 60)

redev_count = (
    joined.groupby("학교ID").size()
    .reset_index(name="nearby_redev_count")
)

priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")

# 기존 nearby_redev_count 제거 후 재병합
if "nearby_redev_count" in priority.columns:
    priority.drop(columns=["nearby_redev_count"], inplace=True)

priority = priority.merge(
    gdf_iso[["학교ID", "학교명"]].drop_duplicates(),
    on="학교명", how="left",
    suffixes=("", "_iso"),
)
# 학교ID_iso가 생긴 경우 통합
if "학교ID_iso" in priority.columns:
    mask = priority["학교ID"].isna()
    priority.loc[mask, "학교ID"] = priority.loc[mask, "학교ID_iso"]
    priority.drop(columns=["학교ID_iso"], inplace=True)

priority = priority.merge(redev_count, on="학교ID", how="left")
priority["nearby_redev_count"] = priority["nearby_redev_count"].fillna(0).astype(int)

print(f"nearby_redev_count 분포:")
print(priority["nearby_redev_count"].value_counts().sort_index().to_string())

# 미추홀구 상세
print()
print("미추홀구 학교 nearby_redev_count:")
mich = priority[priority["gu"] == "미추홀구"].sort_values(
    "nearby_redev_count", ascending=False
)[["학교명", "nearby_redev_count", "case_type", "priority_score", "cluster"]]
print(mich.to_string(index=False))

# 저장 (학교ID 컬럼은 원래 없으면 제거)
save_cols = [c for c in priority.columns if c != "학교ID"]
priority[save_cols].to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")
print()
print(f"저장 완료: {PRIORITY_CSV}")
print(f"nearby_redev_count: 등시선 500m 기준으로 교체 완료")
