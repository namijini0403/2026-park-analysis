from __future__ import annotations

import ast
import json
import math
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_processed"
REPORTS = ROOT / "reports"
DATA_QUALITY = ROOT / "data_quality"

PARKS_PATH = DATA / "parks.csv"
PARKS_NEAREST_SCHOOL_PATH = DATA / "parks_with_nearest_school.csv"
BLOCKED_PARKS_PATH = DATA / "blocked_parks_by_apt_adjustment_20260504.csv"
SCHOOL_PRIORITY_PATH = DATA / "school_priority.csv"
SCHOOL_NEAREST_PARK_PATH = DATA / "school_nearest_park.csv"
SCHOOLS_PATH = DATA / "schools.csv"
ISOCHRONE_PATH = DATA / "school_isochrone_500m.geojson"
BUFFER_PATH = DATA / "school_buffer_500m.geojson"
CANDIDATE_GRID_PATH = DATA / "candidate_grid_final.csv"
GRAPH_PATHS = [
    ROOT / "data_processed" / "incheon_walk_graph_v2.graphml",
    ROOT / "data" / "processed" / "incheon_walk_graph_v2.graphml",
    ROOT / "data" / "processed" / "incheon_walk_graph.graphml",
]

PARKS_WITH_CLASS_PATH = DATA / "parks_with_function_class.csv"
SCHOOL_LAYER_PATH = DATA / "school_priority_with_functional_park_layer.csv"
OUTLIER_PATH = DATA_QUALITY / "park_area_outliers_review.csv"
MAPPING_REPORT_PATH = REPORTS / "functional_park_layer_column_mapping.md"
VALIDATION_REPORT_PATH = REPORTS / "functional_park_layer_validation.md"
AI_BEFORE_AFTER_CSV_PATH = DATA / "ai_recommendation_before_after_functional_layer.csv"
AI_BEFORE_AFTER_REPORT_PATH = REPORTS / "ai_recommendation_before_after_functional_layer.md"

CRS_METRIC = "EPSG:5179"
WALK_DISTANCE_CUTOFF_M = 5000

COL_CANDIDATES = {
    "park_name": ["공원명", "park_name", "name"],
    "park_type": ["시설유형", "공원구분", "park_type", "type"],
    "park_area": ["공원면적", "공원면적_원본", "area_m2", "park_area"],
    "lat": ["위도", "lat", "latitude", "y"],
    "lng": ["경도", "lng", "lon", "longitude", "x"],
    "school_id": ["학교ID", "school_id", "id"],
    "school_name": ["학교명", "school_name", "name"],
    "nearest_park_name": ["nearest_park_name", "nearest_official_park_name"],
    "nearest_park_dist": ["nearest_park_dist_m", "nearest_official_park_dist_m"],
}

FUNCTION_CLASS_LABELS = {
    "playground_like": "놀이터급·초소형 공간",
    "small_child_park": "소규모 어린이공원급",
    "mid_activity_park": "중간 규모 활동공간",
    "neighborhood_park_scale": "근린공원급 활동공간",
}

FUNCTION_CLASS_BASIS = {
    "playground_like": "어린이공원 최소 규모 기준인 1,500㎡ 미만 또는 면적 정보 없음",
    "small_child_park": "어린이공원 최소 규모 기준 이상이나 분석상 운영 기준 3,000㎡ 미만",
    "mid_activity_park": "본 프로젝트의 분석상 운영 기준 3,000㎡ 이상",
    "neighborhood_park_scale": "근린생활권 근린공원 규모 기준 10,000㎡ 이상",
}

ACCESS_LABELS = {
    "no_official_park": "공원 접근 결핍형",
    "nominal_access_only": "명목 접근성 착시형",
    "functional_access_with_barrier": "보행부담 동반형",
    "functional_access_available": "활동공원 접근 가능형",
    "unknown": "추가 검토 필요",
}

ACCESS_DESCRIPTIONS = {
    "no_official_park": "도보생활권 내 공식 공원이 확인되지 않아 야외활동 인프라 자체가 부족한 유형입니다.",
    "nominal_access_only": "공원은 있으나 대부분 초소형 공간으로, 단순 공원 개수만으로는 야외활동 환경을 과대평가할 수 있습니다.",
    "functional_access_with_barrier": "활동 가능 공원은 있으나, 도달 경로에 대로 횡단 또는 교차로 부담이 포함될 수 있습니다.",
    "functional_access_available": "도보권 내 활동 가능 공원이 확인되는 유형입니다.",
    "unknown": "접근성 판단에 필요한 일부 값이 누락되어 추가 검토가 필요합니다.",
}

