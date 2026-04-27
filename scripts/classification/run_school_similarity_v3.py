from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

PRIORITY_CSV = DATA / "school_priority.csv"
SCHOOLS_CSV = DATA / "schools.csv"
TREND_CSV = DATA / "student_trend.csv"
LARGE_APT_COMPLEXES_CSV = DATA / "large_apt_complexes_2025.csv"
OUTPUT_CSV = DATA / "school_similar_schools_top5.csv"

K_NEIGHBORS = 4
MAX_OUTPUT_NEIGHBORS = 5
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

CONTEXT_FEATURES = [
    "current_students_2025",
    "student_slope",
    "recent_student_change_pct",
    "iso_child_total",
    "large_apt_count_500m",
    "redev_status_simple",
    "is_new_school",
]

COMPARISON_FEATURES = [
    "nearest_park_dist_m",
    "iso_green_ratio",
    "iso_playground_count",
]

FEATURE_LABELS = {
    "current_students_2025": "현재 학생 수",
    "student_slope": "학생 수 추세",
    "recent_student_change_pct": "최근 학생 수 증감률",
    "trend_volatility": "학생 수 변동폭",
    "iso_child_total": "주변 아동 규모",
    "large_apt_count_500m": "500m 내 대단지 개수",
    "large_apt_households_500m": "500m 내 대단지 세대 수",
    "redev_status_simple": "재개발 상태",
    "is_new_school": "신설학교 여부",
    "nearest_park_dist_m": "최근접 공원 거리",
    "iso_green_ratio": "녹지 비율",
    "iso_playground_count": "도보권 놀이터 수",
}

TREND_POSITIVE_THRESHOLD = 5.0
TREND_NEGATIVE_THRESHOLD = -5.0
RECENT_CHANGE_POSITIVE_THRESHOLD = 0.05
RECENT_CHANGE_NEGATIVE_THRESHOLD = -0.05


def build_redev_status_simple(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    has_progress = (df["redev_진행중수"] > 0) | (df["redev_예정수"] > 0)
    has_completed = df["redev_완료수"] > 0
    df["redev_status_simple"] = np.select(
        [has_progress, has_completed],
        ["계획·진행", "완료"],
        default="없음",
    )
    df["redev_none"] = (df["redev_status_simple"] == "없음").astype(int)
    df["redev_completed_flag"] = (df["redev_status_simple"] == "완료").astype(int)
    df["redev_planned_flag"] = (df["redev_status_simple"] == "계획·진행").astype(int)
    return df


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
        if len(group) >= 3:
            trend_volatility = float(np.std(np.diff(students), ddof=0))
        else:
            trend_volatility = 0.0
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


def haversine_distance_m(
    lat1_deg: float,
    lon1_deg: float,
    lat2_rad: np.ndarray,
    lon2_rad: np.ndarray,
) -> np.ndarray:
    lat1_rad = np.radians(lat1_deg)
    lon1_rad = np.radians(lon1_deg)
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1_rad) * np.cos(lat2_rad) * np.sin(dlon / 2.0) ** 2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return EARTH_RADIUS_M * c


def load_apt_features() -> pd.DataFrame:
    schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")
    apts = pd.read_csv(LARGE_APT_COMPLEXES_CSV, encoding="utf-8-sig")

    school_id_col = schools.columns[0]
    school_name_col = schools.columns[1]
    school_lat_col = schools.columns[2]
    school_lon_col = schools.columns[3]

    apt_household_col = "세대수"
    apt_lon_col = "경도"
    apt_lat_col = "위도"

    schools = schools[[school_id_col, school_name_col, school_lat_col, school_lon_col]].dropna()
    apts = apts[[apt_lon_col, apt_lat_col, apt_household_col]].dropna()
    apts[apt_household_col] = pd.to_numeric(apts[apt_household_col], errors="coerce").fillna(0)

    apt_lat_rad = np.radians(apts[apt_lat_col].to_numpy(dtype=float))
    apt_lon_rad = np.radians(apts[apt_lon_col].to_numpy(dtype=float))
    apt_households = apts[apt_household_col].to_numpy(dtype=float)

    rows: list[dict[str, int | str]] = []
    for school in schools.itertuples(index=False):
        school_id = getattr(school, school_id_col)
        lat = float(getattr(school, school_lat_col))
        lon = float(getattr(school, school_lon_col))
        distances = haversine_distance_m(lat, lon, apt_lat_rad, apt_lon_rad)
        within_500m = distances <= 500.0
        rows.append(
            {
                "학교ID": school_id,
                "large_apt_count_500m": int(within_500m.sum()),
                "large_apt_households_500m": int(apt_households[within_500m].sum()),
            }
        )
    return pd.DataFrame(rows)


