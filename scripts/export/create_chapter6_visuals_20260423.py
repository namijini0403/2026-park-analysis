from __future__ import annotations

import math
from pathlib import Path

import geopandas as gpd
import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import osmnx as ox
import pandas as pd
from matplotlib.patches import Patch
from scipy.stats import gaussian_kde
from shapely.geometry import Point


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data/processed"
OUTPUT_DIR = BASE_DIR / "output" / "chapter6_visuals"
CRS_METRIC = "EPSG:5179"

BLUE = "#3B82F6"
GREEN = "#10B981"
RED = "#EF4444"
DARK = "#111827"
GRAY = "#6B7280"
LIGHT_GRAY = "#E5E7EB"

FONT_PATHS = [
    Path("C:/Windows/Fonts/malgun.ttf"),
    Path("C:/Windows/Fonts/NotoSansKR-VF.ttf"),
]


def setup_font() -> fm.FontProperties:
    for path in FONT_PATHS:
        if path.exists():
            prop = fm.FontProperties(fname=str(path))
            plt.rcParams["font.family"] = prop.get_name()
            plt.rcParams["axes.unicode_minus"] = False
            return prop
    plt.rcParams["axes.unicode_minus"] = False
    return fm.FontProperties()


FONT = setup_font()
FONT_SMALL = fm.FontProperties(fname=str(FONT_PATHS[0]), size=7.5) if FONT_PATHS[0].exists() else fm.FontProperties(size=7.5)
FONT_MED = fm.FontProperties(fname=str(FONT_PATHS[0]), size=8.5) if FONT_PATHS[0].exists() else fm.FontProperties(size=8.5)
FONT_BOLD = fm.FontProperties(fname=str(FONT_PATHS[0]), size=9.2, weight="bold") if FONT_PATHS[0].exists() else fm.FontProperties(size=9.2, weight="bold")


def save_fig(fig: plt.Figure, path: Path) -> None:
    fig.patch.set_facecolor("white")
    for ax in fig.axes:
        ax.set_facecolor("white")
    fig.savefig(
        path,
        dpi=300,
        transparent=False,
        facecolor="white",
        bbox_inches="tight",
        pad_inches=0.04,
    )
    plt.close(fig)


def load_core() -> pd.DataFrame:
    path = OUTPUT_DIR.parent / "buffer_500m_vs_walk_500m_green_ratio_20260423.csv"
    df = pd.read_csv(path)
    return df[df["is_core_case"].astype(str).str.lower().eq("true")].copy()


def draw_kde(ax: plt.Axes, values: pd.Series, color: str, label: str) -> None:
    clean = pd.to_numeric(values, errors="coerce").dropna()
    clean = clean[(clean >= 0) & (clean <= 100)]
    xs = np.linspace(0, 60, 400)
    kde = gaussian_kde(clean)
    ys = kde(xs)
    ax.fill_between(xs, ys, color=color, alpha=0.22, linewidth=0)
    ax.plot(xs, ys, color=color, linewidth=2.4, label=label)