ACCESS_PRIORITY = {
    "no_official_park": 1,
    "nominal_access_only": 2,
    "functional_access_with_barrier": 3,
    "functional_access_available": 4,
    "unknown": 9,
}


def ensure_dirs() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    DATA_QUALITY.mkdir(parents=True, exist_ok=True)


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")


def find_col(columns: list[str], candidates: list[str]) -> str | None:
    normalized = {str(col).strip().lower(): col for col in columns}
    for candidate in candidates:
        key = candidate.strip().lower()
        if key in normalized:
            return normalized[key]
    return None


def detect_mapping(path: Path, df: pd.DataFrame) -> dict[str, str | None]:
    return {key: find_col(list(df.columns), candidates) for key, candidates in COL_CANDIDATES.items()}


def normalize_name(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip())


def to_bool_series(series: pd.Series) -> pd.Series:
    return series.fillna(False).astype(bool)


def classify_park(row: pd.Series) -> str:
    facility = str(row.get("시설유형", "") or "").strip()
    area = pd.to_numeric(row.get("공원면적"), errors="coerce")
    if facility == "놀이터" or pd.isna(area) or area < 1500:
        return "playground_like"
    if area < 3000:
        return "small_child_park"
    if area < 10000:
        return "mid_activity_park"
    return "neighborhood_park_scale"


def add_park_function_class(parks: pd.DataFrame) -> pd.DataFrame:
    result = parks.copy()
    result["공원면적"] = pd.to_numeric(result["공원면적"], errors="coerce")
    result["park_function_class"] = result.apply(classify_park, axis=1)
    result["park_function_label"] = result["park_function_class"].map(FUNCTION_CLASS_LABELS)
    result["park_function_basis"] = result["park_function_class"].map(FUNCTION_CLASS_BASIS)
    return result


def build_point_gdf(parks: pd.DataFrame) -> gpd.GeoDataFrame:
    valid = parks.copy()
    valid["위도"] = pd.to_numeric(valid["위도"], errors="coerce")
    valid["경도"] = pd.to_numeric(valid["경도"], errors="coerce")
    valid = valid[valid["위도"].notna() & valid["경도"].notna()].copy()
    return gpd.GeoDataFrame(
        valid,
        geometry=gpd.points_from_xy(valid["경도"], valid["위도"]),
        crs="EPSG:4326",
    )


def count_by_zone(zone: gpd.GeoDataFrame, points: gpd.GeoDataFrame, prefix: str) -> pd.DataFrame:
    if zone.crs is None:
        zone = zone.set_crs("EPSG:4326")
    if points.crs != zone.crs:
        points = points.to_crs(zone.crs)

    joined = gpd.sjoin(
        points[["park_function_class", "geometry"]],
        zone[["학교ID", "geometry"]],
        how="inner",
        predicate="within",
    )
    counts = (
        joined.groupby(["학교ID", "park_function_class"])
        .size()
        .unstack(fill_value=0)
        .reset_index()
    )
    for class_name in FUNCTION_CLASS_LABELS:
        if class_name not in counts.columns:
            counts[class_name] = 0

    output = zone[["학교ID"]].drop_duplicates().merge(counts, on="학교ID", how="left")
    for class_name in FUNCTION_CLASS_LABELS:
        output[class_name] = output[class_name].fillna(0).astype(int)

    output[f"{prefix}_official_park_count"] = output[list(FUNCTION_CLASS_LABELS)].sum(axis=1).astype(int)
    output[f"{prefix}_playground_like_count"] = output["playground_like"].astype(int)
    output[f"{prefix}_small_child_park_count"] = output["small_child_park"].astype(int)
    output[f"{prefix}_mid_activity_park_count"] = output["mid_activity_park"].astype(int)
    output[f"{prefix}_neighborhood_scale_park_count"] = output["neighborhood_park_scale"].astype(int)
    output[f"{prefix}_functional_park_count"] = (
        output["mid_activity_park"] + output["neighborhood_park_scale"]
    ).astype(int)
    return output[
        [
            "학교ID",
            f"{prefix}_official_park_count",
            f"{prefix}_functional_park_count",
            f"{prefix}_neighborhood_scale_park_count",
            f"{prefix}_playground_like_count",
            f"{prefix}_small_child_park_count",
            f"{prefix}_mid_activity_park_count",
        ]
    ]


