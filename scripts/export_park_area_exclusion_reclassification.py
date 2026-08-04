from __future__ import annotations

import math
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
PRIORITY = ROOT / "data_processed" / "school_priority_with_functional_park_layer.csv"
ZONES = ROOT / "data_processed" / "school_isochrone_500m.geojson"
PARKS = ROOT / "data_processed" / "parks_with_function_class.csv"
OUT_DIR = ROOT / "outputs" / "park_area_exclusion_reclassification"

CRS_METRIC = "EPSG:5179"
SCENARIOS = [
    {
        "scenario": "current",
        "label": "현재",
        "exclude_classes": [],
    },
    {
        "scenario": "exclude_playground_like",
        "label": "놀이터급 제외",
        "exclude_classes": ["playground_like"],
    },
    {
        "scenario": "exclude_playground_and_small_child",
        "label": "소규모 이하 제외",
        "exclude_classes": ["playground_like", "small_child_park"],
    },
]
CASE_ORDER = ["1", "2", "3", "4"]
CASE_LABELS = {
    "1": "Case 1",
    "2": "Case 2",
    "3": "Case 3",
    "4": "Case 4",
}
COLORS = {
    "1": "#bf4b2b",
    "2": "#e57552",
    "3": "#abc4d8",
    "4": "#4c72aa",
}


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


def normalize_case(value: object) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text if text in set(CASE_ORDER) else ""


def case_from_scenario_ratio(green_ratio: float, park_count: int) -> str:
    if green_ratio <= 1e-9 and park_count <= 0:
        return "1"
    if green_ratio < 1:
        return "2"
    if green_ratio < 5:
        return "3"
    return "4"


def load_active_priority() -> pd.DataFrame:
    priority = pd.read_csv(PRIORITY, encoding="utf-8-sig")
    active = priority[
        priority["is_separate_bundle_tag"].eq(0) & priority["case_type"].notna()
    ].copy().reset_index(drop=True)
    active["current_case"] = active["case_type"].map(normalize_case)
    return active[active["current_case"].isin(CASE_ORDER)].copy()


