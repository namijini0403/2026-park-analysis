from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
OUTPUT = ROOT / "output"

GRAPHML_PATH = DATA / "incheon_walk_graph_v2.graphml"
SCHOOLS_PATH = DATA / "schools.csv"
PARKS_PATH = DATA / "parks.csv"
NEAREST_PARK_PATH = DATA / "school_nearest_park.csv"

DETAIL_OUT = OUTPUT / "school_park_path_barriers_20260418.csv"
SUMMARY_JSON_OUT = OUTPUT / "school_park_path_barriers_summary_20260418.json"
SUMMARY_MD_OUT = OUTPUT / "school_park_path_barriers_summary_20260418.md"

CRS_WGS84 = "EPSG:4326"
CRS_METRIC = "EPSG:5179"

USER_LABELS = {
    "motorway": "주요 도시 간선도로 (보행부담 큼)",
    "trunk": "주요 도시 간선도로 (보행부담 큼)",
    "primary": "주요 도시 간선도로 (보행부담 검토)",
    "secondary": "중간급 간선도로 (주의 필요)",
    "tertiary": "지구 내 간선도로 (보행 가능)",
}

COUNT_KEYS = ["motorway", "trunk", "primary", "secondary", "tertiary"]


@dataclass
class ParkCandidate:
    name: str
    lat: float
    lon: float
    nearest_node: int


def build_points(df: pd.DataFrame, x_col: str, y_col: str) -> gpd.GeoDataFrame:
    return gpd.GeoDataFrame(
        df.copy(),
        geometry=gpd.points_from_xy(df[x_col], df[y_col]),
        crs=CRS_WGS84,
    ).to_crs(CRS_METRIC)


def canonicalize_highway(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, (list, tuple, set)):
        values = [str(item).strip().lower() for item in value]
    else:
        values = [str(value).strip().lower()]

    severity_order = [
        ("motorway", "motorway"),
        ("motorway_link", "motorway"),
        ("trunk", "trunk"),
        ("trunk_link", "trunk"),
        ("primary", "primary"),
        ("primary_link", "primary"),
        ("secondary", "secondary"),
        ("secondary_link", "secondary"),
        ("tertiary", "tertiary"),
        ("tertiary_link", "tertiary"),
    ]
    for raw_value, normalized in severity_order:
        if raw_value in values:
            return normalized
    return None


def select_edge_data(multiedge_dict: dict) -> dict:
    if not multiedge_dict:
        return {}
    return min(
        multiedge_dict.values(),
        key=lambda edge_data: float(edge_data.get("length", float("inf"))),
    )


def iter_path_edge_data(graph: nx.MultiGraph, path: list[int]) -> Iterable[dict]:
    for u, v in zip(path, path[1:]):
        edge_bundle = graph.get_edge_data(u, v, default={})
        if not edge_bundle:
            continue
        yield select_edge_data(edge_bundle)


def count_crossings_on_path(graph: nx.MultiGraph, path: list[int]) -> dict[str, int]:
    counts = {key: 0 for key in COUNT_KEYS}
    for edge_data in iter_path_edge_data(graph, path):
        normalized = canonicalize_highway(edge_data.get("highway"))
        if normalized in counts:
            counts[normalized] += 1
    return counts


def make_path_summary(counts: dict[str, int]) -> str:
    messages: list[str] = []
    for key in COUNT_KEYS:
        count = counts.get(key, 0)
        if count <= 0:
            continue
        label = USER_LABELS[key].split(" (")[0]
        messages.append(f"{label} {count}회")
    return " / ".join(messages) if messages else "해당 없음"


def build_park_index(gdf_parks: gpd.GeoDataFrame) -> dict[str, list[ParkCandidate]]:
    park_index: dict[str, list[ParkCandidate]] = defaultdict(list)
    for row in gdf_parks.itertuples(index=False):
        park_index[row.공원명].append(
            ParkCandidate(
                name=str(row.공원명),
                lat=float(row.위도),
                lon=float(row.경도),
                nearest_node=int(row.nearest_node),
            )
        )
    return park_index


