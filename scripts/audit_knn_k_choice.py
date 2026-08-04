from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_processed"
OUT_DIR = ROOT / "outputs" / "knn"

PRIORITY_CSV = DATA / "school_priority.csv"
SCHOOLS_CSV = DATA / "schools.csv"
TREND_CSV = DATA / "student_trend.csv"
LARGE_APT_COMPLEXES_CSV = DATA / "large_apt_complexes_2025.csv"

SEED = 42
EARTH_RADIUS_M = 6_371_000.0

SELECTION_FEATURES = [
    "current_students_2025",
    "student_slope",
    "recent_student_change_pct",
    "trend_volatility",
    "iso_child_total",
    "large_apt_count_500m",
    "large_apt_households_500m",
    "redev_완료수",
    "redev_진행중수",
    "redev_예정수",
    "is_new_school",
]


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"


def load_trend_features() -> pd.DataFrame:
    trend = pd.read_csv(TREND_CSV, encoding="utf-8-sig")
    school_id_col, _, year_col, student_col = trend.columns[:4]
    trend[year_col] = pd.to_numeric(trend[year_col], errors="coerce")
    trend[student_col] = pd.to_numeric(trend[student_col], errors="coerce")
    trend = trend.dropna(subset=[school_id_col, year_col, student_col]).sort_values([school_id_col, year_col])

    rows: list[dict[str, float | str]] = []
    for school_id, group in trend.groupby(school_id_col):
        years = group[year_col].to_numpy(dtype=float)
        students = group[student_col].to_numpy(dtype=float)
        current_students = float(students[-1])
        if len(group) >= 2:
            slope = float(np.polyfit(years, students, 1)[0])
            recent_base = float(students[-2])
            recent_change_pct = float((students[-1] - students[-2]) / recent_base) if recent_base else 0.0
        else:
            slope = 0.0
            recent_change_pct = 0.0
        trend_volatility = float(np.std(np.diff(students), ddof=0)) if len(group) >= 3 else 0.0
        rows.append(
            {
                "학교ID": school_id,
                "current_students_2025": current_students,
                "student_slope_calc": slope,
                "recent_student_change_pct": recent_change_pct,
                "trend_volatility": trend_volatility,
            }
        )
    return pd.DataFrame(rows)


def haversine_distance_m(lat1_deg: float, lon1_deg: float, lat2_rad: np.ndarray, lon2_rad: np.ndarray) -> np.ndarray:
    lat1_rad = np.radians(lat1_deg)
    lon1_rad = np.radians(lon1_deg)
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2.0) ** 2
    return EARTH_RADIUS_M * 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))


def load_apt_features() -> pd.DataFrame:
    schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
    apts = pd.read_csv(LARGE_APT_COMPLEXES_CSV, encoding="utf-8-sig")

    schools = schools[["학교ID", "학교명", "위도", "경도"]].dropna()
    apts = apts[["경도", "위도", "세대수"]].dropna()
    apts["세대수"] = pd.to_numeric(apts["세대수"], errors="coerce").fillna(0)

    apt_lat_rad = np.radians(apts["위도"].to_numpy(dtype=float))
    apt_lon_rad = np.radians(apts["경도"].to_numpy(dtype=float))
    apt_households = apts["세대수"].to_numpy(dtype=float)

    rows = []
    for school in schools.itertuples(index=False):
        distances = haversine_distance_m(float(school.위도), float(school.경도), apt_lat_rad, apt_lon_rad)
        within_500m = distances <= 500.0
        rows.append(
            {
                "학교ID": school.학교ID,
                "large_apt_count_500m": int(within_500m.sum()),
                "large_apt_households_500m": int(apt_households[within_500m].sum()),
            }
        )
    return pd.DataFrame(rows)


def load_frame() -> pd.DataFrame:
    df = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    df = df.merge(load_trend_features(), on="학교ID", how="left")
    df = df.merge(load_apt_features(), on="학교ID", how="left")

    fill_zero = [
        "current_students_2025",
        "student_slope_calc",
        "recent_student_change_pct",
        "trend_volatility",
        "large_apt_count_500m",
        "large_apt_households_500m",
    ]
    for column in fill_zero:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0.0)
    df["student_slope"] = pd.to_numeric(df["student_slope"], errors="coerce").fillna(df["student_slope_calc"]).fillna(0.0)
    for column in ["redev_완료수", "redev_진행중수", "redev_예정수", "is_new_school", "iso_child_total"]:
        df[column] = pd.to_numeric(df[column], errors="coerce").fillna(0.0)

    missing = [column for column in ["학교ID", "학교명", "is_separate_bundle_tag", *SELECTION_FEATURES] if column not in df.columns]
    if missing:
        raise ValueError(f"missing columns: {missing}")
    return df


