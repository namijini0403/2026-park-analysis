# -*- coding: utf-8 -*-
"""
Valhalla isochrone API로 인천 초등학교 272개교의 도보 500m 등시선을 재계산한다.

- 요청 방식: POST https://valhalla1.openstreetmap.de/isochrone
- 딜레이: 요청 간 1초
- 재시도: 최대 3회
- 실패 시: 기존 OSMnx 등시선으로 fallback
- 출력: data_processed/isochrone_valhalla.geojson
"""

from __future__ import annotations

import time
from pathlib import Path

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import shape


ROOT = Path(r"c:\2026_data_analysis_park")
PROCESSED = ROOT / "data/processed"

SCHOOLS_PATH = PROCESSED / "schools.csv"
OSMNX_ISO_PATH = PROCESSED / "school_isochrone_500m.geojson"
OUTPUT_PATH = PROCESSED / "isochrone_valhalla.geojson"

VALHALLA_URL = "https://valhalla1.openstreetmap.de/isochrone"
REQUEST_DELAY_SEC = 1.0
MAX_RETRIES = 3


def build_payload(lat: float, lon: float) -> dict:
    return {
        "locations": [{"lat": lat, "lon": lon}],
        "costing": "pedestrian",
        "contours": [{"distance": 0.5}],
        "polygons": True,
    }


def fetch_valhalla_isochrone(lat: float, lon: float) -> tuple[object | None, bool, str]:
    payload = build_payload(lat, lon)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = requests.post(VALHALLA_URL, json=payload, timeout=20)
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            if not features:
                raise ValueError("No features in response")
            geom = shape(features[0]["geometry"])
            return geom, True, f"valhalla:attempt_{attempt}"
        except Exception as exc:
            status = getattr(getattr(exc, "response", None), "status_code", "NA")
            if attempt == MAX_RETRIES:
                return None, False, f"fallback:{type(exc).__name__}:status_{status}"
            time.sleep(REQUEST_DELAY_SEC)

    return None, False, "fallback:unknown"


def main() -> None:
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    osmnx_iso = gpd.read_file(OSMNX_ISO_PATH)

    school_id_col = "학교ID"
    school_name_col = "학교명"
    school_lat_col = "위도"
    school_lng_col = "경도"

    iso_id_col = "학교ID"
    iso_name_col = "학교명"

    total = len(schools)
    records: list[dict] = []

    for idx, row in schools.iterrows():
        school_id = row[school_id_col]
        school_name = row[school_name_col]
        lat = float(row[school_lat_col])
        lon = float(row[school_lng_col])

        geom, success, source = fetch_valhalla_isochrone(lat, lon)

        if geom is None:
            fallback_row = osmnx_iso[osmnx_iso[iso_id_col].astype(str) == str(school_id)]
            if fallback_row.empty:
                raise ValueError(f"Fallback geometry not found for {school_id} / {school_name}")
            fallback_row = fallback_row.iloc[0]
            geom = fallback_row.geometry

        records.append(
            {
                "학교ID": school_id,
                "학교명": school_name,
                "valhalla_success": success,
                "source": source,
                "geometry": geom,
            }
        )

        if (idx + 1) % 100 == 0 or (idx + 1) == total:
            print(f"[{idx + 1}/{total}] processed")

        time.sleep(REQUEST_DELAY_SEC)

    out_gdf = gpd.GeoDataFrame(records, crs="EPSG:4326")
    out_gdf.to_file(OUTPUT_PATH, driver="GeoJSON")

    print(f"saved: {OUTPUT_PATH}")
    print(f"valhalla_success count: {int(out_gdf['valhalla_success'].sum())}")
    print(f"fallback count: {int((~out_gdf['valhalla_success']).sum())}")


if __name__ == "__main__":
    main()
