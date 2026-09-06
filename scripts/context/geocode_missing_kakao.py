# -*- coding: utf-8 -*-
"""좌표 미확보 유흥·단란주점 인허가 레코드를 Kakao Local API로 보강한다.

대상: data/context_sources/incheon_nightlife_geocoded.csv 에서
      coordinate_status != 'official_coordinate' 인 행(수집 시점 312행).

원칙
  - 좌표를 만들어내지 않는다. 근거 있는 매칭만 채우고 나머지는 `unresolved`로 남긴다.
    (미해결은 0건이 아니라 '하한 관측치'의 근거로 그대로 유지된다.)
  - 인천 밖·유효 범위 밖·구 불일치·다중 후보 산포 100m 초과는 거절한다.
  - 행별 증빙을 nightlife_kakao_geocode_log.json 에 남긴다(질의, 매칭 주소, address_type, 좌표).
  - CSV는 같은 컬럼·같은 행 순서로 제자리 갱신한다.
  - API 키는 리포에 기록하지 않는다(scripts/context/kakao_client.py 참조).

실행:
  python scripts/context/geocode_missing_kakao.py            # 캐시 우선, 부족분만 호출
  python scripts/context/geocode_missing_kakao.py --offline  # 캐시만 사용(네트워크 금지)
  python scripts/context/geocode_missing_kakao.py --dry-run  # CSV 미수정, 집계만 출력
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
SOURCES_DIR = REPO_ROOT / "data" / "context_sources"
NIGHTLIFE_CSV = SOURCES_DIR / "incheon_nightlife_geocoded.csv"
LOG_PATH = SOURCES_DIR / "nightlife_kakao_geocode_log.json"
ENT_MANIFEST = SOURCES_DIR / "localdata_entertainment_manifest.json"
SING_MANIFEST = SOURCES_DIR / "localdata_singing_manifest.json"

RETRIEVED_AT = "2026-09-06"
AMBIGUITY_LIMIT_M = 100.0

GU_PAT = re.compile(r"인천(?:광역시)?\s*(\S+?[구군])")
DONG_PAT = re.compile(r"([가-힣]+\d*(?:동|리|가))")
ROAD_PAT = re.compile(r"([가-힣A-Za-z0-9]+(?:로|길))\s*(?:지하\s*)?\d")
JIBUN_PAT = re.compile(r"(?:동|리|가)\s+산?\s*\d+")


def haversine_m(lat1, lng1, lat2, lng2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def strip_parens(text: str) -> str:
    out, depth = [], 0
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif depth == 0:
            out.append(ch)
    return "".join(out)


def paren_contents(text: str) -> str:
    """최상위 괄호 안 내용을 이어붙인다."""
    out, depth = [], 0
    for ch in text:
        if ch == "(":
            depth += 1
            continue
        if ch == ")":
            depth = max(0, depth - 1)
            continue
        if depth > 0:
            out.append(ch)
    return "".join(out)


def clean_base_address(address: str) -> str:
    """상세주소(층·호·건물명·괄호·외 N필지)를 떼어낸 기본 주소."""
    base = strip_parens(address)
    base = base.split(",")[0]
    base = re.sub(r"\s*외\s*\d+\s*필지.*$", "", base)
    base = re.sub(r"\s*(?:지하|지상)?\s*\d+\s*층.*$", "", base)
    base = re.sub(r"\s+", " ", base).strip(" ,.-")
    return base


def source_gu(address: str) -> str | None:
    m = GU_PAT.match(address.strip())
    return m.group(1) if m else None


def source_dong(address: str) -> str | None:
    inside = paren_contents(address)
    for token in re.split(r"[,\s]+", inside):
        m = DONG_PAT.fullmatch(token.strip())
        if m:
            return m.group(1)
    # 괄호가 없으면 본문에서 찾는다(지번 주소 형태).
    m = DONG_PAT.search(strip_parens(address))
    return m.group(1) if m else None


def source_road(address: str) -> str | None:
    m = ROAD_PAT.search(strip_parens(address))
    return m.group(1) if m else None


def build_address_queries(address: str) -> list[tuple[str, str]]:
    """(mode, query) 목록. 도로명 우선, 그다음 지번."""
    base = clean_base_address(address)
    if not base:
        return []
    gu = source_gu(address)
    queries: list[tuple[str, str]] = []
    mode = "road" if ROAD_PAT.search(base) else ("jibun" if JIBUN_PAT.search(base) else "address")
    queries.append((mode, base))
    # 구 명칭 변경(2026 행정구역 개편) 등으로 실패할 때를 위한 구 생략 질의
    if gu:
        without_gu = re.sub(r"^인천(?:광역시)?\s*" + re.escape(gu) + r"\s*", "인천 ", base).strip()
        if without_gu and without_gu != base:
            queries.append((mode, without_gu))
    return queries


def classify_address_type(address_type: str) -> str:
    if address_type in ("ROAD", "ROAD_ADDR"):
        return "geocoded_kakao_road"
    if address_type in ("REGION", "REGION_ADDR"):
        return "geocoded_kakao_jibun"
    return "geocoded_kakao_address"


def incheon_docs(payload: dict) -> list[dict]:
    docs = []
    for doc in payload.get("documents") or []:
        name = (doc.get("address_name") or "").strip()
        road_name = ((doc.get("road_address") or {}) or {}).get("address_name") or ""
        if not (name.startswith("인천") or str(road_name).startswith("인천")):
            continue
        try:
            lng, lat = float(doc["x"]), float(doc["y"])
        except (KeyError, TypeError, ValueError):
            continue
        if not coord_valid(lat, lng):
            continue
        doc = dict(doc)
        doc["_lat"], doc["_lng"] = lat, lng
        docs.append(doc)
    return docs


def spread_m(docs: list[dict]) -> float:
    worst = 0.0
    for i in range(len(docs)):
        for j in range(i + 1, len(docs)):
            worst = max(worst, haversine_m(docs[i]["_lat"], docs[i]["_lng"],
                                           docs[j]["_lat"], docs[j]["_lng"]))
    return worst


def gu_of_doc(doc: dict) -> str | None:
    for key in ("address_name",):
        m = GU_PAT.match((doc.get(key) or "").strip())
        if m:
            return m.group(1)
    road = ((doc.get("road_address") or {}) or {}).get("address_name") or ""
    m = GU_PAT.match(road.strip())
    return m.group(1) if m else None


def try_address(client: KakaoLocalClient, row: dict, attempts: list[dict]) -> dict | None:
    address = (row.get("address") or "").strip()
    gu = source_gu(address)
    for mode, query in build_address_queries(address):
        payload = client.search_address(query)
        docs = incheon_docs(payload)
        attempt = {"stage": "address", "mode": mode, "query": query,
                   "total_count": (payload.get("meta") or {}).get("total_count"),
                   "incheon_candidates": len(docs)}
        if not docs:
            attempt["result"] = "no_incheon_candidate"
            attempts.append(attempt)
            continue
        if len(docs) > 1:
            worst = spread_m(docs)
            attempt["candidate_spread_m"] = round(worst, 1)
            if worst > AMBIGUITY_LIMIT_M:
                attempt["result"] = "ambiguous_candidates"
                attempts.append(attempt)
                continue
        doc = docs[0]
        doc_gu = gu_of_doc(doc)
        if gu and doc_gu and doc_gu != gu:
            attempt["result"] = "gu_mismatch"
            attempt["matched_gu"] = doc_gu
            attempts.append(attempt)
            continue
        attempt["result"] = "accepted"
        attempt["matched_address_name"] = doc.get("address_name")
        attempt["address_type"] = doc.get("address_type")
        attempt["lat"], attempt["lng"] = doc["_lat"], doc["_lng"]
        attempts.append(attempt)
        return {"lat": doc["_lat"], "lng": doc["_lng"],
                "status": classify_address_type(doc.get("address_type") or ""),
                "source_mode": "address_" + mode,
                "matched_address_name": doc.get("address_name"),
                "address_type": doc.get("address_type"),
                "query": query}
    return None


def try_keyword(client: KakaoLocalClient, row: dict, attempts: list[dict]) -> dict | None:
    """상호명 기반 폴백. 같은 구 + (같은 법정동 또는 같은 도로명)일 때만 수용."""
    address = (row.get("address") or "").strip()
    name = (row.get("facility_name") or "").strip()
    if not name:
        return None
    gu = source_gu(address)
    dong = source_dong(address)
    road = source_road(address)

    queries = []
    if gu:
        queries.append(f"{name} {gu}")
    if dong:
        queries.append(f"인천 {dong} {name}")

    for query in queries:
        payload = client.search_keyword(query)
        docs = incheon_docs(payload)
        attempt = {"stage": "keyword", "mode": "keyword", "query": query,
                   "total_count": (payload.get("meta") or {}).get("total_count"),
                   "incheon_candidates": len(docs)}
        if not docs:
            attempt["result"] = "no_incheon_candidate"
            attempts.append(attempt)
            continue
        confirmed = []
        for doc in docs:
            doc_gu = gu_of_doc(doc)
            if gu and doc_gu and doc_gu != gu:
                continue
            text = " ".join([(doc.get("address_name") or ""), (doc.get("road_address_name") or "")])
            if (dong and dong in text) or (road and road in text):
                confirmed.append(doc)
        if not confirmed:
            attempt["result"] = "no_address_corroboration"
            attempts.append(attempt)
            continue
        if len(confirmed) > 1 and spread_m(confirmed) > AMBIGUITY_LIMIT_M:
            attempt["result"] = "ambiguous_candidates"
            attempt["candidate_spread_m"] = round(spread_m(confirmed), 1)
            attempts.append(attempt)
            continue
        doc = confirmed[0]
        attempt["result"] = "accepted"
        attempt["matched_address_name"] = doc.get("road_address_name") or doc.get("address_name")
        attempt["place_name"] = doc.get("place_name")
        attempt["lat"], attempt["lng"] = doc["_lat"], doc["_lng"]
        attempts.append(attempt)
        return {"lat": doc["_lat"], "lng": doc["_lng"],
                "status": "geocoded_kakao_keyword",
                "source_mode": "keyword",
                "matched_address_name": doc.get("road_address_name") or doc.get("address_name"),
                "address_type": None,
                "query": query}
    return None


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="유흥·단란주점 좌표 미확보 행 Kakao 보강")
    parser.add_argument("--offline", action="store_true", help="캐시만 사용(네트워크 호출 금지)")
    parser.add_argument("--dry-run", action="store_true", help="CSV/로그 미수정")
    parser.add_argument("--limit", type=int, default=None, help="처리할 최대 행 수(시험용)")
    args = parser.parse_args(argv)

    with open(NIGHTLIFE_CSV, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columns = list(reader.fieldnames or [])
        rows = [dict(r) for r in reader]

    before_located = sum(1 for r in rows if r.get("coordinate_status") == "official_coordinate")
    targets = [r for r in rows if r.get("coordinate_status") != "official_coordinate"]
    if args.limit:
        targets = targets[: args.limit]

    client = KakaoLocalClient(offline=args.offline)
    log_entries = []
    resolved = 0
    for i, row in enumerate(targets, 1):
        attempts: list[dict] = []
        hit = try_address(client, row, attempts) or try_keyword(client, row, attempts)
        entry = {
            "source_record_id": row.get("source_record_id"),
            "facility_name": row.get("facility_name"),
            "address": row.get("address"),
            "attempts": attempts,
        }
        if hit:
            row["latitude"] = f"{hit['lat']:.7f}"
            row["longitude"] = f"{hit['lng']:.7f}"
            row["coordinate_status"] = hit["status"]
            row["coordinate_source"] = "kakao_local_api:" + hit["source_mode"]
            entry.update({
                "coordinate_status": hit["status"],
                "coordinate_source": row["coordinate_source"],
                "accepted_query": hit["query"],
                "matched_address_name": hit["matched_address_name"],
                "address_type": hit["address_type"],
                "latitude": row["latitude"],
                "longitude": row["longitude"],
                "geocoded_at": RETRIEVED_AT,
            })
            resolved += 1
        else:
            row["latitude"] = ""
            row["longitude"] = ""
            row["coordinate_status"] = "unresolved"
            row["coordinate_source"] = "kakao_local_api:unresolved"
            entry.update({
                "coordinate_status": "unresolved",
                "coordinate_source": row["coordinate_source"],
                "latitude": None, "longitude": None,
                "geocoded_at": RETRIEVED_AT,
            })
        log_entries.append(entry)
        if i % 25 == 0:
            print(f"  ... {i}/{len(targets)} (해결 {resolved}, live {client.live_calls})", flush=True)
            if not args.dry_run:
                client.save()

    if not args.dry_run:
        client.save()

    after_located = sum(1 for r in rows if r.get("coordinate_status") in (
        "official_coordinate", "geocoded_kakao_road", "geocoded_kakao_jibun",
        "geocoded_kakao_address", "geocoded_kakao_keyword"))
    unresolved = sum(1 for r in rows if r.get("coordinate_status") == "unresolved")

    print(f"[nightlife-geocode] 대상 {len(targets)}행 / 해결 {resolved} / 미해결 {len(targets) - resolved}")
    print(f"[nightlife-geocode] 좌표 확보: {before_located} -> {after_located} (미해결 {unresolved})")
    print(f"[nightlife-geocode] Kakao live calls={client.live_calls}, cache hits={client.cache_hits}")

    if args.dry_run:
        return 0

    log_entries.sort(key=lambda e: e["source_record_id"] or "")
    by_status: dict[str, int] = {}
    for e in log_entries:
        by_status[e["coordinate_status"]] = by_status.get(e["coordinate_status"], 0) + 1
    payload = {
        "generated_by": "scripts/context/geocode_missing_kakao.py",
        "geocoder": "Kakao Local API (v2/local/search/address.json, v2/local/search/keyword.json)",
        "geocoded_at": RETRIEVED_AT,
        "input_file": "data/context_sources/incheon_nightlife_geocoded.csv",
        "target_rows": len(targets),
        "resolved_rows": resolved,
        "unresolved_rows": len(targets) - resolved,
        "status_counts": dict(sorted(by_status.items())),
        "acceptance_rules_ko": [
            "address_name이 '인천'으로 시작하는 결과만 수용",
            "빌더와 동일한 광역 좌표 범위(lat 36~39, lng 124~128) 안일 것",
            "원 주소의 구와 매칭 결과의 구가 같을 것",
            f"후보가 복수면 상호 거리 {int(AMBIGUITY_LIMIT_M)}m 이하일 때만 수용(그 외 ambiguous 거절)",
            "키워드 폴백은 같은 구 + 같은 법정동 또는 같은 도로명이 확인될 때만 수용",
        ],
        "coordinate_meaning_ko": "행정 주소를 지오코딩한 추정 위치이며 현장 실측 좌표가 아님.",
        "records": log_entries,
    }
    with open(LOG_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    with open(NIGHTLIFE_CSV, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns, lineterminator="\r\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in columns})

    # manifest 좌표 카운트 갱신 (유흥/단란 파일별)
    def update_manifest(path: Path, facility_type: str, key: str, note: str) -> None:
        if not path.exists():
            return
        data = json.loads(path.read_text(encoding="utf-8"))
        subset = [r for r in rows if r.get("facility_type") == facility_type]
        located = sum(1 for r in subset if r.get("coordinate_status") != "unresolved"
                      and (r.get("latitude") or "").strip())
        data[key] = located
        data["kakao_geocoded_rows"] = sum(
            1 for r in subset if (r.get("coordinate_source") or "").startswith("kakao_local_api:")
            and r.get("coordinate_status") != "unresolved")
        data["unresolved_coordinate_rows"] = sum(
            1 for r in subset if r.get("coordinate_status") == "unresolved")
        notes = data.get("notes")
        if isinstance(notes, list):
            if note not in notes:
                notes.append(note)
        elif isinstance(notes, str):
            if note not in notes:
                data["notes"] = notes + " " + note
        else:
            data["notes"] = note
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write("\n")

    note = ("2026-09-06 Kakao Local API 주소 지오코딩으로 좌표 미확보 행 보강 "
            "(coordinate_source=kakao_local_api:*, 미해결은 unresolved 유지). "
            "지오코딩 좌표는 주소 기반 추정 위치이며 현장 실측 좌표가 아님.")
    update_manifest(ENT_MANIFEST, "유흥주점영업", "incheon_active_valid_coords", note)
    update_manifest(SING_MANIFEST, "단란주점영업", "valid_coordinate_rows", note)
    print(f"[nightlife-geocode] 로그 -> {LOG_PATH.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
