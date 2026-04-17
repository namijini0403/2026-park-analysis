from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data_processed"
OUTPUT = ROOT / "output"

SCHOOL_PRIORITY_PATH = DATA / "school_priority.csv"
SCHOOL_NEAREST_PATH = DATA / "school_nearest_park.csv"
PARKS_PATH = DATA / "parks.csv"
ISOCHRONE_PATH = DATA / "school_isochrone_500m.geojson"
SEALED_PATH = OUTPUT / "sealed_nearest_park_dist.json"

SNAPSHOT_PRIORITY_BEFORE = DATA / "school_priority_20260411_before_case_system.csv"
SNAPSHOT_NEAREST_BEFORE = DATA / "school_nearest_park_20260411_before_case_system.csv"
SNAPSHOT_PRIORITY_AFTER = DATA / "school_priority_case_system_20260411.csv"
SNAPSHOT_NEAREST_AFTER = DATA / "school_nearest_park_case_system_20260411.csv"

SEPARATE_GU = {"강화군", "옹진군"}
PUBLIC_PARK_EXCEPTIONS = {"가경공원", "수차공원"}

MANUAL_OVERRIDES = {
    "갑룡초등학교": {"park": "갑룡공원", "dist": 285.0},
    "인천가현초등학교": {"park": "수차공원", "dist": 240.0},
    "인천구산초등학교": {"park": "부개공원", "dist": 105.0},
    "인천송명초등학교": {"park": "마음공원", "dist": 95.0},
    "인천영종초등학교": {"park": "영종하늘체육공원", "dist": 235.0},
    "인천미송초등학교": {"park": "송도랜드마크시티9호근린공원", "dist": 489.0},
    "인천첨단초등학교": {"park": "어울림공원", "dist": 100.0},
    "인천아라초등학교": {"park": "아라노을공원", "dist": 166.0},
    "인천해든초등학교": {"park": "해든공원", "dist": 175.0},
    "인천원당초등학교": {"park": "원당공원", "dist": 320.0},
    "인천하늘초등학교": {"park": "박석공원", "dist": 124.0},
    "인천한별초등학교": {"park": "웃목어린이공원", "dist": 213.0},
    "인천계산초등학교": {"park": "고향골어린이공원", "dist": 444.0},
    "상인천초등학교": {"park": "소공원", "dist": 473.0},
    "인천장도초등학교": {"park": "동녘어린이공원", "dist": 298.0},
    "인천부평동초등학교": {"park": "꿈나무어린이공원", "dist": 409.0},
    "인천부곡초등학교": {"park": "마장공원", "dist": 420.0},
    "인천석천초등학교": {"park": "하늘공원", "dist": 180.0},
    "인천영종초등학교금산분교장": {"park": "없음(산)", "dist": np.nan},
    # 실측값 봉인: 계단 사용 373m / 계단 회피 613m → 공식값은 계단 사용 기준
    "인천연수초등학교": {"park": "두리공원", "dist": 373.0},
}


def ensure_snapshots() -> None:
    if not SNAPSHOT_PRIORITY_BEFORE.exists():
        SNAPSHOT_PRIORITY_BEFORE.write_bytes(SCHOOL_PRIORITY_PATH.read_bytes())
    if not SNAPSHOT_NEAREST_BEFORE.exists():
        SNAPSHOT_NEAREST_BEFORE.write_bytes(SCHOOL_NEAREST_PATH.read_bytes())


def build_park_gdf(df: pd.DataFrame) -> gpd.GeoDataFrame:
    gdf = gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df["경도"], df["위도"]),
        crs="EPSG:4326",
    )
    return gdf


def summarize_points_within(
    points: gpd.GeoDataFrame,
    polygons: gpd.GeoDataFrame,
    count_col: str,
    sum_col: str | None = None,
    use_area_buffer: bool = False,
) -> pd.DataFrame:
    """등시선 polygon 내 공원/놀이터 포인트 집계.

    use_area_buffer=True 이면 공원면적 기반 원형 버퍼를 적용한 뒤 intersects로 판정.
    대형 공원(수변공원·근린공원)의 centroid가 등시선 경계 밖에 있어도
    공원 실제 면적이 걸치면 카운트되도록 한다.
    """
    CRS_METRIC = "EPSG:5179"
    pts = points.copy()
    poly = polygons.copy()
    if use_area_buffer and "공원면적" in pts.columns:
        # buffer 는 미터 단위 CRS에서 수행
        pts_m = pts.to_crs(CRS_METRIC)
        poly_m = poly.to_crs(CRS_METRIC)
        radius = np.sqrt(pts_m["공원면적"].fillna(0) / np.pi).clip(lower=10)
        pts_m = pts_m.copy()
        pts_m["geometry"] = pts_m.geometry.buffer(radius)
        pts = pts_m
        poly = poly_m
        predicate = "intersects"
    else:
        predicate = "within"

    joined = gpd.sjoin(
        pts,
        poly[["학교ID", "geometry"]],
        predicate=predicate,
        how="left",
    )
    joined = joined[joined["학교ID"].notna()].copy()
    if joined.empty:
        result = polygons[["학교ID"]].copy()
        result[count_col] = 0
        if sum_col is not None:
            result[sum_col] = 0.0
        return result

    agg = joined.groupby("학교ID").size().rename(count_col).reset_index()
    if sum_col is not None:
        area = joined.groupby("학교ID")["공원면적"].sum().rename(sum_col).reset_index()
        agg = agg.merge(area, on="학교ID", how="left")
    result = polygons[["학교ID"]].merge(agg, on="학교ID", how="left")
    result[count_col] = result[count_col].fillna(0).astype(int)
    if sum_col is not None:
        result[sum_col] = result[sum_col].fillna(0.0)
    return result


