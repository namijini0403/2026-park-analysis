from __future__ import annotations

import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_processed"
REPORTS = ROOT / "outputs" / "reports"

PRIORITY_PATH = DATA / "school_priority.csv"
GU_SUMMARY_PATH = DATA / "gu_summary.csv"
PARKS_PATH = DATA / "parks.csv"
ISO_PATH = DATA / "school_isochrone_500m.geojson"
BUFFER_PATH = DATA / "school_buffer_500m.geojson"

CRS_METRIC = "EPSG:5179"
PLAYGROUND = "놀이터"
PUBLIC_PARK_EXCEPTIONS = {"가경공원", "수차공원"}
SEPARATE_GU = {"강화군", "옹진군"}

COL_SCHOOL_ID = "학교ID"
COL_SCHOOL_NAME = "학교명"

CASE_LABELS = {
    "1": "공원 접근 불가",
    "2": "접근 가능하나 녹지 부족",
    "3": "접근 가능, 중간 수준",
    "4": "접근 양호",
}
CASE_SCORES = {"1": 4, "2": 3, "3": 2, "4": 1}
QUARTILE_SCORES = {"Q4": 4, "Q3": 3, "Q2": 2, "Q1": 1}

# Explicit measured/manual green values: keep these fixed.
MANUAL_GREEN_RATIO_BY_ID = {
    "B000003143": 7.3447,  # 신석초, sealed in CONTEXT.md
    "B000003144": 0.4263408185968763,  # 석남초
    "B000003145": 0.4263408185968763,  # 천마초
    "B000026504": 20.733643281479043,  # 송담초
    "B000003048": 20.733643281479043,  # 명선초
    "B000002990": 0.8526816371937526,  # 학익초
}

# Schools with field-checked nearest park/path values. Their walking green
# values are not automatically downgraded just because the current parks.csv
# is missing or under-shapes the checked park.
FIELD_REVIEW_PROTECTED_IDS = {
    "B000003143",  # 신석초
    "B000003144",  # 석남초
    "B000025206",  # 새봄초
    "B000002963",  # 만석초
    "B000002981",  # 경원초
    "B000025246",  # 미송초
    "B000002959",  # 영종초
    "B000025189",  # 송명초
    "B000025236",  # 첨단초
    "B000003158",  # 원당초
    "B000026504",  # 송담초
    "B000003048",  # 명선초
    "B000003123",  # 계산초
    "B000003077",  # 상인천초
    "B000002990",  # 학익초
    "B000003145",  # 천마초
    "B000003029",  # 부평동초
    "B000003102",  # 장수초
    "B000003132",  # 상야분교장
}

CITY_BRANCH_CASE_OVERRIDES = {
    "B000002962": {
        "case_type": "1",
        "case_label": CASE_LABELS["1"],
        "priority_score": 4,
        "nearest_park_dist_m": 1587.3,
        "iso_park_count": 0,
        "iso_park_area": 0.0,
        "iso_green_ratio": 0.0,
        "iso_green_ratio_raw": 0.0,
        "green_bucket": "",
        "is_separate_bundle_tag": 0,
        "is_low_access_tag": 0,
        "is_case_conflict_tag": 0,
    },
    "B000003132": {
        "case_type": "3",
        "case_label": CASE_LABELS["3"],
        "priority_score": 2,
        "nearest_park_dist_m": 342.8,
        "green_bucket": "middle",
        "is_separate_bundle_tag": 0,
        "is_low_access_tag": 1,
        "is_case_conflict_tag": 0,
    },
}


def metric_summary(series: pd.Series) -> dict[str, float | int]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    return {
        "n": int(len(clean)),
        "mean": round(float(clean.mean()), 4),
        "median": round(float(clean.median()), 4),
        "sd": round(float(clean.std(ddof=1)), 4),
        "min": round(float(clean.min()), 4),
        "max": round(float(clean.max()), 4),
    }


