# -*- coding: utf-8 -*-
"""
P2 Task 4.5 (+ Kakao 정밀화): 결측 좌표 지오코딩

data/raw_library/전국도서관표준데이터_인천.csv 중 LATITUDE/LONGITUDE가 결측인
68개 행(65 공공도서관 + 3 작은도서관, 전원 RDNMADR 도로명주소 보유)을 지오코딩한다.

우선순위 (행 단위 캐스케이드):
  1) 환경변수 KAKAO_REST_KEY 존재 시, 카카오 로컬 API 주소 검색을 시도한다.
     (원본 주소 실패 시 괄호/콤마 제거한 단순화 주소로 1회 재시도)
  2) 위 결과가 없거나 인천 bbox 밖이면, 카카오 키워드 검색으로 재시도한다.
     쿼리: "<도서관명> <구/군명>" (예: "자월도서관 옹진군"). 응답의 address_name /
     road_address_name에 대상 구/군명이 포함된 결과만 채택한다(엉뚱한 동명 시설 방지).
  3) 위 결과도 없거나 KAKAO_REST_KEY가 없으면 Nominatim(OpenStreetMap)을 사용한다.
     - User-Agent: "park-analysis-reading-module/1.0 (contest app)"
     - 요청 간 1.1초 대기(정책 준수)
     - 빈 결과 시 1회 재시도: 괄호 안 상세동/층수 제거 + 콤마 이후 상세주소 제거한
       단순화 주소로 재검색

각 행의 최종 채택 결과에 실제로 사용된 소스를 geocode_source에 기록한다:
  "kakao_address" | "kakao_keyword" | "nominatim"

검증: 결과 좌표가 인천 bbox(위도 37.0~37.9, 경도 126.1~126.9) 안에 있어야 채택.
      단, 주소에 백령면/대청면/소청면/연평면이 포함된 경우(서해 최북단 옹진군 도서)는
      확장 bbox(위도 37.0~38.05, 경도 124.4~126.9)를 적용한다 — 이 지역은 육지 기준
      bbox보다 훨씬 서쪽·북쪽에 위치한 실제 인천광역시 행정구역이기 때문이다.
      범위 밖이면 다음 우선순위로 넘어가고, 모두 실패하면 failed 처리.

출력: data/raw_library/geocoded_missing_libraries.csv
  컬럼: 도서관명, 주소, 위도, 경도, geocode_source, geocode_status
  (미해결 행도 도서관명/주소를 채운 채 geocode_status=failed 로 포함)

실행: KAKAO_REST_KEY=<key> py scripts/reading_module/geocode_missing_libraries.py
  (환경변수 미설정 시 기존과 동일하게 Nominatim만 사용)
"""
from __future__ import annotations

import csv
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
RAW_LIB_DIR = ROOT / "data" / "raw_library"
LIBRARY_SRC = RAW_LIB_DIR / "전국도서관표준데이터_인천.csv"
OUT_CSV = RAW_LIB_DIR / "geocoded_missing_libraries.csv"

USER_AGENT = "park-analysis-reading-module/1.0 (contest app)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
KAKAO_ADDRESS_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
SLEEP_SECONDS = 1.1
KAKAO_SLEEP_SECONDS = 0.2  # 카카오는 초당 요청 제한이 넉넉하지만 예의상 소폭 대기

# 인천광역시(육지+강화) 대략 bbox
INCHEON_LAT_MIN, INCHEON_LAT_MAX = 37.0, 37.9
INCHEON_LON_MIN, INCHEON_LON_MAX = 126.1, 126.9

# 옹진군 서해 최북단 도서(백령/대청/소청/연평면)는 육지 기준 bbox보다 훨씬 서쪽·북쪽에
# 위치하는 실제 인천 행정구역이다(예: 백령도 진촌리 약 lat 37.97, lon 124.72).
# Kakao 정밀화 과정에서 이 3개 도서관(백령도서관·대청도서관·연평도서관)이 위 좁은 bbox
# 때문에 유효 좌표임에도 "범위 밖"으로 오탈락하는 것을 확인하여, 해당 면(面) 주소에
# 한해 확장 bbox를 적용한다. 나머지 옹진군 도서(자월/영흥/덕적/북도면)는 육지에 더
# 가까워 기존 bbox 안에 들어오므로 그대로 둔다.
ISLAND_MYEON_KEYWORDS = ("백령면", "대청면", "소청면", "연평면")
ISLAND_LAT_MIN, ISLAND_LAT_MAX = 37.0, 38.05
ISLAND_LON_MIN, ISLAND_LON_MAX = 124.4, 126.9


