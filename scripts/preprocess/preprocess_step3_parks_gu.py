"""
1단계: parks.csv에 gu 컬럼 추가
원본 JSON 지번주소에서 구 추출 → parks.csv 덮어쓰기
"""
import json
import csv
import os

JSON_FILE = r"c:\2026_data_analysis_park\data\raw\전국도시공원정보표준데이터.json"
PARKS_FILE = r"c:\2026_data_analysis_park\data\processed\parks.csv"
TARGET_TYPES = {"어린이공원", "소공원", "근린공원", "수변공원"}

print("JSON 로딩 중...")
with open(JSON_FILE, encoding="utf-8") as f:
    data = json.load(f)

# 관리번호 → gu 매핑 생성 (인천 + 대상 공원구분)
# [전국 확장] from scripts.config.region_config import CITY_SHORT → startswith(CITY_SHORT)
gu_map = {}
no_gu = []
for r in data["records"]:
    addr_jibun  = str(r.get("소재지지번주소",  "") or "")
    addr_road   = str(r.get("소재지도로명주소", "") or "")
    is_incheon  = addr_jibun.startswith("인천") or addr_road.startswith("인천")
    if not is_incheon or r.get("공원구분", "") not in TARGET_TYPES:
        continue
    # 구 추출: 지번주소 우선, 없으면 도로명
    addr = addr_jibun if addr_jibun.startswith("인천") else addr_road
    parts = addr.split()
    gu = next((p for p in parts if p.endswith("구") or p.endswith("군")), None)
    if gu:
        gu_map[r["관리번호"]] = gu
    else:
        gu_map[r["관리번호"]] = "미상"
        no_gu.append(r["관리번호"])

print(f"gu 매핑 생성: {len(gu_map)}개")
if no_gu:
    print(f"  구 추출 실패 ({len(no_gu)}개): {no_gu[:5]}")

# parks.csv 읽기
with open(PARKS_FILE, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    rows = list(reader)

# gu 컬럼 추가
if "gu" not in fieldnames:
    fieldnames = fieldnames + ["gu"]

matched, unmatched = 0, 0
for row in rows:
    gu = gu_map.get(row["관리번호"], "")
    row["gu"] = gu
    if gu:
        matched += 1
    else:
        unmatched += 1

print(f"gu 매칭: {matched}개 / 미매칭: {unmatched}개")

with open(PARKS_FILE, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

print(f"저장 완료: {PARKS_FILE}")

# 검증
from collections import Counter
print("\n[구별 공원 수]")
counts = Counter(r["gu"] for r in rows)
for gu, cnt in sorted(counts.items(), key=lambda x: -x[1]):
    print(f"  {gu}: {cnt}")
