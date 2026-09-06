# -*- coding: utf-8 -*-
"""학교 맥락 레이어 빌드 (2026-09-06, 실데이터 통합판).

계약: docs/context_layers_contract_20260906.md
검토 반영: outputs/audit_20260906/context_review_round1.md (bbox·부분커버리지·폐업일·
날짜검증·중복동률·URL·학년도추정 결함 수정)

입력 (repo 자체 포함, 원 출처는 outputs/source_research_20260906/ + PROVENANCE 참조)
  data/context_sources/school_designations_2026.csv   2026 AI·디지털 연구 3 + 선도 70
  data/context_sources/school_ai_focus_2026.csv       2026 AI중점학교 107
  data/context_sources/school_digital_tutor_2025.csv  2025 디지털튜터 운영교 87 (과거 이력)
  data/context_sources/school_edu_welfare_2026.csv    2026 교육복지우선지원사업 지원학교 212
  data/context_sources/school_edu_welfare_2025.csv    2025 교육복지우선지원사업 지원학교 225 (과거 이력)
  data/context_sources/school_multicultural_2026.csv  2026 다문화교육 연구·한국어학급·선도학교 100
  data/context_sources/incheon_nightlife_geocoded.csv 유흥·단란주점 인허가 1,534
      (원천 좌표 1,222 + Kakao 주소 지오코딩 310, unresolved 2)
  data/context_sources/construction_geocoded_exact.csv          연수구, 소진공 정확일치 좌표 추정 15
  data/context_sources/construction_geocoded_yeonsu_kakao.csv   연수구, 정확일치 실패 59행 Kakao 재시도
  data/context_sources/construction_geocoded_gyeyang.csv        계양구
  data/context_sources/construction_geocoded_michuhol.csv       미추홀구
      (구별 커버리지는 상수가 아니라 레코드 주소에서 파생. 미수집 구는 계속 unknown.)
  data_processed/schools.csv (학교ID·좌표·주소, 읽기 전용)

출력 (기존 data_processed 파일은 건드리지 않음)
  data_processed/context/context_layers_manifest.json
  data_processed/context/school_designations.json
  data_processed/context/school_context_summary.json
  data_processed/context/facilities_nightlife.geojson
  data_processed/context/facilities_construction.geojson
  data_quality/context_layers_qa_20260906.json

원칙
  - 맥락 정보이지 판정이 아님: 자동 안전 등급·지원 자격·법령 위반 판단에 쓰지 않는다.
  - 미수집/미관측은 0건이 아니다. 좌표 부분 확보 레이어의 학교별 수치는 하한 관측치이며
    total_count는 null로 남긴다.
  - 직선거리(하버사인)이며 도보 경로가 아니다.
  - 결정론: 시계·난수 미사용. --as-of 미지정 시 입력 retrieved_at 최댓값.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import math
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

SOURCES_DIR = REPO_ROOT / "data" / "context_sources"
SCHOOLS_CSV = REPO_ROOT / "data_processed" / "schools.csv"
OUTPUT_DIR = REPO_ROOT / "data_processed" / "context"
QA_PATH = REPO_ROOT / "data_quality" / "context_layers_qa_20260906.json"

RADIUS_M = 500.0

# 좌표 유효 범위: 백령·대청·연평 등 인천 부속도서를 포함하는 광역 범위.
# (원천 수집 검증 범위 경도124~128/위도36~39와 동일 계열. 도시 bbox로 도서를 거절하지 않는다.)
VALID_BOUNDS = {"lat_min": 36.0, "lat_max": 39.0, "lng_min": 124.0, "lng_max": 128.0}

DESIGNATION_FILES = [
    "school_designations_2026.csv",      # 2026 AI·디지털 연구 3 + 선도 70
    "school_ai_focus_2026.csv",          # 2026 AI중점학교 107
    "school_digital_tutor_2025.csv",     # 2025 디지털튜터 운영교 87 (과거 이력)
    "school_edu_welfare_2026.csv",       # 2026 교육복지우선지원사업 지원학교 212
    "school_edu_welfare_2025.csv",       # 2025 교육복지우선지원사업 지원학교 225 (과거 이력)
    "school_multicultural_2026.csv",     # 2026 다문화교육 연구학교·한국어학급·선도학교 100
]

NIGHTLIFE_FILE = "incheon_nightlife_geocoded.csv"
# 구별 원자료 파일. 커버리지(어느 구가 '수집됨'인지)는 상수가 아니라 아래 파일들의
# 레코드 주소에서 파생한다(derive_construction_coverage). 새 구 파일을 여기 추가하면
# 그 구 학교만 partial로 승격되고 나머지 구는 계속 unknown으로 남는다.
CONSTRUCTION_FILES = [
    "construction_geocoded_exact.csv",          # 연수구 · 소진공 상가주소 정확일치 15
    "construction_geocoded_yeonsu_kakao.csv",   # 연수구 · 정확일치 실패 59행 Kakao 재시도
    "construction_geocoded_gyeyang.csv",        # 계양구
    "construction_geocoded_michuhol.csv",       # 미추홀구
]

# 원자료에 남아 있는 옛 행정구역 표기만 명시 등록(추측 매칭 금지).
# 남구 → 미추홀구: 2018-07-01 인천 남구가 미추홀구로 개칭. 미추홀구 착공신고 원자료 일부 행에
# 옛 표기가 남아 있어 커버리지 판정에서 같은 구로 취급한다.
GU_ALIASES = {"남구": "미추홀구"}

# 명시적 무모호 별칭만 등록. 유사도 기반 추측 매칭 금지.
# 중산초등학교: 인천교육청 2025 디지털튜터 명단 표기. schools.csv에서 '중산'을 포함하는
# 학교는 인천중산초등학교(중구, B000027505) 하나뿐이라 무모호 확인 후 등록.
SCHOOL_NAME_ALIASES: dict[str, str] = {
    "중산초등학교": "인천중산초등학교",
}

DATE_PAT = re.compile(r"^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$")
GU_PAT = re.compile(r"인천광역시\s*(\S+?[구군])")


# ── 공통 유틸 ──────────────────────────────────────────────────────────

def parse_date(value: str | None) -> str | None:
    """실존 달력일만 ISO로 반환 (2026-02-31, 0000-01-01 등 거절). 실패 시 None."""
    if not value:
        return None
    m = DATE_PAT.match(str(value).strip())
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    try:
        return datetime.date(y, mo, d).isoformat()
    except ValueError:
        return None


def sanitize_url(value: str | None) -> str | None:
    """http/https URL만 허용. 그 외 스킴(javascript: 등)은 None."""
    url = (value or "").strip()
    if re.match(r"^https?://", url, re.IGNORECASE):
        return url
    return None


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def coord_valid(lat: float | None, lng: float | None) -> bool:
    if lat is None or lng is None:
        return False
    return (VALID_BOUNDS["lat_min"] <= lat <= VALID_BOUNDS["lat_max"]
            and VALID_BOUNDS["lng_min"] <= lng <= VALID_BOUNDS["lng_max"])


def parse_coord(value: str | None) -> float | None:
    try:
        num = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    return num if math.isfinite(num) else None


def stable_digest(*parts: str) -> str:
    return hashlib.sha1("|".join(parts).encode("utf-8")).hexdigest()[:12]


def read_csv_rows(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig", newline="") as f:
        return [dict(row) for row in csv.DictReader(f)]


def write_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


def load_schools(path: Path = SCHOOLS_CSV) -> list[dict]:
    schools = []
    for row in read_csv_rows(path):
        lat = parse_coord(row.get("위도"))
        lng = parse_coord(row.get("경도"))
        if not coord_valid(lat, lng):
            lat = lng = None
        address = (row.get("소재지도로명주소") or "").strip()
        gu_match = GU_PAT.search(address)
        schools.append({
            "school_id": (row.get("학교ID") or "").strip(),
            "school_name": (row.get("학교명") or "").strip(),
            "lat": lat,
            "lng": lng,
            "gu": gu_match.group(1) if gu_match else None,
        })
    return schools


# ── 지정·연구학교 ──────────────────────────────────────────────────────

def school_year_status(school_year: int | None, as_of: str) -> str:
    """학년도(3/1~익년 2월 말) '추정' 기준 current/expired/upcoming/unknown.

    원문에는 연도(학년도)만 있고 실제 지정 시작·종료일이 없으므로 추정이며,
    레코드에 period_basis="school_year_only"로 명시한다.
    """
    if not school_year:
        return "unknown"
    start = datetime.date(school_year, 3, 1)
    next_march = datetime.date(school_year + 1, 3, 1)
    end = next_march - datetime.timedelta(days=1)
    as_of_date = datetime.date.fromisoformat(as_of)
    if start <= as_of_date <= end:
        return "current"
    if as_of_date > end:
        return "expired"
    return "upcoming"


def slugify_designation_id(school_year, designation_type, program_name, school_name) -> str:
    raw = f"desig_{school_year}_{designation_type}_{program_name}_{school_name}"
    return re.sub(r"[^0-9A-Za-z가-힣_·]+", "-", raw)


def match_school(name: str, schools_by_name: dict[str, list[dict]]) -> tuple[str | None, str]:
    resolved = SCHOOL_NAME_ALIASES.get(name, name)
    hits = schools_by_name.get(resolved, [])
    if len(hits) == 1:
        return hits[0]["school_id"], "matched_exact"
    if len(hits) > 1:
        return None, "ambiguous"
    return None, "unmatched"


def build_designations(sources_dir: Path, schools: list[dict], as_of: str, qa: dict):
    """(records, sources, files_loaded)."""
    schools_by_name: dict[str, list[dict]] = {}
    for s in schools:
        schools_by_name.setdefault(s["school_name"], []).append(s)

    seen_ids: set[str] = set()
    records: list[dict] = []
    sources: dict[tuple, dict] = {}
    files_loaded: list[str] = []

    for filename in DESIGNATION_FILES:
        path = sources_dir / filename
        if not path.exists():
            qa["designations"]["missing_input_files"].append(filename)
            continue
        rows = read_csv_rows(path)
        files_loaded.append(filename)
        qa["designations"]["input_rows"] += len(rows)

        for row in rows:
            name = (row.get("school_name") or "").strip()
            level = (row.get("school_level") or "").strip()
            dtype = (row.get("designation_type") or "").strip()
            program = (row.get("program_name") or "").strip()
            if not name or not dtype:
                qa["designations"]["dropped_incomplete"] += 1
                continue
            try:
                year = int(str(row.get("year", "")).strip())
            except ValueError:
                year = None
                qa["designations"]["undated_records"].append({"school_name": name, "reason": "year 파싱 실패"})

            rec_id = slugify_designation_id(year, dtype, program, name)
            if rec_id in seen_ids:
                qa["designations"]["duplicates_collapsed"] += 1
                continue
            seen_ids.add(rec_id)

            if level == "초등학교":
                school_id, matching_status = match_school(name, schools_by_name)
                if matching_status == "unmatched":
                    qa["designations"]["unmatched"].append({"school_name": name, "designation_type": dtype})
                elif matching_status == "ambiguous":
                    qa["designations"]["ambiguous"].append({"school_name": name, "designation_type": dtype})
            else:
                school_id, matching_status = None, "out_of_scope_level"
                qa["designations"]["out_of_scope_level"] += 1

            url = sanitize_url(row.get("source_url"))
            if (row.get("source_url") or "").strip() and not url:
                qa["designations"]["unsafe_urls_dropped"] += 1
            published = parse_date(row.get("source_published_date"))
            retrieved = parse_date(row.get("retrieved_at"))
            if not published:
                qa["designations"]["undated_records"].append({"school_name": name, "reason": "발행일 없음/무효"})

            support_raw = (row.get("financial_support_amount") or "").strip()
            source = {
                "url": url,
                "title": (row.get("source_file") or "").strip() or None,
                "published_date": published,
                "retrieved_at": retrieved,
                "source_file": (row.get("source_file") or "").strip() or None,
            }
            records.append({
                "designation_id": rec_id,
                "school_name": name,
                "school_level": level,
                "designation_type": dtype,
                "program_name": program,
                "school_year": year,
                # 원문에 학년도만 있고 지정 시작·종료일이 없으므로 기간은 추정임을 명시
                "period_basis": "school_year_only",
                "designation_start_date": None,
                "designation_end_date": None,
                "period_status": school_year_status(year, as_of),
                # 지정 사실만으로 지원 금액을 추론하지 않는다. 원문 명시 시에만 값.
                "financial_support_amount": support_raw or None,
                "verification_status": (row.get("verification_status") or "").strip() or None,
                "source": source,
                "match": {"school_id": school_id, "matching_status": matching_status},
            })
            sources[(url, published)] = source

    records.sort(key=lambda r: r["designation_id"])
    source_list = sorted(sources.values(), key=lambda s: (s["url"] or "", s["published_date"] or ""))
    qa["designations"]["records"] = len(records)
    return records, source_list, files_loaded


# ── 유흥·단란주점 인허가 (nightlife) ───────────────────────────────────

def load_nightlife(sources_dir: Path, qa: dict) -> list[dict] | None:
    """정규화된 인허가 레코드. 파일 없으면 None(미수집), 유효 데이터 0행이면 [] 반환."""
    path = sources_dir / NIGHTLIFE_FILE
    if not path.exists():
        return None
    rows = read_csv_rows(path)
    layer_qa = qa["nightlife"]
    layer_qa["input_rows"] = len(rows)

    seen_ids: dict[str, dict] = {}
    records: list[dict] = []
    for i, row in enumerate(rows):
        name = (row.get("facility_name") or "").strip()
        source_id = (row.get("source_record_id") or "").strip()
        if not name and not source_id:
            layer_qa["dropped_incomplete"] += 1
            continue
        facility_id = source_id or stable_digest("nightlife", name, (row.get("address") or "").strip())

        status_raw = (row.get("business_status") or "").strip()
        # 이 입력은 수집 단계에서 영업/정상만 추출했지만 방어적으로 재검사한다.
        if re.search(r"폐업|말소|취소|정지|휴업|폐쇄", status_raw):
            is_active = False
        elif re.search(r"영업|정상|운영", status_raw):
            is_active = True
        else:
            is_active = None
            layer_qa["unknown_status"] += 1

        coord_status = (row.get("coordinate_status") or "").strip()
        lat = parse_coord(row.get("latitude"))
        lng = parse_coord(row.get("longitude"))
        located = coord_valid(lat, lng)
        if coord_status == "official_coordinate" and not located:
            layer_qa["invalid_coordinates"].append({"facility_id": facility_id, "reason": "official_coordinate인데 좌표 파싱/범위 실패"})
        if not located:
            lat = lng = None
            layer_qa["unlocated_records"] += 1

        prev = seen_ids.get(facility_id)
        if prev is not None:
            layer_qa["duplicates_collapsed"] += 1
            continue

        record = {
            "facility_id": facility_id,
            "name": name or None,
            "category": (row.get("facility_type") or "").strip() or None,
            "subtype": (row.get("subtype") or "").strip() or None,
            "address": (row.get("address") or "").strip() or None,
            "lat": lat,
            "lng": lng,
            "coord_valid": located,
            "coordinate_status": coord_status or None,
            "coordinate_source": (row.get("coordinate_source") or "").strip() or None,
            "business_status": status_raw or None,
            "is_active": is_active,
            # LOCALDATA 파일 스냅샷 기준일은 독립 확인되지 않아 null 유지. 수집일은 수집일일 뿐이다.
            "source_as_of": parse_date(row.get("source_as_of")),
            "source_updated_at": (row.get("source_updated_at") or "").strip() or None,
            "source_modified_at": (row.get("source_modified_at") or "").strip() or None,
            "retrieved_at": parse_date(row.get("retrieved_at")),
            "source_url": sanitize_url(row.get("source_url")),
        }
        seen_ids[facility_id] = record
        records.append(record)

    records.sort(key=lambda r: r["facility_id"])
    layer_qa["records"] = len(records)
    layer_qa["active_records"] = sum(1 for r in records if r["is_active"] is True)
    layer_qa["active_located_records"] = sum(1 for r in records if r["is_active"] is True and r["coord_valid"])
    return records


# ── 공사장 행정기록 (construction, 연수구) ─────────────────────────────

def normalize_gu(gu: str | None) -> str | None:
    if not gu:
        return None
    return GU_ALIASES.get(gu, gu)


def derive_construction_coverage(records: list[dict]) -> tuple[list[str], dict[str, dict]]:
    """공사 레코드가 실제로 존재하는 구와 구별 건수를 산출한다.

    '수집됨(partial 승격 대상)'은 좌표 확보 레코드가 1건 이상인 구로 한정한다.
    레코드는 있으나 좌표가 하나도 없는 구는 학교 노드가 0건으로 보이지 않도록 unknown으로 남긴다.
    """
    by_gu: dict[str, dict] = {}
    for rec in records:
        gu = rec.get("gu")
        if not gu:
            continue
        entry = by_gu.setdefault(gu, {"record_count": 0, "located_record_count": 0})
        entry["record_count"] += 1
        if rec["coord_valid"]:
            entry["located_record_count"] += 1
    covered = sorted(g for g, v in by_gu.items() if v["located_record_count"] > 0)
    return covered, dict(sorted(by_gu.items()))


def load_construction(sources_dir: Path, qa: dict) -> list[dict] | None:
    paths = [sources_dir / f for f in CONSTRUCTION_FILES]
    existing = [p for p in paths if p.exists()]
    if not existing:
        return None
    layer_qa = qa["construction"]
    records: list[dict] = []
    seen_ids: set[str] = set()
    for path in existing:
        rows = read_csv_rows(path)
        layer_qa["input_rows"] += len(rows)
        for row in rows:
            source_id = (row.get("source_record_id") or "").strip()
            if not source_id:
                layer_qa["dropped_incomplete"] += 1
                continue
            if source_id in seen_ids:
                layer_qa["duplicates_collapsed"] += 1
                continue
            seen_ids.add(source_id)

            lat = parse_coord(row.get("latitude"))
            lng = parse_coord(row.get("longitude"))
            located = coord_valid(lat, lng)
            if not located:
                lat = lng = None
                layer_qa["unlocated_records"] += 1

            approval_date = parse_date(row.get("approval_date"))
            for key in ("permit_date", "start_date", "approval_date"):
                raw = (row.get(key) or "").strip()
                if raw and parse_date(raw) is None:
                    layer_qa["invalid_dates"].append({"facility_id": source_id, "field": key, "value": raw})

            address = (row.get("address") or "").strip()
            gu_match = GU_PAT.match(address)
            records.append({
                "facility_id": source_id,
                "name": (row.get("facility_name") or "").strip() or None,
                "category": (row.get("construction_type") or "").strip() or None,
                "main_use": (row.get("main_use") or "").strip() or None,
                "address": address or None,
                "gu": normalize_gu(gu_match.group(1) if gu_match else None),
                "lat": lat,
                "lng": lng,
                "coord_valid": located,
                "coordinate_status": (row.get("coordinate_status") or "").strip() or None,
                "coordinate_source": (row.get("coordinate_source") or "").strip() or None,
                "coordinate_limitations": (row.get("coordinate_limitations") or "").strip() or None,
                # 행정기록일 뿐 현재 공사 여부를 확인한 것이 아니다.
                "construction_status": (row.get("construction_status") or "").strip() or None,
                "permit_date": parse_date(row.get("permit_date")),
                "start_date": parse_date(row.get("start_date")),
                "approval_date": approval_date,
                "use_approved": approval_date is not None,
                "source_as_of": parse_date(row.get("source_as_of")),
                "retrieved_at": parse_date(row.get("retrieved_at")),
                "source_url": sanitize_url(row.get("source_url")),
            })
    records.sort(key=lambda r: r["facility_id"])
    layer_qa["records"] = len(records)
    layer_qa["located_records"] = sum(1 for r in records if r["coord_valid"])
    covered, by_gu = derive_construction_coverage(records)
    layer_qa["coverage_regions"] = covered
    layer_qa["coverage_by_gu"] = by_gu
    layer_qa["records_without_gu"] = sum(1 for r in records if not r.get("gu"))
    return records


# ── 학교별 관측 집계 ───────────────────────────────────────────────────

def observed_facilities_for_school(school: dict, facilities: list[dict],
                                   radius_m: float = RADIUS_M,
                                   active_only: bool = True) -> dict | None:
    """직선거리 radius_m 이내 '좌표 확보' 레코드의 하한 관측치.

    학교 좌표 미상이면 None (집계 불가, 0 아님).
    """
    if school["lat"] is None or school["lng"] is None:
        return None
    hits = []
    for fac in facilities:
        if not fac["coord_valid"]:
            continue
        if active_only and fac.get("is_active") is not True:
            continue
        d = haversine_m(school["lat"], school["lng"], fac["lat"], fac["lng"])
        if d <= radius_m:
            hits.append({"facility_id": fac["facility_id"], "distance_m": round(d, 1)})
    hits.sort(key=lambda h: (h["distance_m"], h["facility_id"]))
    return {
        "observed_count": len(hits),
        "nearest_observed_m": hits[0]["distance_m"] if hits else None,
        "records": hits,
    }


# ── QA 골격 ────────────────────────────────────────────────────────────

def new_qa() -> dict:
    return {
        "designations": {
            "input_rows": 0, "records": 0, "matched_elementary": 0,
            "unmatched": [], "ambiguous": [], "out_of_scope_level": 0,
            "duplicates_collapsed": 0, "dropped_incomplete": 0,
            "undated_records": [], "unsafe_urls_dropped": 0,
            "missing_input_files": [],
        },
        "nightlife": {
            "input_rows": 0, "records": 0, "active_records": 0, "active_located_records": 0,
            "unlocated_records": 0, "invalid_coordinates": [], "unknown_status": 0,
            "duplicates_collapsed": 0, "dropped_incomplete": 0,
        },
        "construction": {
            "input_rows": 0, "records": 0, "located_records": 0, "unlocated_records": 0,
            "invalid_dates": [], "duplicates_collapsed": 0, "dropped_incomplete": 0,
            "coverage_regions": [], "coverage_by_gu": {}, "records_without_gu": 0,
        },
    }


# ── 빌드 본체 ──────────────────────────────────────────────────────────

def build(sources_dir: Path = SOURCES_DIR,
          schools_csv: Path = SCHOOLS_CSV,
          output_dir: Path = OUTPUT_DIR,
          qa_path: Path = QA_PATH,
          as_of: str | None = None) -> dict:
    if as_of is not None and parse_date(as_of) is None:
        raise ValueError(f"--as-of 값이 유효한 달력일이 아닙니다: {as_of!r}")

    qa = new_qa()
    schools = load_schools(schools_csv)

    if as_of is None:
        candidates = []
        for filename in DESIGNATION_FILES + [NIGHTLIFE_FILE]:
            path = sources_dir / filename
            if path.exists():
                for row in read_csv_rows(path):
                    d = parse_date(row.get("retrieved_at"))
                    if d:
                        candidates.append(d)
                        break
        as_of = max(candidates) if candidates else "2026-09-06"

    # 1) 지정·연구학교
    records, sources, files_loaded = build_designations(sources_dir, schools, as_of, qa)
    designations_available = bool(files_loaded) and bool(records)
    matched_ids: dict[str, list[dict]] = {}
    for rec in records:
        if rec["match"]["school_id"]:
            matched_ids.setdefault(rec["match"]["school_id"], []).append(rec)
    qa["designations"]["matched_elementary"] = len(matched_ids)

    # 2) 유흥·단란주점 인허가
    nightlife = load_nightlife(sources_dir, qa)
    nightlife_located = [] if nightlife is None else [r for r in nightlife if r["coord_valid"] and r["is_active"] is True]
    nightlife_available = nightlife is not None and len(nightlife_located) > 0

    # 3) 공사장 행정기록 (연수구)
    construction = load_construction(sources_dir, qa)
    construction_located = [] if construction is None else [r for r in construction if r["coord_valid"]]
    construction_available = construction is not None and len(construction_located) > 0
    # 커버리지는 상수가 아니라 실제 레코드에서 파생한다(좌표 확보 레코드가 있는 구만 승격).
    construction_covered_gus, construction_by_gu = derive_construction_coverage(construction or [])
    covered_label = ("·".join(construction_covered_gus) if construction_covered_gus else "없음")

    # 4) 학교별 요약 — schools.csv 전 학교가 키로 존재
    school_summaries: dict[str, dict] = {}
    for school in schools:
        if not school["school_id"]:
            continue
        current, historical = [], []
        for rec in matched_ids.get(school["school_id"], []):
            entry = {
                "designation_id": rec["designation_id"],
                "designation_type": rec["designation_type"],
                "program_name": rec["program_name"],
                "school_year": rec["school_year"],
                "period_status": rec["period_status"],
                "period_basis": rec["period_basis"],
                "source_url": rec["source"]["url"],
            }
            (current if rec["period_status"] in ("current", "upcoming") else historical).append(entry)
        summary: dict = {
            "school_name": school["school_name"],
            "gu": school["gu"],
            "designations": {
                "status": "available" if designations_available else "unknown",
                "current": sorted(current, key=lambda r: r["designation_id"]),
                "historical": sorted(historical, key=lambda r: r["designation_id"]),
                "scope_note_ko": "수집된 공식 명단(2026 AI·디지털 연구·선도, 2026 AI중점, 2025 디지털튜터) 기준. 그 외 지정·지원 사업 미수집. 명단 미등재가 미지정 확정은 아님.",
            },
        }

        # 유흥·단란주점: 인천 전역 인허가 자료이나 좌표는 부분 확보 → 하한 관측치, total은 null
        if nightlife_available:
            obs = observed_facilities_for_school(school, nightlife_located, active_only=False)
            if obs is None:
                summary["nightlife"] = {"status": "unknown", "observed_count": None, "total_count": None,
                                        "label_ko": "학교 좌표 미상으로 집계 불가"}
            else:
                summary["nightlife"] = {
                    "status": "partial",
                    "total_count": None,
                    "within_m": int(RADIUS_M),
                    "distance_basis_ko": "직선거리 기준 (도보 경로 아님)",
                    "label_ko": "좌표 확보 레코드 기준 최소 관측치 (좌표 미확보 레코드 제외)",
                    **obs,
                }
        else:
            summary["nightlife"] = {"status": "unknown", "observed_count": None, "total_count": None,
                                    "label_ko": "자료 수집 전"}

        # 공사장 행정기록: 연수구만 수집 → 다른 구 학교는 반드시 unknown/null
        if construction_available and school["gu"] in construction_covered_gus:
            obs = observed_facilities_for_school(school, construction_located, active_only=False)
            if obs is None:
                summary["construction"] = {"status": "unknown", "observed_count": None, "total_count": None,
                                           "label_ko": "학교 좌표 미상으로 집계 불가"}
            else:
                completed_ids = {r["facility_id"] for r in construction_located if r["use_approved"]}
                observed_completed = sum(1 for h in obs["records"] if h["facility_id"] in completed_ids)
                summary["construction"] = {
                    "status": "partial",
                    "total_count": None,
                    "within_m": int(RADIUS_M),
                    "distance_basis_ko": "직선거리 기준 (도보 경로 아님)",
                    "label_ko": "착공·사용승인 행정기록 / 주소 기반 추정 위치 / 현재 공사 여부 미확인",
                    "observed_completed_count": observed_completed,
                    **obs,
                }
        else:
            summary["construction"] = {"status": "unknown", "observed_count": None, "total_count": None,
                                       "label_ko": "자료 수집 전" if not construction_available
                                       else f"해당 구 자료 미수집 ({covered_label}만 수집)"}

        school_summaries[school["school_id"]] = summary

    # 5) manifest
    layers: dict = {
        "school_designations": {
            "status": "available" if designations_available else "unavailable",
            "status_label_ko": "수집 완료" if designations_available else "자료 수집 전",
            "programs_covered": [
                "2026 AI·디지털 연구학교·선도학교",
                "2026 AI중점학교",
                "2025 디지털튜터 운영교(과거 이력)",
            ] if designations_available else [],
            "scope_note_ko": "위 프로그램 공식 명단 기준. 그 외 지정·지원 사업은 미수집. 명단 미등재가 미지정 확정은 아님.",
            "period_note_ko": "지정 기간은 학년도 명단 기준 추정(period_basis=school_year_only)이며 확정 지정 시작·종료일이 아님.",
            "record_count": len(records),
            "matched_elementary_count": len(matched_ids),
            "input_files": files_loaded,
            "sources": sources,
            "data_files": ["school_designations.json"],
        },
    }

    if nightlife is None:
        layers["nightlife_permits"] = {
            "status": "unavailable",
            "status_label_ko": "자료 수집 전",
            "label_ko": "유흥·단란주점 인허가 현황",
            "reason_ko": "검증된 인허가 원본이 아직 확보되지 않았습니다.",
        }
    else:
        active = qa["nightlife"]["active_records"]
        located = qa["nightlife"]["active_located_records"]
        coord_provenance = {}
        for rec in nightlife:
            key = rec.get("coordinate_status") or "unknown"
            coord_provenance[key] = coord_provenance.get(key, 0) + 1
        layers["nightlife_permits"] = {
            "status": "partial" if nightlife_available else "unavailable",
            "status_label_ko": "부분 수집(좌표 기준)" if nightlife_available else "좌표 확보 레코드 없음",
            "label_ko": "유흥·단란주점 인허가 현황",
            "usage_note_ko": "행정 인허가 기록이며 사고위험·불법행위·현장 영업 여부 판정이 아님.",
            "record_count": len(nightlife),
            "active_record_count": active,
            "located_record_count": located,
            "unlocated_record_count": active - located,
            "coverage_regions": ["인천광역시 전역(인허가 관할 기준)"],
            "coverage_note_ko": f"영업/정상 {active}건 중 좌표 확보 {located}건만 공간 집계에 사용. 학교별 수치는 하한 관측치이며 total_count는 null.",
            "coordinate_provenance": dict(sorted(coord_provenance.items())),
            "coordinate_note_ko": "official_coordinate는 LOCALDATA 원천 좌표(EPSG:5174→4326 변환), geocoded_kakao_*는 Kakao Local API 주소 지오코딩 추정 위치(현장 실측 좌표 아님), unresolved는 좌표 미확보로 공간 집계에서 제외.",
            "distance_basis_ko": "직선거리 기준 (도보 경로 아님)",
            "source_as_of_note_ko": "파일 스냅샷 기준일은 독립 확인되지 않아 null. 레코드별 원천 갱신/수정 시각 보존, 수집일 2026-09-06.",
            "sources": [
                {"url": "https://www.data.go.kr/data/15045018/fileData.do", "title": "지방행정인허가 유흥주점영업 (LOCALDATA)", "published_date": None, "retrieved_at": as_of},
                {"url": "https://www.data.go.kr/data/15045017/fileData.do", "title": "지방행정인허가 단란주점영업 (LOCALDATA)", "published_date": None, "retrieved_at": as_of},
                {"url": "https://dapi.kakao.com/v2/local/search/address.json", "title": "Kakao Local API 주소 검색 (좌표 미확보 312건 보강 기준)", "published_date": None, "retrieved_at": as_of},
            ],
            "data_files": ["facilities_nightlife.geojson"],
        }

    if construction is None:
        layers["construction_records"] = {
            "status": "unavailable",
            "status_label_ko": "자료 수집 전",
            "label_ko": "공사장(착공신고) 행정기록",
            "reason_ko": "검증된 착공신고 원본이 아직 확보되지 않았습니다.",
        }
    else:
        layers["construction_records"] = {
            "status": "partial" if construction_available else "unavailable",
            "status_label_ko": (f"부분 수집({covered_label}, 좌표 일부)" if construction_available
                                else "좌표 확보 레코드 없음"),
            "label_ko": "공사장(착공신고) 행정기록",
            "usage_note_ko": "착공·사용승인 행정기록이며 현재 공사 진행 여부를 확인한 자료가 아님. 사용승인 완료 기록은 현재 공사 위험이 아님.",
            "record_count": len(construction),
            "located_record_count": len(construction_located),
            "unlocated_record_count": len(construction) - len(construction_located),
            "coverage_regions": construction_covered_gus,
            "coverage_by_gu": construction_by_gu,
            "coverage_basis_ko": "학교 소재지 주소의 구 기준. 그 외 구 학교는 미수집(unknown)으로 표시. 커버리지는 수집 레코드 주소의 구에서 파생하며 좌표 확보 레코드가 1건 이상인 구만 승격.",
            "coverage_note_ko": (
                "구별 수집 현황(레코드/좌표): "
                + ", ".join(f"{gu} {v['record_count']}/{v['located_record_count']}"
                            for gu, v in construction_by_gu.items())
                + ". 연수구 15건은 소상공인 상가정보(2026-06-30) 동일 지번 정확일치 추정, "
                  "나머지는 Kakao Local API 주소 지오코딩 추정. 번지가 없는 개발지구 표기 등은 "
                  "좌표 미부여(unresolved)로 남기며 학교별 수치는 하한 관측치."),
            "coordinate_note_ko": "좌표는 행정 주소 기반 추정 위치이며 실제 공사현장 좌표가 아님.",
            "record_scope_ko": "착공처리일 또는 사용승인일이 있는 행정기록만 포함(허가만 있고 착공·사용승인 기록이 없는 행은 제외).",
            "distance_basis_ko": "직선거리 기준 (도보 경로 아님)",
            "sources": [
                {"url": "https://www.data.go.kr/data/15029299/fileData.do", "title": "인천광역시 연수구 건축물 착공신고 현황", "published_date": None, "source_as_of": "2026-03-09", "retrieved_at": as_of},
                {"url": "https://www.data.go.kr/data/15038929/fileData.do", "title": "인천광역시 계양구 건축착공사용승인현황", "published_date": None, "source_as_of": "2026-01-19", "retrieved_at": as_of},
                {"url": "https://www.data.go.kr/data/15029300/fileData.do", "title": "인천광역시 미추홀구 건축물 착공신고 현황", "published_date": None, "source_as_of": "2025-09-25", "retrieved_at": as_of},
                {"url": "https://www.data.go.kr/data/15083033/fileData.do", "title": "소상공인시장진흥공단 상가(상권)정보 (연수구 15건 좌표 추정 기준)", "published_date": None, "source_as_of": "2026-06-30", "retrieved_at": as_of},
                {"url": "https://dapi.kakao.com/v2/local/search/address.json", "title": "Kakao Local API 주소 검색 (그 외 좌표 추정 기준)", "published_date": None, "source_as_of": as_of, "retrieved_at": as_of},
            ],
            "data_files": ["facilities_construction.geojson"],
        }

    manifest = {
        "schema_version": 2,
        "generated_by": "scripts/build_context_layers.py",
        "data_as_of": as_of,
        "usage_note_ko": "참고용 맥락 정보입니다. 자동 안전 등급·지원 자격·법령 위반 판정에 사용하지 않습니다.",
        "layers": layers,
    }

    # 6) 출력
    write_json(output_dir / "context_layers_manifest.json", manifest)
    write_json(output_dir / "school_designations.json", {"records": records})
    write_json(output_dir / "school_context_summary.json", {"data_as_of": as_of, "schools": school_summaries})

    def facility_geojson(recs: list[dict]) -> dict:
        features = []
        for rec in recs:
            props = {k: v for k, v in rec.items() if k not in ("lat", "lng")}
            features.append({
                "type": "Feature",
                "geometry": ({"type": "Point", "coordinates": [rec["lng"], rec["lat"]]}
                             if rec["coord_valid"] else None),
                "properties": props,
            })
        return {"type": "FeatureCollection", "features": features}

    if nightlife is not None:
        write_json(output_dir / "facilities_nightlife.geojson", facility_geojson(nightlife))
    if construction is not None:
        write_json(output_dir / "facilities_construction.geojson", facility_geojson(construction))
    write_json(qa_path, qa)

    return {"manifest": manifest, "records": records, "summaries": school_summaries, "qa": qa,
            "nightlife": nightlife, "construction": construction}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="학교 맥락 레이어 빌드")
    parser.add_argument("--as-of", dest="as_of", default=None, help="기준일 YYYY-MM-DD (기본: 입력 retrieved_at 최댓값)")
    args = parser.parse_args(argv)
    result = build(as_of=args.as_of)
    layers = result["manifest"]["layers"]
    d = layers["school_designations"]
    print(f"[context-layers] designations: {d['record_count']} records "
          f"({', '.join(d['input_files'])}), matched elementary schools: {d['matched_elementary_count']}")
    for key in ("nightlife_permits", "construction_records"):
        layer = layers[key]
        counts = f" records={layer.get('record_count')}, located={layer.get('located_record_count', layer.get('located_record_count'))}" if "record_count" in layer else ""
        print(f"[context-layers] {key}: {layer['status']}{counts}")
    observed_schools = sum(1 for s in result["summaries"].values()
                           if (s["nightlife"].get("observed_count") or 0) > 0)
    print(f"[context-layers] schools with >=1 observed nightlife record: {observed_schools}")
    print(f"[context-layers] outputs -> {OUTPUT_DIR.relative_to(REPO_ROOT)}, QA -> {QA_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
