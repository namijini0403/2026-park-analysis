# -*- coding: utf-8 -*-
"""
Kakao REST API로 500세대 이상 인천 아파트 단지 전수 지오코딩 후
학교 반경 300m 내 대단지 존재 여부(has_large_apt)를 재산출한다.
"""

from __future__ import annotations

import json
import ssl
import time
import urllib.parse
import urllib.request
from pathlib import Path

import geopandas as gpd
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
PROCESSED = ROOT / "data_processed"

API_KEY = "de063759784e64724643bc9b036737cf"
KAKAO_ADDR_URL = "https://dapi.kakao.com/v2/local/search/address.json"
KAKAO_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"

LARGE_PATH = PROCESSED / "large_apt_complexes_2025.csv"
SCHOOLS_PATH = PROCESSED / "schools.csv"
PRIORITY_PATH = PROCESSED / "school_priority.csv"
DIFF_PATH = PROCESSED / "has_large_apt_diff.csv"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"
BUFFER_M = 500
DELAY_SEC = 0.1


def request_json(base_url: str, query: str) -> dict:
    params = urllib.parse.urlencode({"query": query})
    req = urllib.request.Request(
        f"{base_url}?{params}",
        headers={"Authorization": f"KakaoAK {API_KEY}"},
    )
    context = ssl.create_default_context()
    with urllib.request.urlopen(req, context=context, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def geocode_row(row: pd.Series) -> tuple[float | None, float | None, str | None, str]:
    road_query = str(row.get("도로명주소", "")).strip()
    if road_query:
        try:
            data = request_json(KAKAO_ADDR_URL, road_query)
            docs = data.get("documents", [])
            if docs:
                top = docs[0]
                return float(top["x"]), float(top["y"]), "address", road_query
        except Exception:
            pass

    keyword_query = f"{str(row.get('시군구', '')).strip()} {str(row.get('단지명', '')).strip()}".strip()
    if keyword_query:
        try:
            data = request_json(KAKAO_KEYWORD_URL, keyword_query)
            docs = data.get("documents", [])
            if docs:
                top = docs[0]
                return float(top["x"]), float(top["y"]), "keyword", keyword_query
        except Exception:
            pass

    return None, None, None, keyword_query or road_query


def geocode_large_complexes(df: pd.DataFrame) -> pd.DataFrame:
    result = df.copy()
    result["경도"] = pd.NA
    result["위도"] = pd.NA
    result["geocode_source"] = pd.NA
    result["geocode_query"] = pd.NA

    total = len(result)
    success = 0
    for idx, row in result.iterrows():
        lon, lat, source, query = geocode_row(row)
        result.at[idx, "경도"] = lon
        result.at[idx, "위도"] = lat
        result.at[idx, "geocode_source"] = source
        result.at[idx, "geocode_query"] = query
        if lon is not None and lat is not None:
            success += 1
        if (idx + 1) % 50 == 0 or idx + 1 == total:
            print(f"[geocode] {idx + 1}/{total} processed, success={success}")
        time.sleep(DELAY_SEC)

    return result


def compute_has_large_apt(large: pd.DataFrame) -> pd.DataFrame:
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")

    gdf_schools = gpd.GeoDataFrame(
        schools.copy(),
        geometry=gpd.points_from_xy(schools["경도"], schools["위도"]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)
    gdf_schools["geometry"] = gdf_schools.geometry.buffer(BUFFER_M)

    geocoded = large.dropna(subset=["경도", "위도"]).copy()
    if geocoded.empty:
        return pd.DataFrame({"학교ID": schools["학교ID"], "has_large_apt": False})

    gdf_large = gpd.GeoDataFrame(
        geocoded,
        geometry=gpd.points_from_xy(geocoded["경도"].astype(float), geocoded["위도"].astype(float)),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)

    joined = gpd.sjoin(
        gdf_schools[["학교ID", "geometry"]],
        gdf_large[["단지명", "세대수", "geometry"]],
        how="left",
        predicate="intersects",
    )
    return (
        joined.groupby("학교ID")["단지명"]
        .apply(lambda s: bool(s.notna().any()))
        .rename("has_large_apt")
        .reset_index()
    )


def main() -> None:
    large = pd.read_csv(LARGE_PATH, encoding="utf-8-sig")
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    old_has = (
        priority["has_large_apt"].copy()
        if "has_large_apt" in priority.columns
        else pd.Series(False, index=priority.index)
    )

    geocoded_large = geocode_large_complexes(large)
    geocoded_large.to_csv(LARGE_PATH, index=False, encoding="utf-8-sig")

    new_has = compute_has_large_apt(geocoded_large)

    priority = priority.drop(columns=["has_large_apt"], errors="ignore")
    priority = priority.merge(new_has, on="학교ID", how="left")
    priority["has_large_apt"] = priority["has_large_apt"].fillna(False)
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")

    diff = priority[["학교ID", "학교명", "gu", "has_large_apt"]].copy()
    diff["old_has_large_apt"] = old_has.fillna(False).astype(bool).values
    diff = diff[diff["old_has_large_apt"] != diff["has_large_apt"]]
    diff.to_csv(DIFF_PATH, index=False, encoding="utf-8-sig")

    geocoded_count = int(geocoded_large["경도"].notna().sum())
    print(f"geocoded complexes: {geocoded_count}/{len(geocoded_large)}")
    print(f"has_large_apt True: {int(priority['has_large_apt'].sum())}")
    print(f"changed schools: {len(diff)}")


if __name__ == "__main__":
    main()
