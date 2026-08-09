"""
P2 Task 1: 도서관 데이터 전처리

입력:
  - data/raw_library/전국도서관표준데이터_인천.csv (전국도서관표준데이터, 인천 필터)
  - data/raw_library/학교도서관현황_인천초등_2025.csv (KESS 학교도서관현황, 인천 초등 2025)
  - data_processed/schools.csv (앱 학교 목록 — 학교ID, 학교명, 위도, 경도)
  - data_processed/school_isochrone_500m.geojson (학교별 500m 도로망 등시선 폴리곤)

출력:
  - data_processed/libraries.csv
  - data_processed/school_library_access.csv
  - data/raw_library/matching_report.md

주의: 등시선(네트워크 isochrone) 교차 여부가 "도보 접근성"의 근거이며,
직선거리(euclid)는 참고치일 뿐 접근성으로 제시하지 않는다.

실행 순서 (반드시 이 순서로):
  1) scripts/reading_module/geocode_missing_libraries.py
     (data/raw_library/geocoded_missing_libraries.csv 생성/갱신)
  2) scripts/reading_module/build_library_layer.py (본 스크립트)
     (libraries.csv, school_library_access.csv 생성)
  3) scripts/reading_module/apply_reading_gap_types.py
     (school_library_access.csv에 격차 유형 5개 컬럼 append)
본 스크립트(2단계)를 재실행하면 school_library_access.csv가 격차 유형 컬럼 없이
16개 컬럼으로 덮어써지므로, apply_reading_gap_types.py(3단계)는 build_library_layer.py
실행 직후 항상 다시 실행해야 한다.
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
from pathlib import Path

import pandas as pd

try:
    from shapely.geometry import shape, Point
    from shapely.prepared import prep
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

ROOT = Path(__file__).resolve().parents[2]
RAW_LIB_DIR = ROOT / "data" / "raw_library"
DATA_PROCESSED = ROOT / "data_processed"

LIBRARY_SRC = RAW_LIB_DIR / "전국도서관표준데이터_인천.csv"
GEOCODED_MISSING_SRC = RAW_LIB_DIR / "geocoded_missing_libraries.csv"
SCHOOL_LIB_SRC = RAW_LIB_DIR / "학교도서관현황_인천초등_2025.csv"
SCHOOLS_FILE = DATA_PROCESSED / "schools.csv"
ISOCHRONE_FILE = DATA_PROCESSED / "school_isochrone_500m.geojson"

LIBRARIES_OUT = DATA_PROCESSED / "libraries.csv"
ACCESS_OUT = DATA_PROCESSED / "school_library_access.csv"
REPORT_OUT = RAW_LIB_DIR / "matching_report.md"

TYPE_MAP = {"공공도서관": "공공", "어린이도서관": "어린이", "작은도서관": "작은"}
PUBLIC_TYPES = {"공공", "어린이"}
GU_FIX = {"깅화군": "강화군"}  # 원천 데이터 오타 보정 (강화군 1행이 '깅화군'으로 기록됨)

NOT_MATCHED_MSG = "추가 확인 필요"


# ---------------------------------------------------------------------------
# 유틸리티
# ---------------------------------------------------------------------------

def to_int(v):
    """콤마 포함 숫자 문자열/NaN 방어적으로 정수 변환."""
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    if isinstance(v, str):
        v = v.replace(",", "").strip()
        if v == "":
            return None
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return None


def extract_gu(raw: str) -> str:
    """SIGNGU_NM에서 구/군명만 추출. '인천광역시 미추홀구' 형태든 '미추홀구' 단독이든 대응."""
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return ""
    s = str(raw).strip()
    token = s.split()[-1] if s.split() else s
    return GU_FIX.get(token, token)


def format_hours(open_hhmm, close_hhmm) -> str:
    o = "" if pd.isna(open_hhmm) else str(open_hhmm).strip()
    c = "" if pd.isna(close_hhmm) else str(close_hhmm).strip()
    if not o and not c:
        return ""
    return f"{o}~{c}"


def normalize_school_name(name: str) -> str:
    """KESS 학교명 ↔ 앱 학교명 매칭용 정규화.
    - 공백 제거
    - 선행 '인천' 제거
    - '초등학교' → '초'
    - 분교장 표기는 그대로 유지 (그 자체가 구분자 역할)
    """
    s = str(name).strip()
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"^인천", "", s)
    s = s.replace("초등학교", "초")
    return s


def haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(min(1.0, a)))


# --- 순수 파이썬 point-in-polygon (shapely 미탑재 시 폴백) -------------------

def _point_in_ring(x, y, ring) -> bool:
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y):
            x_intersect = (xj - xi) * (y - yi) / ((yj - yi) or 1e-15) + xi
            if x < x_intersect:
                inside = not inside
        j = i
    return inside


def _point_in_polygon_coords(x, y, coords) -> bool:
    if not coords:
        return False
    if not _point_in_ring(x, y, coords[0]):
        return False
    for hole in coords[1:]:
        if _point_in_ring(x, y, hole):
            return False
    return True


def point_in_geometry_raw(x, y, geometry) -> bool:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "Polygon":
        return _point_in_polygon_coords(x, y, coords)
    if gtype == "MultiPolygon":
        return any(_point_in_polygon_coords(x, y, poly) for poly in coords)
    return False


def main():
    log = []

    def p(*args):
        msg = " ".join(str(a) for a in args)
        print(msg)
        log.append(msg)

    p("=== 환경 확인 ===")
    p(f"pandas: {pd.__version__}")
    p(f"shapely: {'사용 가능' if HAS_SHAPELY else '미탑재 → 순수 파이썬 ray-casting 폴백 사용'}")

    RAW_LIB_DIR.mkdir(parents=True, exist_ok=True)

    # -----------------------------------------------------------------
    # 1) 도서관 레이어
    # -----------------------------------------------------------------
    p("\n=== 도서관 레이어 처리 ===")
    lib_raw = pd.read_csv(LIBRARY_SRC, encoding="utf-8")
    total_lib = len(lib_raw)
    missing_coord_mask = lib_raw["LATITUDE"].isna() | lib_raw["LONGITUDE"].isna()
    missing_coord_count = int(missing_coord_mask.sum())

    # P2 Task 4.5: 결측 좌표를 geocode_missing_libraries.py 산출물로 보완.
    # missing_coord_mask로 걸러낸 순서(=lib_raw.loc[missing_coord_mask]의 행 순서)와
    # geocode_missing_libraries.py가 동일 원본 CSV를 동일 방식으로 순회해 만든
    # geocoded_missing_libraries.csv의 행 순서가 일치하므로 위치 기반으로 매칭한다.
    lib_raw["좌표출처"] = "원본"
    geocoded_filled = 0
    if GEOCODED_MISSING_SRC.exists():
        geo_df = pd.read_csv(GEOCODED_MISSING_SRC, encoding="utf-8")
        missing_positions = lib_raw.index[missing_coord_mask]
        if len(missing_positions) != len(geo_df):
            p(f"WARNING: 결측 좌표 행수({len(missing_positions)})와 "
              f"geocoded_missing_libraries.csv 행수({len(geo_df)})가 다름 → 지오코딩 병합 생략")
        else:
            missing_names = list(lib_raw.loc[missing_positions, "LBRRY_NM"])
            geo_names = list(geo_df["도서관명"])
            if missing_names != geo_names:
                mismatch_at = next(
                    (i for i, (a, b) in enumerate(zip(missing_names, geo_names)) if a != b),
                    None,
                )
                raise SystemExit(
                    "FATAL: 결측 좌표 행의 LBRRY_NM 순서와 geocoded_missing_libraries.csv의 "
                    "도서관명 순서가 일치하지 않음 (위치 기반 병합은 두 순서가 동일할 때만 "
                    f"안전함). 첫 불일치 위치: {mismatch_at} "
                    f"(원본={missing_names[mismatch_at] if mismatch_at is not None else None!r}, "
                    f"지오코딩={geo_names[mismatch_at] if mismatch_at is not None else None!r}). "
                    "geocode_missing_libraries.py를 원본 CSV와 같은 순서로 재실행했는지 확인할 것."
                )
            for pos, orig_idx in enumerate(missing_positions):
                geo_row = geo_df.iloc[pos]
                if geo_row["geocode_status"] == "resolved":
                    lib_raw.loc[orig_idx, "LATITUDE"] = float(geo_row["위도"])
                    lib_raw.loc[orig_idx, "LONGITUDE"] = float(geo_row["경도"])
                    lib_raw.loc[orig_idx, "좌표출처"] = "지오코딩"
                    geocoded_filled += 1
    else:
        p("WARNING: geocoded_missing_libraries.csv 없음 → 지오코딩 병합 생략")

    # 지오코딩 반영 후에도 좌표가 없는 행은 기존과 동일하게 레이어에서 제외.
    still_missing_mask = lib_raw["LATITUDE"].isna() | lib_raw["LONGITUDE"].isna()
    still_missing_count = int(still_missing_mask.sum())
    lib_geo = lib_raw.loc[~still_missing_mask].copy()

    lib_geo["유형"] = lib_geo["LBRRY_SE"].map(TYPE_MAP).fillna(lib_geo["LBRRY_SE"])
    lib_geo["구"] = lib_geo["SIGNGU_NM"].apply(extract_gu)

    libraries_out = pd.DataFrame({
        "도서관명": lib_geo["LBRRY_NM"],
        "유형": lib_geo["유형"],
        "구": lib_geo["구"],
        "위도": lib_geo["LATITUDE"].astype(float),
        "경도": lib_geo["LONGITUDE"].astype(float),
        "장서수": lib_geo["BOOK_CO"].apply(to_int),
        "열람좌석수": lib_geo["SEAT_CO"].apply(to_int),
        "평일운영": [
            format_hours(o, c)
            for o, c in zip(lib_geo["WEEKDAY_OPER_OPEN_HHMM"], lib_geo["WEEKDAY_OPER_COLSE_HHMM"])
        ],
        "휴관일": lib_geo["CLOSE_DAY"].fillna(""),
        "기준일": lib_geo["REFERENCE_DATE"],
        "좌표출처": lib_geo["좌표출처"],
    })

    # 원천 데이터에 동일 물리 도서관이 두 행(좌표 있는 행 + 좌표 없는 행)으로 중복
    # 등록된 경우가 있다. 좌표 없는 쪽이 지오코딩으로 채워지면 (도서관명, 구) 기준
    # 완전 동일한 두 행이 레이어에 함께 들어가 iso_library_count 등을 이중 집계한다.
    # 우선순위: 좌표출처=원본 > 지오코딩, 동률이면 기준일이 더 최신인 행을 채택.
    pre_dedupe_count = len(libraries_out)

    def normalize_lib_name(name: str) -> str:
        return re.sub(r"\s+", "", str(name).strip())

    libraries_out["_dedupe_key"] = (
        libraries_out["도서관명"].apply(normalize_lib_name) + "|" + libraries_out["구"]
    )
    libraries_out["_coord_rank"] = libraries_out["좌표출처"].map({"원본": 0, "지오코딩": 1}).fillna(2)
    libraries_out["_ref_date_parsed"] = pd.to_datetime(libraries_out["기준일"], errors="coerce")
    libraries_out = libraries_out.sort_values(
        ["_dedupe_key", "_coord_rank", "_ref_date_parsed"],
        ascending=[True, True, False],
        kind="mergesort",  # stable: 동률(원본/원본 등)일 때 원 순서 보존
    )
    dup_mask = libraries_out.duplicated(subset="_dedupe_key", keep="first")
    dedupe_removed = int(dup_mask.sum())
    dedupe_removed_names = sorted(libraries_out.loc[dup_mask, "도서관명"].unique().tolist())
    libraries_out = libraries_out.loc[~dup_mask].drop(
        columns=["_dedupe_key", "_coord_rank", "_ref_date_parsed"]
    )

    libraries_out = libraries_out.sort_values(["구", "도서관명"]).reset_index(drop=True)

    libraries_out.to_csv(LIBRARIES_OUT, index=False, encoding="utf-8", lineterminator="\r\n")

    p(f"원천 도서관 총 {total_lib}행, 좌표 결측 {missing_coord_count}행 중 지오코딩으로 "
      f"{geocoded_filled}행 보완 → 잔여 결측 {still_missing_count}행 제외 → 좌표 확보 {pre_dedupe_count}행")
    p(f"중복 도서관 행 제거(동일 도서관명+구, 좌표출처=원본>지오코딩 우선, 동률 시 최신 기준일 우선): "
      f"{dedupe_removed}건 제거 → 레이어 최종 {len(libraries_out)}행")
    if dedupe_removed_names:
        p(f"  제거 대상 도서관명({len(dedupe_removed_names)}종): {dedupe_removed_names}")
    p("유형별 분포:")
    for t, c in libraries_out["유형"].value_counts().items():
        p(f"  - {t}: {c}")
    p("구별 분포:")
    for g, c in libraries_out["구"].value_counts().sort_index().items():
        p(f"  - {g}: {c}")

    # -----------------------------------------------------------------
    # 2) 앱 학교 목록 + 등시선
    # -----------------------------------------------------------------
    p("\n=== 앱 학교 목록 / 등시선 로딩 ===")
    schools_df = pd.read_csv(SCHOOLS_FILE, encoding="utf-8-sig")
    p(f"schools.csv 컬럼: {schools_df.columns.tolist()}")
    p(f"schools.csv 행수: {len(schools_df)}")

    with open(ISOCHRONE_FILE, encoding="utf-8") as f:
        iso = json.load(f)
    iso_features = iso["features"]
    p(f"등시선 feature 수: {len(iso_features)}")

    geom_types = {}
    school_geoms = {}
    for feat in iso_features:
        sid = feat["properties"]["학교ID"]
        geometry = feat["geometry"]
        gtype = geometry.get("type")
        geom_types[gtype] = geom_types.get(gtype, 0) + 1
        if HAS_SHAPELY:
            school_geoms[sid] = prep(shape(geometry))
        else:
            school_geoms[sid] = geometry
    p(f"등시선 geometry 타입 분포: {geom_types}")

    def school_contains_point(sid, lon, lat) -> bool:
        g = school_geoms.get(sid)
        if g is None:
            return False
        if HAS_SHAPELY:
            return g.contains(Point(lon, lat))
        return point_in_geometry_raw(lon, lat, g)

    # -----------------------------------------------------------------
    # 3) 등시선 교차 + 최근접(직선거리, 참고치)
    # -----------------------------------------------------------------
    p("\n=== 등시선 교차 / 최근접 도서관 계산 ===")
    lib_records = libraries_out.to_dict("records")

    iso_counts = []
    iso_public_counts = []
    nearest_names = []
    nearest_dists = []
    nearest_types = []
    nearest_coord_sources = []

    schools_without_iso = 0
    for _, srow in schools_df.iterrows():
        sid = srow["학교ID"]
        s_lat, s_lon = float(srow["위도"]), float(srow["경도"])

        if sid not in school_geoms:
            schools_without_iso += 1

        count_all = 0
        count_public = 0
        best_name = None
        best_dist = None
        best_type = None
        best_coord_source = None
        for lib in lib_records:
            l_lat, l_lon = lib["위도"], lib["경도"]
            if school_contains_point(sid, l_lon, l_lat):
                count_all += 1
                if lib["유형"] in PUBLIC_TYPES:
                    count_public += 1
            d = haversine_m(s_lat, s_lon, l_lat, l_lon)
            if best_dist is None or d < best_dist:
                best_dist = d
                best_name = lib["도서관명"]
                best_type = lib["유형"]
                best_coord_source = lib["좌표출처"]

        iso_counts.append(count_all)
        iso_public_counts.append(count_public)
        nearest_names.append(best_name)
        nearest_dists.append(int(round(best_dist)) if best_dist is not None else None)
        nearest_types.append(best_type)
        nearest_coord_sources.append(best_coord_source)

    p(f"등시선 폴리곤이 없는 학교 수: {schools_without_iso}")

    # -----------------------------------------------------------------
    # 4) KESS 학교도서관현황 매칭
    # -----------------------------------------------------------------
    p("\n=== KESS 학교도서관현황 매칭 ===")
    kess_df = pd.read_csv(SCHOOL_LIB_SRC, encoding="utf-8")
    p(f"KESS 원천 행수: {len(kess_df)}")

    kess_df["_norm"] = kess_df["학교명"].apply(normalize_school_name)

    exact_map = {}
    for idx, row in kess_df.iterrows():
        exact_map.setdefault(row["학교명"], idx)

    norm_collisions = []
    normalized_map = {}
    for idx, row in kess_df.iterrows():
        key = row["_norm"]
        if key in normalized_map and normalized_map[key] != exact_map.get(row["학교명"]):
            norm_collisions.append(key)
        normalized_map.setdefault(key, idx)

    match_method = []
    match_target_idx = []
    unmatched_list = []

    for _, srow in schools_df.iterrows():
        name = srow["학교명"]
        if name in exact_map:
            match_method.append("exact")
            match_target_idx.append(exact_map[name])
            continue
        nkey = normalize_school_name(name)
        if nkey in normalized_map:
            match_method.append("normalized")
            match_target_idx.append(normalized_map[nkey])
            continue
        match_method.append(None)
        match_target_idx.append(None)
        unmatched_list.append(name)

    exact_n = match_method.count("exact")
    normalized_n = match_method.count("normalized")
    unmatched_n = match_method.count(None)
    total_n = len(schools_df)
    match_rate = (exact_n + normalized_n) / total_n * 100 if total_n else 0.0

    p(f"exact 매칭: {exact_n}")
    p(f"normalized 매칭(추가): {normalized_n}")
    p(f"미매칭: {unmatched_n}")
    p(f"매칭률: {match_rate:.2f}%")
    if norm_collisions:
        p(f"WARNING: 정규화 키 충돌 {len(norm_collisions)}건: {norm_collisions}")

    kess_only_names = sorted(set(kess_df["학교명"]) - set(schools_df["학교명"]))
    app_only_names = sorted(set(schools_df["학교명"]) - set(kess_df["학교명"]))

    # -----------------------------------------------------------------
    # 5) school_library_access.csv 조립
    # -----------------------------------------------------------------
    p("\n=== school_library_access.csv 조립 ===")
    out_rows = []
    for i, srow in enumerate(schools_df.itertuples(index=False)):
        sid = getattr(srow, "학교ID")
        name = getattr(srow, "학교명")
        method = match_method[i]
        target_idx = match_target_idx[i]
        matched = 1 if method is not None else 0

        if matched:
            k = kess_df.loc[target_idx]
            libbook = to_int(k["장서수_계"])
            seats = to_int(k["좌석수"])
            teacher_librarians = to_int(k["사서교사_사서교사_계"])
            staff_librarians = to_int(k["직원(사서자격증보유여부)_직원수_계"])
            total_librarians = (teacher_librarians or 0) + (staff_librarians or 0)
            students = to_int(k["학생수"])
            per_capita_books = k["1인당장서수"]
            seats_per_student = k["좌석당학생수"]
            ref_date = k["연도"]
        else:
            libbook = seats = teacher_librarians = staff_librarians = total_librarians = NOT_MATCHED_MSG
            students = NOT_MATCHED_MSG
            per_capita_books = NOT_MATCHED_MSG
            seats_per_student = NOT_MATCHED_MSG
            ref_date = NOT_MATCHED_MSG

        out_rows.append({
            "학교ID": sid,
            "학교명": name,
            "iso_library_count": iso_counts[i],
            "iso_public_library_count": iso_public_counts[i],
            "nearest_library_name": nearest_names[i],
            "nearest_library_euclid_m": nearest_dists[i],
            "nearest_library_type": nearest_types[i],
            "nearest_library_coord_source": nearest_coord_sources[i],
            "장서수": libbook,
            "좌석수": seats,
            "사서교사수": teacher_librarians,
            "사서직원수": staff_librarians,
            "사서합계": total_librarians,
            "학생수": students,
            "인당장서수": per_capita_books,
            "좌석당학생수": seats_per_student,
            "matched": matched,
            "기준일": ref_date,
        })

    access_out = pd.DataFrame(out_rows)
    access_out.to_csv(ACCESS_OUT, index=False, encoding="utf-8", lineterminator="\r\n")
    p(f"school_library_access.csv 행수: {len(access_out)}")

    # -----------------------------------------------------------------
    # 6) 검증 통계
    # -----------------------------------------------------------------
    p("\n=== 검증 ===")
    p(f"전체 학교 수: {len(schools_df)} (schools.csv 행수와 일치: {len(schools_df) == len(access_out)})")
    zero_iso = int((access_out["iso_library_count"] == 0).sum())
    p(f"iso_library_count 분포: 0인 학교 {zero_iso}개 / 전체 {len(access_out)}개")
    p(access_out["iso_library_count"].describe().to_string())
    p("iso_library_count 값 카운트(상위 10):")
    p(access_out["iso_library_count"].value_counts().sort_index().head(10).to_string())
    p(f"iso_public_library_count == 0 인 학교: {int((access_out['iso_public_library_count'] == 0).sum())}개")

    status = "DONE" if match_rate >= 95.0 else "DONE_WITH_CONCERNS"
    p(f"\n매칭률 {match_rate:.2f}% (목표 ≥95%) → {status}")

    # 인코딩/BOM 점검
    with open(LIBRARIES_OUT, "rb") as f:
        head = f.read(3)
    has_bom_lib = head == b"\xef\xbb\xbf"
    with open(ACCESS_OUT, "rb") as f:
        head2 = f.read(3)
    has_bom_access = head2 == b"\xef\xbb\xbf"
    p(f"libraries.csv BOM 여부: {has_bom_lib}")
    p(f"school_library_access.csv BOM 여부: {has_bom_access}")

    # -----------------------------------------------------------------
    # 7) matching_report.md
    # -----------------------------------------------------------------
    report_lines = []
    report_lines.append("# 도서관-학교 매칭 리포트 (P2 Task 1)")
    report_lines.append("")
    report_lines.append(
        f"- 도서관 원천 행수: {total_lib} (좌표 결측 {missing_coord_count}행 중 지오코딩으로 "
        f"{geocoded_filled}행 보완, 잔여 결측 {still_missing_count}행 제외 → 좌표 확보 {pre_dedupe_count}행 → "
        f"동일 도서관 중복 {dedupe_removed}행 제거 → 레이어 {len(libraries_out)}행)"
    )
    report_lines.append(f"- 앱 학교 수(schools.csv): {len(schools_df)}")
    report_lines.append(f"- KESS 학교도서관현황 원천 행수: {len(kess_df)}")
    report_lines.append("")
    report_lines.append("## 273(KESS) vs 272(앱) 행수 차이")
    report_lines.append("")
    report_lines.append(
        "KESS 데이터는 본교 265행 + 분교장 8행 = 273행. 앱 schools.csv는 272행이며, "
        "분교장 8곳 중 6곳(인천계양초등학교상야분교장, 인천공항초등학교신도분교장, "
        "인천남부초등학교이작분교장, 인천삼목초등학교장봉분교장, 인천영종초등학교금산분교장, "
        "인천용현남초등학교자월분교장)은 앱 목록에도 별도 학교ID로 존재하여 정상 매칭된다. "
        "나머지 2곳(대청초등학교소청분교장, 인천주안남초등학교승봉분교장)은 앱 학교 목록에 "
        "별도 항목이 없어(본교인 대청초등학교/인천주안남초등학교만 존재) 매칭 대상에서 자연히 제외된다."
    )
    report_lines.append("")
    if kess_only_names:
        report_lines.append("KESS에만 존재(앱 미포함):")
        for n in kess_only_names:
            report_lines.append(f"- {n}")
        report_lines.append("")
    report_lines.append("## 매칭 결과")
    report_lines.append("")
    report_lines.append(f"- exact 매칭: {exact_n}")
    report_lines.append(f"- normalized 매칭(추가): {normalized_n}")
    report_lines.append(f"- 미매칭: {unmatched_n}")
    report_lines.append(f"- 매칭률: {match_rate:.2f}% (목표 ≥95%) → **{status}**")
    report_lines.append("")
    if unmatched_list:
        report_lines.append("## 미매칭 학교 목록")
        report_lines.append("")
        for n in unmatched_list:
            report_lines.append(f"- {n} — KESS 2025 데이터에 동일/유사 학교명 레코드 없음 (신설교 추정, 추가 확인 필요)")
        report_lines.append("")
    if app_only_names:
        report_lines.append("## (참고) 앱에만 존재 학교명 전체 목록 크로스체크")
        report_lines.append("")
        for n in app_only_names:
            report_lines.append(f"- {n}")
        report_lines.append("")
    report_lines.append("## 검증 요약")
    report_lines.append("")
    report_lines.append(f"- 전체 학교 수 일치: {len(schools_df) == len(access_out)} ({len(access_out)}행)")
    report_lines.append(f"- iso_library_count == 0 인 학교: {zero_iso}개")
    report_lines.append(f"- iso_public_library_count == 0 인 학교: {int((access_out['iso_public_library_count'] == 0).sum())}개")
    report_lines.append(f"- libraries.csv BOM 없음: {not has_bom_lib}")
    report_lines.append(f"- school_library_access.csv BOM 없음: {not has_bom_access}")
    report_lines.append("")
    report_lines.append("## 참고: 접근성 판정 기준")
    report_lines.append("")
    report_lines.append(
        "`iso_library_count`/`iso_public_library_count`는 500m 도로망 등시선(school_isochrone_500m.geojson) "
        "폴리곤 내부 포함 여부로 산출한 값이며, 이것이 실제 '도보 접근성' 판정 근거다. "
        "`nearest_library_euclid_m`은 직선거리(하버사인) 참고치일 뿐 접근성 지표로 사용하지 않는다."
    )
    report_lines.append("")

    REPORT_OUT.write_text("\n".join(report_lines), encoding="utf-8")
    p(f"\nmatching_report.md 작성 완료: {REPORT_OUT}")

    return status


if __name__ == "__main__":
    result_status = main()
    sys.exit(0)
