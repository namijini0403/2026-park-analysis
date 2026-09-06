# -*- coding: utf-8 -*-
"""건축 착공·사용승인 행정기록(계양구·미추홀구·연수구)을 28컬럼 스키마로 정규화하고
Kakao Local API 주소 지오코딩으로 좌표를 '추정'한다.

원자료(읽기 전용, 워크스페이스 루트 outputs/source_research_20260906/)
  construction_15038929_utf8.csv  인천광역시 계양구 건축착공사용승인현황 (1,948행, 기준 20260119)
  construction_15029300_utf8.csv  인천광역시 미추홀구 건축물 착공신고 현황 (1,971행, 기준 20250925)
  construction_15029299_utf8.csv  인천광역시 연수구 건축물 착공신고 현황 (74행, 기준 20260309)
연수구 59행은 이미 정규화된 data/context_sources/construction_yeonsu_exact_unmatched.csv 를
그대로 읽어 좌표만 보강한다(소진공 정확일치 15행은 건드리지 않는다).

원칙
  - 좌표를 만들어내지 않는다. 지번(또는 도로명) 번지가 응답과 정확히 일치할 때만 수용하고,
    번지 없는 개발지구 표기("동춘1구역 16블럭 5로트" 등)는 지오코딩하지 않는다(unresolved).
    법정동 중심점 같은 저해상도 좌표를 공사 위치처럼 쓰지 않는다.
  - construction_status 의미는 그대로 "행정기록·현재 공사 여부 미확인".
  - 좌표는 주소 기반 추정 위치이며 공사현장 좌표가 아니다(coordinate_limitations).
  - 이 레이어는 '착공·사용승인' 기록이므로 착공처리일·사용승인일이 모두 없는 허가만 있는 행은
    제외하고 그 수를 리포트에 남긴다(임의 판단 금지 — 제외 사유·건수 공개).

실행:
  python scripts/context/normalize_construction.py                 # 전부
  python scripts/context/normalize_construction.py --only gyeyang  # 일부만
  python scripts/context/normalize_construction.py --offline       # 캐시만 사용
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kakao_client import KakaoLocalClient, coord_valid  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = REPO_ROOT.parent
RAW_DIR = WORKSPACE_ROOT / "outputs" / "source_research_20260906"
SOURCES_DIR = REPO_ROOT / "data" / "context_sources"

RETRIEVED_AT = "2026-09-06"
AMBIGUITY_LIMIT_M = 100.0

# 28컬럼 스키마 (construction_geocoded_exact.csv 와 동일 순서)
COLUMNS = [
    "source_record_id", "source_row", "facility_type", "facility_name", "address",
    "latitude", "longitude", "coordinate_status", "match_reason", "matched_address_key",
    "coordinate_matching_record_count", "coordinate_unique_point_count",
    "coordinate_max_pairwise_distance_m", "coordinate_source_record_ids",
    "coordinate_source", "coordinate_source_url", "coordinate_source_as_of",
    "source_url", "source_as_of", "retrieved_at", "construction_status",
    "construction_type", "permit_date", "start_date", "approval_date",
    "main_use", "site_area_sqm", "coordinate_limitations",
]

CONSTRUCTION_STATUS = "administrative_record_only_not_confirmed_active"
COORD_LIMITATIONS = "주소 기반 추정 위치, 공사현장 좌표 아님"
KAKAO_SOURCE_URL = "https://dapi.kakao.com/v2/local/search/address.json"

# 구 명칭 별칭: 원자료에 남아 있는 옛 명칭만 명시 등록(추측 매칭 금지).
# 남구 → 미추홀구: 2018-07-01 인천 남구가 미추홀구로 개칭. 미추홀구 원자료 10행에 옛 표기가 남아 있음.
GU_ALIASES = {"남구": "미추홀구"}

DATASETS = {
    "gyeyang": {
        "gu": "계양구",
        "pk": "15038929",
        "raw": "construction_15038929_utf8.csv",
        "source_url": "https://www.data.go.kr/data/15038929/fileData.do",
        "source_as_of": "2026-01-19",
        "title": "인천광역시 계양구_건축착공사용승인현황_20260119",
        "out": "construction_geocoded_gyeyang.csv",
        "report": "construction_gyeyang_kakao_match_report.json",
        "columns": {"category": "구분", "type": "건축구분", "address": "대지위치",
                    "permit": "허가일", "start": "착공처리일", "approval": "사용승인일",
                    "main_use": "주용도", "site_area": None},
    },
    "michuhol": {
        "gu": "미추홀구",
        "pk": "15029300",
        "raw": "construction_15029300_utf8.csv",
        "source_url": "https://www.data.go.kr/data/15029300/fileData.do",
        "source_as_of": "2025-09-25",
        "title": "인천광역시 미추홀구_건축물 착공신고 현황_20250925",
        "out": "construction_geocoded_michuhol.csv",
        "report": "construction_michuhol_kakao_match_report.json",
        "columns": {"category": None, "type": "건축구분", "address": "대지위치",
                    "permit": "허가일", "start": "착공처리일", "approval": "사용승인일",
                    "main_use": "주용도", "site_area": "대지면적(제곱미터)"},
    },
}

YEONSU = {
    "gu": "연수구",
    "input": "construction_yeonsu_exact_unmatched.csv",
    "out": "construction_geocoded_yeonsu_kakao.csv",
    "report": "construction_yeonsu_kakao_match_report.json",
    "title": "인천광역시 연수구_건축물 착공신고 현황_20260309 (소진공 정확일치 실패 59행)",
}

JIBUN_PAT = re.compile(
    r"^인천광역시\s+(?P<gu>\S+?[구군])\s+(?P<dong>[가-힣A-Za-z0-9]+(?:동|리|가))\s+"
    r"(?P<san>산\s*)?(?P<main>\d+)(?:-(?P<sub>\d+))?\s*(?P<rest>.*)$")
ROAD_PAT = re.compile(
    r"^인천광역시\s+(?P<gu>\S+?[구군])\s+(?P<road>\S*(?:로|길))\s+"
    r"(?P<num>\d+(?:-\d+)?)\s*(?P<rest>.*)$")

DATE_PAT = re.compile(r"^(\d{4})[-./]?(\d{2})[-./]?(\d{2})")


def norm_date(value: str | None) -> str:
    raw = (value or "").strip()
    m = DATE_PAT.match(raw)
    if not m:
        return ""
    y, mo, d = (int(g) for g in m.groups())
    try:
        import datetime
        return datetime.date(y, mo, d).isoformat()
    except ValueError:
        return ""


def haversine_m(lat1, lng1, lat2, lng2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def normalize_gu(gu: str | None) -> str | None:
    if not gu:
        return None
    return GU_ALIASES.get(gu, gu)


# ── 지오코딩 ───────────────────────────────────────────────────────────

def geocode_address(client: KakaoLocalClient, address: str) -> dict:
    """번지가 응답과 정확히 일치할 때만 좌표를 수용한다.

    반환: {status, lat, lng, match_reason, matched_address_key, candidates, unique_points,
           max_pairwise_m, query, address_type}
    """
    addr = re.sub(r"\s+", " ", (address or "").strip())
    fail = {"status": "unresolved", "lat": None, "lng": None,
            "candidates": 0, "unique_points": 0, "max_pairwise_m": None,
            "matched_address_key": "", "query": "", "address_type": None}

    jm = JIBUN_PAT.match(addr)
    rm = None if jm else ROAD_PAT.match(addr)
    if not jm and not rm:
        fail["match_reason"] = "address_not_parcel_or_road_notation"
        return fail

    if jm:
        gu = normalize_gu(jm.group("gu"))
        san = "산 " if jm.group("san") else ""
        main, sub = jm.group("main"), jm.group("sub")
        parcel = f"{main}-{sub}" if sub else main
        query = f"인천광역시 {gu} {jm.group('dong')} {san}{parcel}"
        mode = "jibun"
    else:
        gu = normalize_gu(rm.group("gu"))
        query = f"인천광역시 {gu} {rm.group('road')} {rm.group('num')}"
        mode = "road"
        main = sub = None

    payload = client.search_address(query, size=5)
    docs = []
    for doc in payload.get("documents") or []:
        try:
            lng, lat = float(doc["x"]), float(doc["y"])
        except (KeyError, TypeError, ValueError):
            continue
        if not coord_valid(lat, lng):
            continue
        if not (doc.get("address_name") or "").startswith("인천"):
            continue
        addr_part = doc.get("address") or {}
        if normalize_gu((addr_part.get("region_2depth_name") or "").strip()) != gu:
            continue
        if mode == "jibun":
            # 번지 정확 일치 검증 (동 중심점·유사 번지 수용 금지)
            if (addr_part.get("main_address_no") or "") != main:
                continue
            if (addr_part.get("sub_address_no") or "") != (sub or ""):
                continue
            if (addr_part.get("mountain_yn") or "N") != ("Y" if jm.group("san") else "N"):
                continue
        else:
            road_part = doc.get("road_address") or {}
            if not road_part:
                continue
        doc = dict(doc)
        doc["_lat"], doc["_lng"] = lat, lng
        docs.append(doc)

    total = (payload.get("meta") or {}).get("total_count")
    if not docs:
        fail["match_reason"] = ("no_exact_parcel_match_in_kakao" if mode == "jibun"
                                else "no_road_match_in_kakao")
        fail["query"] = query
        fail["candidates"] = total or 0
        return fail

    points = sorted({(round(d["_lat"], 7), round(d["_lng"], 7)) for d in docs})
    worst = 0.0
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            worst = max(worst, haversine_m(points[i][0], points[i][1], points[j][0], points[j][1]))
    if worst > AMBIGUITY_LIMIT_M:
        fail["match_reason"] = "ambiguous_candidates_over_100m"
        fail["query"] = query
        fail["candidates"] = len(docs)
        fail["unique_points"] = len(points)
        fail["max_pairwise_m"] = round(worst, 1)
        return fail

    doc = docs[0]
    return {
        "status": f"geocoded_kakao_{mode}",
        "lat": doc["_lat"], "lng": doc["_lng"],
        "match_reason": f"kakao_exact_{mode}_address_match",
        "matched_address_key": doc.get("address_name"),
        "candidates": len(docs),
        "unique_points": len(points),
        "max_pairwise_m": round(worst, 1),
        "query": query,
        "address_type": doc.get("address_type"),
    }


def apply_geocode(record: dict, hit: dict) -> None:
    record["coordinate_status"] = hit["status"]
    record["match_reason"] = hit["match_reason"]
    record["matched_address_key"] = hit.get("matched_address_key") or ""
    record["coordinate_matching_record_count"] = str(hit.get("candidates") or 0)
    record["coordinate_unique_point_count"] = str(hit.get("unique_points") or 0)
    record["coordinate_max_pairwise_distance_m"] = (
        "" if hit.get("max_pairwise_m") is None else str(hit["max_pairwise_m"]))
    record["coordinate_source_record_ids"] = ""
    record["coordinate_source_url"] = KAKAO_SOURCE_URL
    record["coordinate_source_as_of"] = RETRIEVED_AT
    record["coordinate_limitations"] = COORD_LIMITATIONS
    if hit["status"] == "unresolved":
        record["latitude"] = ""
        record["longitude"] = ""
        record["coordinate_source"] = "kakao_local_api:unresolved"
    else:
        record["latitude"] = f"{hit['lat']:.7f}"
        record["longitude"] = f"{hit['lng']:.7f}"
        record["coordinate_source"] = "kakao_local_api:address_" + hit["status"].rsplit("_", 1)[-1]


def write_csv(path: Path, records: list[dict]) -> None:
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\r\n")
        writer.writeheader()
        for rec in records:
            writer.writerow({k: rec.get(k, "") for k in COLUMNS})


def write_report(path: Path, payload: dict) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")


# ── 원자료 정규화 ──────────────────────────────────────────────────────

def normalize_raw(key: str, client: KakaoLocalClient) -> dict:
    cfg = DATASETS[key]
    cols = cfg["columns"]
    raw_path = RAW_DIR / cfg["raw"]
    with open(raw_path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    records: list[dict] = []
    excluded_permit_only = 0
    category_counts: dict[str, int] = {}
    log: list[dict] = []

    for idx, row in enumerate(rows, 1):
        permit = norm_date(row.get(cols["permit"]))
        start = norm_date(row.get(cols["start"]))
        approval = norm_date(row.get(cols["approval"]))
        if not start and not approval:
            # 이 레이어는 '착공·사용승인' 행정기록이다. 허가만 있고 착공·사용승인 기록이
            # 없는 행은 공사 착수 근거가 없으므로 제외하고 건수를 리포트에 남긴다.
            excluded_permit_only += 1
            continue
        if cols["category"]:
            cat = (row.get(cols["category"]) or "").strip() or "미상"
            category_counts[cat] = category_counts.get(cat, 0) + 1

        address = re.sub(r"\s+", " ", (row.get(cols["address"]) or "").strip())
        main_use = (row.get(cols["main_use"]) or "").strip()
        site_area = (row.get(cols["site_area"]) or "").strip() if cols["site_area"] else ""

        record = {
            "source_record_id": f"{cfg['pk']}:{idx}",
            "source_row": str(idx),
            "facility_type": "건축행정기록",
            "facility_name": main_use,
            "address": address,
            "coordinate_source": "kakao_local_api:unresolved",
            "source_url": cfg["source_url"],
            "source_as_of": cfg["source_as_of"],
            "retrieved_at": RETRIEVED_AT,
            "construction_status": CONSTRUCTION_STATUS,
            "construction_type": (row.get(cols["type"]) or "").strip(),
            "permit_date": permit,
            "start_date": start,
            "approval_date": approval,
            "main_use": main_use,
            "site_area_sqm": site_area,
        }
        hit = geocode_address(client, address)
        apply_geocode(record, hit)
        records.append(record)
        log.append({"source_record_id": record["source_record_id"], "address": address,
                    "query": hit.get("query"), "coordinate_status": hit["status"],
                    "match_reason": hit["match_reason"],
                    "matched_address_key": hit.get("matched_address_key") or None,
                    "address_type": hit.get("address_type"),
                    "latitude": record["latitude"] or None,
                    "longitude": record["longitude"] or None})
        if len(records) % 200 == 0:
            print(f"  [{key}] {len(records)} rows (live {client.live_calls})", flush=True)
            client.save()

    client.save()
    write_csv(SOURCES_DIR / cfg["out"], records)

    located = sum(1 for r in records if r["latitude"])
    reasons: dict[str, int] = {}
    for entry in log:
        reasons[entry["match_reason"]] = reasons.get(entry["match_reason"], 0) + 1
    report = {
        "gu": cfg["gu"],
        "dataset_pk": cfg["pk"],
        "dataset_title": cfg["title"],
        "source_url": cfg["source_url"],
        "source_as_of": cfg["source_as_of"],
        "retrieved_at": RETRIEVED_AT,
        "raw_rows": len(rows),
        "normalized_rows": len(records),
        "excluded_permit_only_rows": excluded_permit_only,
        "excluded_reason_ko": "착공처리일·사용승인일이 모두 없는 건축허가 행(공사 착수 행정기록 아님)",
        "record_category_counts": dict(sorted(category_counts.items())) or None,
        "started_rows": sum(1 for r in records if r["start_date"]),
        "use_approved_rows": sum(1 for r in records if r["approval_date"]),
        "located_rows": located,
        "unresolved_rows": len(records) - located,
        "match_reason_counts": dict(sorted(reasons.items())),
        "geocoder": "Kakao Local API v2/local/search/address.json",
        "match_rule_ko": (
            "지번(또는 도로명) 번지를 그대로 질의하고 응답의 본번·부번·산 여부·구가 정확히 "
            "일치할 때만 수용. 개발지구·블록/로트 표기 등 번지가 없는 주소는 지오코딩하지 않음. "
            f"후보 좌표 산포가 {int(AMBIGUITY_LIMIT_M)}m를 넘으면 거절."),
        "coordinate_meaning_ko": COORD_LIMITATIONS,
        "construction_status_meaning_ko": "행정기록이며 현재 공사 진행 여부는 미확인.",
        "output_file": f"data/context_sources/{cfg['out']}",
        "evidence_note_ko": (
            "행별 증빙(질의 결과·매칭 주소·좌표 출처)은 출력 CSV의 match_reason / "
            "matched_address_key / coordinate_status / coordinate_source 컬럼에 그대로 들어 있다. "
            "여기에는 좌표를 부여하지 못한 행 전체와 수용된 행 표본만 싣는다."),
        "unresolved_records": sorted(
            (e for e in log if e["coordinate_status"] == "unresolved"),
            key=lambda e: e["source_record_id"]),
        "accepted_sample": sorted(
            (e for e in log if e["coordinate_status"] != "unresolved"),
            key=lambda e: e["source_record_id"])[:20],
    }
    write_report(SOURCES_DIR / cfg["report"], report)
    return report


def normalize_yeonsu(client: KakaoLocalClient) -> dict:
    src = SOURCES_DIR / YEONSU["input"]
    with open(src, encoding="utf-8-sig", newline="") as f:
        rows = [dict(r) for r in csv.DictReader(f)]

    log = []
    for record in rows:
        hit = geocode_address(client, record.get("address") or "")
        apply_geocode(record, hit)
        log.append({"source_record_id": record["source_record_id"],
                    "address": record["address"], "query": hit.get("query"),
                    "coordinate_status": hit["status"], "match_reason": hit["match_reason"],
                    "matched_address_key": hit.get("matched_address_key") or None,
                    "address_type": hit.get("address_type"),
                    "latitude": record["latitude"] or None,
                    "longitude": record["longitude"] or None})
    client.save()
    write_csv(SOURCES_DIR / YEONSU["out"], rows)

    located = sum(1 for r in rows if r["latitude"])
    reasons: dict[str, int] = {}
    for entry in log:
        reasons[entry["match_reason"]] = reasons.get(entry["match_reason"], 0) + 1
    report = {
        "gu": YEONSU["gu"],
        "dataset_pk": "15029299",
        "dataset_title": YEONSU["title"],
        "source_url": "https://www.data.go.kr/data/15029299/fileData.do",
        "source_as_of": "2026-03-09",
        "retrieved_at": RETRIEVED_AT,
        "input_file": f"data/context_sources/{YEONSU['input']}",
        "normalized_rows": len(rows),
        "located_rows": located,
        "unresolved_rows": len(rows) - located,
        "match_reason_counts": dict(sorted(reasons.items())),
        "geocoder": "Kakao Local API v2/local/search/address.json",
        "note_ko": ("소진공 상가주소 정확일치에 실패한 59행만 대상. 정확일치 15행"
                    "(construction_geocoded_exact.csv)은 변경하지 않음."),
        "coordinate_meaning_ko": COORD_LIMITATIONS,
        "output_file": f"data/context_sources/{YEONSU['out']}",
        "evidence_note_ko": (
            "행별 증빙(질의 결과·매칭 주소·좌표 출처)은 출력 CSV의 match_reason / "
            "matched_address_key / coordinate_status / coordinate_source 컬럼에 그대로 들어 있다. "
            "여기에는 좌표를 부여하지 못한 행 전체와 수용된 행 표본만 싣는다."),
        "unresolved_records": sorted(
            (e for e in log if e["coordinate_status"] == "unresolved"),
            key=lambda e: e["source_record_id"]),
        "accepted_sample": sorted(
            (e for e in log if e["coordinate_status"] != "unresolved"),
            key=lambda e: e["source_record_id"])[:20],
    }
    write_report(SOURCES_DIR / YEONSU["report"], report)
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="건축 착공·사용승인 행정기록 정규화 + Kakao 지오코딩")
    parser.add_argument("--only", choices=["gyeyang", "michuhol", "yeonsu"], default=None)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args(argv)

    client = KakaoLocalClient(offline=args.offline)
    targets = [args.only] if args.only else ["yeonsu", "gyeyang", "michuhol"]
    reports = []
    for key in targets:
        print(f"[construction] {key} 처리 중...", flush=True)
        reports.append(normalize_yeonsu(client) if key == "yeonsu" else normalize_raw(key, client))
    client.save()

    for rep in reports:
        print(f"[construction] {rep['gu']}: 레코드 {rep['normalized_rows']}, "
              f"좌표 {rep['located_rows']}, 미해결 {rep['unresolved_rows']}"
              + (f", 허가만 있는 행 제외 {rep['excluded_permit_only_rows']}"
                 if "excluded_permit_only_rows" in rep else ""))
    print(f"[construction] Kakao live calls={client.live_calls}, cache hits={client.cache_hits}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
