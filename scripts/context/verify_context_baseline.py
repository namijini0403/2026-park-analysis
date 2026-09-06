# -*- coding: utf-8 -*-
"""school_context_summary.json 의 학교-시설 공간조인을 CSV에서 독립 재계산해 대조한다.

빌더(scripts/build_context_layers.py)를 import 하지 않고, 입력 CSV만 읽어
자체 거리 계산(단위구 3D 벡터 현(chord) → 대원거리)으로 500m 이내 조합을 다시 만든 뒤
산출물과 **완전 일치**하는지 확인한다. 불일치가 하나라도 있으면 종료코드 1.

실행:
  python scripts/context/verify_context_baseline.py
  python scripts/context/verify_context_baseline.py --json   # 기계 판독용 요약
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_DIR = REPO_ROOT / "data" / "context_sources"
SCHOOLS_CSV = REPO_ROOT / "data_processed" / "schools.csv"
SUMMARY_PATH = REPO_ROOT / "data_processed" / "context" / "school_context_summary.json"
MANIFEST_PATH = REPO_ROOT / "data_processed" / "context" / "context_layers_manifest.json"

RADIUS_M = 500.0
EARTH_R = 6371008.8
BOUNDS = (36.0, 39.0, 124.0, 128.0)  # lat_min, lat_max, lng_min, lng_max
GU_PAT = re.compile(r"인천광역시\s*(\S+?[구군])")

NIGHTLIFE_FILE = "incheon_nightlife_geocoded.csv"
CONSTRUCTION_FILES = [
    "construction_geocoded_exact.csv",
    "construction_geocoded_yeonsu_kakao.csv",
    "construction_geocoded_gyeyang.csv",
    "construction_geocoded_michuhol.csv",
]


def great_circle_m(lat1, lng1, lat2, lng2) -> float:
    """단위구 위 두 점의 3D 현 길이 -> 대원거리 (하버사인 식을 쓰지 않은 독립 구현)."""
    p1, l1 = math.radians(lat1), math.radians(lng1)
    p2, l2 = math.radians(lat2), math.radians(lng2)
    x1, y1, z1 = math.cos(p1) * math.cos(l1), math.cos(p1) * math.sin(l1), math.sin(p1)
    x2, y2, z2 = math.cos(p2) * math.cos(l2), math.cos(p2) * math.sin(l2), math.sin(p2)
    chord = math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2)
    return 2.0 * EARTH_R * math.asin(min(1.0, chord / 2.0))


def read_rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [dict(r) for r in csv.DictReader(f)]


def as_float(value):
    try:
        num = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) else None


def in_bounds(lat, lng) -> bool:
    return (lat is not None and lng is not None
            and BOUNDS[0] <= lat <= BOUNDS[1] and BOUNDS[2] <= lng <= BOUNDS[3])


def load_schools() -> list[dict]:
    out = []
    for row in read_rows(SCHOOLS_CSV):
        lat, lng = as_float(row.get("위도")), as_float(row.get("경도"))
        if not in_bounds(lat, lng):
            lat = lng = None
        m = GU_PAT.search((row.get("소재지도로명주소") or "").strip())
        out.append({"school_id": (row.get("학교ID") or "").strip(),
                    "name": (row.get("학교명") or "").strip(),
                    "gu": m.group(1) if m else None, "lat": lat, "lng": lng})
    return [s for s in out if s["school_id"]]


def load_nightlife() -> list[dict]:
    seen, out = set(), []
    for row in read_rows(SOURCES_DIR / NIGHTLIFE_FILE):
        fid = (row.get("source_record_id") or "").strip()
        if not fid or fid in seen:
            continue
        seen.add(fid)
        status = (row.get("business_status") or "").strip()
        if not re.search(r"영업|정상|운영", status) or re.search(r"폐업|말소|취소|정지|휴업|폐쇄", status):
            continue
        lat, lng = as_float(row.get("latitude")), as_float(row.get("longitude"))
        if not in_bounds(lat, lng):
            continue
        out.append({"facility_id": fid, "lat": lat, "lng": lng})
    return out


def load_construction() -> tuple[list[dict], set[str]]:
    seen, out, gus = set(), [], set()
    for name in CONSTRUCTION_FILES:
        path = SOURCES_DIR / name
        if not path.exists():
            continue
        for row in read_rows(path):
            fid = (row.get("source_record_id") or "").strip()
            if not fid or fid in seen:
                continue
            seen.add(fid)
            m = GU_PAT.match((row.get("address") or "").strip())
            if m:
                gus.add(m.group(1))
            lat, lng = as_float(row.get("latitude")), as_float(row.get("longitude"))
            if not in_bounds(lat, lng):
                continue
            out.append({"facility_id": fid, "lat": lat, "lng": lng,
                        "use_approved": bool((row.get("approval_date") or "").strip())})
    return out, gus


def pairs_for(school, facilities):
    hits = []
    for fac in facilities:
        d = great_circle_m(school["lat"], school["lng"], fac["lat"], fac["lng"])
        if d <= RADIUS_M:
            hits.append((fac["facility_id"], round(d, 1), fac))
    hits.sort(key=lambda h: (h[1], h[0]))
    return hits


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="맥락 레이어 공간조인 독립 재계산 대조")
    parser.add_argument("--json", action="store_true", help="요약을 JSON으로 출력")
    args = parser.parse_args(argv)

    if not SUMMARY_PATH.exists():
        print("school_context_summary.json 이 없습니다. 먼저 빌드하세요.", file=sys.stderr)
        return 2
    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))["schools"]
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    covered_gus = set(manifest["layers"]["construction_records"].get("coverage_regions") or [])

    schools = load_schools()
    nightlife = load_nightlife()
    construction, construction_gus = load_construction()

    mismatches: list[str] = []
    n_obs_schools = n_pairs = n_max = 0
    c_obs_schools = c_pairs = c_max = c_completed = 0

    for school in schools:
        node = summary.get(school["school_id"])
        if node is None:
            mismatches.append(f"{school['school_id']}: 요약에 학교 없음")
            continue

        # 유흥·단란주점
        got = node["nightlife"]
        if school["lat"] is None:
            if got.get("observed_count") is not None:
                mismatches.append(f"{school['school_id']}: 좌표 미상인데 observed_count 존재")
        else:
            hits = pairs_for(school, nightlife)
            expected_ids = [h[0] for h in hits]
            actual = got.get("records") or []
            actual_ids = [r["facility_id"] for r in actual]
            if sorted(expected_ids) != sorted(actual_ids):
                mismatches.append(
                    f"{school['school_id']} nightlife record ID 불일치 "
                    f"(재계산 {len(expected_ids)} vs 산출물 {len(actual_ids)})")
            else:
                by_id = {h[0]: h[1] for h in hits}
                for rec in actual:
                    if abs(by_id[rec["facility_id"]] - rec["distance_m"]) > 0.2:
                        mismatches.append(
                            f"{school['school_id']}/{rec['facility_id']} 거리 불일치 "
                            f"{by_id[rec['facility_id']]} vs {rec['distance_m']}")
            if got.get("observed_count") != len(expected_ids):
                mismatches.append(f"{school['school_id']}: observed_count 불일치")
            if got.get("total_count") is not None:
                mismatches.append(f"{school['school_id']}: total_count 가 null 이 아님")
            n_pairs += len(expected_ids)
            n_max = max(n_max, len(expected_ids))
            if expected_ids:
                n_obs_schools += 1

        # 공사장 행정기록 (수집 구만)
        gotc = node["construction"]
        if school["gu"] in covered_gus and school["lat"] is not None:
            hits = pairs_for(school, construction)
            expected_ids = [h[0] for h in hits]
            actual_ids = [r["facility_id"] for r in (gotc.get("records") or [])]
            if sorted(expected_ids) != sorted(actual_ids):
                mismatches.append(
                    f"{school['school_id']} construction record ID 불일치 "
                    f"(재계산 {len(expected_ids)} vs 산출물 {len(actual_ids)})")
            if gotc.get("observed_count") != len(expected_ids):
                mismatches.append(f"{school['school_id']}: construction observed_count 불일치")
            completed = sum(1 for h in hits if h[2]["use_approved"])
            if gotc.get("observed_completed_count") != completed:
                mismatches.append(f"{school['school_id']}: observed_completed_count 불일치")
            c_pairs += len(expected_ids)
            c_max = max(c_max, len(expected_ids))
            c_completed += completed
            if expected_ids:
                c_obs_schools += 1
        else:
            if gotc.get("observed_count") is not None:
                mismatches.append(
                    f"{school['school_id']}: 미수집 구({school['gu']})인데 observed_count 존재")

    result = {
        "schools_total": len(schools),
        "nightlife": {
            "facilities_used": len(nightlife),
            "schools_with_observed_facilities": n_obs_schools,
            "school_facility_observed_pairs": n_pairs,
            "max_observed_count": n_max,
        },
        "construction": {
            "facilities_used": len(construction),
            "coverage_regions": sorted(covered_gus),
            "gus_present_in_files": sorted(construction_gus),
            "schools_with_observed_facilities": c_obs_schools,
            "school_facility_observed_pairs": c_pairs,
            "max_observed_count": c_max,
            "observed_completed_pairs": c_completed,
        },
        "mismatches": mismatches,
        "match": not mismatches,
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print("[verify] 독립 재계산 (자체 거리식, 빌더 미사용)")
        print(f"  학교 {result['schools_total']}개")
        n = result["nightlife"]
        print(f"  유흥·단란주점: 사용 좌표 {n['facilities_used']}건 / "
              f"관측 학교 {n['schools_with_observed_facilities']} / "
              f"학교-시설 조합 {n['school_facility_observed_pairs']} / "
              f"최대 {n['max_observed_count']}")
        c = result["construction"]
        print(f"  공사 행정기록: 사용 좌표 {c['facilities_used']}건 / 커버 구 {c['coverage_regions']} / "
              f"관측 학교 {c['schools_with_observed_facilities']} / "
              f"학교-시설 조합 {c['school_facility_observed_pairs']} / "
              f"최대 {c['max_observed_count']} / 사용승인 완료 조합 {c['observed_completed_pairs']}")
        if mismatches:
            print(f"  ✗ 불일치 {len(mismatches)}건")
            for line in mismatches[:20]:
                print("    -", line)
        else:
            print("  ✓ school_context_summary.json 과 완전 일치")
    return 0 if not mismatches else 1


if __name__ == "__main__":
    sys.exit(main())
