# -*- coding: utf-8 -*-
"""
재개발 구역 근접성 분석
- redevelopment.csv 전 구역 카카오 지오코딩
- 각 학교 기준 1km 내 재개발 구역 수 산출
- 결과: school_priority.csv에 nearby_redev_count 추가
"""
import sys, os, time, warnings
sys.stdout.reconfigure(encoding="utf-8")
warnings.filterwarnings("ignore")

import pandas as pd
import requests
from geopy.distance import geodesic
from dotenv import load_dotenv

load_dotenv(r"c:\2026_data_analysis_park\.env")
KAKAO_KEY = os.getenv("KAKAO_REST_KEY")

OUT  = r"c:\2026_data_analysis_park\data\processed"
REDEV_CSV    = f"{OUT}/redevelopment.csv"
SCHOOLS_CSV  = f"{OUT}/schools.csv"
PRIORITY_CSV = f"{OUT}/school_priority.csv"
REDEV_GEO    = f"{OUT}/redevelopment_geocoded.csv"  # 지오코딩 캐시

RADIUS_M = 1000  # 1km

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
if res.status_code == 200 and res.json().get("documents"):
    print(f"  키 유효: {KAKAO_KEY[:8]}...")
else:
    print(f"  HTTP {res.status_code} → 스크립트 중단")
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# 재개발 데이터 로드
# ─────────────────────────────────────────────────────────────────────────────
redev = pd.read_csv(REDEV_CSV, encoding="utf-8-sig")
print(f"\n재개발 구역: {len(redev)}개")
print(f"  구별: {redev['구명'].value_counts().to_dict()}")

# ─────────────────────────────────────────────────────────────────────────────
# 지오코딩 (캐시 파일 있으면 재사용)
# ─────────────────────────────────────────────────────────────────────────────
if os.path.exists(REDEV_GEO):
    redev_geo = pd.read_csv(REDEV_GEO, encoding="utf-8-sig")
    print(f"\n캐시 로드: {REDEV_GEO} ({len(redev_geo)}행)")
    # 미지오코딩 행 보완
    need = redev_geo[redev_geo["위도"].isna()]
    print(f"  좌표 있음: {redev_geo['위도'].notna().sum()} / 없음: {len(need)}")
else:
    redev_geo = redev.copy()
    redev_geo["위도"] = None
    redev_geo["경도"] = None
    need = redev_geo.copy()
    print(f"\n캐시 없음 → 전체 {len(need)}건 지오코딩")

# 지오코딩 실행 (미완료 행만)
if len(need) > 0:
    print()
    print("=" * 60)
    print(f"카카오 지오코딩 ({len(need)}건)")
    print("=" * 60)

    success = fail = 0
    for i, row in need.iterrows():
        query = f"인천광역시 {row['구명']} {str(row['위치']).split('일원')[0].strip()}"
        # '일원' 이후 불필요한 설명 제거
        try:
            res = requests.get(
                "https://dapi.kakao.com/v2/local/search/address.json",
                headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
                params={"query": query},
                timeout=5,
            )
            docs = res.json().get("documents", []) if res.status_code == 200 else []
            if docs:
                redev_geo.loc[i, "위도"] = float(docs[0]["y"])
                redev_geo.loc[i, "경도"] = float(docs[0]["x"])
                success += 1
            else:
                # 쿼리 단순화 재시도: 첫 번째 '번지' 앞까지만
                query2 = f"인천광역시 {row['구명']} {str(row['위치']).split('번지')[0].strip()}번지"
                res2 = requests.get(
                    "https://dapi.kakao.com/v2/local/search/address.json",
                    headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
                    params={"query": query2},
                    timeout=5,
                )
                docs2 = res2.json().get("documents", []) if res2.status_code == 200 else []
                if docs2:
                    redev_geo.loc[i, "위도"] = float(docs2[0]["y"])
                    redev_geo.loc[i, "경도"] = float(docs2[0]["x"])
                    success += 1
                else:
                    fail += 1
        except Exception as e:
            fail += 1

        if (i + 1) % 30 == 0 or (i + 1) == len(need):
            print(f"  [{i+1:3d}/{len(need)}] 성공 {success} / 실패 {fail}")
        time.sleep(0.12)

    print(f"\n지오코딩 완료: 성공 {success} / 실패 {fail}")
    redev_geo.to_csv(REDEV_GEO, index=False, encoding="utf-8-sig")
    print(f"캐시 저장: {REDEV_GEO}")

