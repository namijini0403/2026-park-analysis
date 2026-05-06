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
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import transform as shapely_transform


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data_processed"
REPORTS = ROOT / "reports"
DATA_QUALITY = ROOT / "data_quality"
BACKUPS = ROOT / "backups"

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
WALKING_BARRIER_REPORT_PATH = REPORTS / "walking_barrier_logic_validation.md"

CRS_METRIC = "EPSG:5179"
WALK_DISTANCE_CUTOFF_M = 5000
GREEN_WARNING_THRESHOLD = 5.0
GREEN_HIGH_REVIEW_THRESHOLD = 80.0
ACCIDENT_DATA_PATH = ROOT / "data" / "raw" / "전국교통사고다발지역표준데이터.csv"
ACCIDENT_REGION_KEYWORD = "인천"
ACCIDENT_COL_REGION = "사고다발지역시도시군구"
ACCIDENT_COL_TYPE = "사고유형구분"
ACCIDENT_COL_NAME = "사고지역위치명"
ACCIDENT_COL_LAT = "위도"
ACCIDENT_COL_LNG = "경도"
ACCIDENT_COL_POLYGON = "사고다발지역폴리곤정보"
TO_EPSG5179 = Transformer.from_crs("EPSG:4326", CRS_METRIC, always_xy=True)
HIGHWAY_BUCKETS = ("motorway", "trunk", "primary", "secondary", "tertiary")
MAJOR_CROSSING_BUCKETS = ("motorway", "trunk", "primary", "secondary")

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
    "near_park_low_green_imbalance": "근접 공원-녹지환경 불균형형",
    "functional_access_with_barrier": "보행부담 동반형",
    "functional_access_available": "활동공원 접근 가능형",
    "unknown": "추가 검토 필요",
}

ACCESS_DESCRIPTIONS = {
    "no_official_park": "도보생활권 내 공식 공원이 확인되지 않아 야외활동 인프라 자체가 부족한 유형입니다.",
    "nominal_access_only": "공원은 있으나 대부분 초소형 공간으로, 단순 공원 개수만으로는 야외활동 환경을 과대평가할 수 있습니다.",
    "near_park_low_green_imbalance": "가까운 활동 가능 공원은 있으나, 학교 도보생활권 전체의 녹지 비율은 낮은 유형입니다.",
    "functional_access_with_barrier": "활동 가능 공원은 있으나, 도달 경로에 우회 부담 등 보행부담 요소가 포함될 수 있습니다.",
    "functional_access_available": "도보권 내 활동 가능 공원이 확인되는 유형입니다.",
    "unknown": "접근성 판단에 필요한 일부 값이 누락되어 추가 검토가 필요합니다.",
}

ACCESS_PRIORITY = {
    "no_official_park": 1,
    "nominal_access_only": 2,
    "near_park_low_green_imbalance": 3,
    "functional_access_with_barrier": 4,
    "functional_access_available": 5,
    "unknown": 9,
}


def ensure_dirs() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    DATA_QUALITY.mkdir(parents=True, exist_ok=True)
    BACKUPS.mkdir(parents=True, exist_ok=True)


def backup_existing_outputs(paths: list[Path], tag: str) -> list[Path]:
    timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
    backups: list[Path] = []
    for path in paths:
        if not path.exists():
            continue
        backup_path = BACKUPS / f"{path.stem}_before_{tag}_{timestamp}{path.suffix}"
        backup_path.write_bytes(path.read_bytes())
        backups.append(backup_path)
    return backups


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


def normalize_highway(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple, set)):
        normalized = [normalize_highway(item) for item in value]
        normalized = [item for item in normalized if item]
        if not normalized:
            return None
        return max(normalized, key=highway_rank)

    text = str(value).strip().lower()
    if not text:
        return None
    if text.endswith("_link"):
        text = text[:-5]
    return text if text in HIGHWAY_BUCKETS else None


def highway_rank(bucket: str | None) -> int:
    if bucket in {"motorway", "trunk"}:
        return 4
    if bucket == "primary":
        return 3
    if bucket == "secondary":
        return 2
    if bucket == "tertiary":
        return 1
    return 0


def road_label_for_bucket(bucket: str) -> str:
    if bucket in {"motorway", "trunk", "primary"}:
        return "주요 도시 간선도로"
    if bucket == "secondary":
        return "중간급 간선도로"
    if bucket == "tertiary":
        return "지구 내 간선도로"
    return "간선도로"


