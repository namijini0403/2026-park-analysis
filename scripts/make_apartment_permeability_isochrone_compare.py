from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import FancyBboxPatch, Patch
from shapely.geometry import Point


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "robust_xai" / "ppt_assets"

ORIGINAL_ISO = ROOT / "data_processed" / "school_isochrone_500m.geojson"
ADJUSTED_ISO = ROOT / "data_processed" / "school_isochrone_500m_apt_adjusted_20260504.geojson"
BUFFER_500M = ROOT / "data_processed" / "school_buffer_500m.geojson"
SCHOOLS = ROOT / "data_processed" / "schools.csv"
ADJUSTMENT = ROOT / "data_processed" / "school_walk_500m_apartment_adjustment_20260504.csv"
RESIDENTIAL = ROOT / "data_processed" / "incheon_residential_osm.geojson"
SCHOOL_POLYGONS = ROOT / "data_processed" / "osm_school_polygons_incheon.geojson"

METRIC_CRS = "EPSG:5179"
ROAD_CACHE_DIR = ROOT / "outputs" / "robust_xai" / "ppt_assets" / "osm_road_cache"


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"


def read_layers() -> dict[str, gpd.GeoDataFrame | pd.DataFrame]:
    original = gpd.read_file(ORIGINAL_ISO).to_crs(METRIC_CRS)
    adjusted = gpd.read_file(ADJUSTED_ISO).to_crs(METRIC_CRS)
    buffer = gpd.read_file(BUFFER_500M).to_crs(METRIC_CRS)
    residential = gpd.read_file(RESIDENTIAL).to_crs(METRIC_CRS)
    school_polygons = gpd.read_file(SCHOOL_POLYGONS).to_crs(METRIC_CRS)
    schools = pd.read_csv(SCHOOLS)
    adjustment = pd.read_csv(ADJUSTMENT)
    school_points = gpd.GeoDataFrame(
        schools,
        geometry=[Point(xy) for xy in zip(schools["경도"], schools["위도"])],
        crs="EPSG:4326",
    ).to_crs(METRIC_CRS)
    return {
        "original": original,
        "adjusted": adjusted,
        "buffer": buffer,
        "residential": residential,
        "school_polygons": school_polygons,
        "school_points": school_points,
        "adjustment": adjustment,
    }


def fetch_osm_roads(lat: float, lon: float, slug: str) -> gpd.GeoDataFrame:
    cache = ROAD_CACHE_DIR / f"{slug}_roads.geojson"
    if cache.exists():
        return gpd.read_file(cache).to_crs(METRIC_CRS)

    try:
        import osmnx as ox

        ROAD_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        ox.settings.use_cache = True
        ox.settings.log_console = False
        graph = ox.graph_from_point((lat, lon), dist=760, network_type="walk", simplify=True)
        _, edges = ox.graph_to_gdfs(graph)
        edges = edges.reset_index(drop=True).to_crs(METRIC_CRS)
        edges.to_file(cache, driver="GeoJSON")
        return edges
    except Exception as error:
        print(f"[warn] OSM road fetch failed for {slug}: {error}")
        return gpd.GeoDataFrame({"highway": []}, geometry=[], crs=METRIC_CRS)


def draw_roads(ax, roads: gpd.GeoDataFrame) -> None:
    if roads.empty:
        return

    def road_rank(value: object) -> str:
        if isinstance(value, list):
            value = value[0] if value else ""
        text = str(value)
        if any(key in text for key in ["motorway", "trunk", "primary"]):
            return "major"
        if any(key in text for key in ["secondary", "tertiary"]):
            return "mid"
        if any(key in text for key in ["footway", "path", "pedestrian", "steps", "cycleway"]):
            return "walk"
        return "local"

    roads = roads.copy()
    roads["road_rank"] = roads.get("highway", "").apply(road_rank)
    styles = {
        "major": {"color": "#f59e0b", "linewidth": 2.0, "alpha": 0.58, "zorder": 3.7},
        "mid": {"color": "#fbbf24", "linewidth": 1.35, "alpha": 0.5, "zorder": 3.6},
        "local": {"color": "#cbd5e1", "linewidth": 0.9, "alpha": 0.62, "zorder": 3.5},
        "walk": {"color": "#94a3b8", "linewidth": 0.58, "alpha": 0.48, "zorder": 3.4},
    }
    for rank, style in styles.items():
        subset = roads[roads["road_rank"] == rank]
        if not subset.empty:
            subset.plot(ax=ax, **style)


def one_row(layer: gpd.GeoDataFrame, school_id: str) -> gpd.GeoDataFrame:
    row = layer[layer["학교ID"].astype(str) == school_id]
    if row.empty:
        raise ValueError(f"missing school_id in layer: {school_id}")
    return row