# 좌표 있는 구역만 사용
redev_valid = redev_geo.dropna(subset=["위도", "경도"]).copy()
print(f"\n좌표 확보 구역: {len(redev_valid)} / {len(redev_geo)}")

# ─────────────────────────────────────────────────────────────────────────────
# 학교 좌표 준비
# ─────────────────────────────────────────────────────────────────────────────
schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")

# school_priority.csv ← schools.csv 좌표 조인
priority = priority.merge(
    schools[["학교명", "위도", "경도"]],
    on="학교명", how="left",
)
print(f"\n학교 좌표 조인: {priority['위도'].notna().sum()}/{len(priority)}")

# ─────────────────────────────────────────────────────────────────────────────
# 1km 내 재개발 구역 수 산출 (전체 학교)
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print(f"1km 내 재개발 구역 수 산출 ({len(priority)}개 학교)")
print("=" * 60)

redev_coords = list(zip(redev_valid["위도"], redev_valid["경도"]))
redev_names  = redev_valid["구역명"].tolist()
redev_gus    = redev_valid["구명"].tolist()

nearby_counts = []
nearby_names_list = []

for _, row in priority.iterrows():
    if pd.isna(row["위도"]):
        nearby_counts.append(0)
        nearby_names_list.append("")
        continue

    school_coord = (row["위도"], row["경도"])
    nearby = []
    for coord, name, gu in zip(redev_coords, redev_names, redev_gus):
        dist = geodesic(school_coord, coord).meters
        if dist <= RADIUS_M:
            nearby.append(f"{gu} {name}")
    nearby_counts.append(len(nearby))
    nearby_names_list.append("; ".join(nearby))

priority["nearby_redev_count"] = nearby_counts
priority["nearby_redev_names"] = nearby_names_list

print(f"  nearby_redev_count 분포:")
print(priority["nearby_redev_count"].value_counts().sort_index().to_string())

# ─────────────────────────────────────────────────────────────────────────────
# 우선지원 5개교 상세 출력
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("우선지원 5개교 재개발 근접성")
print("=" * 60)

for school in TARGET_SCHOOLS:
    row = priority[priority["학교명"] == school]
    if len(row) == 0:
        print(f"\n  [{school}] - 데이터 없음")
        continue
    row = row.iloc[0]
    print(f"\n[{school}]")
    print(f"  좌표: ({row['위도']:.6f}, {row['경도']:.6f})")
    print(f"  1km 내 재개발 구역 수: {row['nearby_redev_count']}개")
    if row["nearby_redev_count"] > 0:
        for name in row["nearby_redev_names"].split("; "):
            print(f"    - {name}")
    else:
        print("    (없음)")

# ─────────────────────────────────────────────────────────────────────────────
# 미추홀구 전체 재개발 근접성
# ─────────────────────────────────────────────────────────────────────────────
print()
print("=" * 60)
print("미추홀구 학교 재개발 근접성")
print("=" * 60)

mich = priority[priority["gu"] == "미추홀구"].sort_values(
    "nearby_redev_count", ascending=False
)[["학교명", "nearby_redev_count", "case_type", "priority_score", "cluster"]]
print(mich.to_string(index=False))

# ─────────────────────────────────────────────────────────────────────────────
# school_priority.csv 저장 (위도/경도 임시 컬럼 제외)
# ─────────────────────────────────────────────────────────────────────────────
save_cols = [c for c in priority.columns if c not in ["위도", "경도", "nearby_redev_names"]]
priority[save_cols].to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")
print()
print(f"저장 완료: {PRIORITY_CSV}")
print(f"추가 컬럼: nearby_redev_count")