def select_edge_attrs(edge_data: dict[Any, dict[str, Any]] | None) -> dict[str, Any]:
    if not edge_data:
        return {}
    return min(
        edge_data.values(),
        key=lambda attrs: float(attrs.get("length", float("inf"))),
    )


def edge_bucket(graph: nx.MultiDiGraph, left: Any, right: Any) -> str | None:
    edge_data = graph.get_edge_data(left, right)
    if not edge_data:
        return None

    best_bucket = None
    best_rank = -1
    for attrs in edge_data.values():
        bucket = normalize_highway(attrs.get("highway"))
        rank = highway_rank(bucket)
        if rank > best_rank:
            best_bucket = bucket
            best_rank = rank
    return best_bucket


def edge_road_signature(graph: nx.MultiDiGraph, left: Any, right: Any) -> tuple[str | None, str | None]:
    edge_data = graph.get_edge_data(left, right)
    if not edge_data:
        return (None, None)
    labels: list[str] = []
    bucket = None
    best_rank = -1
    for attrs in edge_data.values():
        current_bucket = normalize_highway(attrs.get("highway"))
        rank = highway_rank(current_bucket)
        if rank > best_rank:
            bucket = current_bucket
            best_rank = rank
        name = attrs.get("name")
        osmid = attrs.get("osmid")
        if isinstance(name, list):
            labels.extend(str(item).strip() for item in name if str(item).strip())
        elif name is not None and str(name).strip():
            labels.append(str(name).strip())
        elif isinstance(osmid, list):
            labels.extend(f"osmid:{item}" for item in osmid if str(item).strip())
        elif osmid is not None and str(osmid).strip():
            labels.append(f"osmid:{osmid}")
    return (bucket, " | ".join(sorted(set(labels))) if labels else None)


def count_route_highway_buckets(graph: nx.MultiDiGraph, route: list[Any]) -> dict[str, int]:
    counts = {bucket: 0 for bucket in HIGHWAY_BUCKETS}
    last_signature: tuple[str | None, str | None] | None = None
    for left, right in zip(route, route[1:]):
        bucket, road_signature = edge_road_signature(graph, left, right)
        if bucket in counts:
            signature = (bucket, road_signature)
            if signature != last_signature:
                counts[bucket] += 1
                last_signature = signature
        else:
            last_signature = None
    return counts


def route_length_m(graph: nx.MultiDiGraph, route: list[Any]) -> float:
    total = 0.0
    for left, right in zip(route, route[1:]):
        attrs = select_edge_attrs(graph.get_edge_data(left, right))
        if attrs.get("length") is not None:
            total += float(attrs.get("length", 0))
    return total


def route_coordinates(graph: nx.MultiDiGraph, route: list[Any]) -> list[list[float]]:
    coords: list[list[float]] = []
    for node in route:
        node_data = graph.nodes[node]
        coords.append([round(float(node_data["y"]), 6), round(float(node_data["x"]), 6)])
    return coords


def distance_in_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lng2 - lng1)
    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius_m * c


def route_linestring_5179(route_coords: list[list[float]]) -> LineString | None:
    lon_lat = []
    for point in route_coords:
        if not isinstance(point, list) or len(point) != 2:
            continue
        lat, lng = point
        lon_lat.append((float(lng), float(lat)))
    if len(lon_lat) < 2:
        return None
    return shapely_transform(TO_EPSG5179.transform, LineString(lon_lat))


def parse_accident_polygon(text: Any, lat: float, lng: float) -> Polygon:
    raw = str(text or "").strip()
    matches = re.findall(r"\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]", raw)
    if len(matches) >= 4:
        coords = [(float(x), float(y)) for x, y in matches]
        polygon = Polygon(coords)
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        if not polygon.is_empty:
            return polygon

    center = Point(*TO_EPSG5179.transform(lng, lat))
    return center.buffer(50)