def choose_matching_park_candidate(
    graph: nx.MultiGraph,
    school_node: int,
    school_name: str,
    nearest_park_name: str,
    nearest_distance_m: float | None,
    park_candidates: list[ParkCandidate],
) -> tuple[ParkCandidate | None, float | None, list[int] | None, str | None]:
    best_candidate: ParkCandidate | None = None
    best_length: float | None = None
    best_path: list[int] | None = None
    best_score: tuple[float, float] | None = None

    for candidate in park_candidates:
        try:
            path = nx.shortest_path(
                graph,
                source=school_node,
                target=candidate.nearest_node,
                weight="length",
            )
            path_length = nx.path_weight(graph, path, weight="length")
        except nx.NetworkXNoPath:
            continue

        if nearest_distance_m is None or pd.isna(nearest_distance_m):
            score = (path_length, path_length)
        else:
            score = (abs(path_length - float(nearest_distance_m)), path_length)

        if best_score is None or score < best_score:
            best_candidate = candidate
            best_length = float(path_length)
            best_path = path
            best_score = score

    if best_candidate is None:
        return None, None, None, f"no_path_to_named_park:{school_name}->{nearest_park_name}"

    return best_candidate, best_length, best_path, None


def summarize(detail_df: pd.DataFrame) -> dict:
    analyzed = detail_df[detail_df["analysis_status"] == "ok"].copy()

    summary = {
        "total_school_rows": int(len(detail_df)),
        "analyzed_school_rows": int(len(analyzed)),
        "unmatched_school_rows": int((detail_df["analysis_status"] != "ok").sum()),
        "count_keys": COUNT_KEYS,
        "user_labels": USER_LABELS,
        "schools_with_any": {},
        "schools_with_major_barrier": 0,
        "schools_with_any_caution_barrier": 0,
        "top_major_barrier_schools": [],
    }

    for key in COUNT_KEYS:
        summary["schools_with_any"][key] = int((analyzed[key] > 0).sum())

    major_mask = (analyzed["motorway"] + analyzed["trunk"] + analyzed["primary"]) > 0
    caution_mask = (analyzed["motorway"] + analyzed["trunk"] + analyzed["primary"] + analyzed["secondary"]) > 0
    summary["schools_with_major_barrier"] = int(major_mask.sum())
    summary["schools_with_any_caution_barrier"] = int(caution_mask.sum())

    top_df = analyzed.assign(
        major_barrier_total=analyzed["motorway"] + analyzed["trunk"] + analyzed["primary"],
        total_barrier_total=analyzed[COUNT_KEYS].sum(axis=1),
    ).sort_values(
        by=["major_barrier_total", "primary", "trunk", "secondary", "tertiary", "nearest_park_dist_m"],
        ascending=[False, False, False, False, False, False],
    )
    summary["top_major_barrier_schools"] = top_df.loc[
        top_df["major_barrier_total"] > 0,
        ["학교ID", "학교명", "nearest_park_name", "nearest_park_dist_m", "major_barrier_total", "path_barrier_summary"],
    ].head(20).to_dict("records")

    unmatched = detail_df.loc[detail_df["analysis_status"] != "ok", ["학교ID", "학교명", "nearest_park_name", "analysis_status"]]
    summary["unmatched_examples"] = unmatched.head(20).to_dict("records")
    return summary