def summarize_equivalent_circle_area_within(
    points: gpd.GeoDataFrame,
    polygons_ll: gpd.GeoDataFrame,
    school_id_col: str,
    area_col: str,
    sum_col: str,
) -> pd.DataFrame:
    """등시선과 공원 원형 버퍼의 교차 면적 합산.

    공원 centroid 기준 원형 버퍼를 먼저 생성한 뒤 intersects로 후보를 필터링하여
    centroid 가 등시선 경계 밖에 있는 대형 공원도 교차 면적을 반영한다.
    """
    CRS_METRIC = "EPSG:5179"
    pts_m = points.to_crs(CRS_METRIC).copy()
    poly_m = polygons_ll[[school_id_col, "geometry"]].to_crs(CRS_METRIC)

    pts_m[area_col] = pd.to_numeric(pts_m[area_col], errors="coerce").fillna(0.0)
    radius = np.sqrt(pts_m[area_col] / np.pi).clip(lower=10)
    pts_m["_circle"] = pts_m.geometry.buffer(radius)

    # 원형 버퍼 기준 intersects 로 후보 추출
    pts_circles = pts_m.set_geometry("_circle")
    joined = gpd.sjoin(
        pts_circles[[area_col, "_circle"]],
        poly_m[[school_id_col, "geometry"]],
        predicate="intersects",
        how="left",
    )
    joined = joined[joined[school_id_col].notna()].copy()
    if joined.empty:
        result = polygons_ll[[school_id_col]].copy()
        result[sum_col] = 0.0
        return result

    polygon_map = dict(zip(poly_m[school_id_col], poly_m.geometry))
    joined[sum_col] = 0.0
    for idx, row in joined.iterrows():
        area = float(row[area_col])
        if area <= 0:
            continue
        circle = row["_circle"]
        iso_poly = polygon_map.get(row[school_id_col])
        if iso_poly is not None:
            joined.at[idx, sum_col] = circle.intersection(iso_poly).area

    agg = joined.groupby(school_id_col)[sum_col].sum().reset_index()
    result = polygons_ll[[school_id_col]].merge(agg, on=school_id_col, how="left")
    result[sum_col] = result[sum_col].fillna(0.0)
    return result


def quartile_score(value: str) -> int:
    mapping = {"Q4": 4, "Q3": 3, "Q2": 2, "Q1": 1}
    return mapping.get(value, 0)