def load_accident_hotspots() -> tuple[list[dict[str, Any]], str]:
    if not ACCIDENT_DATA_PATH.exists():
        return [], "사고위험 자료 없음"

    try:
        df = pd.read_csv(ACCIDENT_DATA_PATH, encoding="cp949")
    except UnicodeDecodeError:
        df = pd.read_csv(ACCIDENT_DATA_PATH, encoding="utf-8-sig")

    if ACCIDENT_COL_REGION not in df.columns:
        return [], "사고위험 자료 컬럼 매핑 실패"

    mask = df[ACCIDENT_COL_REGION].astype(str).str.contains(ACCIDENT_REGION_KEYWORD, na=False)
    hotspots: list[dict[str, Any]] = []
    for _, row in df.loc[mask].iterrows():
        try:
            lat = float(row[ACCIDENT_COL_LAT])
            lng = float(row[ACCIDENT_COL_LNG])
        except Exception:
            continue
        hotspots.append(
            {
                "type": str(row.get(ACCIDENT_COL_TYPE, "")).strip(),
                "name": str(row.get(ACCIDENT_COL_NAME, "")).strip(),
                "geometry": parse_accident_polygon(row.get(ACCIDENT_COL_POLYGON), lat, lng),
            }
        )
    return hotspots, f"사고위험 자료 {len(hotspots)}건 사용"


def accident_route_meta(route_coords: list[list[float]], hotspots: list[dict[str, Any]], data_note: str) -> dict[str, Any]:
    if not hotspots:
        return {"flag": pd.NA, "note": data_note}
    route_line = route_linestring_5179(route_coords)
    if route_line is None:
        return {"flag": pd.NA, "note": "경로 geometry 없음"}

    hits = [hotspot for hotspot in hotspots if route_line.intersects(hotspot["geometry"])]
    if not hits:
        return {"flag": False, "note": "사고위험 지점 인접 정보 없음"}
    top_names = ", ".join(hit["name"] for hit in hits[:2] if hit.get("name"))
    extra_count = len(hits) - min(len(hits), 2)
    suffix = f" 외 {extra_count}곳" if extra_count > 0 else ""
    detail = f"사고위험 지점 인접 {len(hits)}곳"
    if top_names:
        detail += f" ({top_names}{suffix})"
    return {"flag": True, "note": detail}


def route_has_large_intersection(graph: nx.MultiDiGraph, route: list[Any]) -> bool:
    for node in route[1:-1]:
        incident_buckets: set[str] = set()
        neighbors = set()
        try:
            neighbors.update(graph.successors(node))
        except Exception:
            pass
        try:
            neighbors.update(graph.predecessors(node))
        except Exception:
            pass
        for neighbor in neighbors:
            bucket = edge_bucket(graph, node, neighbor) or edge_bucket(graph, neighbor, node)
            if bucket in MAJOR_CROSSING_BUCKETS:
                incident_buckets.add(bucket)
        if len(incident_buckets) >= 2:
            return True
    return False


def barrier_label_for_level(level: int | None) -> str:
    labels = {
        0: "보행 부담 낮음",
        1: "일부 보행 부담",
        2: "보행 부담 높음",
        3: "접근 주의",
    }
    return labels.get(level, "자료 없음")


def barrier_summary(counts: dict[str, int], large_intersection: bool, accident_flag: Any, detour_ratio: float | None, level: int | None) -> str:
    if level is None:
        return "자료 없음"

    parts: list[str] = []
    major_count = sum(counts.get(bucket, 0) for bucket in MAJOR_CROSSING_BUCKETS)
    if major_count > 0:
        detail_parts = []
        city_count = counts.get("motorway", 0) + counts.get("trunk", 0) + counts.get("primary", 0)
        if city_count:
            detail_parts.append(f"주요 도시 간선도로 {city_count}회")
        if counts.get("secondary", 0):
            detail_parts.append(f"중간급 간선도로 {counts['secondary']}회")
        parts.append(" · ".join(detail_parts))
    elif counts.get("tertiary", 0) > 0 and level >= 1:
        parts.append(f"지구 내 간선도로 {counts['tertiary']}회")
    if large_intersection:
        parts.append("대형 교차로 인접")
    if accident_flag is True:
        parts.append("사고위험 지점 인접")
    if detour_ratio is not None and detour_ratio >= 1.6:
        parts.append("우회 부담")
    return " · ".join(parts) if parts else barrier_label_for_level(level)