def load_park_proxy_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(PARKS, encoding="utf-8-sig")
    lat_col = parks.columns[3]
    lon_col = parks.columns[4]
    area_col = parks.columns[5]
    parks[area_col] = pd.to_numeric(parks[area_col], errors="coerce").fillna(0.0)
    valid = parks[
        pd.to_numeric(parks[lat_col], errors="coerce").notna()
        & pd.to_numeric(parks[lon_col], errors="coerce").notna()
    ].copy()
    gdf = gpd.GeoDataFrame(
        valid,
        geometry=gpd.points_from_xy(valid[lon_col], valid[lat_col]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    radius = np.sqrt(gdf[area_col] / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def excluded_area_by_school(
    zones: gpd.GeoDataFrame,
    parks: gpd.GeoDataFrame,
    classes: list[str],
) -> pd.DataFrame:
    school_id_col = zones.columns[0]
    if not classes:
        return pd.DataFrame(
            {
                school_id_col: zones[school_id_col].astype(str),
                "excluded_area_m2": 0.0,
                "excluded_park_count": 0,
            }
        )

    subset = parks[parks["park_function_class"].isin(classes)].copy()
    rows: list[dict[str, object]] = []
    for row in zones[[school_id_col, "geometry"]].itertuples(index=False):
        school_id = str(getattr(row, school_id_col))
        zone = row.geometry
        candidates = subset[subset.intersects(zone)]
        if candidates.empty:
            rows.append(
                {
                    school_id_col: school_id,
                    "excluded_area_m2": 0.0,
                    "excluded_park_count": 0,
                }
            )
            continue

        excluded_union = unary_union(candidates.geometry)
        intersection = zone.intersection(excluded_union)
        excluded_area = 0.0 if intersection.is_empty else float(intersection.area)
        rows.append(
            {
                school_id_col: school_id,
                "excluded_area_m2": excluded_area,
                "excluded_park_count": int(len(candidates)),
            }
        )
    return pd.DataFrame(rows)


def included_park_count_by_school(
    zones: gpd.GeoDataFrame,
    parks: gpd.GeoDataFrame,
    excluded_classes: list[str],
) -> pd.DataFrame:
    school_id_col = zones.columns[0]
    subset = parks[~parks["park_function_class"].isin(excluded_classes)].copy()
    rows: list[dict[str, object]] = []
    for row in zones[[school_id_col, "geometry"]].itertuples(index=False):
        school_id = str(getattr(row, school_id_col))
        zone = row.geometry
        rows.append(
            {
                school_id_col: school_id,
                "included_park_count": int(subset.intersects(zone).sum()),
            }
        )
    return pd.DataFrame(rows)


def build_scenario_frame() -> pd.DataFrame:
    active = load_active_priority()
    school_id_col = active.columns[0]
    active_ids = set(active[school_id_col].astype(str))

    zones = gpd.read_file(ZONES).to_crs(CRS_METRIC)
    zones = zones[zones[school_id_col].astype(str).isin(active_ids)].copy()
    parks = load_park_proxy_polygons()

    base = active.copy()
    base[school_id_col] = base[school_id_col].astype(str)
    zone_area = pd.to_numeric(base["isochrone_area_m2"], errors="coerce")
    current_ratio = pd.to_numeric(base["display_green_ratio"], errors="coerce").fillna(0.0)
    current_area = (current_ratio / 100.0 * zone_area).fillna(0.0)

    rows: list[pd.DataFrame] = []
    for scenario in SCENARIOS:
        excluded = excluded_area_by_school(zones, parks, scenario["exclude_classes"])
        included_counts = included_park_count_by_school(zones, parks, scenario["exclude_classes"])
        scenario_frame = base.merge(excluded, on=school_id_col, how="left").merge(included_counts, on=school_id_col, how="left")
        excluded_area = pd.to_numeric(scenario_frame["excluded_area_m2"], errors="coerce").fillna(0.0)
        scenario_area = (current_area - excluded_area).clip(lower=0.0)
        scenario_ratio = np.where(
            zone_area.to_numpy() > 0,
            scenario_area.to_numpy() / zone_area.to_numpy() * 100.0,
            0.0,
        )
        scenario_park_count = pd.to_numeric(scenario_frame["included_park_count"], errors="coerce").fillna(0).astype(int)

        if scenario["scenario"] == "current":
            scenario_case = scenario_frame["current_case"].tolist()
        else:
            raw_case = [
                case_from_scenario_ratio(float(green_ratio), int(park_count))
                for green_ratio, park_count in zip(scenario_ratio, scenario_park_count)
            ]
            scenario_changed = excluded_area.gt(1e-6) | scenario_frame["excluded_park_count"].fillna(0).astype(int).gt(0)
            scenario_case = [
                str(min(int(current), int(scenario))) if changed else str(current)
                for current, scenario, changed in zip(scenario_frame["current_case"], raw_case, scenario_changed)
            ]

        out = pd.DataFrame(
            {
                "school_id": scenario_frame[school_id_col].astype(str),
                "school_name": scenario_frame["학교명"],
                "gu": scenario_frame["gu"],
                "scenario": scenario["scenario"],
                "scenario_label": scenario["label"],
                "current_case": scenario_frame["current_case"],
                "scenario_case": scenario_case,
                "operational_green_area_m2": current_area.round(4),
                "scenario_excluded_area_m2": excluded_area.round(4),
                "scenario_green_area_m2": scenario_area.round(4),
                "scenario_green_ratio": pd.Series(scenario_ratio).round(6),
                "excluded_park_count": scenario_frame["excluded_park_count"].fillna(0).astype(int),
                "included_park_count": scenario_park_count,
            }
        )
        rows.append(out)

    return pd.concat(rows, ignore_index=True)


def write_counts(frame: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    total_by_scenario = frame.groupby("scenario").size().to_dict()
    for scenario in SCENARIOS:
        scenario_rows = frame[frame["scenario"].eq(scenario["scenario"])]
        counts = scenario_rows["scenario_case"].value_counts().reindex(CASE_ORDER, fill_value=0)
        total = total_by_scenario[scenario["scenario"]]
        for case in CASE_ORDER:
            rows.append(
                {
                    "scenario": scenario["scenario"],
                    "scenario_label": scenario["label"],
                    "case": CASE_LABELS[case],
                    "case_type": case,
                    "school_count": int(counts[case]),
                    "share_pct": round(float(counts[case] / total * 100.0), 1),
                }
            )
    counts_df = pd.DataFrame(rows)
    counts_df.to_csv(
        OUT_DIR / "park_area_exclusion_case_counts.csv",
        index=False,
        encoding="utf-8-sig",
    )
    return counts_df


def write_transitions(frame: pd.DataFrame) -> None:
    for scenario in ["exclude_playground_like", "exclude_playground_and_small_child"]:
        scenario_rows = frame[frame["scenario"].eq(scenario)]
        transition = pd.crosstab(
            scenario_rows["current_case"],
            scenario_rows["scenario_case"],
        ).reindex(index=CASE_ORDER, columns=CASE_ORDER, fill_value=0)
        transition.index.name = "current_case"
        transition.to_csv(
            OUT_DIR / f"park_area_exclusion_transition_{scenario}.csv",
            encoding="utf-8-sig",
        )


def draw_chart(counts_df: pd.DataFrame) -> None:
    setup_style()
    fig, ax = plt.subplots(figsize=(8.38, 3.65), dpi=180)
    fig.patch.set_facecolor("white")
    fig.patch.set_edgecolor("#3f3f3f")
    fig.patch.set_linewidth(1.2)

    x = range(len(SCENARIOS))
    bottoms = [0] * len(SCENARIOS)
    width = 0.58

    for case in CASE_ORDER:
        values = []
        for scenario in SCENARIOS:
            value = counts_df[
                counts_df["scenario"].eq(scenario["scenario"])
                & counts_df["case_type"].eq(case)
            ]["school_count"].iloc[0]
            values.append(int(value))

        bars = ax.bar(
            x,
            values,
            width,
            bottom=bottoms,
            color=COLORS[case],
            edgecolor="white",
            linewidth=1.6,
            label=CASE_LABELS[case],
        )
        for idx, (bar, value) in enumerate(zip(bars, values)):
            if value <= 0:
                continue
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bottoms[idx] + value / 2,
                str(value),
                ha="center",
                va="center",
                fontsize=10.2,
                fontweight="bold",
                color="white",
            )
        bottoms = [bottom + value for bottom, value in zip(bottoms, values)]

    ax.set_title("소규모 공원 면적 제외 후 case 재분류", fontsize=14, fontweight="bold", color="#26384f", pad=20)
    ax.set_ylabel("학교 수 (242교 기준)", fontsize=10.5, color="#26384f", labelpad=6)
    ax.set_xticks(list(x))
    ax.set_xticklabels([scenario["label"] for scenario in SCENARIOS], fontsize=10, color="#26384f")
    ax.set_ylim(0, 265)
    ax.set_yticks([0, 50, 100, 150, 200, 250])
    ax.tick_params(axis="y", labelsize=9, colors="#26384f")
    ax.tick_params(axis="x", colors="#26384f")
    ax.yaxis.grid(True, color="#d8dde6", linewidth=0.9)
    ax.set_axisbelow(True)

    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#9aa8bb")
    ax.spines["bottom"].set_color("#9aa8bb")
    ax.legend(
        ncol=4,
        loc="upper center",
        bbox_to_anchor=(0.5, 1.12),
        frameon=False,
        fontsize=9,
    )
    fig.text(
        0.08,
        0.035,
        "제외 대상 공원 proxy 면적을 기존 운영 도보권 녹지면적에서 차감해 재분류. 시나리오는 녹지비율 기준, 별도 묶음 제외 242교.",
        fontsize=8.8,
        color="#5b6678",
    )
    fig.subplots_adjust(left=0.08, right=0.985, bottom=0.2, top=0.82)
    fig.savefig(OUT_DIR / "park_area_exclusion_case_reclassification.png", facecolor="white")
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    frame = build_scenario_frame()
    frame.to_csv(
        OUT_DIR / "park_area_exclusion_reclassified_by_school.csv",
        index=False,
        encoding="utf-8-sig",
    )
    counts_df = write_counts(frame)
    write_transitions(frame)
    draw_chart(counts_df)
    print(counts_df.pivot(index="scenario_label", columns="case", values="school_count").to_string())
    print(f"saved: {OUT_DIR}")


if __name__ == "__main__":
    main()