def plot_school(layers: dict[str, gpd.GeoDataFrame | pd.DataFrame], school_id: str, slug: str) -> Path:
    original = one_row(layers["original"], school_id)
    adjusted = one_row(layers["adjusted"], school_id)
    buffer = one_row(layers["buffer"], school_id)
    point = one_row(layers["school_points"], school_id)
    stats = layers["adjustment"][layers["adjustment"]["학교ID"].astype(str) == school_id].iloc[0]
    roads = fetch_osm_roads(float(point.iloc[0]["위도"]), float(point.iloc[0]["경도"]), slug)

    original_geom = original.geometry.iloc[0]
    adjusted_geom = adjusted.geometry.iloc[0]
    added_geom = adjusted_geom.difference(original_geom)

    extent_geom = buffer.geometry.iloc[0].buffer(170)
    residential = layers["residential"][layers["residential"].intersects(extent_geom)].copy()
    school_polygons = layers["school_polygons"][layers["school_polygons"].intersects(extent_geom)].copy()

    fig, ax = plt.subplots(figsize=(13.33, 7.5), dpi=180)
    ax.set_aspect("equal")
    ax.set_facecolor("#f7fafc")

    buffer.boundary.plot(ax=ax, color="#94a3b8", linewidth=1.0, linestyle="--", alpha=0.74, zorder=1)
    if not residential.empty:
        residential.plot(ax=ax, color="#e9eef5", edgecolor="#cbd5e1", linewidth=0.32, alpha=0.78, zorder=2)
    if not school_polygons.empty:
        school_polygons.plot(ax=ax, color="#fef3c7", edgecolor="#d6a23f", linewidth=0.42, alpha=0.68, zorder=3)

    draw_roads(ax, roads)

    gpd.GeoSeries([adjusted_geom], crs=METRIC_CRS).plot(
        ax=ax, color="#6ee7b7", edgecolor="#10b981", linewidth=2.0, alpha=0.14, zorder=4
    )
    gpd.GeoSeries([added_geom], crs=METRIC_CRS).plot(
        ax=ax, color="#f97316", edgecolor="#ea580c", linewidth=1.6, alpha=0.54, zorder=5
    )
    gpd.GeoSeries([original_geom], crs=METRIC_CRS).plot(
        ax=ax, color="#38bdf8", edgecolor="#2563eb", linewidth=2.45, alpha=0.36, zorder=6
    )
    point.plot(ax=ax, marker="*", color="#0f172a", edgecolor="white", linewidth=0.8, markersize=245, zorder=8)

    if not residential.empty:
        label_candidates = residential[residential["name"].notna()].copy()
        label_candidates["area"] = label_candidates.geometry.area
        for _, row in label_candidates.sort_values("area", ascending=False).head(5).iterrows():
            pt = row.geometry.representative_point()
            name = str(row["name"]).replace("아파트", "")
            ax.text(
                pt.x,
                pt.y,
                name[:14],
                fontsize=7.0,
                color="#475569",
                ha="center",
                va="center",
                zorder=9,
                bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.58, "pad": 0.9},
            )

    minx, miny, maxx, maxy = extent_geom.bounds
    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.axis("off")

    school_name = str(stats["학교명"])
    display_name = school_name.replace("인천", "").replace("초등학교", "초")
    added_area = float(stats["apt_added_area_m2"])
    original_area = float(stats["osm_walk_area_m2"])
    adjusted_area = float(stats["adjusted_walk_area_m2"])
    gain_pp = float(stats["adjusted_walk_area_ratio_to_buffer"] - stats["osm_walk_area_ratio_to_buffer"]) * 100

    header = FancyBboxPatch(
        (0.018, 0.895),
        0.42,
        0.075,
        boxstyle="round,pad=0.012,rounding_size=0.018",
        transform=ax.transAxes,
        facecolor="#263445",
        edgecolor="#334155",
        linewidth=0.8,
        alpha=0.96,
        zorder=30,
    )
    ax.add_patch(header)
    ax.text(
        0.035,
        0.935,
        f"{display_name}  |  단지 통과 보행권 변화",
        transform=ax.transAxes,
        fontsize=13.8,
        weight="bold",
        color="#f8fafc",
        va="center",
        zorder=31,
    )
    ax.text(
        0.028,
        0.055,
        (
            f"미통과 {original_area:,.0f}㎡   →   단지 통과 허용 {adjusted_area:,.0f}㎡"
            f"   |   추가 연결 {added_area:,.0f}㎡  (+{gain_pp:.1f}%p)"
        ),
        transform=ax.transAxes,
        fontsize=11.5,
        color="#f8fafc",
        bbox={"facecolor": "#263445", "edgecolor": "#334155", "boxstyle": "round,pad=0.45", "alpha": 0.95},
        zorder=20,
    )
    ax.text(
        0.035,
        0.905,
        "주황 = 단지 통과 시 추가 연결 생활권",
        transform=ax.transAxes,
        fontsize=8.4,
        color="#cbd5e1",
        va="top",
        zorder=31,
    )
    ax.legend(
        handles=[
            Patch(facecolor="#38bdf8", edgecolor="#2563eb", label="미통과 보행권"),
            Patch(facecolor="#f97316", edgecolor="#ea580c", label="단지 통과로 추가 연결"),
            Patch(facecolor="#6ee7b7", edgecolor="#10b981", label="단지 통과 허용 보행권"),
            Patch(facecolor="#e9eef5", edgecolor="#cbd5e1", label="OSM 주거/아파트 단지"),
            Patch(facecolor="#fef3c7", edgecolor="#d97706", label="학교 부지"),
            Patch(facecolor="#fbbf24", edgecolor="#f59e0b", label="주요 도로"),
        ],
        loc="upper right",
        bbox_to_anchor=(0.985, 0.88),
        frameon=True,
        framealpha=0.96,
        facecolor="#f8fafc",
        edgecolor="#cbd5e1",
        fontsize=9.0,
    )

    target = OUT_DIR / f"apartment_permeability_isochrone_{slug}_appstyle.png"
    fig.savefig(target, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return target


def main() -> None:
    setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    layers = read_layers()
    adjustment = layers["adjustment"]
    top_school = adjustment.sort_values("apt_added_area_m2", ascending=False).iloc[0]
    targets = [
        ("B000025677", "juan_elementary"),
        (str(top_school["학교ID"]), "largest_apt_gap"),
    ]
    for school_id, slug in targets:
        path = plot_school(layers, school_id, slug)
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