def barrier_description(
    counts: dict[str, int],
    large_intersection: bool,
    accident_flag: Any,
    detour_ratio: float | None,
    level: int | None,
) -> str:
    if level is None:
        return "경로 자료가 없어 보행부담을 추정할 수 없습니다."

    major_count = sum(counts.get(bucket, 0) for bucket in MAJOR_CROSSING_BUCKETS)
    has_detour = detour_ratio is not None and detour_ratio >= 1.6
    has_large_detour = detour_ratio is not None and detour_ratio >= 2.0

    if level == 0:
        return "생활도로 중심의 접근 경로로 보행 부담이 낮은 편입니다."
    if level == 1:
        if detour_ratio is not None and detour_ratio >= 1.3:
            return "간선도로 횡단이나 대형 교차로 인접은 확인되지 않지만, 일부 우회가 포함된 경로입니다."
        return "일부 일반 횡단 또는 지구 내 간선도로 구간이 포함될 수 있습니다."

    if major_count == 0 and not large_intersection and accident_flag is not True and has_detour:
        if has_large_detour:
            return "간선도로 횡단이나 대형 교차로 인접은 확인되지 않지만, 실제 보행 경로가 직선거리 대비 크게 우회하는 것으로 계산됩니다."
        return "간선도로 횡단이나 대형 교차로 인접은 확인되지 않지만, 일부 우회 부담이 확인됩니다."

    parts: list[str] = []
    if major_count > 0:
        parts.append("간선도로 횡단")
    if large_intersection:
        parts.append("대형 교차로 인접")
    if accident_flag is True:
        parts.append("사고위험 지점 인접")
    if has_detour:
        parts.append("우회 부담")

    if parts:
        joined = " · ".join(parts)
        return f"도보 경로에 {joined}이 포함되어, 초등학생 보행 관점에서 접근 품질을 함께 검토해야 합니다."

    return barrier_label_for_level(level)


def compute_barrier_level(counts: dict[str, int], large_intersection: bool, accident_flag: Any, detour_ratio: float | None) -> int:
    major_count = sum(counts.get(bucket, 0) for bucket in MAJOR_CROSSING_BUCKETS)
    primary_or_higher = counts.get("motorway", 0) + counts.get("trunk", 0) + counts.get("primary", 0)

    if (
        major_count >= 2
        or (major_count >= 1 and large_intersection)
        or (major_count >= 1 and accident_flag is True)
        or (detour_ratio is not None and detour_ratio >= 2.0)
        or (primary_or_higher >= 1 and large_intersection)
    ):
        return 3
    if (
        major_count >= 1
        or large_intersection
        or accident_flag is True
        or (detour_ratio is not None and detour_ratio >= 1.6)
    ):
        return 2
    if (detour_ratio is not None and detour_ratio >= 1.3) or counts.get("tertiary", 0) > 0:
        return 1
    return 0


def route_barrier_meta(
    graph: nx.MultiDiGraph,
    school_node: Any,
    school_lat: float,
    school_lng: float,
    park: dict[str, Any] | None,
    prefix: str,
    accident_hotspots: list[dict[str, Any]],
    accident_note: str,
) -> dict[str, Any]:
    empty = {
        f"{prefix}_route_dist_m": pd.NA,
        f"{prefix}_route_detour_ratio": pd.NA,
        f"{prefix}_major_road_crossing_count": pd.NA,
        f"{prefix}_large_intersection_flag": pd.NA,
        f"{prefix}_accident_hotspot_flag": pd.NA,
        f"{prefix}_barrier_level": pd.NA,
        f"{prefix}_barrier_label": "자료 없음",
        f"{prefix}_barrier_summary": "자료 없음",
        f"{prefix}_barrier_description": "경로 자료가 없어 보행부담을 추정할 수 없습니다.",
    }
    if not park or park.get("node") is None:
        return empty

    try:
        route = nx.shortest_path(graph, school_node, int(park["node"]), weight="length")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return empty

    route_dist = route_length_m(graph, route)
    straight_dist = distance_in_meters(school_lat, school_lng, float(park["lat"]), float(park["lng"]))
    detour_ratio = route_dist / straight_dist if straight_dist > 0 else None
    counts = count_route_highway_buckets(graph, route)
    major_count = sum(counts.get(bucket, 0) for bucket in MAJOR_CROSSING_BUCKETS)
    large_intersection = route_has_large_intersection(graph, route)
    coords = route_coordinates(graph, route)
    accident = accident_route_meta(coords, accident_hotspots, accident_note)
    level = compute_barrier_level(counts, large_intersection, accident["flag"], detour_ratio)
    label = barrier_label_for_level(level)
    summary = barrier_summary(counts, large_intersection, accident["flag"], detour_ratio, level)
    description = barrier_description(counts, large_intersection, accident["flag"], detour_ratio, level)

    return {
        f"{prefix}_route_dist_m": round(route_dist, 1),
        f"{prefix}_route_detour_ratio": round(detour_ratio, 3) if detour_ratio is not None else pd.NA,
        f"{prefix}_major_road_crossing_count": int(major_count),
        f"{prefix}_large_intersection_flag": bool(large_intersection),
        f"{prefix}_accident_hotspot_flag": accident["flag"],
        f"{prefix}_barrier_level": int(level),
        f"{prefix}_barrier_label": label,
        f"{prefix}_barrier_summary": summary,
        f"{prefix}_barrier_description": description,
    }


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
        "node": best_node,
        "lat": chosen.get("위도"),
        "lng": chosen.get("경도"),
    }