def make_outlier_review(parks: pd.DataFrame) -> pd.DataFrame:
    rows: list[pd.DataFrame] = []
    area = pd.to_numeric(parks["공원면적"], errors="coerce")
    facility = parks["시설유형"].astype(str).fillna("")

    mask = facility.eq("근린공원") & area.notna() & area.lt(500)
    if mask.any():
        item = parks.loc[mask].copy()
        item["review_reason"] = "근린공원인데 공원면적 500㎡ 미만"
        rows.append(item)

    mask = facility.ne("놀이터") & area.isna()
    if mask.any():
        item = parks.loc[mask].copy()
        item["review_reason"] = "공원 계열 시설인데 공원면적 누락"
        rows.append(item)

    mask = area.notna() & area.le(0)
    if mask.any():
        item = parks.loc[mask].copy()
        item["review_reason"] = "공원면적 0 또는 음수"
        rows.append(item)

    duplicate_area_names = []
    for name, group in parks.groupby("공원명", dropna=False):
        clean_area = pd.to_numeric(group["공원면적"], errors="coerce").dropna()
        if len(clean_area) < 2:
            continue
        area_min = float(clean_area.min())
        area_max = float(clean_area.max())
        if area_max - area_min > 1000 and (area_min <= 0 or area_max / area_min > 1.25):
            duplicate_area_names.append(name)
    if duplicate_area_names:
        item = parks[parks["공원명"].isin(duplicate_area_names)].copy()
        item["review_reason"] = "같은 공원명 내 면적 차이 큼"
        rows.append(item)

    duplicate_type_names = []
    for name, group in parks.groupby("공원명", dropna=False):
        if group["시설유형"].astype(str).nunique(dropna=True) > 1:
            duplicate_type_names.append(name)
    if duplicate_type_names:
        item = parks[parks["공원명"].isin(duplicate_type_names)].copy()
        item["review_reason"] = "같은 공원명 내 시설유형 상이"
        rows.append(item)

    if not rows:
        return pd.DataFrame(columns=list(parks.columns) + ["review_reason"])

    return pd.concat(rows, ignore_index=True).drop_duplicates(
        subset=["관리번호", "공원명", "시설유형", "공원면적", "review_reason"]
    )


def resolve_graph_path() -> Path | None:
    for path in GRAPH_PATHS:
        if path.exists():
            return path
    return None


def nearest_nodes_for_parks(graph: nx.MultiDiGraph, parks: pd.DataFrame) -> pd.DataFrame:
    valid = parks.copy()
    valid["위도"] = pd.to_numeric(valid["위도"], errors="coerce")
    valid["경도"] = pd.to_numeric(valid["경도"], errors="coerce")
    valid = valid[valid["위도"].notna() & valid["경도"].notna()].copy()
    valid["graph_node"] = ox.distance.nearest_nodes(
        graph,
        X=valid["경도"].astype(float).to_numpy(),
        Y=valid["위도"].astype(float).to_numpy(),
    )
    return valid


def pick_nearest_park(lengths: dict[Any, float], target_nodes: set[Any], parks_by_node: dict[Any, list[dict[str, Any]]]) -> dict[str, Any] | None:
    best_node = None
    best_distance = math.inf
    for node in target_nodes:
        distance = lengths.get(node)
        if distance is not None and distance < best_distance:
            best_distance = float(distance)
            best_node = node
    if best_node is None:
        return None

    candidates = parks_by_node.get(best_node, [])
    if not candidates:
        return None

    chosen = sorted(
        candidates,
        key=lambda item: (
            0 if pd.notna(item.get("공원면적")) else 1,
            -float(item.get("공원면적") or 0),
            str(item.get("공원명") or ""),
        ),
    )[0]
    return {
        "name": chosen.get("공원명"),
        "area": chosen.get("공원면적"),
        "class": chosen.get("park_function_class"),
        "label": chosen.get("park_function_label"),
        "type": chosen.get("시설유형") or chosen.get("공원구분"),
        "dist": round(best_distance, 1),
    }