def peer_dispersion(X: np.ndarray, neighbor_indices: np.ndarray, k: int) -> float:
    values = []
    for row_idx, row in enumerate(X):
        peers = X[neighbor_indices[row_idx, 1 : k + 1]]
        values.append(float(np.mean(np.linalg.norm(peers - row, axis=1))))
    return float(np.mean(values))


def evaluate_group(group: pd.DataFrame, group_name: str, max_k: int = 10) -> pd.DataFrame:
    scaled = StandardScaler().fit_transform(group[SELECTION_FEATURES])
    max_neighbors = min(max_k + 1, len(group))
    nn = NearestNeighbors(n_neighbors=max_neighbors, metric="euclidean")
    nn.fit(scaled)
    distances, indices = nn.kneighbors(scaled)

    rows = []
    for k in range(2, max_neighbors):
        kth = distances[:, k]
        prev = distances[:, k - 1]
        rows.append(
            {
                "group": group_name,
                "n_schools": len(group),
                "k": k,
                "mean_neighbor_distance": round(float(distances[:, 1 : k + 1].mean()), 4),
                "mean_kth_neighbor_distance": round(float(kth.mean()), 4),
                "median_kth_neighbor_distance": round(float(np.median(kth)), 4),
                "marginal_kth_distance_increase": round(float((kth - prev).mean()), 4),
                "peer_dispersion": round(peer_dispersion(scaled, indices, k), 4),
            }
        )

    # KMeans silhouette is a secondary reference for the broader feature geometry,
    # not a direct KNN neighbor-count criterion.
    for row in rows:
        k = int(row["k"])
        if 2 <= k < len(group):
            labels = KMeans(n_clusters=k, random_state=SEED, n_init=20).fit_predict(scaled)
            row["kmeans_silhouette_reference"] = round(float(silhouette_score(scaled, labels)), 4)
        else:
            row["kmeans_silhouette_reference"] = np.nan
    return pd.DataFrame(rows)


def make_plot(metrics: pd.DataFrame) -> Path:
    main = metrics[metrics["group"] == "mainstream"].copy()
    fig, axes = plt.subplots(1, 2, figsize=(13.33, 6.2), dpi=180)

    axes[0].plot(main["k"], main["mean_kth_neighbor_distance"], marker="o", color="#2563eb", linewidth=2.2)
    axes[0].axvline(4, color="#10b981", linestyle="--", linewidth=2)
    axes[0].set_title("K-distance elbow: k번째 이웃 거리", loc="left", fontsize=14, weight="bold")
    axes[0].set_xlabel("K")
    axes[0].set_ylabel("평균 k번째 이웃 거리")
    axes[0].grid(alpha=0.24)

    axes[1].plot(main["k"], main["peer_dispersion"], marker="o", color="#f59e0b", linewidth=2.2)
    axes[1].axvline(4, color="#10b981", linestyle="--", linewidth=2)
    axes[1].set_title("Peer dispersion: 비교군 내부 이질성", loc="left", fontsize=14, weight="bold")
    axes[1].set_xlabel("K")
    axes[1].set_ylabel("표준화 feature 거리")
    axes[1].grid(alpha=0.24)

    fig.suptitle("유사학교 KNN의 K 선택 근거: K=4는 밀도와 해석성의 균형점", fontsize=18, weight="bold", x=0.05, ha="left")
    fig.text(
        0.05,
        0.035,
        "해석: K를 5 이상으로 키우면 비교군 수는 늘지만 평균 이웃 거리와 비교군 이질성이 계속 증가한다. K=4는 가까운 비교군을 유지하면서 평균 비교 설명이 가능한 최소 안정 구간이다.",
        fontsize=11.5,
        color="#334155",
    )
    target = OUT_DIR / "knn_k_choice_elbow.png"
    fig.savefig(target, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return target


def main() -> None:
    setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    frame = load_frame()
    outputs = []
    for flag, name in [(0, "mainstream"), (1, "separate_bundle")]:
        group = frame[frame["is_separate_bundle_tag"] == flag].copy()
        if len(group) >= 4:
            outputs.append(evaluate_group(group, name))
    metrics = pd.concat(outputs, ignore_index=True)
    csv_path = OUT_DIR / "knn_k_choice_metrics.csv"
    metrics.to_csv(csv_path, index=False, encoding="utf-8-sig")
    plot_path = make_plot(metrics)
    print(csv_path.relative_to(ROOT))
    print(plot_path.relative_to(ROOT))
    print(metrics.to_string(index=False))


if __name__ == "__main__":
    main()