def compute_nearest_walk_distances(schools: pd.DataFrame, iso: gpd.GeoDataFrame, parks: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    graph_path = resolve_graph_path()
    if graph_path is None:
        return pd.DataFrame({"학교ID": schools["학교ID"]}), "GraphML 파일을 찾지 못해 기능성 공원 최근접 도보거리 산출을 건너뜀"

    graph = ox.load_graphml(graph_path)
    accident_hotspots, accident_note = load_accident_hotspots()
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
        school_lat = float(row["위도"])
        school_lng = float(row["경도"])
        official_route_meta = route_barrier_meta(
            graph,
            school_node,
            school_lat,
            school_lng,
            official,
            "nearest_official",
            accident_hotspots,
            accident_note,
        )
        functional_route_meta = route_barrier_meta(
            graph,
            school_node,
            school_lat,
            school_lng,
            functional,
            "nearest_functional",
            accident_hotspots,
            accident_note,
        )

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
                **official_route_meta,
                **functional_route_meta,
            }
        )

    note = f"GraphML `{graph_path}` 사용, cutoff {WALK_DISTANCE_CUTOFF_M}m; {accident_note}"
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


def is_low_green_warning(row: pd.Series | dict[str, Any]) -> bool:
    bucket = str(row.get("green_bucket", "") or "").strip().lower()
    if bucket in {"low", "middle"}:
        return True
    for col in ("corrected_green_ratio", "iso_green_ratio"):
        value = pd.to_numeric(row.get(col), errors="coerce")
        if pd.notna(value) and float(value) < GREEN_WARNING_THRESHOLD:
            return True
    return False


def is_functional_present(row: dict[str, Any]) -> bool:
    functional_count = pd.to_numeric(row.get("iso_functional_park_count"), errors="coerce")
    functional_dist = pd.to_numeric(row.get("nearest_functional_park_dist_m"), errors="coerce")
    return bool((pd.notna(functional_count) and functional_count > 0) or (pd.notna(functional_dist) and functional_dist <= 500))