def fig_distribution(core: pd.DataFrame) -> None:
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    draw_kde(ax, core["buffer_green_ratio"], BLUE, "반경 500m")
    draw_kde(ax, core["walk_green_ratio"], GREEN, "도보 500m")

    buffer_mean = float(core["buffer_green_ratio"].mean())
    walk_mean = float(core["walk_green_ratio"].mean())
    ax.axvline(buffer_mean, color=BLUE, linestyle=(0, (4, 3)), linewidth=1.7)
    ax.axvline(walk_mean, color=GREEN, linestyle=(0, (4, 3)), linewidth=1.7)
    ax.text(
        buffer_mean + 1,
        ax.get_ylim()[1] * 0.82,
        f"반경 평균 {buffer_mean:.2f}%",
        color=BLUE,
        fontproperties=FONT_MED,
    )
    ax.text(
        walk_mean + 1,
        ax.get_ylim()[1] * 0.68,
        f"도보 평균 {walk_mean:.2f}%",
        color=GREEN,
        fontproperties=FONT_MED,
    )

    ax.text(
        0.98,
        0.93,
        "반경으로는 풍부, 도보로는 절반 이하",
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontproperties=FONT_BOLD,
        color=DARK,
    )
    ax.set_xlim(0, 60)
    ax.set_xlabel("녹지 비율 (%)", fontproperties=FONT_MED)
    ax.set_ylabel("밀도", fontproperties=FONT_MED)
    ax.grid(axis="y", color=LIGHT_GRAY, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.legend(loc="upper right", bbox_to_anchor=(0.98, 0.78), frameon=False, prop=FONT_SMALL)
    ax.tick_params(labelsize=7.5)
    save_fig(fig, OUTPUT_DIR / "fig_radius_vs_walk_distribution.png")
    print(f"[fig1] 반경 평균={buffer_mean:.2f}%, 도보 평균={walk_mean:.2f}%")


def fig_case_bars(core: pd.DataFrame) -> pd.DataFrame:
    case_stats = (
        core.groupby("case_type")
        .agg(
            n=("학교ID", "count"),
            buffer_mean=("buffer_green_ratio", "mean"),
            walk_mean=("walk_green_ratio", "mean"),
            loss_mean=("buffer_to_walk_loss_pp", "mean"),
        )
        .reset_index()
        .sort_values("case_type")
    )

    x = np.arange(len(case_stats))
    width = 0.34
    fig, ax = plt.subplots(figsize=(6.4, 3.6))
    b1 = ax.bar(
        x - width / 2,
        case_stats["buffer_mean"],
        width,
        color=BLUE,
        alpha=0.9,
        label="반경 500m",
    )
    b2 = ax.bar(
        x + width / 2,
        case_stats["walk_mean"],
        width,
        color=GREEN,
        alpha=0.9,
        label="도보 500m",
    )

    for bars in [b1, b2]:
        for bar in bars:
            h = bar.get_height()
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                h + 0.8,
                f"{h:.1f}",
                ha="center",
                va="bottom",
                fontsize=7.2,
                color=DARK,
                fontproperties=FONT_SMALL,
            )

    y_top = max(case_stats["buffer_mean"].max(), case_stats["walk_mean"].max()) + 8
    for i, row in case_stats.iterrows():
        idx = int(row["case_type"]) - 1
        is_case4 = int(row["case_type"]) == 4
        ax.text(
            idx,
            y_top - 2.0,
            f"손실 {row['loss_mean']:.2f}%p",
            ha="center",
            va="center",
            fontsize=7.7,
            color="white" if is_case4 else DARK,
            bbox=dict(
                boxstyle="round,pad=0.25",
                facecolor=RED if is_case4 else "#F3F4F6",
                edgecolor="none",
                alpha=0.95,
            ),
            fontproperties=FONT_SMALL,
        )

    labels = [
        f"Case{int(r.case_type)}\n(n={int(r.n)})" for r in case_stats.itertuples(index=False)
    ]
    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontproperties=FONT_MED)
    ax.set_ylim(0, y_top + 3)
    ax.set_ylabel("녹지 비율 (%)", fontproperties=FONT_MED)
    ax.text(
        0.5,
        0.96,
        "도보 접근성이 양호한 Case4에서 착시가 가장 크다",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontproperties=FONT_BOLD,
        color=DARK,
    )
    ax.legend(loc="upper left", bbox_to_anchor=(0.01, 0.89), frameon=False, prop=FONT_SMALL)
    ax.grid(axis="y", color=LIGHT_GRAY, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(labelsize=7.5)
    save_fig(fig, OUTPUT_DIR / "fig_case_level_loss.png")

    print("[fig2] Case별 평균")
    for r in case_stats.itertuples(index=False):
        print(
            f"  Case{int(r.case_type)} n={int(r.n)} "
            f"반경={r.buffer_mean:.2f}% 도보={r.walk_mean:.2f}% 손실={r.loss_mean:.2f}%p"
        )
    return case_stats


def fig_case_loss_alt(case_stats: pd.DataFrame) -> None:
    colors = ["#FCA5A5", "#F87171", "#EF4444", "#B91C1C"]
    fig, ax = plt.subplots(figsize=(5.8, 3.2))
    x = np.arange(len(case_stats))
    bars = ax.bar(x, case_stats["loss_mean"], color=colors, width=0.58)
    for bar, row in zip(bars, case_stats.itertuples(index=False)):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.6,
            f"{row.loss_mean:.2f}%p",
            ha="center",
            va="bottom",
            fontsize=7.8,
            fontweight="bold" if int(row.case_type) == 4 else "normal",
            color=DARK,
            fontproperties=FONT_SMALL,
        )
    ax.set_xticks(x)
    ax.set_xticklabels(
        [f"Case{int(r.case_type)}\n(n={int(r.n)})" for r in case_stats.itertuples(index=False)],
        fontproperties=FONT,
    )
    ax.set_ylabel("평균 손실 (%p)", fontproperties=FONT_MED)
    ax.text(
        0.5,
        0.95,
        "Case가 좋아질수록 반경 착시는 더 커진다",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontproperties=FONT_BOLD,
        color=DARK,
    )
    ax.grid(axis="y", color=LIGHT_GRAY, linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    save_fig(fig, OUTPUT_DIR / "fig_case_loss_only_alt.png")


def park_polygons() -> gpd.GeoDataFrame:
    parks = pd.read_csv(DATA_DIR / "parks.csv")
    parks = parks[parks["시설유형"].ne("놀이터")].copy()
    gdf = gpd.GeoDataFrame(
        parks,
        geometry=gpd.points_from_xy(parks["경도"], parks["위도"]),
        crs="EPSG:4326",
    ).to_crs(CRS_METRIC)
    radius = np.sqrt(gdf["공원면적"].fillna(0) / math.pi).clip(lower=10)
    gdf["geometry"] = gdf.geometry.buffer(radius)
    return gdf


def load_roads() -> gpd.GeoDataFrame | None:
    graph_path = DATA_DIR / "incheon_walk_graph_v2.graphml"
    if not graph_path.exists():
        graph_path = DATA_DIR / "incheon_walk_graph.graphml"
    if not graph_path.exists():
        return None
    graph = ox.load_graphml(graph_path)
    _, edges = ox.graph_to_gdfs(graph)
    if edges.crs is None:
        edges = edges.set_crs("EPSG:4326")
    return edges.to_crs(CRS_METRIC)


def highway_is_major(value: object) -> bool:
    major = {"motorway", "trunk", "primary", "secondary"}
    if isinstance(value, list):
        return any(str(v) in major for v in value)
    return str(value) in major


def fig_extreme_map(core: pd.DataFrame) -> None:
    target_name = "인천장도초등학교"
    row = core.loc[core["학교명"].eq(target_name)].iloc[0]
    school_id = row["학교ID"]

    schools = pd.read_csv(DATA_DIR / "schools.csv")
    school = schools.loc[schools["학교ID"].eq(school_id)].iloc[0]
    school_pt = gpd.GeoSeries(
        [Point(float(school["경도"]), float(school["위도"]))], crs="EPSG:4326"
    ).to_crs(CRS_METRIC).iloc[0]

    buffer_gdf = gpd.read_file(DATA_DIR / "school_buffer_500m.geojson").to_crs(CRS_METRIC)
    iso_gdf = gpd.read_file(DATA_DIR / "isochrone_corrected.geojson").to_crs(CRS_METRIC)
    target_buffer = buffer_gdf[buffer_gdf["학교ID"].eq(school_id)]
    target_iso = iso_gdf[iso_gdf["학교ID"].eq(school_id)]

    extent = school_pt.buffer(760).bounds
    clip_box = gpd.GeoSeries([school_pt.buffer(760)], crs=CRS_METRIC)
    parks = park_polygons()
    local_parks = gpd.clip(parks, clip_box)
    roads = load_roads()
    if roads is not None:
        local_roads = gpd.clip(roads, clip_box)
        major_roads = local_roads[local_roads["highway"].apply(highway_is_major)]
    else:
        local_roads = None
        major_roads = None

    fig, ax = plt.subplots(figsize=(6.8, 4.3))
    if local_roads is not None and not local_roads.empty:
        local_roads.plot(ax=ax, color="#D1D5DB", linewidth=0.45, alpha=0.55, zorder=1)
    if major_roads is not None and not major_roads.empty:
        major_roads.plot(ax=ax, color=RED, linewidth=1.8, alpha=0.75, zorder=2)

    local_parks.plot(ax=ax, color="#047857", alpha=0.68, edgecolor="#065F46", linewidth=0.4, zorder=3)
    target_buffer.plot(ax=ax, color=BLUE, alpha=0.16, edgecolor=BLUE, linewidth=2.0, zorder=4)
    target_iso.plot(ax=ax, color=GREEN, alpha=0.24, edgecolor=GREEN, linewidth=2.0, zorder=5)
    ax.scatter(
        [school_pt.x],
        [school_pt.y],
        s=72,
        color="black",
        edgecolor="white",
        linewidth=1.5,
        zorder=6,
    )
    ax.text(
        school_pt.x + 22,
        school_pt.y + 22,
        target_name,
        fontproperties=FONT_MED,
        color=DARK,
        zorder=7,
    )

    text = (
        f"반경 기준 녹지: {row['buffer_green_ratio']:.1f}%\n"
        f"도보 기준 녹지: {row['walk_green_ratio']:.1f}%\n"
        f"손실: {row['buffer_to_walk_loss_pp']:.1f}%p"
    )
    ax.text(
        0.03,
        0.96,
        text,
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontproperties=FONT_MED,
        color=DARK,
        bbox=dict(boxstyle="round,pad=0.45", facecolor="white", edgecolor="none", alpha=0.86),
        zorder=8,
    )
    ax.text(
        0.5,
        -0.04,
        "인천장도초등학교 — 반경 안의 녹지가 실제 도보로는 도달하기 어렵다",
        transform=ax.transAxes,
        ha="center",
        va="top",
        fontproperties=FONT_BOLD,
        color=DARK,
    )

    handles = [
        Patch(facecolor=BLUE, edgecolor=BLUE, alpha=0.18, label="반경 500m"),
        Patch(facecolor=GREEN, edgecolor=GREEN, alpha=0.28, label="도보 500m"),
        Patch(facecolor="#047857", edgecolor="#065F46", alpha=0.68, label="공원/녹지"),
        Patch(facecolor=RED, edgecolor=RED, alpha=0.75, label="간선도로"),
    ]
    ax.legend(handles=handles, loc="lower right", frameon=True, framealpha=0.84, prop=FONT_SMALL)
    ax.set_xlim(extent[0], extent[2])
    ax.set_ylim(extent[1], extent[3])
    ax.set_aspect("equal")
    ax.axis("off")
    save_fig(fig, OUTPUT_DIR / "fig_extreme_case_map.png")
    print(
        f"[fig3] {target_name} 반경={row['buffer_green_ratio']:.2f}% "
        f"도보={row['walk_green_ratio']:.2f}% 손실={row['buffer_to_walk_loss_pp']:.2f}%p"
    )


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    core = load_core()
    fig_distribution(core)
    case_stats = fig_case_bars(core)
    fig_case_loss_alt(case_stats)
    fig_extreme_map(core)
    print(f"저장 폴더: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