def compute_nearest_walk_distances(schools: pd.DataFrame, iso: gpd.GeoDataFrame, parks: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    graph_path = resolve_graph_path()
    if graph_path is None:
        return pd.DataFrame({"학교ID": schools["학교ID"]}), "GraphML 파일을 찾지 못해 기능성 공원 최근접 도보거리 산출을 건너뜀"

    graph = ox.load_graphml(graph_path)
    parks_with_nodes = nearest_nodes_for_parks(graph, parks)
    parks_by_node: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for record in parks_with_nodes.to_dict("records"):
        parks_by_node[record["graph_node"]].append(record)

    official_nodes = set(parks_with_nodes["graph_node"])
    functional_nodes = set(
        parks_with_nodes.loc[
            parks_with_nodes["park_function_class"].isin(["mid_activity_park", "neighborhood_park_scale"]),
            "graph_node",
        ]
    )
    neighborhood_nodes = set(
        parks_with_nodes.loc[parks_with_nodes["park_function_class"].eq("neighborhood_park_scale"), "graph_node"]
    )

    iso_nodes = iso[["학교ID", "nearest_node"]].copy() if "nearest_node" in iso.columns else pd.DataFrame()
    merged = schools.merge(iso_nodes, on="학교ID", how="left")
    missing_school_nodes = []
    output_rows = []

    for row in merged.to_dict("records"):
        school_id = row.get("학교ID")
        school_node = row.get("nearest_node")
        try:
            if pd.isna(school_node) or int(school_node) not in graph:
                school_node = ox.distance.nearest_nodes(graph, X=float(row["경도"]), Y=float(row["위도"]))
            else:
                school_node = int(school_node)
        except Exception:
            missing_school_nodes.append(str(school_id))
            output_rows.append({"학교ID": school_id})
            continue

        lengths = nx.single_source_dijkstra_path_length(
            graph,
            school_node,
            cutoff=WALK_DISTANCE_CUTOFF_M,
            weight="length",
        )
        official = pick_nearest_park(lengths, official_nodes, parks_by_node)
        functional = pick_nearest_park(lengths, functional_nodes, parks_by_node)
        neighborhood = pick_nearest_park(lengths, neighborhood_nodes, parks_by_node)

        output_rows.append(
            {
                "학교ID": school_id,
                "graph_nearest_official_park_dist_m": official["dist"] if official else pd.NA,
                "graph_nearest_official_park_name": official["name"] if official else pd.NA,
                "nearest_functional_park_dist_m": functional["dist"] if functional else pd.NA,
                "nearest_functional_park_name": functional["name"] if functional else pd.NA,
                "nearest_functional_park_area_m2": functional["area"] if functional else pd.NA,
                "nearest_functional_park_function_class": functional["class"] if functional else pd.NA,
                "nearest_neighborhood_scale_park_dist_m": neighborhood["dist"] if neighborhood else pd.NA,
                "nearest_neighborhood_scale_park_name": neighborhood["name"] if neighborhood else pd.NA,
                "nearest_neighborhood_scale_park_area_m2": neighborhood["area"] if neighborhood else pd.NA,
            }
        )

    note = f"GraphML `{graph_path}` 사용, cutoff {WALK_DISTANCE_CUTOFF_M}m"
    if missing_school_nodes:
        note += f"; 학교 노드 매핑 실패 {len(missing_school_nodes)}건"
    return pd.DataFrame(output_rows), note


def build_name_lookup(parks: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    lookup: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in parks.to_dict("records"):
        lookup[normalize_name(record.get("공원명"))].append(record)
    return lookup


def lookup_park_by_name(name: Any, gu: Any, lookup: dict[str, list[dict[str, Any]]]) -> dict[str, Any] | None:
    candidates = lookup.get(normalize_name(name), [])
    if not candidates:
        return None
    gu_text = str(gu or "")
    sorted_candidates = sorted(
        candidates,
        key=lambda item: (
            0 if str(item.get("gu") or "") == gu_text else 1,
            0 if pd.notna(item.get("공원면적")) else 1,
            -float(item.get("공원면적") or 0),
        ),
    )
    return sorted_candidates[0]


def enrich_school_layer(priority: pd.DataFrame, nearest: pd.DataFrame, parks: pd.DataFrame, iso_counts: pd.DataFrame, walk_distances: pd.DataFrame) -> pd.DataFrame:
    result = priority.copy()
    nearest_cols = ["학교ID", "nearest_park_name", "nearest_park_dist_m"]
    nearest_existing = nearest[[col for col in nearest_cols if col in nearest.columns]].copy()
    if "nearest_park_name" in nearest_existing.columns:
        result = result.drop(columns=["nearest_park_name"], errors="ignore").merge(
            nearest_existing[["학교ID", "nearest_park_name"]],
            on="학교ID",
            how="left",
        )

    result = result.merge(iso_counts, on="학교ID", how="left")
    result = result.merge(walk_distances, on="학교ID", how="left")

    count_cols = [col for col in result.columns if col.startswith("iso_") and col.endswith("_park_count")]
    count_cols += [
        "iso_playground_like_count",
        "iso_small_child_park_count",
        "iso_mid_activity_park_count",
        "iso_neighborhood_scale_park_count",
    ]
    for col in sorted(set(count_cols)):
        if col in result.columns:
            result[col] = pd.to_numeric(result[col], errors="coerce").fillna(0).astype(int)

    result["nearest_official_park_dist_m"] = pd.to_numeric(result["nearest_park_dist_m"], errors="coerce")
    result["nearest_official_park_name"] = result.get("nearest_park_name")

    lookup = build_name_lookup(parks)
    official_types = []
    official_areas = []
    official_classes = []
    official_labels = []
    for row in result.to_dict("records"):
        park = lookup_park_by_name(row.get("nearest_official_park_name"), row.get("gu"), lookup)
        official_types.append(park.get("시설유형") if park else pd.NA)
        official_areas.append(park.get("공원면적") if park else pd.NA)
        official_classes.append(park.get("park_function_class") if park else pd.NA)
        official_labels.append(park.get("park_function_label") if park else pd.NA)

    result["nearest_official_park_type"] = official_types
    result["nearest_official_park_area_m2"] = official_areas
    result["nearest_official_park_function_class"] = official_classes
    result["nearest_official_park_function_label"] = official_labels

    result["official_to_functional_gap_m"] = (
        pd.to_numeric(result["nearest_functional_park_dist_m"], errors="coerce")
        - pd.to_numeric(result["nearest_official_park_dist_m"], errors="coerce")
    )
    result["official_to_neighborhood_gap_m"] = (
        pd.to_numeric(result["nearest_neighborhood_scale_park_dist_m"], errors="coerce")
        - pd.to_numeric(result["nearest_official_park_dist_m"], errors="coerce")
    )

    result["no_official_park_flag"] = result["iso_official_park_count"].eq(0)
    result["only_micro_park_flag"] = result["iso_official_park_count"].gt(0) & result["iso_functional_park_count"].eq(0)
    result["no_functional_park_flag"] = result["iso_functional_park_count"].eq(0)
    result["no_neighborhood_scale_park_flag"] = result["iso_neighborhood_scale_park_count"].eq(0)
    result["activity_space_limited_flag"] = (
        result["nearest_official_park_function_class"].isin(["playground_like", "small_child_park"])
        & (
            pd.to_numeric(result["nearest_functional_park_dist_m"], errors="coerce").isna()
            | pd.to_numeric(result["nearest_functional_park_dist_m"], errors="coerce").gt(500)
        )
    )
    result["nominal_access_gap_flag"] = result["iso_official_park_count"].gt(0) & result["iso_functional_park_count"].eq(0)
    result["neighborhood_scale_gap_flag"] = result["iso_functional_park_count"].gt(0) & result["iso_neighborhood_scale_park_count"].eq(0)

    barrier_level_present = "barrier_level" in result.columns
    access_types = []
    for row in result.to_dict("records"):
        if row.get("no_official_park_flag") is True:
            access_types.append("no_official_park")
        elif bool(row.get("iso_official_park_count", 0) > 0 and row.get("iso_functional_park_count", 0) == 0):
            access_types.append("nominal_access_only")
        elif barrier_level_present and row.get("iso_functional_park_count", 0) > 0 and pd.to_numeric(row.get("barrier_level"), errors="coerce") >= 2:
            access_types.append("functional_access_with_barrier")
        elif row.get("iso_functional_park_count", 0) > 0:
            access_types.append("functional_access_available")
        else:
            access_types.append("unknown")

    result["access_condition_type"] = access_types
    result["access_condition_label"] = result["access_condition_type"].map(ACCESS_LABELS)
    result["access_condition_description"] = result["access_condition_type"].map(ACCESS_DESCRIPTIONS)
    result["access_condition_priority"] = result["access_condition_type"].map(ACCESS_PRIORITY)

    bool_cols = [
        "no_official_park_flag",
        "only_micro_park_flag",
        "no_functional_park_flag",
        "no_neighborhood_scale_park_flag",
        "activity_space_limited_flag",
        "nominal_access_gap_flag",
        "neighborhood_scale_gap_flag",
    ]
    for col in bool_cols:
        result[col] = to_bool_series(result[col])

    return result


def parse_linked_schools(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    text = str(value or "").strip()
    if not text or text.lower() == "nan":
        return []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            flattened: list[str] = []
            for item in parsed:
                flattened.extend(parse_linked_schools(item))
            return flattened
    except Exception:
        pass
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, (list, tuple)):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except Exception:
        pass
    return [name.strip() for name in re.findall(r"'([^']+)'", text) if name.strip()]


def build_ai_before_after(school_layer: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    if not CANDIDATE_GRID_PATH.exists():
        return pd.DataFrame(), "candidate_grid_final.csv 없음"

    candidates = read_csv(CANDIDATE_GRID_PATH)
    school_lookup = {
        str(row["학교명"]): {
            "priority": int(row["access_condition_priority"]),
            "label": str(row["access_condition_label"]),
        }
        for row in school_layer.to_dict("records")
        if pd.notna(row.get("학교명")) and pd.notna(row.get("access_condition_priority"))
    }

    rows = []
    for record in candidates.to_dict("records"):
        names = parse_linked_schools(record.get("linked_schools"))
        matched = [school_lookup[name] for name in names if name in school_lookup]
        min_priority = min((item["priority"] for item in matched), default=9)
        labels = sorted(set(item["label"] for item in matched))
        existing_score = pd.to_numeric(record.get("priority_score_mixed"), errors="coerce")
        if pd.isna(existing_score):
            existing_score = pd.to_numeric(record.get("priority_score"), errors="coerce")
        demand = pd.to_numeric(record.get("walkshed_beneficiary_2031"), errors="coerce")
        if pd.isna(demand):
            demand = pd.to_numeric(record.get("pred_beneficiary_2031"), errors="coerce")
        rows.append(
            {
                **record,
                "existing_recommendation_score": existing_score,
                "linked_access_condition_priority_min": min_priority,
                "linked_access_condition_labels": " | ".join(labels),
                "linked_access_condition_school_count": len(matched),
                "sort_demand_2031": demand,
            }
        )

    result = pd.DataFrame(rows)
    result = result.sort_values(
        ["existing_recommendation_score", "linked_access_condition_priority_min"],
        ascending=[False, True],
        na_position="last",
    ).reset_index(drop=True)
    result["rank_option_off"] = result.index + 1
    result = result.sort_values(
        ["linked_access_condition_priority_min", "existing_recommendation_score", "sort_demand_2031"],
        ascending=[True, False, False],
        na_position="last",
    ).reset_index(drop=True)
    result["rank_access_deficit_first_on"] = result.index + 1
    result["rank_delta_when_access_deficit_first_on"] = result["rank_option_off"] - result["rank_access_deficit_first_on"]
    result.to_csv(AI_BEFORE_AFTER_CSV_PATH, index=False, encoding="utf-8-sig")

    matched = result[result["linked_access_condition_school_count"].gt(0)].copy()
    top_changes = matched.reindex(
        matched["rank_delta_when_access_deficit_first_on"].abs().sort_values(ascending=False).index
    ).head(10)
    lines = [
        "# AI 추천 정렬 before/after",
        "",
        "- 기본값 OFF: 기존 추천 점수 DESC 뒤에 접근성 결핍 우선순위를 보조 정렬키로 둔다.",
        "- 사용자 옵션 ON: 접근성 결핍 우선순위를 1차 정렬키로 사용한다.",
        "- 기존 추천 점수 자체는 변경하지 않았다.",
        "",
        "## 순위 변화 상위 10건",
        "",
        f"- 연결 학교 접근성 유형이 매칭된 후보: {len(matched):,} / {len(result):,}건",
        "- 아래 표는 매칭된 후보만 대상으로 한다.",
        "",
        "| grid_id | 기존 순위 | 접근성 우선 순위 | 변화 | 연결 접근성 유형 |",
        "|---|---:|---:|---:|---|",
    ]
    for row in top_changes.to_dict("records"):
        lines.append(
            f"| {row.get('grid_id')} | {int(row.get('rank_option_off'))} | "
            f"{int(row.get('rank_access_deficit_first_on'))} | "
            f"{int(row.get('rank_delta_when_access_deficit_first_on'))} | "
            f"{row.get('linked_access_condition_labels') or '-'} |"
        )
    AI_BEFORE_AFTER_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return result, f"{AI_BEFORE_AFTER_CSV_PATH} 생성"


def write_mapping_report(dataframes: dict[Path, pd.DataFrame], mappings: dict[Path, dict[str, str | None]]) -> None:
    lines = [
        "# 기능성 공원 레이어 컬럼 매핑",
        "",
        "각 파일의 존재 여부와 자동 탐색한 컬럼명이다. 매핑 실패 항목은 빈 값으로 남겨 후속 검토 대상임을 표시한다.",
        "",
    ]
    for path, df in dataframes.items():
        lines.extend(
            [
                f"## `{path.as_posix()}`",
                "",
                f"- 존재 여부: {'있음' if path.exists() else '없음'}",
                f"- 행/열: {df.shape[0]}행, {df.shape[1]}열",
                f"- 전체 컬럼: `{', '.join(map(str, df.columns))}`",
                "",
                "| 항목 | 매핑 컬럼 |",
                "|---|---|",
            ]
        )
        for key, value in mappings[path].items():
            lines.append(f"| {key} | {value or '매핑 실패'} |")
        lines.append("")
    MAPPING_REPORT_PATH.write_text("\n".join(lines), encoding="utf-8")


def metric_table(counts: pd.Series) -> str:
    lines = ["| 값 | 개수 |", "|---|---:|"]
    for key, value in counts.items():
        lines.append(f"| {key} | {int(value)} |")
    return "\n".join(lines)


def write_validation_report(
    parks: pd.DataFrame,
    school_layer: pd.DataFrame,
    outliers: pd.DataFrame,
    before_priority: pd.DataFrame,
    graph_note: str,
    ai_note: str,
) -> None:
    area_non_null = pd.to_numeric(parks["공원면적"], errors="coerce").notna()
    class_counts = parks["park_function_class"].value_counts().reindex(FUNCTION_CLASS_LABELS.keys(), fill_value=0)
    class_medians = (
        parks.groupby("park_function_class")["공원면적"]
        .median()
        .reindex(FUNCTION_CLASS_LABELS.keys())
        .round(2)
    )
    access_counts = school_layer["access_condition_type"].value_counts().reindex(ACCESS_LABELS.keys(), fill_value=0)

    case_unchanged = before_priority["case_type"].astype(str).fillna("").equals(
        school_layer.loc[before_priority.index, "case_type"].astype(str).fillna("")
    )
    dist_unchanged = pd.to_numeric(before_priority["nearest_park_dist_m"], errors="coerce").fillna(-1).equals(
        pd.to_numeric(school_layer.loc[before_priority.index, "nearest_park_dist_m"], errors="coerce").fillna(-1)
    )
    green_unchanged = pd.to_numeric(before_priority["iso_green_ratio"], errors="coerce").fillna(-1).equals(
        pd.to_numeric(school_layer.loc[before_priority.index, "iso_green_ratio"], errors="coerce").fillna(-1)
    )

    lines = [
        "# 기능성 공원 접근성 보조 레이어 검증",
        "",
        "이번 작업은 기존 Case 분류를 변경하지 않고, 공식 공원 접근성과 활동 가능 공원 접근성을 분리하는 보조 해석 레이어를 추가한 것이다.",
        "",
        "## 입력·산출 요약",
        "",
        f"- 전체 공원/놀이터 레코드 수: {len(parks)}",
        f"- 공원면적 있는 레코드 수: {int(area_non_null.sum())}",
        f"- 공원면적 없는 레코드 수: {int((~area_non_null).sum())}",
        f"- 이상치 검수 대상 레코드 수: {len(outliers)}",
        f"- 도보거리 산출 메모: {graph_note}",
        f"- AI 추천 before/after: {ai_note}",
        "- barrier_level 컬럼: 없음. access_condition_type의 `functional_access_with_barrier` 조건은 건너뜀.",
        "",
        "## park_function_class별 개수",
        "",
        metric_table(class_counts),
        "",
        "## park_function_class별 면적 중앙값",
        "",
        "| park_function_class | 중앙값(㎡) |",
        "|---|---:|",
    ]
    for key, value in class_medians.items():
        display = "-" if pd.isna(value) else f"{float(value):,.2f}"
        lines.append(f"| {key} | {display} |")

    flag_cols = [
        "no_official_park_flag",
        "only_micro_park_flag",
        "no_functional_park_flag",
        "no_neighborhood_scale_park_flag",
        "activity_space_limited_flag",
        "nominal_access_gap_flag",
    ]
    lines.extend(["", "## 학교 플래그 집계", ""])
    for col in flag_cols:
        lines.append(f"- {col}: {int(school_layer[col].fillna(False).astype(bool).sum())}개교")

    lines.extend(
        [
            "",
            "## access_condition_type별 학교 수",
            "",
            metric_table(access_counts),
            "",
            "## 기존 값 보존 검증",
            "",
            f"- 기존 case 컬럼 값 변경 없음: {case_unchanged}",
            f"- 기존 최근접 공원 거리 컬럼 변경 없음: {dist_unchanged}",
            f"- 기존 녹지비율 컬럼 변경 없음: {green_unchanged}",
            "",
            "## 이상치 예시 10건",
            "",
        ]
    )
    if outliers.empty:
        lines.append("- 검수 대상 없음")
    else:
        preview_cols = [col for col in ["공원명", "시설유형", "공원면적", "gu", "review_reason"] if col in outliers.columns]
        lines.extend(["| " + " | ".join(preview_cols) + " |", "|" + "|".join(["---"] * len(preview_cols)) + "|"])
        for row in outliers[preview_cols].head(10).to_dict("records"):
            lines.append("| " + " | ".join(str(row.get(col, "")) for col in preview_cols) + " |")

    VALIDATION_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()

    required_paths = [
        PARKS_PATH,
        PARKS_NEAREST_SCHOOL_PATH,
        BLOCKED_PARKS_PATH,
        SCHOOL_PRIORITY_PATH,
        SCHOOL_NEAREST_PARK_PATH,
        SCHOOLS_PATH,
    ]
    dataframes: dict[Path, pd.DataFrame] = {}
    for path in required_paths:
        dataframes[path] = read_csv(path) if path.exists() else pd.DataFrame()
    mappings = {path: detect_mapping(path, df) for path, df in dataframes.items()}
    write_mapping_report(dataframes, mappings)

    parks = add_park_function_class(dataframes[PARKS_PATH])
    parks.to_csv(PARKS_WITH_CLASS_PATH, index=False, encoding="utf-8-sig")

    outliers = make_outlier_review(parks)
    outliers.to_csv(OUTLIER_PATH, index=False, encoding="utf-8-sig")

    iso = gpd.read_file(ISOCHRONE_PATH)
    points = build_point_gdf(parks)
    iso_counts = count_by_zone(iso, points, "iso")

    schools = dataframes[SCHOOLS_PATH]
    graph_distances, graph_note = compute_nearest_walk_distances(schools, iso, parks)

    before_priority = dataframes[SCHOOL_PRIORITY_PATH].copy()
    school_layer = enrich_school_layer(
        before_priority,
        dataframes[SCHOOL_NEAREST_PARK_PATH],
        parks,
        iso_counts,
        graph_distances,
    )
    school_layer.to_csv(SCHOOL_LAYER_PATH, index=False, encoding="utf-8-sig")

    _, ai_note = build_ai_before_after(school_layer)
    write_validation_report(parks, school_layer, outliers, before_priority, graph_note, ai_note)

    print(f"wrote {PARKS_WITH_CLASS_PATH}")
    print(f"wrote {SCHOOL_LAYER_PATH}")
    print(f"wrote {OUTLIER_PATH}")
    print(f"wrote {MAPPING_REPORT_PATH}")
    print(f"wrote {VALIDATION_REPORT_PATH}")
    print(f"park_function_class counts: {parks['park_function_class'].value_counts().to_dict()}")
    print(f"access_condition_type counts: {school_layer['access_condition_type'].value_counts().to_dict()}")
    print(f"outlier rows: {len(outliers)}")


if __name__ == "__main__":
    main()