def add_green_display_fields(result: pd.DataFrame) -> pd.DataFrame:
    iso_green = pd.to_numeric(
        result["iso_green_ratio"] if "iso_green_ratio" in result.columns else pd.Series(pd.NA, index=result.index),
        errors="coerce",
    )
    corrected_green = pd.to_numeric(
        result["corrected_green_ratio"] if "corrected_green_ratio" in result.columns else pd.Series(pd.NA, index=result.index),
        errors="coerce",
    )
    display_green = corrected_green.where(corrected_green.notna(), iso_green)
    result["display_green_ratio"] = display_green.round(6)

    corrected_differs = corrected_green.notna() & iso_green.notna() & (corrected_green - iso_green).abs().gt(0.005)
    result["green_ratio_display_basis"] = "walk_iso"
    result.loc[corrected_green.notna() & corrected_differs, "green_ratio_display_basis"] = "apartment_adjusted"

    high_review = display_green.ge(GREEN_HIGH_REVIEW_THRESHOLD).fillna(False)
    result["green_ratio_high_review_flag"] = high_review
    result["green_ratio_review_note"] = ""
    result.loc[
        corrected_green.notna() & corrected_differs,
        "green_ratio_review_note",
    ] = "아파트 단지 내부 보행 가능성 보정값을 우선 표시합니다."
    result.loc[
        high_review,
        "green_ratio_review_note",
    ] = "80% 이상 고비율로, 도보권 분모와 공원 추정 폴리곤을 추가 검수해야 합니다."
    return result


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

    official_dist = pd.to_numeric(result["nearest_official_park_dist_m"], errors="coerce")
    functional_dist = pd.to_numeric(result["nearest_functional_park_dist_m"], errors="coerce")
    neighborhood_dist = pd.to_numeric(result["nearest_neighborhood_scale_park_dist_m"], errors="coerce")

    official_present = result["iso_official_park_count"].gt(0) | official_dist.le(500)
    functional_present = result["iso_functional_park_count"].gt(0) | functional_dist.le(500)
    neighborhood_present = result["iso_neighborhood_scale_park_count"].gt(0) | neighborhood_dist.le(500)

    result["no_official_park_flag"] = ~official_present
    result["only_micro_park_flag"] = official_present & ~functional_present
    result["no_functional_park_flag"] = ~functional_present
    result["no_neighborhood_scale_park_flag"] = ~neighborhood_present
    result["activity_space_limited_flag"] = (
        result["nearest_official_park_function_class"].isin(["playground_like", "small_child_park"])
        & (
            functional_dist.isna()
            | functional_dist.gt(500)
        )
    )
    result["nominal_access_gap_flag"] = official_present & ~functional_present
    result["neighborhood_scale_gap_flag"] = functional_present & ~neighborhood_present

    result["near_park_low_green_imbalance_flag"] = functional_present & result.apply(is_low_green_warning, axis=1)
    access_types = []
    for row in result.to_dict("records"):
        if row.get("no_official_park_flag") is True:
            access_types.append("no_official_park")
        elif bool(row.get("only_micro_park_flag") is True):
            access_types.append("nominal_access_only")
        elif bool(row.get("near_park_low_green_imbalance_flag") is True):
            access_types.append("near_park_low_green_imbalance")
        elif is_functional_present(row) and pd.to_numeric(row.get("nearest_functional_barrier_level"), errors="coerce") >= 2:
            access_types.append("functional_access_with_barrier")
        elif is_functional_present(row):
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
        "near_park_low_green_imbalance_flag",
    ]
    for col in bool_cols:
        result[col] = to_bool_series(result[col])

    result = add_green_display_fields(result)

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
        "- 보행부담 컬럼: `nearest_official_*`, `nearest_functional_*` 경로별 산출.",
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
        "near_park_low_green_imbalance_flag",
    ]
    lines.extend(["", "## 학교 플래그 집계", ""])
    for col in flag_cols:
        lines.append(f"- {col}: {int(school_layer[col].fillna(False).astype(bool).sum())}개교")

    high_green = school_layer[school_layer.get("green_ratio_high_review_flag", pd.Series(False, index=school_layer.index)).fillna(False).astype(bool)].copy()
    lines.extend(
        [
            "",
            "## 녹지비율 표시값 검수 플래그",
            "",
            f"- display_green_ratio 80% 이상 검수 대상: {len(high_green)}개교",
            "- 이 플래그는 기존 `iso_green_ratio` 또는 Case를 변경하지 않고, 앱 표시와 해석에서 추가 검수가 필요함을 알리기 위한 보조 정보다.",
            "",
        ]
    )
    if high_green.empty:
        lines.append("- 검수 대상 없음")
    else:
        preview_cols = [
            "학교명",
            "gu",
            "iso_green_ratio",
            "corrected_green_ratio",
            "display_green_ratio",
            "isochrone_area_m2",
            "iso_park_area",
            "green_ratio_review_note",
        ]
        preview_cols = [col for col in preview_cols if col in high_green.columns]
        lines.extend(["| " + " | ".join(preview_cols) + " |", "|" + "|".join(["---"] * len(preview_cols)) + "|"])
        for row in high_green.sort_values("display_green_ratio", ascending=False)[preview_cols].to_dict("records"):
            lines.append("| " + " | ".join(str(row.get(col, "")) for col in preview_cols) + " |")

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


def value_count_table(series: pd.Series) -> str:
    counts = series.value_counts(dropna=False).sort_index()
    lines = ["| 값 | 개수 |", "|---|---:|"]
    for key, value in counts.items():
        label = "NaN" if pd.isna(key) else str(key)
        lines.append(f"| {label} | {int(value)} |")
    return "\n".join(lines)