def in_incheon_bbox(lat: float, lon: float, addr: str = "") -> bool:
    if addr and any(kw in addr for kw in ISLAND_MYEON_KEYWORDS):
        return (
            ISLAND_LAT_MIN <= lat <= ISLAND_LAT_MAX
            and ISLAND_LON_MIN <= lon <= ISLAND_LON_MAX
        )
    return (
        INCHEON_LAT_MIN <= lat <= INCHEON_LAT_MAX
        and INCHEON_LON_MIN <= lon <= INCHEON_LON_MAX
    )


def simplify_address(addr: str) -> str:
    """괄호 안 상세동/층수 제거 + 콤마 이후 상세주소 제거."""
    s = re.sub(r"\([^)]*\)", "", addr)
    s = s.split(",")[0]
    return s.strip()


def geocode_nominatim(addr: str):
    """Nominatim 검색. 성공 시 (lat, lon) 튜플, 실패 시 None."""
    params = {
        "format": "json",
        "q": addr,
        "countrycodes": "kr",
        "limit": 1,
    }
    url = NOMINATIM_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # pragma: no cover - 네트워크 예외 방어
        print(f"  [ERROR] Nominatim 요청 실패: {addr!r} -> {e}")
        return None
    if not data:
        return None
    try:
        lat = float(data[0]["lat"])
        lon = float(data[0]["lon"])
    except (KeyError, ValueError, TypeError):
        return None
    return lat, lon