def write_summary_markdown(summary: dict) -> None:
    lines = [
        "# 학교-최근접 공원 경로 보행부담 요소 요약",
        "",
        f"- 전체 학교 행: {summary['total_school_rows']}",
        f"- 분석 성공: {summary['analyzed_school_rows']}",
        f"- 분석 예외: {summary['unmatched_school_rows']}",
        "",
        "## 등급별 학교 수",
    ]
    for key in COUNT_KEYS:
        lines.append(f"- {USER_LABELS[key]}: {summary['schools_with_any'][key]}개교")
    lines.extend(
        [
            "",
            f"- 주요 보행부담 요소(motorway·trunk·primary) 포함 학교: {summary['schools_with_major_barrier']}개교",
            f"- 주의 요소까지 포함(secondary 이상) 학교: {summary['schools_with_any_caution_barrier']}개교",
            "",
            "## 주요 학교 예시",
        ]
    )
    for item in summary["top_major_barrier_schools"]:
        lines.append(
            f"- {item['학교명']} ({item['nearest_park_name']}, {item['nearest_park_dist_m']}m): {item['path_barrier_summary']}"
        )

    if summary["unmatched_examples"]:
        lines.extend(["", "## 분석 예외 예시"])
        for item in summary["unmatched_examples"]:
            lines.append(
                f"- {item['학교명']} ({item['nearest_park_name']}): {item['analysis_status']}"
            )

    SUMMARY_MD_OUT.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    print("[1/6] loading CSVs")
    schools = pd.read_csv(SCHOOLS_PATH, encoding="utf-8-sig")
    parks = pd.read_csv(PARKS_PATH, encoding="utf-8-sig")
    nearest = pd.read_csv(NEAREST_PARK_PATH, encoding="utf-8-sig")

    print("[2/6] projecting points and snapping nearest nodes")
    gdf_schools = build_points(schools, "경도", "위도")
    gdf_parks = build_points(parks, "경도", "위도")

    graph = ox.load_graphml(GRAPHML_PATH)
    graph_proj = ox.project_graph(graph, to_crs=CRS_METRIC)
    graph_proj = ox.convert.to_undirected(graph_proj)

    gdf_schools["nearest_node"] = ox.distance.nearest_nodes(
        graph_proj,
        X=gdf_schools.geometry.x.to_list(),
        Y=gdf_schools.geometry.y.to_list(),
    )
    gdf_parks["nearest_node"] = ox.distance.nearest_nodes(
        graph_proj,
        X=gdf_parks.geometry.x.to_list(),
        Y=gdf_parks.geometry.y.to_list(),
    )

    print("[3/6] building lookup tables")
    school_nodes = dict(zip(gdf_schools["학교ID"], gdf_schools["nearest_node"]))
    park_index = build_park_index(gdf_parks)

    print("[4/6] counting path barriers")
    records: list[dict[str, object]] = []
    total = len(nearest)
    for idx, row in enumerate(nearest.itertuples(index=False), start=1):
        school_id = row.학교ID
        school_name = row.학교명
        park_name = row.nearest_park_name
        nearest_distance = row.nearest_park_dist_m
        school_node = school_nodes.get(school_id)
        candidates = park_index.get(park_name, [])

        base_record = {
            "학교ID": school_id,
            "학교명": school_name,
            "nearest_park_name": park_name,
            "nearest_park_dist_m": nearest_distance,
            "matched_park_candidate_count": len(candidates),
            "matched_path_distance_m": None,
            "analysis_status": "ok",
            "path_barrier_summary": "해당 없음",
        }
        base_record.update({key: 0 for key in COUNT_KEYS})

        if school_node is None:
            base_record["analysis_status"] = "school_node_not_found"
            records.append(base_record)
            continue

        if not candidates:
            base_record["analysis_status"] = "nearest_park_name_not_in_parks_csv"
            records.append(base_record)
            continue

        matched_candidate, matched_length, matched_path, error = choose_matching_park_candidate(
            graph=graph_proj,
            school_node=int(school_node),
            school_name=str(school_name),
            nearest_park_name=str(park_name),
            nearest_distance_m=float(nearest_distance) if pd.notna(nearest_distance) else None,
            park_candidates=candidates,
        )
        if error or matched_candidate is None or matched_path is None:
            base_record["analysis_status"] = error or "path_match_failed"
            records.append(base_record)
            continue

        counts = count_crossings_on_path(graph_proj, matched_path)
        base_record.update(counts)
        base_record["matched_path_distance_m"] = round(float(matched_length), 1) if matched_length is not None else None
        base_record["analysis_status"] = "ok"
        base_record["path_barrier_summary"] = make_path_summary(counts)
        records.append(base_record)

        if idx % 25 == 0 or idx == total:
            print(f"  processed {idx}/{total}")

    print("[5/6] writing detail outputs")
    detail_df = pd.DataFrame(records)
    detail_df["major_barrier_total"] = detail_df["motorway"] + detail_df["trunk"] + detail_df["primary"]
    detail_df["caution_barrier_total"] = detail_df["major_barrier_total"] + detail_df["secondary"]
    detail_df.to_csv(DETAIL_OUT, index=False, encoding="utf-8-sig")

    print("[6/6] writing summaries")
    summary = summarize(detail_df)
    SUMMARY_JSON_OUT.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    write_summary_markdown(summary)

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