def write_walking_barrier_report(school_layer: pd.DataFrame, previous_layer: pd.DataFrame | None, graph_note: str) -> None:
    official_level = pd.to_numeric(school_layer.get("nearest_official_barrier_level"), errors="coerce")
    functional_level = pd.to_numeric(school_layer.get("nearest_functional_barrier_level"), errors="coerce")
    official_crossing = pd.to_numeric(school_layer.get("nearest_official_major_road_crossing_count"), errors="coerce")
    functional_crossing = pd.to_numeric(school_layer.get("nearest_functional_major_road_crossing_count"), errors="coerce")
    official_detour = pd.to_numeric(school_layer.get("nearest_official_route_detour_ratio"), errors="coerce")
    functional_detour = pd.to_numeric(school_layer.get("nearest_functional_route_detour_ratio"), errors="coerce")

    if previous_layer is not None and "access_condition_type" in previous_layer.columns:
        before_access = previous_layer[["학교ID", "access_condition_type"]].rename(columns={"access_condition_type": "before"})
        after_access = school_layer[["학교ID", "access_condition_type"]].rename(columns={"access_condition_type": "after"})
        access_compare = before_access.merge(after_access, on="학교ID", how="outer")
        changed = access_compare[access_compare["before"].astype(str) != access_compare["after"].astype(str)].copy()
    else:
        access_compare = pd.DataFrame()
        changed = pd.DataFrame()

    representative = school_layer.sort_values(
        by=[
            "nearest_functional_barrier_level",
            "nearest_functional_major_road_crossing_count",
            "nearest_functional_route_detour_ratio",
        ],
        ascending=[False, False, False],
        na_position="last",
    ).head(10)

    lines = [
        "# 기존 시설 접근성 보행부담 로직 검증",
        "",
        "이번 작업은 기존 후보지 추천의 간선도로 횡단 필터와 별개로, 학교에서 기존 공식 공원과 활동 가능 공원까지의 접근 경로에 대한 보행부담 진단 레이어를 추가한 것이다.",
        "",
        f"- 도보거리 산출 메모: {graph_note}",
        "- 도로등급 표현은 OSM highway class를 보수적으로 번역했다.",
        "- 정확한 횡단보도 위치 자료가 없어 경로 edge 기반 추정값으로 기록한다.",
        "",
        "## barrier_level별 학교 수",
        "",
        "### 최근접 공식 공원",
        "",
        value_count_table(official_level),
        "",
        "### 최근접 활동 가능 공원",
        "",
        value_count_table(functional_level),
        "",
        "## major_road_crossing_count 분포",
        "",
        "### 최근접 공식 공원",
        "",
        value_count_table(official_crossing),
        "",
        "### 최근접 활동 가능 공원",
        "",
        value_count_table(functional_crossing),
        "",
        "## 대형 교차로·사고위험 지점",
        "",
        f"- nearest_official_large_intersection_flag true: {int(school_layer.get('nearest_official_large_intersection_flag', pd.Series(dtype=object)).fillna(False).astype(bool).sum())}개교",
        f"- nearest_functional_large_intersection_flag true: {int(school_layer.get('nearest_functional_large_intersection_flag', pd.Series(dtype=object)).fillna(False).astype(bool).sum())}개교",
        f"- nearest_official_accident_hotspot_flag true: {int(school_layer.get('nearest_official_accident_hotspot_flag', pd.Series(dtype=object)).fillna(False).astype(bool).sum())}개교",
        f"- nearest_functional_accident_hotspot_flag true: {int(school_layer.get('nearest_functional_accident_hotspot_flag', pd.Series(dtype=object)).fillna(False).astype(bool).sum())}개교",
        "",
        "## detour_ratio 분포",
        "",
        "| 경로 | min | median | max | non-null |",
        "|---|---:|---:|---:|---:|",
    ]
    for label, series in [("최근접 공식 공원", official_detour), ("최근접 활동 가능 공원", functional_detour)]:
        valid = series.dropna()
        if valid.empty:
            lines.append(f"| {label} | - | - | - | 0 |")
        else:
            lines.append(f"| {label} | {valid.min():.3f} | {valid.median():.3f} | {valid.max():.3f} | {len(valid)} |")

    lines.extend(
        [
            "",
            "## access_condition_type 변경 전후 비교",
            "",
            f"- 변경 학교 수: {len(changed)}",
            "",
            "| before | after | 개수 |",
            "|---|---|---:|",
        ]
    )
    if changed.empty:
        lines.append("| 변경 없음 | 변경 없음 | 0 |")
    else:
        grouped = changed.groupby(["before", "after"], dropna=False).size().reset_index(name="count")
        for row in grouped.to_dict("records"):
            lines.append(f"| {row.get('before')} | {row.get('after')} | {int(row.get('count'))} |")

    lines.extend(
        [
            "",
            "## 대표 사례 10개",
            "",
            "| 학교명 | 최근접 활동 가능 공원 | 거리(m) | 보행부담 | 횡단횟수 | 경로 특성 | 접근성 유형 |",
            "|---|---|---:|---|---:|---|---|",
        ]
    )
    for row in representative.to_dict("records"):
        lines.append(
            f"| {row.get('학교명')} | {row.get('nearest_functional_park_name') or '-'} | "
            f"{row.get('nearest_functional_park_dist_m') if pd.notna(row.get('nearest_functional_park_dist_m')) else '-'} | "
            f"{row.get('nearest_functional_barrier_label') or '-'} | "
            f"{row.get('nearest_functional_major_road_crossing_count') if pd.notna(row.get('nearest_functional_major_road_crossing_count')) else '-'} | "
            f"{row.get('nearest_functional_barrier_summary') or '-'} | "
            f"{row.get('access_condition_label') or '-'} |"
        )

    juan = school_layer.loc[school_layer["학교명"].eq("인천주안초등학교")]
    lines.extend(["", "## 지정 검증: 인천주안초등학교", ""])
    if juan.empty:
        lines.append("- 인천주안초등학교 행을 찾지 못함")
    else:
        row = juan.iloc[0]
        lines.extend(
            [
                f"- 최근접 공식 공원: {row.get('nearest_official_park_name')} / {row.get('nearest_official_park_dist_m')}m / {row.get('nearest_official_park_area_m2')}㎡",
                f"- 최근접 활동 가능 공원: {row.get('nearest_functional_park_name')} / {row.get('nearest_functional_park_dist_m')}m",
                f"- no_official_park_flag: {row.get('no_official_park_flag')}",
                f"- no_functional_park_flag: {row.get('no_functional_park_flag')}",
                f"- access_condition_type: {row.get('access_condition_type')}",
            ]
        )

    WALKING_BARRIER_REPORT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    previous_school_layer = read_csv(SCHOOL_LAYER_PATH) if SCHOOL_LAYER_PATH.exists() else None
    backup_paths = backup_existing_outputs(
        [PARKS_WITH_CLASS_PATH, SCHOOL_LAYER_PATH, OUTLIER_PATH, AI_BEFORE_AFTER_CSV_PATH],
        "functional_park_layer_update",
    )

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
    text_cols = [
        col
        for col in school_layer.columns
        if school_layer[col].dtype == object or pd.api.types.is_string_dtype(school_layer[col].dtype)
    ]
    school_layer.loc[:, text_cols] = school_layer.loc[:, text_cols].replace(
        {
            ("공원 접근 " + "불가"): "공원 접근 결핍",
            ("도시 " + "대로"): "주요 도시 간선도로",
            ("중간급 " + "도로"): "중간급 간선도로",
        },
        regex=True,
    )
    school_layer.to_csv(SCHOOL_LAYER_PATH, index=False, encoding="utf-8-sig")

    _, ai_note = build_ai_before_after(school_layer)
    write_validation_report(parks, school_layer, outliers, before_priority, graph_note, ai_note)
    write_walking_barrier_report(school_layer, previous_school_layer, graph_note)

    print(f"wrote {PARKS_WITH_CLASS_PATH}")
    print(f"wrote {SCHOOL_LAYER_PATH}")
    print(f"wrote {OUTLIER_PATH}")
    print(f"wrote {MAPPING_REPORT_PATH}")
    print(f"wrote {VALIDATION_REPORT_PATH}")
    print(f"wrote {WALKING_BARRIER_REPORT_PATH}")
    if backup_paths:
        print(f"backups: {[str(path) for path in backup_paths]}")
    print(f"park_function_class counts: {parks['park_function_class'].value_counts().to_dict()}")
    print(f"access_condition_type counts: {school_layer['access_condition_type'].value_counts().to_dict()}")
    print(f"outlier rows: {len(outliers)}")


if __name__ == "__main__":
    main()