def load_frame() -> pd.DataFrame:
    df = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    trend_features = load_trend_features()
    apt_features = load_apt_features()

    df = df.merge(trend_features, on="학교ID", how="left")
    df = df.merge(apt_features, on="학교ID", how="left")
    df = build_redev_status_simple(df)

    df["current_students_2025"] = df["current_students_2025"].fillna(0.0)
    df["student_slope"] = df["student_slope"].fillna(df["student_slope_calc"]).fillna(0.0)
    df["recent_student_change_pct"] = df["recent_student_change_pct"].fillna(0.0)
    df["trend_volatility"] = df["trend_volatility"].fillna(0.0)
    df["large_apt_count_500m"] = df["large_apt_count_500m"].fillna(0).astype(int)
    df["large_apt_households_500m"] = df["large_apt_households_500m"].fillna(0).astype(int)
    df["nearest_park_dist_m"] = df["nearest_park_dist_m"].fillna(9999.0)
    df["iso_green_ratio"] = df["iso_green_ratio"].fillna(0.0)
    df["iso_playground_count"] = df["iso_playground_count"].fillna(0.0)

    required = [
        "학교ID",
        "학교명",
        "gu",
        "is_separate_bundle_tag",
        *SELECTION_FEATURES,
        *COMPARISON_FEATURES,
        "redev_status_simple",
    ]
    missing = [column for column in required if column not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {missing}")

    null_counts = df[required].isna().sum()
    null_counts = {key: int(value) for key, value in null_counts.items() if int(value) > 0}
    if null_counts:
        raise ValueError(f"유사학교 입력 결측 발견: {null_counts}")

    return df


def describe_student_slope(value: float) -> str:
    if value >= TREND_POSITIVE_THRESHOLD:
        return "학생 수가 늘어나는 흐름"
    if value <= TREND_NEGATIVE_THRESHOLD:
        return "학생 수가 줄어드는 흐름"
    return "학생 수가 대체로 안정적인 흐름"


def describe_recent_change_pct(value: float) -> str:
    if value >= RECENT_CHANGE_POSITIVE_THRESHOLD:
        return "최근 1년 학생 수 증가폭"
    if value <= RECENT_CHANGE_NEGATIVE_THRESHOLD:
        return "최근 1년 학생 수 감소폭"
    return "최근 1년 학생 수 변동"


def format_signed_number(value: float, digits: int = 1) -> str:
    return f"{value:+.{digits}f}"


def format_signed_percent(value: float, digits: int = 1) -> str:
    return f"{value * 100:+.{digits}f}%"


def format_range_text(min_value: float, max_value: float, digits: int = 0, suffix: str = "") -> str:
    if digits == 0:
        left = f"{int(round(min_value)):,}"
        right = f"{int(round(max_value)):,}"
    else:
        left = f"{min_value:.{digits}f}"
        right = f"{max_value:.{digits}f}"
    return f"{left}~{right}{suffix}"


def current_students_common_text(row: pd.Series, peers: pd.DataFrame, peer_mean: pd.Series) -> str:
    current = float(row["current_students_2025"])
    peer_min = float(peers["current_students_2025"].min())
    peer_max = float(peers["current_students_2025"].max())
    peer_avg = float(peer_mean["current_students_2025"])
    return (
        f"현재 학생수는 {int(round(current)):,}명으로, "
        f"KNN 비교군 {format_range_text(peer_min, peer_max, 0, '명')} 범위에 가깝습니다"
        f" (평균 {int(round(peer_avg)):,}명)."
    )


def student_slope_common_text(row: pd.Series, peer_mean: pd.Series) -> str:
    slope = float(row["student_slope"])
    peer_avg = float(peer_mean["student_slope"])
    flow_text = describe_student_slope(slope)
    return (
        f"학생수 추세는 연간 {format_signed_number(slope, 1)}명 수준으로, "
        f"KNN 비교군 평균 {format_signed_number(peer_avg, 1)}명과 비슷한 {flow_text}입니다."
    )


def recent_change_common_text(row: pd.Series, peers: pd.DataFrame, peer_mean: pd.Series) -> str:
    current = float(row["recent_student_change_pct"])
    peer_min = float(peers["recent_student_change_pct"].min())
    peer_max = float(peers["recent_student_change_pct"].max())
    peer_avg = float(peer_mean["recent_student_change_pct"])
    return (
        f"최근 1년 학생수 증감률은 {format_signed_percent(current, 1)}로, "
        f"KNN 비교군 {format_range_text(peer_min * 100, peer_max * 100, 1, '%')} 범위와 유사합니다"
        f" (평균 {format_signed_percent(peer_avg, 1)})."
    )


def child_total_common_text(row: pd.Series, peers: pd.DataFrame, peer_mean: pd.Series) -> str:
    current = float(row["iso_child_total"])
    peer_min = float(peers["iso_child_total"].min())
    peer_max = float(peers["iso_child_total"].max())
    peer_avg = float(peer_mean["iso_child_total"])
    return (
        f"학교 주변 아동 규모는 {int(round(current)):,}명으로, "
        f"KNN 비교군 {format_range_text(peer_min, peer_max, 0, '명')} 범위와 비슷합니다"
        f" (평균 {int(round(peer_avg)):,}명)."
    )


def large_apt_common_text(row: pd.Series, peers: pd.DataFrame) -> str:
    current_count = int(round(float(row["large_apt_count_500m"])))
    peer_min = float(peers["large_apt_count_500m"].min())
    peer_max = float(peers["large_apt_count_500m"].max())
    household_avg = float(peers["large_apt_households_500m"].mean())
    return (
        f"500m 안 대단지 아파트는 {current_count}개로, "
        f"KNN 비교군도 {format_range_text(peer_min, peer_max, 0, '개')} 범위에 몰려 있습니다"
        f" (세대수 평균 {int(round(household_avg)):,}세대)."
    )


def redev_common_text(row: pd.Series, peers: pd.DataFrame) -> str:
    same_status_share = float((peers["redev_status_simple"] == row["redev_status_simple"]).mean()) * 100
    return (
        f"재개발 상태는 '{row['redev_status_simple']}'이며, "
        f"KNN 비교군의 {same_status_share:.0f}%도 같은 단계입니다."
    )


def new_school_common_text(row: pd.Series, peers: pd.DataFrame) -> str:
    same_flag_share = float((peers["is_new_school"] == row["is_new_school"]).mean()) * 100
    status = "신설학교" if int(row["is_new_school"]) == 1 else "기존학교"
    return f"학교 유형은 {status}이며, KNN 비교군의 {same_flag_share:.0f}%도 같은 유형입니다."


def common_point_text(feature: str, row: pd.Series, peers: pd.DataFrame, peer_mean: pd.Series) -> str:
    if feature == "current_students_2025":
        return current_students_common_text(row, peers, peer_mean)
    if feature == "student_slope":
        return student_slope_common_text(row, peer_mean)
    if feature == "recent_student_change_pct":
        return recent_change_common_text(row, peers, peer_mean)
    if feature == "iso_child_total":
        return child_total_common_text(row, peers, peer_mean)
    if feature == "large_apt_count_500m":
        return large_apt_common_text(row, peers)
    if feature == "redev_status_simple":
        return redev_common_text(row, peers)
    if feature == "is_new_school":
        return new_school_common_text(row, peers)
    return f"KNN 비교군과 {FEATURE_LABELS[feature]}이 비슷합니다."


def comparison_text(feature: str, diff: float) -> str:
    if feature == "nearest_park_dist_m":
        direction = "더 가깝습니다" if diff < 0 else "더 멉니다"
        return f"유사학교 평균보다 최근접 공원 거리가 {abs(diff):.1f}m {direction}"
    if feature == "iso_green_ratio":
        direction = "더 높습니다" if diff > 0 else "더 낮습니다"
        return f"유사학교 평균보다 녹지 비율이 {abs(diff):.1f}%p {direction}"
    if feature == "iso_playground_count":
        rounded = abs(int(round(diff)))
        if rounded == 0:
            rounded = 1
        direction = "더 많습니다" if diff > 0 else "더 적습니다"
        return f"유사학교 평균보다 도보권 놀이터 수가 {rounded}개 {direction}"
    return f"유사학교 평균보다 {FEATURE_LABELS[feature]} 차이가 있습니다"


def build_common_points(row: pd.Series, peers: pd.DataFrame, peer_mean: pd.Series, peer_std: pd.Series) -> str:
    numeric_ranked: list[tuple[float, str]] = []
    categorical_ranked: list[tuple[float, str]] = []
    for feature in CONTEXT_FEATURES:
        if feature == "redev_status_simple":
            row_vector = np.array(
                [
                    int(row["redev_none"]),
                    int(row["redev_completed_flag"]),
                    int(row["redev_planned_flag"]),
                ],
                dtype=float,
            )
            peer_vector = np.array(
                [
                    float(peer_mean["redev_none"]),
                    float(peer_mean["redev_completed_flag"]),
                    float(peer_mean["redev_planned_flag"]),
                ],
                dtype=float,
              )
            score = float(np.abs(row_vector - peer_vector).sum())
            categorical_ranked.append((score, common_point_text(feature, row, peers, peer_mean)))
        elif feature == "is_new_school":
            score = abs(int(row[feature]) - int(round(float(peer_mean[feature]))))
            categorical_ranked.append((score, common_point_text(feature, row, peers, peer_mean)))
        else:
            diff = abs(float(row[feature]) - float(peer_mean[feature]))
            denom = float(peer_std.get(feature, 0.0))
            score = diff / denom if denom > 0 else diff
            numeric_ranked.append((score, common_point_text(feature, row, peers, peer_mean)))

    numeric_ranked.sort(key=lambda item: item[0])
    categorical_ranked.sort(key=lambda item: item[0])
    texts: list[str] = []
    for _, text in numeric_ranked[:2]:
        if text not in texts:
            texts.append(text)
    for _, text in categorical_ranked[:1]:
        if text not in texts:
            texts.append(text)
        if len(texts) == 3:
            break
    return " | ".join(texts)


def build_strengths_weaknesses(row: pd.Series, peer_mean: pd.Series, peer_std: pd.Series) -> tuple[str, str]:
    strengths: list[tuple[float, str]] = []
    weaknesses: list[tuple[float, str]] = []

    for feature in COMPARISON_FEATURES:
        diff = float(row[feature]) - float(peer_mean[feature])
        denom = float(peer_std.get(feature, 0.0))
        magnitude = abs(diff / denom) if denom > 0 else abs(diff)
        if magnitude == 0:
            continue

        better = diff < 0 if feature == "nearest_park_dist_m" else diff > 0
        text = comparison_text(feature, diff)
        if better:
            strengths.append((magnitude, text))
        else:
            weaknesses.append((magnitude, text))

    strengths.sort(key=lambda item: item[0], reverse=True)
    weaknesses.sort(key=lambda item: item[0], reverse=True)

    strength_text = " | ".join(text for _, text in strengths[:2]) or "유사학교 평균 대비 두드러진 상대 강점이 크지 않습니다"
    weakness_text = " | ".join(text for _, text in weaknesses[:2]) or "유사학교 평균 대비 두드러진 상대 약점이 크지 않습니다"
    return strength_text, weakness_text


def selection_feature_label_list() -> str:
    return ", ".join(SELECTION_FEATURES)


def comparison_feature_label_list() -> str:
    return ", ".join(COMPARISON_FEATURES)


def process_group(group: pd.DataFrame, bundle_label: str) -> list[dict[str, object]]:
    group = group.reset_index(drop=True).copy()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(group[SELECTION_FEATURES])

    neighbor_count = min(K_NEIGHBORS + 1, len(group))
    if neighbor_count < 2:
        raise ValueError(f"{bundle_label} 그룹 학교 수가 너무 적어 유사학교를 계산할 수 없습니다.")

    model = NearestNeighbors(n_neighbors=neighbor_count, metric="euclidean")
    model.fit(scaled)
    distances, indices = model.kneighbors(scaled)

    rows: list[dict[str, object]] = []
    for idx, school in group.iterrows():
        neighbor_positions = [pos for pos in indices[idx].tolist() if pos != idx][:K_NEIGHBORS]
        neighbor_distances = [
            distance
            for pos, distance in zip(indices[idx].tolist(), distances[idx].tolist())
            if pos != idx
        ][:K_NEIGHBORS]
        peers = group.iloc[neighbor_positions].copy()

        peer_mean = peers[
            [
                *SELECTION_FEATURES,
                *COMPARISON_FEATURES,
                "redev_none",
                "redev_completed_flag",
                "redev_planned_flag",
            ]
        ].mean()
        peer_std = peers[
            [
                "current_students_2025",
                "student_slope",
                "recent_student_change_pct",
                "iso_child_total",
                "large_apt_count_500m",
                "nearest_park_dist_m",
                "iso_green_ratio",
                "iso_playground_count",
            ]
        ].std(ddof=0).replace(0, np.nan)

        strengths, weaknesses = build_strengths_weaknesses(school, peer_mean, peer_std.fillna(0))
        row: dict[str, object] = {
            "학교ID": school["학교ID"],
            "학교명": school["학교명"],
            "gu": school["gu"],
            "similarity_group": bundle_label,
            "knn_k": K_NEIGHBORS,
            "similarity_features": selection_feature_label_list(),
            "selection_features": selection_feature_label_list(),
            "comparison_features": comparison_feature_label_list(),
            "redev_status_simple": school["redev_status_simple"],
            "large_apt_flag": int(school["large_apt_count_500m"] > 0),
            "redev_none": int(school["redev_none"]),
            "redev_completed": int(school["redev_completed_flag"]),
            "redev_planned": int(school["redev_planned_flag"]),
            "large_apt_count_500m": int(school["large_apt_count_500m"]),
            "large_apt_households_500m": int(school["large_apt_households_500m"]),
            "current_students_2025": int(round(float(school["current_students_2025"]))),
            "student_slope": round(float(school["student_slope"]), 3),
            "recent_student_change_pct": round(float(school["recent_student_change_pct"]), 4),
            "trend_volatility": round(float(school["trend_volatility"]), 3),
            "common_points": build_common_points(school, peers, peer_mean, peer_std.fillna(0)),
            "relative_strengths": strengths,
            "relative_weaknesses": weaknesses,
            "peer_avg_nearest_park_dist_m": round(float(peer_mean["nearest_park_dist_m"]), 1),
            "peer_avg_iso_green_ratio": round(float(peer_mean["iso_green_ratio"]), 2),
            "peer_avg_iso_playground_count": round(float(peer_mean["iso_playground_count"]), 2),
        }

        for rank in range(MAX_OUTPUT_NEIGHBORS):
            if rank < len(neighbor_positions):
                peer = peers.iloc[rank]
                row[f"similar_school_{rank + 1}_id"] = peer["학교ID"]
                row[f"similar_school_{rank + 1}_name"] = peer["학교명"]
                row[f"similar_school_{rank + 1}_gu"] = peer["gu"]
                row[f"similar_school_{rank + 1}_distance"] = round(float(neighbor_distances[rank]), 4)
                row[f"similar_school_{rank + 1}_nearest_park_dist_m"] = round(float(peer["nearest_park_dist_m"]), 1)
                row[f"similar_school_{rank + 1}_iso_green_ratio"] = round(float(peer["iso_green_ratio"]), 2)
                row[f"similar_school_{rank + 1}_iso_playground_count"] = int(round(float(peer["iso_playground_count"])))
            else:
                row[f"similar_school_{rank + 1}_id"] = ""
                row[f"similar_school_{rank + 1}_name"] = ""
                row[f"similar_school_{rank + 1}_gu"] = ""
                row[f"similar_school_{rank + 1}_distance"] = np.nan
                row[f"similar_school_{rank + 1}_nearest_park_dist_m"] = np.nan
                row[f"similar_school_{rank + 1}_iso_green_ratio"] = np.nan
                row[f"similar_school_{rank + 1}_iso_playground_count"] = np.nan
        rows.append(row)
    return rows


def main() -> None:
    df = load_frame()
    rows: list[dict[str, object]] = []
    for bundle_flag, bundle_label in [(0, "mainstream"), (1, "separate_bundle")]:
        group = df[df["is_separate_bundle_tag"] == bundle_flag].copy()
        rows.extend(process_group(group, bundle_label))

    result = pd.DataFrame(rows).sort_values(["similarity_group", "gu", "학교명"]).reset_index(drop=True)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUTPUT_CSV}")
    print(f"rows: {len(result)}")
    print(f"knn_k: {K_NEIGHBORS}")


if __name__ == "__main__":
    main()
