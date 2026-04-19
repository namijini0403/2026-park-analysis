from __future__ import annotations

import json
import math
import re
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import pandas as pd
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import transform as shapely_transform


BASE = Path(__file__).resolve().parents[1]
GRAPH_PATH = BASE / "data_processed" / "incheon_walk_graph_v2.graphml"
SCHOOLS_PATH = BASE / "data_processed" / "schools.csv"
SCHOOL_PRIORITY_PATH = BASE / "data_processed" / "school_priority.csv"
CANDIDATES_PATH = BASE / "data_processed" / "candidate_grid_final.geojson"
OUTPUT_JSON_PATH = BASE / "data_processed" / "candidate_barrier_routes_by_school.json"
OUTPUT_CSV_PATH = BASE / "output" / "candidate_barrier_routes_by_school.csv"
MIN_CANDIDATES_PER_CASE123_SCHOOL = 6
ACCIDENT_DATA_FILENAME = (
    "\uC804\uAD6D\uAD50\uD1B5\uC0AC\uACE0\uB2E4\uBC1C\uC9C0\uC5ED\uD45C\uC900\uB370\uC774\uD130.csv"
)
ACCIDENT_REGION_KEYWORD = "\uC778\uCC9C"
ACCIDENT_COL_REGION = "\uC0AC\uACE0\uB2E4\uBC1C\uC9C0\uC5ED\uC2DC\uB3C4\uC2DC\uAD70\uAD6C"
ACCIDENT_COL_TYPE = "\uC0AC\uACE0\uC720\uD615\uAD6C\uBD84"
ACCIDENT_COL_NAME = "\uC0AC\uACE0\uC9C0\uC5ED\uC704\uCE58\uBA85"
ACCIDENT_COL_LAT = "\uC704\uB3C4"
ACCIDENT_COL_LNG = "\uACBD\uB3C4"
ACCIDENT_COL_POLYGON = "\uC0AC\uACE0\uB2E4\uBC1C\uC9C0\uC5ED\uD3F4\uB9AC\uACE4\uC815\uBCF4"

HIGHWAY_BUCKETS = ("motorway", "trunk", "primary", "secondary", "tertiary")
TO_EPSG5179 = Transformer.from_crs("EPSG:4326", "EPSG:5179", always_xy=True)