def value_counts_dict(series: pd.Series) -> dict[str, int]:
    counts = series.value_counts(dropna=False).sort_index()
    result: dict[str, int] = {}
    for key, value in counts.items():
        label = "NA" if pd.isna(key) else str(key)
        result[label] = int(value)
    return result


def load_public_park_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    public = parks[
        parks["시설유형"].ne(PLAYGROUND) | parks["공원명"].isin(PUBLIC_PARK_EXCEPTIONS)
    ].copy()
    public["공원면적"] = pd.to_numeric(public["공원면적"], errors="coerce").fillna(0.0)
    gdf = gpd.GeoDataFrame(
        public,
        geometry=gpd.points_from_xy(public["경도"], public["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    radius = np.sqrt(gdf["공원면적"] / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def zone_stats(zone_gdf: gpd.GeoDataFrame, park_gdf: gpd.GeoDataFrame, prefix: str) -> pd.DataFrame:
    park_union = unary_union(park_gdf.geometry)
    rows: list[dict[str, object]] = []
    for row in zone_gdf[[COL_SCHOOL_ID, COL_SCHOOL_NAME, "gu", "geometry"]].itertuples(index=False):
        zone_area = float(row.geometry.area) if row.geometry is not None else 0.0
        green_area = 0.0
        if zone_area > 0:
            intersection = row.geometry.intersection(park_union)
            if not intersection.is_empty:
                green_area = float(intersection.area)
        count = int(park_gdf.intersects(row.geometry).sum()) if zone_area > 0 else 0
        rows.append(
            {
                COL_SCHOOL_ID: row.학교ID,
                f"{prefix}_park_count_intersection": count,
                f"{prefix}_park_area_intersection": green_area,
                f"{prefix}_zone_area_m2": zone_area,
                f"{prefix}_green_ratio_intersection": green_area / zone_area * 100
                if zone_area > 0
                else 0.0,
            }
        )
    return pd.DataFrame(rows)


def recalc_case_fields(priority: pd.DataFrame) -> pd.DataFrame:
    nearest_dist = pd.to_numeric(priority["nearest_park_dist_m"], errors="coerce")
    active = priority["is_separate_bundle_tag"].eq(0)
    hard_case1 = (
        active
        & nearest_dist.ge(500)
        & priority["iso_park_count"].eq(0)
        & priority["iso_green_ratio"].eq(0)
    )
    candidate = active & ~hard_case1 & (
        priority["iso_park_count"].ge(1) | nearest_dist.lt(500)
    )

    priority["green_bucket"] = pd.NA
    priority.loc[candidate & priority["iso_green_ratio"].lt(1), "green_bucket"] = "low"
    priority.loc[
        candidate & priority["iso_green_ratio"].ge(1) & priority["iso_green_ratio"].lt(5),
        "green_bucket",
    ] = "middle"
    priority.loc[candidate & priority["iso_green_ratio"].ge(5), "green_bucket"] = "high"

    priority["case_type"] = pd.NA
    priority.loc[hard_case1, "case_type"] = "1"
    priority.loc[candidate & priority["green_bucket"].eq("low"), "case_type"] = "2"
    priority.loc[candidate & priority["green_bucket"].eq("middle"), "case_type"] = "3"
    priority.loc[candidate & priority["green_bucket"].eq("high"), "case_type"] = "4"
    priority["case_label"] = priority["case_type"].map(CASE_LABELS)
    priority["priority_score"] = priority["case_type"].map(CASE_SCORES)
    priority.loc[priority["is_separate_bundle_tag"].eq(1), "case_label"] = "별도 묶음"
    priority.loc[priority["is_separate_bundle_tag"].eq(1), "priority_score"] = pd.NA

    priority["is_case_conflict_tag"] = (
        active
        & (
            (nearest_dist.lt(500) & priority["iso_park_count"].eq(0))
            | (nearest_dist.ge(500) & priority["iso_park_count"].ge(1))
        )
    ).astype(int)

    for school_id, overrides in CITY_BRANCH_CASE_OVERRIDES.items():
        mask = priority[COL_SCHOOL_ID].eq(school_id)
        for key, value in overrides.items():
            priority.loc[mask, key] = value

    priority["priority_rank"] = pd.NA
    for case_type in ["1", "2", "3", "4"]:
        mask = (
            priority["case_type"].astype(str).eq(case_type)
            & priority["is_separate_bundle_tag"].eq(0)
        )
        if not mask.any():
            continue
        subset = priority.loc[mask].copy()
        if "final_quartile" in subset.columns:
            subset["_quartile_score"] = subset["final_quartile"].map(QUARTILE_SCORES).fillna(0)
        else:
            subset["_quartile_score"] = 0
        subset["_green_sort"] = pd.to_numeric(subset["iso_green_ratio"], errors="coerce").fillna(0)
        subset["_play_sort"] = pd.to_numeric(subset.get("iso_playground_count", 0), errors="coerce").fillna(0)
        subset["_dist_sort"] = pd.to_numeric(subset["nearest_park_dist_m"], errors="coerce").fillna(0)
        subset["_slope_sort"] = pd.to_numeric(subset.get("student_slope", 0), errors="coerce").fillna(0)
        subset = subset.sort_values(
            ["_quartile_score", "_green_sort", "_play_sort", "_dist_sort", "_slope_sort", COL_SCHOOL_NAME],
            ascending=[False, True, True, False, False, True],
        )
        priority.loc[subset.index, "priority_rank"] = range(1, len(subset) + 1)

    return priority


def update_gu_summary(priority: pd.DataFrame) -> None:
    summary = (
        priority.groupby("gu", dropna=False)
        .agg(
            total_school_count=(COL_SCHOOL_ID, "count"),
            case_type_1_count=("case_type", lambda s: (pd.to_numeric(s, errors="coerce") == 1).sum()),
            case_type_2_count=("case_type", lambda s: (pd.to_numeric(s, errors="coerce") == 2).sum()),
            case_type_3_count=("case_type", lambda s: (pd.to_numeric(s, errors="coerce") == 3).sum()),
            case_type_4_count=("case_type", lambda s: (pd.to_numeric(s, errors="coerce") == 4).sum()),
            avg_iso_park_count=("iso_park_count", "mean"),
            avg_access_ratio=("access_ratio", "mean"),
            avg_gap_count=("gap_count", "mean"),
            priority_score_3plus_count=("priority_score", lambda s: (pd.to_numeric(s, errors="coerce") >= 3).sum()),
            iso_park_count_0_count=("iso_park_count", lambda s: (pd.to_numeric(s, errors="coerce") == 0).sum()),
        )
        .reset_index()
    )
    for col in ["avg_iso_park_count", "avg_access_ratio", "avg_gap_count"]:
        summary[col] = summary[col].round(3)
    summary.to_csv(GU_SUMMARY_PATH, index=False, encoding="utf-8-sig")


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    priority = pd.read_csv(PRIORITY_PATH, encoding="utf-8-sig")
    before = priority.copy()

    for col in [
        "iso_park_count",
        "iso_park_area",
        "buf_park_count",
        "buf_park_area",
        "isochrone_area_m2",
        "iso_green_ratio",
        "iso_green_ratio_raw",
        "nearest_park_dist_m",
        "is_separate_bundle_tag",
    ]:
        if col in priority.columns:
            priority[col] = pd.to_numeric(priority[col], errors="coerce")
    priority["is_separate_bundle_tag"] = priority["gu"].isin(SEPARATE_GU).astype(int)
    priority.loc[priority[COL_SCHOOL_ID].isin(CITY_BRANCH_CASE_OVERRIDES), "is_separate_bundle_tag"] = 0

    park_gdf = load_public_park_polygons()
    iso_gdf = gpd.read_file(ISO_PATH).to_crs(CRS_METRIC)
    buffer_gdf = gpd.read_file(BUFFER_PATH).to_crs(CRS_METRIC)
    iso_stats = zone_stats(iso_gdf, park_gdf, "walk_500m")
    buffer_stats = zone_stats(buffer_gdf, park_gdf, "radius_500m")

    priority = priority.merge(iso_stats, on=COL_SCHOOL_ID, how="left")
    priority = priority.merge(buffer_stats, on=COL_SCHOOL_ID, how="left")
    priority["green_fix_protected"] = priority[COL_SCHOOL_ID].isin(FIELD_REVIEW_PROTECTED_IDS)
    priority["green_fix_manual_ratio"] = priority[COL_SCHOOL_ID].isin(MANUAL_GREEN_RATIO_BY_ID)

    priority["old_iso_green_ratio"] = before["iso_green_ratio"]
    priority["old_iso_park_count"] = before["iso_park_count"]
    priority["old_iso_park_area"] = before["iso_park_area"]
    priority["old_case_type"] = before["case_type"]

    # Always fix straight-radius fields; they are comparison fields and do not
    # encode sealed field measurements.
    priority["buf_park_count"] = priority["radius_500m_park_count_intersection"].fillna(0).astype(int)
    priority["buf_park_area"] = priority["radius_500m_park_area_intersection"].fillna(0.0)

    auto_mask = ~priority["green_fix_protected"]
    priority.loc[auto_mask, "iso_park_count"] = (
        priority.loc[auto_mask, "walk_500m_park_count_intersection"].fillna(0).astype(int)
    )
    priority.loc[auto_mask, "iso_park_area"] = (
        priority.loc[auto_mask, "walk_500m_park_area_intersection"].fillna(0.0)
    )
    if "iso_park_count_raw" in priority.columns:
        priority.loc[auto_mask, "iso_park_count_raw"] = priority.loc[auto_mask, "iso_park_count"]
    if "iso_park_area_raw" in priority.columns:
        priority.loc[auto_mask, "iso_park_area_raw"] = priority.loc[auto_mask, "iso_park_area"]

    auto_ratio = np.where(
        priority["isochrone_area_m2"].fillna(0) > 0,
        priority["iso_park_area"].fillna(0) / priority["isochrone_area_m2"].fillna(0) * 100.0,
        0.0,
    )
    priority.loc[auto_mask, "iso_green_ratio_raw"] = auto_ratio[auto_mask]

    for school_id, ratio in MANUAL_GREEN_RATIO_BY_ID.items():
        mask = priority[COL_SCHOOL_ID].eq(school_id)
        priority.loc[mask, "iso_green_ratio_raw"] = ratio
        priority.loc[mask, "iso_park_count"] = np.maximum(
            pd.to_numeric(priority.loc[mask, "iso_park_count"], errors="coerce").fillna(0),
            1,
        )
        priority.loc[mask, "iso_park_area"] = (
            priority.loc[mask, "isochrone_area_m2"].fillna(0) * ratio / 100.0
        )
        if "iso_park_count_raw" in priority.columns:
            priority.loc[mask, "iso_park_count_raw"] = priority.loc[mask, "iso_park_count"]
        if "iso_park_area_raw" in priority.columns:
            priority.loc[mask, "iso_park_area_raw"] = priority.loc[mask, "iso_park_area"]

    priority["iso_green_ratio"] = pd.to_numeric(
        priority["iso_green_ratio_raw"], errors="coerce"
    ).fillna(0.0).clip(0, 100)

    priority["access_ratio"] = np.where(
        priority["buf_park_count"].fillna(0).gt(0),
        priority["iso_park_count"].fillna(0) / priority["buf_park_count"].fillna(0),
        0.0,
    )
    priority["is_low_access_tag"] = (
        priority["iso_park_count"].fillna(0).ge(1) & priority["access_ratio"].le(0.5)
    ).astype(int)

    if "current_green_ratio" in priority.columns:
        priority["current_green_ratio"] = priority["walk_500m_green_ratio_intersection"].round(4)
    if "corrected_green_ratio" in priority.columns:
        priority["corrected_green_ratio"] = priority["iso_green_ratio"].round(4)
    if "green_ratio_delta" in priority.columns:
        priority["green_ratio_delta"] = (
            priority["corrected_green_ratio"] - priority["current_green_ratio"]
        ).round(4)

    priority = recalc_case_fields(priority)

    audit_cols = [
        COL_SCHOOL_ID,
        COL_SCHOOL_NAME,
        "gu",
        "green_fix_protected",
        "green_fix_manual_ratio",
        "old_iso_green_ratio",
        "walk_500m_green_ratio_intersection",
        "iso_green_ratio",
        "old_iso_park_count",
        "walk_500m_park_count_intersection",
        "iso_park_count",
        "old_iso_park_area",
        "walk_500m_park_area_intersection",
        "iso_park_area",
        "old_case_type",
        "case_type",
        "nearest_park_dist_m",
    ]
    audit = priority[audit_cols].copy()
    audit["green_ratio_delta_final_vs_old"] = (
        pd.to_numeric(audit["iso_green_ratio"], errors="coerce")
        - pd.to_numeric(audit["old_iso_green_ratio"], errors="coerce")
    ).round(4)
    old_case_norm = pd.to_numeric(audit["old_case_type"], errors="coerce").astype("Int64")
    new_case_norm = pd.to_numeric(audit["case_type"], errors="coerce").astype("Int64")
    audit["case_changed"] = old_case_norm.ne(new_case_norm).fillna(False)
    audit_path = REPORTS / "walk_green_ratio_intersection_audit_20260504.csv"
    summary_path = REPORTS / "walk_green_ratio_intersection_summary_20260504.json"
    audit.to_csv(audit_path, index=False, encoding="utf-8-sig")

    drop_cols = [
        "walk_500m_park_count_intersection",
        "walk_500m_park_area_intersection",
        "walk_500m_zone_area_m2",
        "walk_500m_green_ratio_intersection",
        "radius_500m_park_count_intersection",
        "radius_500m_park_area_intersection",
        "radius_500m_zone_area_m2",
        "radius_500m_green_ratio_intersection",
        "green_fix_protected",
        "green_fix_manual_ratio",
        "old_iso_green_ratio",
        "old_iso_park_count",
        "old_iso_park_area",
        "old_case_type",
    ]
    priority = priority.drop(columns=drop_cols, errors="ignore")

    # Preserve original column order, appending any unexpected columns at the end.
    ordered = [col for col in before.columns if col in priority.columns]
    ordered += [col for col in priority.columns if col not in ordered]
    priority = priority[ordered].sort_values(COL_SCHOOL_ID).reset_index(drop=True)
    priority.to_csv(PRIORITY_PATH, index=False, encoding="utf-8-sig")
    update_gu_summary(priority)

    core = priority[
        pd.to_numeric(priority["case_type"], errors="coerce").notna()
        & pd.to_numeric(priority["is_separate_bundle_tag"], errors="coerce").fillna(0).eq(0)
    ].copy()
    summary = {
        "priority_path": str(PRIORITY_PATH.relative_to(ROOT)),
        "audit_path": str(audit_path.relative_to(ROOT)),
        "protected_field_review_schools": int(audit["green_fix_protected"].sum()),
        "manual_green_ratio_schools": int(audit["green_fix_manual_ratio"].sum()),
        "auto_recalculated_schools": int((~audit["green_fix_protected"]).sum()),
        "green_delta_abs_10pp_plus_auto": int(
            (
                (~audit["green_fix_protected"])
                & audit["green_ratio_delta_final_vs_old"].abs().ge(10)
            ).sum()
        ),
        "case_changed_auto": int(
            ((~audit["green_fix_protected"]) & audit["case_changed"]).sum()
        ),
        "case_counts_all": value_counts_dict(priority["case_type"]),
        "case_counts_core": value_counts_dict(core["case_type"]),
        "walk_green_ratio_core": metric_summary(core["iso_green_ratio"]),
        "radius_green_ratio_core": metric_summary(
            priority.loc[core.index, "buf_park_area"] / (math.pi * 500**2) * 100.0
        ),
        "note": "Field-reviewed/manual schools are protected; automatic schools use public-park intersection area inside the walking 500m isochrone.",
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