def main() -> None:
    ensure_snapshots()

    school_priority = pd.read_csv(SCHOOL_PRIORITY_PATH)
    school_nearest = pd.read_csv(SCHOOL_NEAREST_PATH)
    parks = pd.read_csv(PARKS_PATH)
    isochrone = gpd.read_file(ISOCHRONE_PATH)

    with open(SEALED_PATH, "r", encoding="utf-8") as f:
        sealed = json.load(f)

    # Make the script idempotent when rerunning on an already-classified CSV.
    derived_cols = [
        "iso_green_ratio",
        "iso_green_ratio_raw",
        "iso_playground_count",
        "is_separate_bundle_tag",
        "is_low_access_tag",
        "is_case_conflict_tag",
        "isochrone_area_m2",
        "iso_park_count_raw",
        "iso_park_area_raw",
        "green_bucket",
    ]
    school_priority = school_priority.drop(columns=[c for c in derived_cols if c in school_priority.columns], errors="ignore")

    id_by_name = dict(zip(school_priority["학교명"], school_priority["학교ID"]))

    # Keep sealed distances authoritative and update explicit manual park names.
    for school_name, override in MANUAL_OVERRIDES.items():
        school_id = id_by_name.get(school_name)
        if school_id is None:
            continue
        sealed[str(school_id)] = None if pd.isna(override["dist"]) else float(override["dist"])

        school_priority.loc[school_priority["학교ID"] == school_id, "nearest_park_dist_m"] = override["dist"]
        mask_nearest = school_nearest["학교ID"] == school_id
        school_nearest.loc[mask_nearest, "nearest_park_name"] = override["park"]
        school_nearest.loc[mask_nearest, "nearest_park_dist_m"] = override["dist"]
        for col in ("nearest_park_lat", "nearest_park_lon"):
            if col in school_nearest.columns:
                school_nearest.loc[mask_nearest, col] = np.nan

    with open(SEALED_PATH, "w", encoding="utf-8") as f:
        json.dump(sealed, f, ensure_ascii=False, indent=2, sort_keys=True)

    public_parks = parks[(parks["시설유형"] != "놀이터") | (parks["공원명"].isin(PUBLIC_PARK_EXCEPTIONS))].copy()
    public_parks = public_parks.drop_duplicates(subset=["관리번호", "공원명", "위도", "경도", "공원면적"])
    playgrounds = parks[parks["시설유형"] == "놀이터"].copy()

    public_gdf = build_park_gdf(public_parks)
    playground_gdf = build_park_gdf(playgrounds)
    isochrone = isochrone.to_crs("EPSG:4326")

    iso_public = summarize_points_within(public_gdf, isochrone, "iso_park_count_raw", use_area_buffer=True)
    iso_public_area = summarize_equivalent_circle_area_within(
        public_gdf,
        isochrone,
        "학교ID",
        "공원면적",
        "iso_park_area_raw",
    )
    iso_play = summarize_points_within(playground_gdf, isochrone, "iso_playground_count")

    isochrone_area = isochrone.to_crs("EPSG:5179")
    area_df = pd.DataFrame(
        {
            "학교ID": isochrone_area["학교ID"],
            "isochrone_area_m2": isochrone_area.geometry.area,
        }
    )

    school_priority = school_priority.merge(iso_public, on="학교ID", how="left")
    school_priority = school_priority.merge(iso_public_area, on="학교ID", how="left")
    school_priority = school_priority.merge(iso_play, on="학교ID", how="left")
    school_priority = school_priority.merge(area_df, on="학교ID", how="left")

    school_priority["iso_park_count_raw"] = school_priority["iso_park_count_raw"].fillna(0).astype(int)
    school_priority["iso_park_area_raw"] = school_priority["iso_park_area_raw"].fillna(0.0)
    school_priority["iso_playground_count"] = school_priority["iso_playground_count"].fillna(0).astype(int)
    school_priority["isochrone_area_m2"] = school_priority["isochrone_area_m2"].fillna(0.0)

    school_priority["is_separate_bundle_tag"] = (
        school_priority["gu"].isin(SEPARATE_GU)
        | school_priority["학교명"].str.contains("분교", na=False)
        | school_priority["학교명"].str.contains("분교장", na=False)
    ).astype(int)

    school_priority["iso_park_count"] = school_priority["iso_park_count_raw"]
    school_priority["iso_park_area"] = school_priority["iso_park_area_raw"]

    # Manual nearest values under 500m confirm at least one accessible park.
    manual_series = school_priority["학교ID"].map(sealed)
    sealed_under_500 = manual_series.notna() & (pd.to_numeric(manual_series, errors="coerce") < 500)
    school_priority.loc[sealed_under_500 & (school_priority["iso_park_count"] < 1), "iso_park_count"] = 1

    # Goldsan branch is a permanent no-park exception.
    branch_mask = school_priority["학교명"] == "인천영종초등학교금산분교장"
    school_priority.loc[branch_mask, ["nearest_park_dist_m", "iso_park_count", "buf_park_count"]] = [np.nan, 0, 0]
    school_priority.loc[branch_mask, "access_ratio"] = 0.0
    school_priority.loc[branch_mask, "iso_park_area"] = 0.0

    school_priority["buf_park_count"] = school_priority["buf_park_count"].fillna(0)
    school_priority["access_ratio"] = np.where(
        school_priority["buf_park_count"] > 0,
        school_priority["iso_park_count"] / school_priority["buf_park_count"],
        0.0,
    )
    school_priority["is_low_access_tag"] = (
        (school_priority["iso_park_count"] >= 1) & (school_priority["access_ratio"] <= 0.5)
    ).astype(int)

    school_priority["iso_green_ratio_raw"] = np.where(
        school_priority["isochrone_area_m2"] > 0,
        (school_priority["iso_park_area"] / school_priority["isochrone_area_m2"]) * 100.0,
        0.0,
    )
    school_priority["iso_green_ratio"] = school_priority["iso_green_ratio_raw"].clip(lower=0.0, upper=100.0)

    active_mask = school_priority["is_separate_bundle_tag"] == 0
    candidate_mask = active_mask & school_priority["nearest_park_dist_m"].lt(500) & school_priority["iso_park_count"].ge(1)

    candidate = school_priority.loc[candidate_mask, ["학교ID", "iso_green_ratio"]].copy()
    if not candidate.empty:
        candidate["green_bucket"] = pd.qcut(
            candidate["iso_green_ratio"].rank(method="first"),
            3,
            labels=["low", "middle", "high"],
        )
        school_priority = school_priority.merge(candidate[["학교ID", "green_bucket"]], on="학교ID", how="left")
    else:
        school_priority["green_bucket"] = pd.NA

    school_priority["is_case_conflict_tag"] = (
        active_mask
        & (
            (school_priority["nearest_park_dist_m"].lt(500) & school_priority["iso_park_count"].eq(0))
            | (school_priority["nearest_park_dist_m"].ge(500) & school_priority["iso_park_count"].ge(1))
        )
    ).astype(int)

    school_priority["case_type"] = pd.NA
    school_priority.loc[active_mask & school_priority["nearest_park_dist_m"].ge(500) & school_priority["iso_park_count"].eq(0), "case_type"] = "1"
    school_priority.loc[candidate_mask & school_priority["green_bucket"].eq("low"), "case_type"] = "2"
    school_priority.loc[candidate_mask & school_priority["green_bucket"].eq("middle"), "case_type"] = "3"
    school_priority.loc[candidate_mask & school_priority["green_bucket"].eq("high"), "case_type"] = "4"
    school_priority.loc[school_priority["is_case_conflict_tag"] == 1, "case_type"] = "2"

    label_map = {
        "1": "공원 접근 불가",
        "2": "접근 가능하나 녹지 부족",
        "3": "접근 가능, 중간 수준",
        "4": "접근 양호",
    }
    score_map = {"1": 4, "2": 3, "3": 2, "4": 1}

    school_priority["case_label"] = school_priority["case_type"].map(label_map)
    school_priority["priority_score"] = school_priority["case_type"].map(score_map)
    school_priority.loc[school_priority["is_separate_bundle_tag"] == 1, "case_label"] = "별도 묶음"
    school_priority.loc[school_priority["is_separate_bundle_tag"] == 1, "priority_score"] = pd.NA

    school_priority["priority_rank"] = pd.NA
    case1 = school_priority.loc[school_priority["case_type"] == "1"].copy()
    if not case1.empty:
        case1["quartile_score"] = case1["child_pop_quartile"].map(quartile_score)
        sort_by = ["quartile_score", "iso_green_ratio", "iso_playground_count", "nearest_park_dist_m"]
        sort_asc = [False, True, True, False]
        # student_slope 는 이후 단계에서 추가되므로 존재할 때만 사용
        if "student_slope" in case1.columns:
            case1["student_slope_sort"] = case1["student_slope"].fillna(-10**9)
            sort_by.append("student_slope_sort")
            sort_asc.append(False)
        case1 = case1.sort_values(by=sort_by, ascending=sort_asc)
        case1["priority_rank"] = range(1, len(case1) + 1)
        school_priority.loc[case1.index, "priority_rank"] = case1["priority_rank"]

    school_priority["is_island_tag"] = school_priority["gu"].eq("옹진군").astype(int)

    ordered_cols = list(pd.read_csv(SCHOOL_PRIORITY_PATH, nrows=0).columns)
    for extra_col in [
        "iso_green_ratio",
        "iso_green_ratio_raw",
        "iso_playground_count",
        "is_separate_bundle_tag",
        "is_low_access_tag",
        "is_case_conflict_tag",
        "isochrone_area_m2",
        "iso_park_count_raw",
        "iso_park_area_raw",
        "green_bucket",
        "case_label",
        "priority_rank",
        "is_island_tag",
    ]:
        if extra_col not in ordered_cols:
            ordered_cols.append(extra_col)
    school_priority = school_priority[ordered_cols]

    school_priority.to_csv(SCHOOL_PRIORITY_PATH, index=False, encoding="utf-8-sig")
    school_nearest.to_csv(SCHOOL_NEAREST_PATH, index=False, encoding="utf-8-sig")
    school_priority.to_csv(SNAPSHOT_PRIORITY_AFTER, index=False, encoding="utf-8-sig")
    school_nearest.to_csv(SNAPSHOT_NEAREST_AFTER, index=False, encoding="utf-8-sig")

    counts = school_priority.loc[school_priority["is_separate_bundle_tag"] == 0, "case_type"].value_counts(dropna=False).to_dict()
    print("ACTIVE_CASE_COUNTS", counts)
    print("SEPARATE_BUNDLE", int(school_priority["is_separate_bundle_tag"].sum()))
    print("LOW_ACCESS", int(school_priority["is_low_access_tag"].sum()))
    print("CASE_CONFLICT", int(school_priority["is_case_conflict_tag"].sum()))


if __name__ == "__main__":
    main()
