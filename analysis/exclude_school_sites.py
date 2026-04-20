"""
후보지 학교부지 배제 스크립트
기본 입출력: data_processed/candidate_grid_final.geojson
로그:        data_processed/school_exclusion_log.csv

단독 실행 또는 build_mixed_demand_model.py Step I에서 임포트해 호출됨.
"""

from __future__ import annotations

import json
import re
import sys
import warnings
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import osmnx as ox
import pandas as pd
from scipy.spatial import KDTree
from shapely.geometry import Point

warnings.filterwarnings("ignore")

BASE = Path(__file__).resolve().parents[1]
CFG_PATH = BASE / "analysis/school_exclusion_config.json"
DEFAULT_INPUT = BASE / "data_processed/candidate_grid_final.geojson"
DEFAULT_OUTPUT = BASE / "data_processed/candidate_grid_final.geojson"
LOG_PATH = BASE / "data_processed/school_exclusion_log.csv"
OSM_CACHE = BASE / "data_processed/osm_school_polygons_incheon.geojson"
PROJ = "EPSG:5179"
SEARCH_POLY_M = 200
SEARCH_POINT_M = 150


def _load_config() -> dict[str, Any]:
    with open(CFG_PATH, encoding="utf-8") as f:
        return json.load(f)


def _normalize_name(name: str) -> str:
    name = re.sub(r"\s+", "", str(name))
    name = re.sub(r"[\(（][^)）]*[\)）]", "", name)
    return name.strip()


def _is_large_university(name: str, large_list: list[str]) -> bool:
    norm = _normalize_name(name)
    return any(
        _normalize_name(c) in norm or norm in _normalize_name(c)
        for c in large_list
    )


def _load_school_data() -> gpd.GeoDataFrame:
    cfg = _load_config()

    kem = pd.read_csv(
        BASE / "data_raw/전국초중등학교위치표준데이터.csv",
        encoding="cp949",
        usecols=["학교명", "학교급구분", "운영상태", "소재지도로명주소", "위도", "경도"],
    )
    kem = kem[kem["운영상태"] == "운영"].copy()
    kem_inc = kem[kem["소재지도로명주소"].str.startswith("인천", na=False)].copy()
    kem_inc = kem_inc.rename(columns={"학교급구분": "inst_type", "학교명": "inst_name"})
    kem_inc["address"] = kem_inc["소재지도로명주소"]

    uni = pd.read_excel(BASE / "data_raw/교육부_대학교 주소기반 좌표정보_20251126.xlsx")
    uni_inc = uni[
        (uni["지역"] == "인천") & (uni["학교상태"].isin(["기존", "신설"]))
    ].copy()
    uni_inc = uni_inc.rename(columns={"학제": "inst_type", "학교명": "inst_name"})
    uni_inc["address"] = uni_inc["도로명 주소"]

    all_df = pd.concat(
        [
            kem_inc[["inst_name", "inst_type", "address", "위도", "경도"]],
            uni_inc[["inst_name", "inst_type", "address", "위도", "경도"]],
        ],
        ignore_index=True,
    ).dropna(subset=["위도", "경도"])

    all_df["lat"] = all_df["위도"].astype(float)
    all_df["lon"] = all_df["경도"].astype(float)

    gdf = gpd.GeoDataFrame(
        all_df,
        geometry=gpd.points_from_xy(all_df["lon"], all_df["lat"]),
        crs="EPSG:4326",
    )
    print(f"  초중등(인천): {len(kem_inc)}개 / 대학(인천): {len(uni_inc)}개 → 통합: {len(gdf)}개")
    return gdf


