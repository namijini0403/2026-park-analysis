"""
2단계: 전국도시공원정보표준데이터.json
대상 도시 공원 필터링 + 공원구분(어린이/소공원/근린/수변) 필터링 → data/processed/parks.csv

[전국 확장] scripts/config/region_config.py 의 CITY_SHORT 를 변경하면
다른 시도 공원으로 전환됩니다.
"""
import json
import csv
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT))
from scripts.config.region_config import CITY_SHORT  # noqa: E402

INPUT_FILE = r"c:\2026_data_analysis_park\data\raw\전국도시공원정보표준데이터.json"
OUTPUT_FILE = r"c:\2026_data_analysis_park\data\processed\parks.csv"
OUTPUT_COLS = ["관리번호", "공원명", "공원구분", "위도", "경도", "공원면적"]
TARGET_TYPES = {"어린이공원", "소공원", "근린공원", "수변공원"}

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

print("JSON 로딩 중...")
with open(INPUT_FILE, encoding="utf-8") as f:
    data = json.load(f)

records = data["records"]
print(f"전체 레코드 수: {len(records)}")

# 대상 도시 공원 필터 (도로명주소 또는 지번주소 기준, region_config.CITY_SHORT)
target_city = [
    r for r in records
    if str(r.get("소재지도로명주소", "")).startswith(CITY_SHORT)
    or str(r.get("소재지지번주소", "")).startswith(CITY_SHORT)
]
print(f"{CITY_SHORT} 전체 공원: {len(target_city)}개")

# 공원구분 필터
filtered = [r for r in target_city if r.get("공원구분", "") in TARGET_TYPES]
print(f"공원구분 필터 후: {len(filtered)}개")

from collections import Counter
print("공원구분 분포:", dict(Counter(r.get("공원구분") for r in filtered)))

# 위경도 결측 확인
no_coords = [r for r in filtered if not r.get("위도") or not r.get("경도")]
print(f"위경도 결측: {len(no_coords)}개")
if no_coords:
    for r in no_coords[:5]:
        print(f"  - {r.get('공원명')} / {r.get('소재지지번주소')}")

with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=OUTPUT_COLS, extrasaction="ignore")
    writer.writeheader()
    for r in filtered:
        row = {col: r.get(col, "") for col in OUTPUT_COLS}
        writer.writerow(row)

print(f"\n저장 완료: {OUTPUT_FILE}")

# 샘플 출력
print("\n[샘플 5행]")
with open(OUTPUT_FILE, encoding="utf-8-sig") as f:
    for i, line in enumerate(f):
        print(line.rstrip())
        if i >= 5:
            break