def normalize_highway(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        normalized = [normalize_highway(item) for item in value]
        normalized = [item for item in normalized if item]
        if not normalized:
            return None
        return max(normalized, key=bucket_rank)

    text = str(value).strip().lower()
    if not text:
        return None
    if text.endswith("_link"):
        text = text[:-5]
    if text in HIGHWAY_BUCKETS:
        return text
    if text in {"residential", "living_street", "unclassified", "road", "service"}:
        return "tertiary"
    return None


def bucket_rank(bucket: str) -> int:
    if bucket in {"motorway", "trunk"}:
        return 4
    if bucket == "primary":
        return 3
    if bucket == "secondary":
        return 2
    if bucket == "tertiary":
        return 1
    return 0


def parse_linked_schools(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    text = str(value or "").strip()
    if not text:
        return []

    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except json.JSONDecodeError:
        pass

    matches = re.findall(r"np\.str_\('([^']+)'\)", text)
    if matches:
        return [name.strip() for name in matches if name.strip()]

    return [name.strip() for name in re.findall(r"'([^']+)'", text) if name.strip()]


def edge_bucket(graph: nx.MultiDiGraph, left: int, right: int) -> str | None:
    edge_data = graph.get_edge_data(left, right)
    if not edge_data:
        return None

    best_bucket = None
    best_rank = -1
    for attrs in edge_data.values():
        bucket = normalize_highway(attrs.get("highway"))
        rank = bucket_rank(bucket or "")
        if rank > best_rank:
            best_bucket = bucket
            best_rank = rank
    return best_bucket


def edge_road_label(graph: nx.MultiDiGraph, left: int, right: int) -> str | None:
    edge_data = graph.get_edge_data(left, right)
    if not edge_data:
        return None

    labels: list[str] = []
    for attrs in edge_data.values():
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

    if not labels:
        return None
    return " | ".join(sorted(set(labels)))


def count_barriers(graph: nx.MultiDiGraph, route: list[int]) -> dict[str, int]:
    counts = {bucket: 0 for bucket in HIGHWAY_BUCKETS}
    last_signature: tuple[str, str | None] | None = None
    for left, right in zip(route, route[1:]):
        bucket = edge_bucket(graph, left, right)
        if bucket in counts:
            road_label = edge_road_label(graph, left, right)
            signature = (bucket, road_label)
            if signature != last_signature:
                counts[bucket] += 1
                last_signature = signature
        else:
            last_signature = None
    return counts


def route_length_m(graph: nx.MultiDiGraph, route: list[int]) -> float:
    total = 0.0
    for left, right in zip(route, route[1:]):
        edge_data = graph.get_edge_data(left, right) or {}
        lengths = [
            float(attrs.get("length", 0))
            for attrs in edge_data.values()
            if attrs.get("length") is not None
        ]
        if lengths:
            total += min(lengths)
    return total


def severity_from_counts(counts: dict[str, int]) -> str:
    if counts["motorway"] > 0 or counts["trunk"] > 0:
        return "red"
    if counts["primary"] > 0:
        return "orange"
    if counts["secondary"] > 0:
        return "yellow"
    return "green"


def severity_label(severity: str) -> str:
    labels = {
        "green": "큰 도로 횡단 없음",
        "yellow": "중간급 도로 횡단",
        "orange": "도시 대로 횡단",
        "red": "자동차 전용 간선/고속화도로 포함",
    }
    return labels[severity]


def severity_color(severity: str) -> str:
    colors = {
        "green": "#2E8B57",
        "yellow": "#D4A017",
        "orange": "#E67E22",
        "red": "#C0392B",
    }
    return colors[severity]


def build_note(counts: dict[str, int], severity: str) -> str:
    if severity == "green":
        return "큰 도로 횡단이 없어 생활도로 중심으로 이동할 수 있습니다."

    if severity == "red":
        parts = []
        if counts["motorway"] > 0:
            parts.append(f"고속화도로 계열 {counts['motorway']}회")
        if counts["trunk"] > 0:
            parts.append(f"자동차 전용 간선도로 {counts['trunk']}회")
        return "후보지까지 가는 경로에는 " + ", ".join(parts) + "가 포함되어 보행 부담이 매우 큽니다."

    parts = []
    if counts["primary"] > 0:
        parts.append(f"도시 대로 {counts['primary']}회")
    if counts["secondary"] > 0:
        parts.append(f"중간급 도로 {counts['secondary']}회")

    if not parts:
        return "큰 도로 횡단이 없어 생활도로 중심으로 이동할 수 있습니다."

    return "후보지까지 가려면 " + ", ".join(parts) + "를 지나야 합니다."


def route_coordinates(graph: nx.MultiDiGraph, route: list[int]) -> list[list[float]]:
    coords: list[list[float]] = []
    for node in route:
        node_data = graph.nodes[node]
        coords.append([round(float(node_data["y"]), 6), round(float(node_data["x"]), 6)])
    return coords


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


def load_accident_hotspots() -> list[dict[str, Any]]:
    accident_path = BASE / "data_raw" / ACCIDENT_DATA_FILENAME
    if not accident_path.exists():
        return []

    df = pd.read_csv(accident_path, encoding="cp949")
    mask = df[ACCIDENT_COL_REGION].astype(str).str.contains(ACCIDENT_REGION_KEYWORD, na=False)
    hotspots: list[dict[str, Any]] = []
    for _, row in df.loc[mask].iterrows():
        lat = float(row[ACCIDENT_COL_LAT])
        lng = float(row[ACCIDENT_COL_LNG])
        hotspots.append(
            {
                "type": str(row[ACCIDENT_COL_TYPE]).strip(),
                "name": str(row[ACCIDENT_COL_NAME]).strip(),
                "region": str(row[ACCIDENT_COL_REGION]).strip(),
                "geometry": parse_accident_polygon(row.get(ACCIDENT_COL_POLYGON), lat, lng),
            }
        )
    return hotspots


def route_linestring_5179(route_coords: list[list[float]]) -> LineString | None:
    if len(route_coords) < 2:
        return None

    lon_lat = []
    for point in route_coords:
        if not isinstance(point, list) or len(point) != 2:
            continue
        lat, lng = point
        lon_lat.append((float(lng), float(lat)))

    if len(lon_lat) < 2:
        return None
    return shapely_transform(TO_EPSG5179.transform, LineString(lon_lat))


def accident_route_meta(route_coords: list[list[float]], hotspots: list[dict[str, Any]]) -> dict[str, Any]:
    route_line = route_linestring_5179(route_coords)
    if route_line is None:
        return {"accident_hotspot_flag": False, "accident_hotspot_text": None}

    hits = [hotspot for hotspot in hotspots if route_line.intersects(hotspot["geometry"])]
    if not hits:
        return {"accident_hotspot_flag": False, "accident_hotspot_text": None}

    def summarize_accident_type(raw_type: str) -> str:
        normalized = str(raw_type).strip()
        if normalized == "보행어린이":
            return "보행어린이"
        if normalized == "스쿨존어린이":
            return "스쿨존어린이"
        if normalized == "자전거":
            return "자전거"
        return "보행사고다발지역"

    type_counts = pd.Series([summarize_accident_type(hit["type"]) for hit in hits]).value_counts()
    top_names = ", ".join(hit["name"] for hit in hits[:2])
    extra_count = len(hits) - min(len(hits), 2)
    count_summary = ", ".join(f"{label} {count}곳" for label, count in type_counts.items())
    extra_suffix = f" 외 {extra_count}곳" if extra_count > 0 else ""
    text = f"사고다발지역 {len(hits)}곳 경유: {count_summary} ({top_names}{extra_suffix})"
    return {
        "accident_hotspot_flag": True,
        "accident_hotspot_text": text,
        "accident_hotspot_hit_count": int(len(hits)),
    }


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


def load_school_lookup() -> dict[str, dict[str, Any]]:
    schools_df = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    school_priority_df = pd.read_csv(SCHOOL_PRIORITY_PATH, encoding="utf-8-sig")

    school_id_col = schools_df.columns[0]
    school_name_col = schools_df.columns[1]
    school_lat_col = schools_df.columns[2]
    school_lng_col = schools_df.columns[3]
    priority_id_col = school_priority_df.columns[0]

    school_case_type = {
        str(row[priority_id_col]).strip(): int(float(row["case_type"]))
        for _, row in school_priority_df.iterrows()
        if pd.notna(row.get("case_type")) and str(row[priority_id_col]).strip()
    }

    return {
        str(row[school_name_col]).strip(): {
            "school_id": str(row[school_id_col]).strip(),
            "school_name": str(row[school_name_col]).strip(),
            "lat": float(row[school_lat_col]),
            "lng": float(row[school_lng_col]),
            "case_type": school_case_type.get(str(row[school_id_col]).strip()),
        }
        for _, row in schools_df.iterrows()
        if pd.notna(row[school_id_col]) and pd.notna(row[school_lat_col]) and pd.notna(row[school_lng_col])
    }


def load_candidate_rows() -> tuple[list[dict[str, Any]], dict[str, list[str]]]:
    candidate_geojson = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    candidate_rows: list[dict[str, Any]] = []
    school_to_direct_candidates: dict[str, list[str]] = {}

    for feature in candidate_geojson.get("features", []):
        props = feature.get("properties", {})
        grid_id = str(props["grid_id"]).strip()
        linked_schools = parse_linked_schools(props.get("linked_schools"))
        candidate_rows.append(
            {
                "grid_id": grid_id,
                "lat": float(props["cy"]),
                "lng": float(props["cx"]),
                "linked_schools": linked_schools,
                "candidate_rank": float(
                    props.get("candidate_rank_mixed", props.get("candidate_rank", 999999))
                ),
            }
        )
        for school_name in linked_schools:
            school_to_direct_candidates.setdefault(school_name, []).append(grid_id)

    return candidate_rows, school_to_direct_candidates


def build_supplemental_candidate_map(
    schools_by_name: dict[str, dict[str, Any]],
    candidate_rows: list[dict[str, Any]],
    school_to_direct_candidates: dict[str, list[str]],
) -> dict[str, list[str]]:
    school_to_supplemental_candidates: dict[str, list[str]] = {}

    for school_name, school_info in schools_by_name.items():
        case_type = school_info.get("case_type")
        if case_type not in {1, 2, 3}:
            continue

        direct_ids = school_to_direct_candidates.get(school_name, [])
        if len(direct_ids) >= MIN_CANDIDATES_PER_CASE123_SCHOOL:
            continue

        existing_ids = set(direct_ids)
        ranked_candidates: list[tuple[float, float, str]] = []
        for candidate in candidate_rows:
            grid_id = candidate["grid_id"]
            if grid_id in existing_ids:
                continue
            ranked_candidates.append(
                (
                    distance_in_meters(
                        school_info["lat"],
                        school_info["lng"],
                        candidate["lat"],
                        candidate["lng"],
                    ),
                    candidate["candidate_rank"],
                    grid_id,
                )
            )

        ranked_candidates.sort(key=lambda item: (item[0], item[1], item[2]))
        needed = max(0, MIN_CANDIDATES_PER_CASE123_SCHOOL - len(direct_ids))
        school_to_supplemental_candidates[school_name] = [
            grid_id for _, _, grid_id in ranked_candidates[:needed]
        ]

    return school_to_supplemental_candidates


def main() -> None:
    schools_by_name = load_school_lookup()
    candidate_rows, school_to_direct_candidates = load_candidate_rows()
    candidate_by_id = {candidate["grid_id"]: candidate for candidate in candidate_rows}
    school_to_supplemental_candidates = build_supplemental_candidate_map(
        schools_by_name,
        candidate_rows,
        school_to_direct_candidates,
    )
    accident_hotspots = load_accident_hotspots()

    graph = ox.load_graphml(GRAPH_PATH)
    school_node_cache: dict[str, int] = {}
    candidate_node_cache: dict[str, int] = {}
    output: dict[str, dict[str, Any]] = {}
    flat_rows: list[dict[str, Any]] = []

    school_candidate_pairs: list[tuple[str, str, bool]] = []
    for school_name, direct_ids in school_to_direct_candidates.items():
        for grid_id in direct_ids:
            school_candidate_pairs.append((school_name, grid_id, False))
    for school_name, supplemental_ids in school_to_supplemental_candidates.items():
        for grid_id in supplemental_ids:
            school_candidate_pairs.append((school_name, grid_id, True))

    for school_name, grid_id, is_supplemental in school_candidate_pairs:
        school_info = schools_by_name.get(school_name)
        candidate = candidate_by_id.get(grid_id)
        if not school_info or not candidate:
            continue

        candidate_node = candidate_node_cache.get(grid_id)
        if candidate_node is None:
            candidate_node = ox.distance.nearest_nodes(graph, candidate["lng"], candidate["lat"])
            candidate_node_cache[grid_id] = int(candidate_node)

        school_id = school_info["school_id"]
        school_node = school_node_cache.get(school_id)
        if school_node is None:
            school_node = ox.distance.nearest_nodes(graph, school_info["lng"], school_info["lat"])
            school_node_cache[school_id] = int(school_node)

        try:
            route = nx.shortest_path(graph, school_node, candidate_node, weight="length")
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue

        counts = count_barriers(graph, route)
        severity = severity_from_counts(counts)
        route_coords = route_coordinates(graph, route)
        accident_meta = accident_route_meta(route_coords, accident_hotspots)
        record = {
            "severity": severity,
            "severity_label": severity_label(severity),
            "color": severity_color(severity),
            "note": build_note(counts, severity),
            "counts": counts,
            "route_length_m": round(route_length_m(graph, route), 1),
            "route_coords": route_coords,
            **accident_meta,
        }

        output.setdefault(school_id, {})[grid_id] = record
        flat_rows.append(
            {
                "school_id": school_id,
                "school_name": school_name,
                "grid_id": grid_id,
                "is_supplemental": is_supplemental,
                "severity": severity,
                "severity_label": record["severity_label"],
                "motorway": counts["motorway"],
                "trunk": counts["trunk"],
                "primary": counts["primary"],
                "secondary": counts["secondary"],
                "tertiary": counts["tertiary"],
                "route_length_m": record["route_length_m"],
                "route_point_count": len(record["route_coords"]),
                "note": record["note"],
                "accident_hotspot_flag": record.get("accident_hotspot_flag", False),
                "accident_hotspot_text": record.get("accident_hotspot_text"),
            }
        )

    OUTPUT_JSON_PATH.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    pd.DataFrame(flat_rows).to_csv(OUTPUT_CSV_PATH, index=False, encoding="utf-8-sig")

    summary = {
        "schools": len(output),
        "routes": len(flat_rows),
        "supplemental_routes": sum(1 for row in flat_rows if row["is_supplemental"]),
        "severity_counts": {
            severity: sum(1 for row in flat_rows if row["severity"] == severity)
            for severity in ("green", "yellow", "orange", "red")
        },
        "accident_hotspot_routes": sum(
            1 for row in flat_rows if bool(row.get("accident_hotspot_flag"))
        ),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