def _load_osm_polygons() -> gpd.GeoDataFrame:
    if OSM_CACHE.exists():
        poly = gpd.read_file(OSM_CACHE)
        print(f"  OSM 캐시 로드: {len(poly)}개 폴리곤")
        return poly
    try:
        tags = {"amenity": ["school", "college", "university"]}
        raw = ox.features_from_place("인천광역시, 대한민국", tags=tags)
        poly = raw[raw.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
        poly = poly[["name", "amenity", "geometry"]].reset_index(drop=True)
        poly = poly[poly.geometry.notna()]
        poly.to_file(OSM_CACHE, driver="GeoJSON")
        print(f"  OSM 수집 완료: {len(poly)}개 폴리곤 (캐시 저장)")
        return poly
    except Exception as exc:
        print(f"  OSM 수집 실패 ({exc}) → 폴리곤 없이 진행")
        return gpd.GeoDataFrame(columns=["name", "amenity", "geometry"], crs="EPSG:4326")


def _match_polygons(
    schools_proj: gpd.GeoDataFrame,
    osm_proj: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    schools_proj = schools_proj.copy()
    schools_proj["geometry_polygon"] = None

    if len(osm_proj) == 0:
        print("  폴리곤 없음 → point fallback만 사용")
        return schools_proj

    joined = gpd.sjoin(schools_proj, osm_proj[["geometry"]], how="left", predicate="within")

    for i in schools_proj.index:
        rows = joined.loc[[i]] if i in joined.index else pd.DataFrame()
        if rows.empty:
            continue
        idx_right = rows["index_right"].dropna()
        if idx_right.empty:
            continue
        poly_geom = osm_proj.loc[int(idx_right.iloc[0]), "geometry"]
        schools_proj.at[i, "geometry_polygon"] = poly_geom

    n = schools_proj["geometry_polygon"].notna().sum()
    print(f"  폴리곤 매칭: {n}/{len(schools_proj)}개 기관에 폴리곤 연결")
    return schools_proj


def _judge_candidate(
    cand_pt: Point,
    poly_schools: gpd.GeoDataFrame,
    schools_proj: gpd.GeoDataFrame,
    tree: KDTree,
    cfg: dict[str, Any],
) -> tuple[bool, str | None, str | None, str | None, float | None, bool, str | None]:
    """
    Returns: (excluded, reason, inst_name, inst_type, dist_m, polygon_used, radius_rule)
    """
    large_list = cfg["large_university_names"]
    univ_types = set(cfg["university_inst_types"])
    school_radius = cfg["school_radius_m"]
    large_radius = cfg["large_university_radius_m"]
    poly_buf_cfg = cfg["polygon_buffer_m"]

    # A. 폴리곤 우선
    if len(poly_schools) > 0:
        nearby = list(poly_schools.sindex.query(
            cand_pt.buffer(SEARCH_POLY_M), predicate="intersects"
        ))
        for pi in nearby:
            inst = poly_schools.iloc[pi]
            poly = inst["poly_geom"]
            buf_m = (
                poly_buf_cfg["초등학교"]
                if inst["inst_type"] in ("초등학교", "중학교", "고등학교")
                else poly_buf_cfg["university"]
            )
            poly_buf = poly.buffer(buf_m)
            if cand_pt.within(poly) or cand_pt.intersects(poly):
                return (True, "inside_polygon", inst["inst_name"], inst["inst_type"], 0.0, True, None)
            if cand_pt.within(poly_buf) or cand_pt.intersects(poly_buf):
                dist = cand_pt.distance(poly.exterior)
                return (True, "inside_polygon_buffer", inst["inst_name"], inst["inst_type"], dist, True, None)

    # B. Point fallback
    cx, cy = cand_pt.x, cand_pt.y
    nearby_idxs = tree.query_ball_point([cx, cy], r=SEARCH_POINT_M)
    for pi in nearby_idxs:
        inst = schools_proj.iloc[pi]
        itype = inst["inst_type"]
        iname = inst["inst_name"]
        if itype in ("초등학교", "중학교", "고등학교"):
            threshold = school_radius.get(itype, 50)
            rule = f"{int(threshold)}m_school"
        elif itype in univ_types:
            if _is_large_university(iname, large_list):
                threshold = large_radius
                rule = f"{int(threshold)}m_large_university"
            else:
                threshold = school_radius["대학교_default"]
                rule = f"{int(threshold)}m_university"
        else:
            continue
        dist = cand_pt.distance(inst.geometry)
        if dist <= threshold:
            return (True, "within_point_radius", iname, itype, round(dist, 1), False, rule)

    return (False, None, None, None, None, False, None)


def apply_school_exclusion(
    input_path: Path | str | None = None,
    output_path: Path | str | None = None,
    verbose: bool = True,
) -> gpd.GeoDataFrame:
    """
    후보지 GeoJSON에서 학교·대학 부지와 겹치는 후보지를 배제하고 저장.

    Args:
        input_path: 입력 GeoJSON 경로 (기본값: candidate_grid_final.geojson)
        output_path: 출력 GeoJSON 경로 (기본값: 입력과 동일)
        verbose: 상세 로그 출력 여부

    Returns:
        배제 완료된 GeoDataFrame
    """
    in_path = Path(input_path) if input_path else DEFAULT_INPUT
    out_path = Path(output_path) if output_path else (in_path if not input_path else Path(output_path or in_path))

    def log(msg: str) -> None:
        if verbose:
            print(msg)

    cfg = _load_config()

    log("\n[Step I] 학교부지 배제 시작")
    log("  학교 데이터 로드...")
    schools_gdf = _load_school_data()

    log("  OSM 폴리곤 로드...")
    osm_poly = _load_osm_polygons()

    log("  투영좌표 변환 및 폴리곤 매칭...")
    schools_proj = schools_gdf.to_crs(PROJ)
    osm_proj = osm_poly.to_crs(PROJ) if len(osm_poly) > 0 else osm_poly
    schools_proj = _match_polygons(schools_proj, osm_proj)

    # polygon GeoDataFrame 분리
    poly_schools = schools_proj[schools_proj["geometry_polygon"].notna()].copy()
    poly_schools["poly_geom"] = poly_schools["geometry_polygon"]
    poly_schools = poly_schools.set_geometry("poly_geom")
    poly_schools.crs = PROJ

    # KDTree (point fallback)
    coords = np.array([(g.x, g.y) for g in schools_proj.geometry])
    tree = KDTree(coords)

    log(f"  후보지 로드: {in_path.name}")
    grid = gpd.read_file(in_path)
    n_before = len(grid)
    log(f"  후보지 수: {n_before}개")

    grid_proj = grid.to_crs(PROJ)

    log("  배제 판정 실행...")
    log_rows: list[dict] = []
    excluded_flags: list[bool] = []

    for _, cand in grid_proj.iterrows():
        cx, cy = cand.geometry.centroid.x, cand.geometry.centroid.y
        cand_pt = Point(cx, cy)

        excl, reason, iname, itype, dist, poly_used, rule = _judge_candidate(
            cand_pt, poly_schools, schools_proj, tree, cfg
        )
        excluded_flags.append(excl)
        log_rows.append({
            "candidate_id": cand["grid_id"],
            "excluded_by_school": excl,
            "exclude_reason": reason,
            "matched_inst_name": iname,
            "matched_inst_type": itype,
            "matched_distance_m": round(dist, 1) if dist is not None else None,
            "polygon_used": poly_used,
            "radius_rule_applied": rule,
        })

    grid["excluded_by_school"] = excluded_flags
    n_excl = sum(excluded_flags)

    log(f"\n  배제: {n_excl}개 / 전체 {n_before}개 → 잔여 {n_before - n_excl}개")

    # 로그 저장
    log_df = pd.DataFrame(log_rows)
    log_df.to_csv(LOG_PATH, index=False, encoding="utf-8-sig")
    log(f"  로그: {LOG_PATH.name}")

    # 배제된 후보지 제거 후 저장
    grid_clean = grid[~grid["excluded_by_school"]].drop(columns=["excluded_by_school"]).copy()
    grid_clean.to_file(out_path, driver="GeoJSON")
    log(f"  저장: {out_path.name} ({len(grid_clean)}개)")

    if verbose and n_excl > 0:
        excl_df = log_df[log_df["excluded_by_school"]]
        log(f"\n  사유별: {dict(excl_df['exclude_reason'].value_counts())}")
        log(f"  기관유형별: {dict(excl_df['matched_inst_type'].value_counts())}")

    log("[Step I] 완료\n")
    return grid_clean


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    import argparse

    parser = argparse.ArgumentParser(description="후보지 학교부지 배제")
    parser.add_argument("--input", default=None, help="입력 GeoJSON 경로")
    parser.add_argument("--output", default=None, help="출력 GeoJSON 경로")
    args = parser.parse_args()

    apply_school_exclusion(
        input_path=args.input,
        output_path=args.output,
        verbose=True,
    )
