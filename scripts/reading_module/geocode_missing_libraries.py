# -*- coding: utf-8 -*-
"""
P2 Task 4.5: 결측 좌표 지오코딩

data/raw_library/전국도서관표준데이터_인천.csv 중 LATITUDE/LONGITUDE가 결측인
68개 행(65 공공도서관 + 3 작은도서관, 전원 RDNMADR 도로명주소 보유)을 지오코딩한다.

우선순위:
  1) 환경변수 KAKAO_REST_KEY 존재 시 카카오 로컬 API(주소 검색)를 사용한다.
     (본 실행 시점에는 키가 없어 사용되지 않음 — .env 파일은 읽지 않는다.)
  2) 없으면 Nominatim(OpenStreetMap)을 사용한다.
     - User-Agent: "park-analysis-reading-module/1.0 (contest app)"
     - 요청 간 1.1초 대기(정책 준수, 총 68개 기준 약 75초)
     - 빈 결과 시 1회 재시도: 괄호 안 상세동/층수 제거 + 콤마 이후 상세주소 제거한
       단순화 주소로 재검색

검증: 결과 좌표가 인천 bbox(위도 37.0~37.9, 경도 126.1~126.9) 안에 있어야 채택.
      범위 밖이면 실패(failed) 처리.

출력: data/raw_library/geocoded_missing_libraries.csv
  컬럼: 도서관명, 주소, 위도, 경도, geocode_source, geocode_status
  (미해결 행도 도서관명/주소를 채운 채 geocode_status=failed 로 포함)

실행: py scripts/reading_module/geocode_missing_libraries.py
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
KAKAO_URL = "https://dapi.kakao.com/v2/local/search/address.json"
SLEEP_SECONDS = 1.1

# 인천광역시 대략 bbox
INCHEON_LAT_MIN, INCHEON_LAT_MAX = 37.0, 37.9
INCHEON_LON_MIN, INCHEON_LON_MAX = 126.1, 126.9


def in_incheon_bbox(lat: float, lon: float) -> bool:
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


def geocode_kakao(addr: str, key: str):
    """카카오 로컬 API 주소 검색. 성공 시 (lat, lon), 실패 시 None."""
    params = {"query": addr}
    url = KAKAO_URL + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(
        url, headers={"Authorization": f"KakaoAK {key}", "User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # pragma: no cover
        print(f"  [ERROR] Kakao 요청 실패: {addr!r} -> {e}")
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


def main():
    kakao_key = os.environ.get("KAKAO_REST_KEY")
    use_kakao = bool(kakao_key)
    source_label = "kakao" if use_kakao else "nominatim"

    print("=== 결측 좌표 지오코딩 (P2 Task 4.5) ===")
    print(f"지오코딩 소스: {source_label}"
          + ("" if use_kakao else " (KAKAO_REST_KEY 미설정 → Nominatim 사용)"))

    lib_raw = pd.read_csv(LIBRARY_SRC, encoding="utf-8")
    missing_mask = lib_raw["LATITUDE"].isna() | lib_raw["LONGITUDE"].isna()
    missing = lib_raw.loc[missing_mask].copy()
    print(f"결측 좌표 대상: {len(missing)}행")

    def do_geocode(addr: str):
        if use_kakao:
            return geocode_kakao(addr, kakao_key)
        return geocode_nominatim(addr)

    results = []
    resolved = 0
    failed = 0
    by_type_resolved = {}
    by_type_failed = {}

    for i, row in enumerate(missing.itertuples(index=False), start=1):
        name = getattr(row, "LBRRY_NM")
        addr = getattr(row, "RDNMADR")
        lib_type = getattr(row, "LBRRY_SE")

        print(f"[{i}/{len(missing)}] {name} ({lib_type}) — {addr}")

        addr_str = "" if pd.isna(addr) else str(addr).strip()
        if not addr_str:
            print("  [SKIP] 주소 없음")
            results.append({
                "도서관명": name,
                "주소": addr_str,
                "위도": "",
                "경도": "",
                "geocode_source": source_label,
                "geocode_status": "failed",
            })
            failed += 1
            by_type_failed[lib_type] = by_type_failed.get(lib_type, 0) + 1
            continue

        coord = do_geocode(addr_str)
        time.sleep(SLEEP_SECONDS)

        used_addr = addr_str
        if coord is None or not in_incheon_bbox(*coord):
            simplified = simplify_address(addr_str)
            if simplified and simplified != addr_str:
                print(f"  [RETRY] 단순화 주소로 재시도: {simplified!r}")
                coord2 = do_geocode(simplified)
                time.sleep(SLEEP_SECONDS)
                if coord2 is not None and in_incheon_bbox(*coord2):
                    coord = coord2
                    used_addr = simplified
                elif coord is not None and not in_incheon_bbox(*coord):
                    # 1차 결과가 bbox 밖이면 폐기
                    coord = None

        if coord is not None and in_incheon_bbox(*coord):
            lat, lon = coord
            print(f"  [OK] lat={lat:.6f} lon={lon:.6f}")
            results.append({
                "도서관명": name,
                "주소": used_addr,
                "위도": lat,
                "경도": lon,
                "geocode_source": source_label,
                "geocode_status": "resolved",
            })
            resolved += 1
            by_type_resolved[lib_type] = by_type_resolved.get(lib_type, 0) + 1
        else:
            print("  [FAIL] 결과 없음 또는 인천 bbox 밖")
            results.append({
                "도서관명": name,
                "주소": addr_str,
                "위도": "",
                "경도": "",
                "geocode_source": source_label,
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