def geocode_kakao_address(addr: str, key: str):
    """카카오 로컬 API 주소 검색. 성공 시 (lat, lon), 실패 시 None."""
    params = {"query": addr}
    url = KAKAO_ADDRESS_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, headers={"Authorization": f"KakaoAK {key}", "User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # pragma: no cover
        print(f"  [ERROR] Kakao 주소검색 요청 실패: {addr!r} -> {e}")
        return None
    docs = data.get("documents") or []
    if not docs:
        return None
    try:
        lat = float(docs[0]["y"])
        lon = float(docs[0]["x"])
    except (KeyError, ValueError, TypeError):
        return None
    return lat, lon


def geocode_kakao_keyword(query: str, key: str, expect_gu: str):
    """카카오 로컬 API 키워드 검색. 결과 주소에 expect_gu가 포함된 첫 결과만 채택.

    성공 시 (lat, lon), 실패 시 None.
    """
    params = {"query": query}
    url = KAKAO_KEYWORD_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, headers={"Authorization": f"KakaoAK {key}", "User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # pragma: no cover
        print(f"  [ERROR] Kakao 키워드검색 요청 실패: {query!r} -> {e}")
        return None
    docs = data.get("documents") or []
    if not docs or not expect_gu:
        return None
    for doc in docs:
        addr_name = doc.get("address_name") or ""
        road_addr_name = doc.get("road_address_name") or ""
        if expect_gu in addr_name or expect_gu in road_addr_name:
            try:
                lat = float(doc["y"])
                lon = float(doc["x"])
            except (KeyError, ValueError, TypeError):
                continue
            return lat, lon
    return None


def geocode_via_kakao(addr: str, name: str, gu: str, key: str):
    """카카오 캐스케이드: 주소검색(원본→단순화) → 키워드검색.

    성공 시 (lat, lon, source, used_addr), 실패 시 None.
    """
    # 1) 주소검색 - 원본
    coord = geocode_kakao_address(addr, key)
    time.sleep(KAKAO_SLEEP_SECONDS)
    if coord is not None and in_incheon_bbox(*coord, addr=addr):
        return coord[0], coord[1], "kakao_address", addr

    # 1b) 주소검색 - 단순화 주소
    simplified = simplify_address(addr)
    if simplified and simplified != addr:
        coord2 = geocode_kakao_address(simplified, key)
        time.sleep(KAKAO_SLEEP_SECONDS)
        if coord2 is not None and in_incheon_bbox(*coord2, addr=addr):
            return coord2[0], coord2[1], "kakao_address", simplified

    # 2) 키워드검색 - "<도서관명> <구/군명>"
    query = f"{name} {gu}".strip() if gu else name
    coord3 = geocode_kakao_keyword(query, key, gu)
    time.sleep(KAKAO_SLEEP_SECONDS)
    if coord3 is not None and in_incheon_bbox(*coord3, addr=addr):
        return coord3[0], coord3[1], "kakao_keyword", addr

    return None


def geocode_via_nominatim(addr: str):
    """Nominatim 캐스케이드(기존 로직): 원본 → 단순화 1회 재시도.

    성공 시 (lat, lon, source, used_addr), 실패 시 None.
    """
    coord = geocode_nominatim(addr)
    time.sleep(SLEEP_SECONDS)

    used_addr = addr
    if coord is None or not in_incheon_bbox(*coord, addr=addr):
        simplified = simplify_address(addr)
        if simplified and simplified != addr:
            print(f"  [RETRY] 단순화 주소로 재시도: {simplified!r}")
            coord2 = geocode_nominatim(simplified)
            time.sleep(SLEEP_SECONDS)
            if coord2 is not None and in_incheon_bbox(*coord2, addr=addr):
                coord = coord2
                used_addr = simplified
            elif coord is not None and not in_incheon_bbox(*coord, addr=addr):
                coord = None

    if coord is not None and in_incheon_bbox(*coord, addr=addr):
        return coord[0], coord[1], "nominatim", used_addr
    return None


def main():
    kakao_key = os.environ.get("KAKAO_REST_KEY")
    use_kakao = bool(kakao_key)

    print("=== 결측 좌표 지오코딩 (P2 Task 4.5 + Kakao 정밀화) ===")
    print(
        "지오코딩 순서: "
        + ("kakao_address -> kakao_keyword -> nominatim" if use_kakao else "nominatim (KAKAO_REST_KEY 미설정)")
    )

    lib_raw = pd.read_csv(LIBRARY_SRC, encoding="utf-8")
    missing_mask = lib_raw["LATITUDE"].isna() | lib_raw["LONGITUDE"].isna()
    missing = lib_raw.loc[missing_mask].copy()
    print(f"결측 좌표 대상: {len(missing)}행")

    results = []
    resolved = 0
    failed = 0
    by_type_resolved = {}
    by_type_failed = {}
    by_source_resolved = {}

    for i, row in enumerate(missing.itertuples(index=False), start=1):
        name = getattr(row, "LBRRY_NM")
        addr = getattr(row, "RDNMADR")
        lib_type = getattr(row, "LBRRY_SE")
        gu = getattr(row, "SIGNGU_NM", "")
        gu = "" if pd.isna(gu) else str(gu).strip()

        print(f"[{i}/{len(missing)}] {name} ({lib_type}, {gu}) — {addr}")

        addr_str = "" if pd.isna(addr) else str(addr).strip()
        if not addr_str:
            print("  [SKIP] 주소 없음")
            results.append({
                "도서관명": name,
                "주소": addr_str,
                "위도": "",
                "경도": "",
                "geocode_source": "kakao_address" if use_kakao else "nominatim",
                "geocode_status": "failed",
            })
            failed += 1
            by_type_failed[lib_type] = by_type_failed.get(lib_type, 0) + 1
            continue

        outcome = None
        if use_kakao:
            outcome = geocode_via_kakao(addr_str, name, gu, kakao_key)
        if outcome is None:
            outcome = geocode_via_nominatim(addr_str)

        if outcome is not None:
            lat, lon, source, used_addr = outcome
            print(f"  [OK:{source}] lat={lat:.6f} lon={lon:.6f}")
            results.append({
                "도서관명": name,
                "주소": used_addr,
                "위도": lat,
                "경도": lon,
                "geocode_source": source,
                "geocode_status": "resolved",
            })
            resolved += 1
            by_type_resolved[lib_type] = by_type_resolved.get(lib_type, 0) + 1
            by_source_resolved[source] = by_source_resolved.get(source, 0) + 1
        else:
            print("  [FAIL] 모든 소스에서 결과 없음 또는 인천 bbox 밖")
            results.append({
                "도서관명": name,
                "주소": addr_str,
                "위도": "",
                "경도": "",
                "geocode_source": "kakao_address" if use_kakao else "nominatim",
                "geocode_status": "failed",
            })
            failed += 1
            by_type_failed[lib_type] = by_type_failed.get(lib_type, 0) + 1

    RAW_LIB_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["도서관명", "주소", "위도", "경도", "geocode_source", "geocode_status"],
        )
        writer.writeheader()
        writer.writerows(results)

    print("\n=== 결과 요약 ===")
    print(f"총 {len(missing)}행 중 해결(resolved) {resolved}행 / 실패(failed) {failed}행")
    print("소스별 해결:")
    for s, c in by_source_resolved.items():
        print(f"  - {s}: {c}")
    print("유형별 해결:")
    for t, c in by_type_resolved.items():
        print(f"  - {t}: {c}")
    print("유형별 실패:")
    for t, c in by_type_failed.items():
        print(f"  - {t}: {c}")
    print(f"\n출력: {OUT_CSV}")

    if failed > 15:
        print("\n[WARN] 실패 15건 초과 → DONE_WITH_CONCERNS 로 보고 필요"
              "(Kakao REST 지오코딩(키 필요) 검토 권장)")
        return "DONE_WITH_CONCERNS"
    return "DONE"


if __name__ == "__main__":
    status = main()
    print(f"\nSTATUS: {status}")
    sys.exit(0)
