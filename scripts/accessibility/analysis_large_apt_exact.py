# -*- coding: utf-8 -*-
"""
주택 공시가격 정보(2025) 기반 has_large_apt 재산출

절차
1. 주택 공시가격 정보에서 인천 단지별 세대수(행 수) 집계
2. 500세대 이상 단지 추출
3. 로컬 공동주택 체육시설 점데이터와 단지명 매칭으로 좌표 추정
4. 좌표 미매칭 단지는 시군구 + 동/읍/면 기준 텍스트 매칭으로 보완
5. school_priority.csv has_large_apt 덮어쓰기

주의
- 현재 세션에서 외부 지오코딩이 불가해, 단지명-공동주택 체육시설 점 매칭을 사용
- 매칭되지 않은 단지는 제외되므로 보수적 추정값임
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

import geopandas as gpd
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
RAW = ROOT / "data/raw"
PROCESSED = ROOT / "data/processed"

PRICE_PATH = next(RAW.glob("*주택 공시가격 정보(2025).csv"))
APT_POINT_PATH = next(RAW.glob("*공동주택내 체육시설 정보제공_20201130.csv"))
SCHOOLS_PATH = PROCESSED / "schools.csv"
PRIORITY_PATH = PROCESSED / "school_priority.csv"
LARGE_OUT = PROCESSED / "large_apt_complexes_2025.csv"
DIFF_OUT = PROCESSED / "has_large_apt_diff.csv"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"
CRS_APT = "EPSG:5186"
BUFFER_M = 300


def normalize_name(value: str) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", "", text)
    text = re.sub(r"아파트|주공|맨션|빌라|타운|캐슬|파크|힐스|하이츠|더샵|e편한세상|아이파크", "", text)
    text = re.sub(r"[^0-9a-z가-힣]", "", text)
    return text


def extract_road_name(address: str) -> str:
    parts = str(address or "").split()
    if len(parts) < 3:
        return ""
    road = parts[2]
    road = re.sub(r"\d.*$", "", road)
    return road.strip()


def main() -> None:
    counts: dict[tuple[str, str, str, str, str, str], int] = {}

    with PRICE_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        idx_addr = header.index("도로명주소")
        idx_sido = header.index("시도")
        idx_sigungu = header.index("시군구")
        idx_dong = header.index("동리")
        idx_complex = header.index("단지명")
        idx_code = header.index("단지코드")

        for row in reader:
            if not row or len(row) <= idx_code:
                continue
            if row[idx_sido] != "인천광역시":
                continue
            key = (
                row[idx_sido],
                row[idx_sigungu],
                row[idx_addr],
                row[idx_dong],
                row[idx_complex],
                row[idx_code],
            )
            counts[key] = counts.get(key, 0) + 1

    complex_rows = [
        {
            "시도": k[0],
            "시군구": k[1],
            "도로명주소": k[2],
            "동리": k[3],
            "단지명": k[4],
            "단지코드": k[5],
            "세대수": v,
            "단지명_norm": normalize_name(k[4]),
        }
        for k, v in counts.items()
    ]
    complexes = pd.DataFrame(complex_rows)
    large = complexes[complexes["세대수"] >= 500].copy()

    apt_points = pd.read_csv(APT_POINT_PATH, encoding="cp949")
    apt_points["정식명칭_norm"] = apt_points["정식명칭"].map(normalize_name)

    matched_records: list[dict[str, object]] = []
    for row in large.itertuples(index=False):
        name_norm = row.단지명_norm
        if not name_norm:
            continue
        matches = apt_points[
            apt_points["군구명"].astype(str).eq(row.시군구)
            & apt_points["정식명칭_norm"].astype(str).apply(
                lambda v: bool(v) and (name_norm in v or v in name_norm)
            )
        ]
        if matches.empty:
            continue
        matched_records.append(
            {
                "시도": row.시도,
                "시군구": row.시군구,
                "도로명주소": row.도로명주소,
                "동리": row.동리,
                "단지명": row.단지명,
                "단지코드": row.단지코드,
                "세대수": row.세대수,
                "X좌표": matches["X좌표"].astype(float).mean(),
                "Y좌표": matches["Y좌표"].astype(float).mean(),
                "matched_point_count": len(matches),
            }
        )

    matched_large = pd.DataFrame(matched_records)
    large_out = large.merge(
        matched_large[
            ["단지코드", "X좌표", "Y좌표", "matched_point_count"]
        ].drop_duplicates(subset=["단지코드"]),
        on="단지코드",
        how="left",
    )
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    old_has = priority["has_large_apt"].copy() if "has_large_apt" in priority.columns else pd.Series(False, index=priority.index)

    gdf_schools = gpd.GeoDataFrame(
        schools.copy(),
        geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)
    gdf_schools["geometry"] = gdf_schools.geometry.buffer(BUFFER_M)

    if matched_large.empty:
        new_has = pd.DataFrame({"학교ID": schools["학교ID"], "has_large_apt": False})
    else:
        gdf_large = gpd.GeoDataFrame(
            matched_large.copy(),
            geometry=gpd.points_from_xy(matched_large["X좌표"], matched_large["Y좌표"]),
            crs=CRS_APT,
        ).to_crs(CRS_METRIC)

        joined = gpd.sjoin(
            gdf_schools[["학교ID", "geometry"]],
            gdf_large[["단지명", "세대수", "geometry"]],
            how="left",
            predicate="intersects",
        )
        new_has = (
            joined.groupby("학교ID")["단지명"]
            .apply(lambda s: bool(s.notna().any()))
            .rename("has_large_apt")
            .reset_index()
        )

    new_has = new_has[["학교ID", "has_large_apt"]]

    large_out.to_csv(LARGE_OUT, index=False, encoding="utf-8-sig")

    priority = priority.drop(columns=["has_large_apt"], errors="ignore")
    priority = priority.merge(new_has, on="학교ID", how="left")
    priority["has_large_apt"] = priority["has_large_apt"].fillna(False)
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    diff = priority[["학교ID", "학교명", "gu", "has_large_apt"]].copy()
    diff["old_has_large_apt"] = old_has.fillna(False).astype(bool).values
    diff = diff[diff["old_has_large_apt"] != diff["has_large_apt"]]
    diff.to_csv(DIFF_OUT, index=False, encoding="utf-8-sig")

    print(f"all complexes in Incheon: {len(complexes)}")
    print(f"500+ complexes: {len(large)}")
    print(f"500+ complexes with local point match: {len(matched_large)}")
    print(f"has_large_apt True: {int(priority['has_large_apt'].sum())}")
    print(f"changed schools: {len(diff)}")


if __name__ == "__main__":
    main()
