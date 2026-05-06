from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_processed"
REPORTS = ROOT / "reports"

CRS_METRIC = "EPSG:5179"
PARK_INTERSECTION_CAP_M2 = 30000.0
PLAYGROUND = "놀이터"
PUBLIC_PARK_EXCEPTIONS = {"가경공원", "수차공원"}

COL_SCHOOL_ID = "학교ID"
COL_SCHOOL_NAME = "학교명"

MANUAL_GREEN_RATIO_BY_ID = {
    "B000003143": 7.3447,
    "B000003144": 0.4263408185968763,
    "B000003145": 0.4263408185968763,
    "B000026504": 20.733643281479043,
    "B000003048": 20.733643281479043,
    "B000002990": 0.8526816371937526,
}


def clean_geometry(geom: BaseGeometry | None) -> BaseGeometry | None:
    if geom is None or geom.is_empty:
        return geom
    if not geom.is_valid:
        geom = geom.buffer(0)
    return geom


def load_public_park_proxy_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(DATA / "parks.csv", encoding="utf-8-sig")
    public = parks[
        parks["시설유형"].ne(PLAYGROUND) | parks["공원명"].isin(PUBLIC_PARK_EXCEPTIONS)
    ].copy()
    public["공원면적"] = pd.to_numeric(public["공원면적"], errors="coerce").fillna(0.0)
    public = public[
        pd.to_numeric(public["위도"], errors="coerce").notna()
        & pd.to_numeric(public["경도"], errors="coerce").notna()
    ].copy()

    gdf = gpd.GeoDataFrame(
        public,
        geometry=gpd.points_from_xy(public["경도"], public["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    radius = np.sqrt(gdf["공원면적"] / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def load_display_walk_zones() -> gpd.GeoDataFrame:
    valhalla = gpd.read_file(DATA / "isochrone_valhalla.geojson").to_crs(CRS_METRIC)
    valhalla["geometry"] = valhalla.geometry.apply(clean_geometry)
    valhalla = valhalla[[COL_SCHOOL_ID, COL_SCHOOL_NAME, "geometry"]].copy()
    valhalla["zone_source"] = "valhalla_walk"

    adjusted_path = DATA / "school_isochrone_500m_apt_adjusted_20260504.geojson"
    if not adjusted_path.exists():
        return valhalla

    adjusted = gpd.read_file(adjusted_path).to_crs(CRS_METRIC)
    adjusted["geometry"] = adjusted.geometry.apply(clean_geometry)
    adjusted = adjusted[[COL_SCHOOL_ID, COL_SCHOOL_NAME, "geometry"]].copy()
    adjusted["zone_source"] = "apt_adjusted_walk"

    adjusted_by_id = adjusted.set_index(COL_SCHOOL_ID)
    output_rows: list[dict[str, object]] = []
    for row in valhalla.itertuples(index=False):
        school_id = getattr(row, COL_SCHOOL_ID)
        val_geom = row.geometry
        val_area = 0.0 if val_geom is None or val_geom.is_empty else float(val_geom.area)
        best_geom = val_geom
        source = "valhalla_walk"

        if school_id in adjusted_by_id.index:
            adj_geom = adjusted_by_id.loc[school_id, "geometry"]
            adj_area = 0.0 if adj_geom is None or adj_geom.is_empty else float(adj_geom.area)
            if adj_area > val_area:
                best_geom = adj_geom
                source = "apt_adjusted_walk"

        output_rows.append(
            {
                COL_SCHOOL_ID: school_id,
                COL_SCHOOL_NAME: getattr(row, COL_SCHOOL_NAME),
                "zone_source": source,
                "geometry": best_geom,
            }
        )

    return gpd.GeoDataFrame(output_rows, geometry="geometry", crs=CRS_METRIC)


def calc_guardrail_rows() -> pd.DataFrame:
    priority = pd.read_csv(DATA / "school_priority_with_functional_park_layer.csv", encoding="utf-8-sig")
    priority_by_id = priority.set_index(COL_SCHOOL_ID)
    zones = load_display_walk_zones()
    parks = load_public_park_proxy_polygons()
    parks_union = unary_union(parks.geometry)

    rows: list[dict[str, object]] = []
    for zone_row in zones.itertuples(index=False):
        school_id = getattr(zone_row, COL_SCHOOL_ID)
        school_name = getattr(zone_row, COL_SCHOOL_NAME)
        zone = zone_row.geometry
        zone_source = getattr(zone_row, "zone_source")

        zone_area = 0.0 if zone is None or zone.is_empty else float(zone.area)
        uncapped_green_area = 0.0
        capped_green_area = 0.0
        capped_park_names: list[str] = []
        intersecting_park_count = 0

        if zone_area > 0:
            union_intersection = zone.intersection(parks_union)
            uncapped_green_area = 0.0 if union_intersection.is_empty else float(union_intersection.area)

            for park in parks.itertuples(index=False):
                intersection = zone.intersection(park.geometry)
                if intersection.is_empty:
                    continue
                intersection_area = float(intersection.area)
                if intersection_area <= 1:
                    continue
                intersecting_park_count += 1
                capped_green_area += min(intersection_area, PARK_INTERSECTION_CAP_M2)
                if intersection_area > PARK_INTERSECTION_CAP_M2:
                    capped_park_names.append(str(getattr(park, "공원명", "")))

        display_ratio = capped_green_area / zone_area * 100.0 if zone_area > 0 else np.nan
        display_ratio = min(display_ratio, 100.0) if pd.notna(display_ratio) else display_ratio

        old_iso = pd.to_numeric(priority_by_id.at[school_id, "iso_green_ratio"], errors="coerce") if school_id in priority_by_id.index else np.nan
        corrected = pd.to_numeric(priority_by_id.at[school_id, "corrected_green_ratio"], errors="coerce") if school_id in priority_by_id.index else np.nan
        operational = corrected if pd.notna(corrected) else old_iso
        basis = f"{zone_source}_park_proxy_cap_{int(PARK_INTERSECTION_CAP_M2)}m2"
        note_parts = [
            "지도 표시용 도보권 기준으로 녹지비율을 재산정했습니다.",
            "대형 공원은 점 좌표+면적 원형 프록시가 생활권을 과대 덮을 수 있어 공원별 기여면적 상한을 적용했습니다.",
            "기존 운영 iso_green_ratio와 Case는 변경하지 않습니다.",
        ]

        if school_id in MANUAL_GREEN_RATIO_BY_ID:
            display_ratio = MANUAL_GREEN_RATIO_BY_ID[school_id]
            basis = "manual_sealed_green_ratio"
            note_parts = ["봉인된 수동 검수 녹지비율을 표시값으로 유지합니다."]

        rows.append(
            {
                COL_SCHOOL_ID: school_id,
                COL_SCHOOL_NAME: school_name,
                "green_ratio_display_guardrail": round(float(display_ratio), 6) if pd.notna(display_ratio) else np.nan,
                "green_ratio_display_guardrail_basis": basis,
                "green_ratio_display_guardrail_note": " ".join(note_parts),
                "display_walk_zone_source": zone_source,
                "display_walk_area_m2": round(zone_area, 4),
                "display_uncapped_green_area_m2": round(uncapped_green_area, 4),
                "display_capped_green_area_m2": round(min(capped_green_area, zone_area), 4),
                "display_intersecting_park_count": int(intersecting_park_count),
                "display_capped_oversized_park_count": int(len(capped_park_names)),
                "display_capped_oversized_park_names": ", ".join(sorted(set(capped_park_names))),
                "operational_iso_green_ratio": old_iso,
                "operational_corrected_green_ratio": corrected,
                "display_delta_vs_operational_pp": round(float(display_ratio - operational), 6)
                if pd.notna(display_ratio) and pd.notna(operational)
                else np.nan,
            }
        )

    return pd.DataFrame(rows)


def write_report(result: pd.DataFrame) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    high = result[pd.to_numeric(result["green_ratio_display_guardrail"], errors="coerce").ge(80)]
    examples = result[result[COL_SCHOOL_NAME].isin(["인천백운초등학교", "인천함박초등학교"])].copy()
    top = result.sort_values("green_ratio_display_guardrail", ascending=False).head(15)

    def markdown_table(frame: pd.DataFrame) -> str:
        if frame.empty:
            return "_대상 없음_"
        cols = list(frame.columns)
        lines = [
            "| " + " | ".join(cols) + " |",
            "|" + "|".join(["---"] * len(cols)) + "|",
        ]
        for record in frame.to_dict("records"):
            lines.append("| " + " | ".join(str(record.get(col, "")) for col in cols) + " |")
        return "\n".join(lines)

    lines = [
        "# 녹지비율 표시값 보수 산정 검증",
        "",
        "- 원본 `iso_green_ratio`, `corrected_green_ratio`, `case_type`은 변경하지 않는다.",
        "- 앱 표시용 `display_green_ratio`에만 Valhalla/아파트 보정 도보권과 대형 공원 프록시 상한을 적용한다.",
        f"- 공원별 기여면적 상한: {int(PARK_INTERSECTION_CAP_M2):,}㎡",
        f"- 표시 녹지비율 80% 이상: {len(high)}개교",
        "",
        "## 백운초·함박초 확인",
        "",
        markdown_table(
            examples[
                [
                    COL_SCHOOL_ID,
                    COL_SCHOOL_NAME,
                    "green_ratio_display_guardrail",
                    "operational_corrected_green_ratio",
                    "display_walk_area_m2",
                    "display_uncapped_green_area_m2",
                    "display_capped_green_area_m2",
                    "display_capped_oversized_park_names",
                ]
            ]
        ),
        "",
        "## 표시 녹지비율 상위 15개교",
        "",
        markdown_table(
            top[
                [
                    COL_SCHOOL_ID,
                    COL_SCHOOL_NAME,
                    "green_ratio_display_guardrail",
                    "display_walk_area_m2",
                    "display_capped_green_area_m2",
                    "display_capped_oversized_park_count",
                    "display_capped_oversized_park_names",
                ]
            ]
        ),
    ]
    (REPORTS / "green_ratio_display_guardrail_20260506.md").write_text(
        "\n".join(lines),
        encoding="utf-8",
    )


def main() -> None:
    result = calc_guardrail_rows()
    out_path = DATA / "school_green_ratio_display_guardrail_20260506.csv"
    result.to_csv(out_path, index=False, encoding="utf-8-sig")
    write_report(result)
    print(
        json.dumps(
            {
                "output": str(out_path),
                "n": int(len(result)),
                "display_ge_80": int(pd.to_numeric(result["green_ratio_display_guardrail"], errors="coerce").ge(80).sum()),
                "baegun": result.loc[result[COL_SCHOOL_NAME].eq("인천백운초등학교"), "green_ratio_display_guardrail"].tolist(),
                "hambak": result.loc[result[COL_SCHOOL_NAME].eq("인천함박초등학교"), "green_ratio_display_guardrail"].tolist(),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
