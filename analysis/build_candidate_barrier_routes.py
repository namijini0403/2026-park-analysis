from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import networkx as nx
import osmnx as ox
import pandas as pd


BASE = Path(__file__).resolve().parents[1]
GRAPH_PATH = BASE / "data_processed" / "incheon_walk_graph_v2.graphml"
SCHOOLS_PATH = BASE / "data_processed" / "schools.csv"
CANDIDATES_PATH = BASE / "data_processed" / "candidate_grid_xgb_v4.geojson"
OUTPUT_JSON_PATH = BASE / "data_processed" / "candidate_barrier_routes_by_school.json"
OUTPUT_CSV_PATH = BASE / "output" / "candidate_barrier_routes_by_school.csv"

HIGHWAY_BUCKETS = ("motorway", "trunk", "primary", "secondary", "tertiary")
SEVERITY_ORDER = {
    "green": 0,
    "yellow": 1,
    "orange": 2,
    "red": 3,
}


def normalize_highway(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        normalized = [normalize_highway(item) for item in value]
        normalized = [item for item in normalized if item]
        if not normalized:
            return None
        return max(normalized, key=lambda item: bucket_rank(item))

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


def count_barriers(graph: nx.MultiDiGraph, route: list[int]) -> dict[str, int]:
    counts = {bucket: 0 for bucket in HIGHWAY_BUCKETS}
    for left, right in zip(route, route[1:]):
        bucket = edge_bucket(graph, left, right)
        if bucket in counts:
            counts[bucket] += 1
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
        "red": "자동차 전용 간선/고속도로 포함",
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
            parts.append(f"고속도로 수준 {counts['motorway']}회")
        if counts["trunk"] > 0:
            parts.append(f"자동차 전용 간선도로 수준 {counts['trunk']}회")
        return "이 후보지까지 가는 경로에는 " + ", ".join(parts) + "가 포함되어 보행 부담이 매우 큽니다."

    parts = []
    if counts["primary"] > 0:
        parts.append(f"도시 대로 {counts['primary']}회")
    if counts["secondary"] > 0:
        parts.append(f"중간급 도로 {counts['secondary']}회")

    if not parts:
        return "큰 도로 횡단이 없어 생활도로 중심으로 이동할 수 있습니다."

    return "이 후보지까지 가려면 " + ", ".join(parts) + "를 지나야 합니다."


def route_coordinates(graph: nx.MultiDiGraph, route: list[int]) -> list[list[float]]:
    coords: list[list[float]] = []
    for node in route:
        node_data = graph.nodes[node]
        coords.append([round(float(node_data["y"]), 6), round(float(node_data["x"]), 6)])
    return coords


def main() -> None:
    schools_df = pd.read_csv(SCHOOLS_PATH)
    candidate_geojson = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))

    schools_by_name = {
        str(row["학교명"]).strip(): {
            "school_id": str(row["학교ID"]).strip(),
            "school_name": str(row["학교명"]).strip(),
            "lat": float(row["위도"]),
            "lng": float(row["경도"]),
        }
        for _, row in schools_df.iterrows()
        if pd.notna(row["학교ID"]) and pd.notna(row["위도"]) and pd.notna(row["경도"])
    }

    graph = ox.load_graphml(GRAPH_PATH)

    candidate_rows: list[dict[str, Any]] = []
    for feature in candidate_geojson.get("features", []):
        props = feature.get("properties", {})
        linked_schools = parse_linked_schools(props.get("linked_schools"))
        if not linked_schools:
            continue
        candidate_rows.append(
            {
                "grid_id": str(props["grid_id"]).strip(),
                "lat": float(props["cy"]),
                "lng": float(props["cx"]),
                "linked_schools": linked_schools,
            }
        )

    school_node_cache: dict[str, int] = {}
    candidate_node_cache: dict[str, int] = {}
    output: dict[str, dict[str, Any]] = {}
    flat_rows: list[dict[str, Any]] = []

    for candidate in candidate_rows:
        grid_id = candidate["grid_id"]
        candidate_node = candidate_node_cache.get(grid_id)
        if candidate_node is None:
            candidate_node = ox.distance.nearest_nodes(graph, candidate["lng"], candidate["lat"])
            candidate_node_cache[grid_id] = int(candidate_node)

        for school_name in candidate["linked_schools"]:
            school_info = schools_by_name.get(school_name)
            if not school_info:
                continue

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
            record = {
                "severity": severity,
                "severity_label": severity_label(severity),
                "color": severity_color(severity),
                "note": build_note(counts, severity),
                "counts": counts,
                "route_length_m": round(route_length_m(graph, route), 1),
                "route_coords": route_coordinates(graph, route),
            }

            output.setdefault(school_id, {})[grid_id] = record
            flat_rows.append(
                {
                    "school_id": school_id,
                    "school_name": school_name,
                    "grid_id": grid_id,
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
        "severity_counts": {
            severity: sum(1 for row in flat_rows if row["severity"] == severity)
            for severity in ("green", "yellow", "orange", "red")
        },
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
