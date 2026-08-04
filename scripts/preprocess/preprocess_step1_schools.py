"""
1단계: 전국초중등학교위치표준데이터.json
대상 교육청 초등학교만 필터링 → data/processed/schools.csv

[전국 확장] scripts/config/region_config.py 의 CITY_EDUCATION_OFFICE 를 변경하면
다른 시도 교육청으로 전환됩니다.
"""
import json
import csv
import os
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT))
from scripts.config.region_config import CITY_EDUCATION_OFFICE  # noqa: E402

INPUT_FILE = r"c:\2026_data_analysis_park\data\raw\전국초중등학교위치표준데이터.json"
OUTPUT_FILE = r"c:\2026_data_analysis_park\data\processed\schools.csv"
OUTPUT_COLS = ["학교ID", "학교명", "위도", "경도", "소재지도로명주소", "시도교육청명"]

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

print("JSON 로딩 중...")
with open(INPUT_FILE, encoding="utf-8") as f:
    data = json.load(f)

records = data["records"]
print(f"전체 레코드 수: {len(records)}")

# 대상 교육청 + 초등학교 필터 (region_config.CITY_EDUCATION_OFFICE)
filtered = [
    r for r in records
    if r.get("시도교육청명", "") == CITY_EDUCATION_OFFICE
    and r.get("학교급구분", "") == "초등학교"
    and r.get("운영상태", "") == "운영"
]
print(f"인천 초등학교 (운영중): {len(filtered)}개")

# 컬럼 매핑
col_map = {
    "학교ID": "학교ID",
    "학교명": "학교명",
    "위도": "위도",
    "경도": "경도",
    "소재지도로명주소": "소재지도로명주소",
    "시도교육청명": "시도교육청명",
}

with open(OUTPUT_FILE, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=OUTPUT_COLS, extrasaction="ignore")
    writer.writeheader()
    for r in filtered:
        row = {col: r.get(col, "") for col in OUTPUT_COLS}
        writer.writerow(row)

print(f"저장 완료: {OUTPUT_FILE}")

# 샘플 출력
print("\n[샘플 5행]")
with open(OUTPUT_FILE, encoding="utf-8-sig") as f:
    for i, line in enumerate(f):
        print(line.rstrip())
        if i >= 5:
            break
