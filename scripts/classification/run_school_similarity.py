from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
OUTPUT_CSV = DATA / "school_similar_schools_top5.csv"

PRIORITY_CSV = DATA / "school_priority.csv"

SIMILARITY_FEATURES = [
    "nearest_park_dist_m",
    "iso_park_count",
    "iso_park_area",
    "buf_park_count",
    "buf_park_area",
    "iso_playground_count",
    "iso_child_total",
    "iso_child_6_12",
    "redev_완료수",
    "redev_진행중수",
    "redev_예정수",
    "is_new_school",
]

FORBIDDEN_FEATURES = {
    "case_type",
    "case_label",
    "priority_score",
    "priority_rank",
    "is_low_access_tag",
    "is_case_conflict_tag",
    "is_separate_bundle_tag",
    "student_slope",
}

COMMON_FEATURES = [
    "nearest_park_dist_m",
    "iso_park_count",
    "iso_park_area",
    "iso_playground_count",
    "iso_child_total",
    "redev_진행중수",
]

EVAL_FEATURES = [
    "nearest_park_dist_m",
    "iso_park_count",
    "iso_park_area",
    "buf_park_count",
    "buf_park_area",
    "iso_playground_count",
]

FEATURE_LABELS = {
    "nearest_park_dist_m": "최인근 공원 거리",
    "iso_park_count": "도보권 공원 수",
    "iso_park_area": "도보권 공원 면적",
    "buf_park_count": "직선권 공원 수",
    "buf_park_area": "직선권 공원 면적",
    "iso_playground_count": "도보권 놀이터 수",
    "iso_child_total": "도보권 아동 수",
    "iso_child_6_12": "도보권 초등학령기 아동 수",
    "redev_완료수": "재개발 완료 수",
    "redev_진행중수": "재개발 진행중 수",
    "redev_예정수": "재개발 예정 수",
    "is_new_school": "신설학교 여부",
}

COMMON_TEXT = {
    "nearest_park_dist_m": "최인근 공원 거리가 유사학교 평균과 비슷합니다",
    "iso_park_count": "도보권 공원 수가 유사학교 평균과 비슷합니다",
    "iso_park_area": "도보권 공원 면적이 유사학교 평균과 비슷합니다",
    "buf_park_count": "직선권 공원 수가 유사학교 평균과 비슷합니다",
    "buf_park_area": "직선권 공원 면적이 유사학교 평균과 비슷합니다",
    "iso_playground_count": "도보권 놀이터 수가 유사학교 평균과 비슷합니다",
    "iso_child_total": "도보권 아동 규모가 유사학교 평균과 비슷합니다",
    "iso_child_6_12": "도보권 초등학령기 아동 규모가 유사학교 평균과 비슷합니다",
    "redev_완료수": "재개발 완료 규모가 유사학교 평균과 비슷합니다",
    "redev_진행중수": "재개발 진행 규모가 유사학교 평균과 비슷합니다",
    "redev_예정수": "재개발 예정 규모가 유사학교 평균과 비슷합니다",
    "is_new_school": "신설학교 여부가 유사학교 평균과 비슷합니다",
}


def load_frame() -> pd.DataFrame:
    df = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    required = ["학교ID", "학교명", "gu", "is_separate_bundle_tag", *SIMILARITY_FEATURES]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {missing}")

    forbidden_used = sorted(set(SIMILARITY_FEATURES) & FORBIDDEN_FEATURES)
    if forbidden_used:
        raise ValueError(f"금지 변수 사용 감지: {forbidden_used}")

    null_counts = df[required].isna().sum()
    null_counts = {k: int(v) for k, v in null_counts.items() if int(v) > 0}
    if null_counts:
        raise ValueError(f"유사도 입력 컬럼 결측 발견: {null_counts}")
    return df


def format_delta(value: float, integer: bool = False) -> str:
    rounded = round(value)
    if integer:
        sign = "+" if rounded > 0 else ""
        return f"{sign}{int(rounded)}"
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}"


def build_common_points(row: pd.Series, peer_mean: pd.Series, peer_std: pd.Series) -> str:
    ranked: list[tuple[float, str]] = []
    for feature in COMMON_FEATURES:
        denom = float(peer_std.get(feature, 0.0))
        diff = abs(float(row[feature]) - float(peer_mean[feature]))
        score = diff / denom if denom > 0 else diff
        ranked.append((score, COMMON_TEXT[feature]))
    ranked.sort(key=lambda item: item[0])
    unique_points: list[str] = []
    for _, text in ranked:
        if text not in unique_points:
            unique_points.append(text)
        if len(unique_points) == 3:
            break
    return " | ".join(unique_points[:3])


def strength_text(feature: str, diff: float) -> str:
    label = FEATURE_LABELS[feature]
    if feature == "nearest_park_dist_m":
        return f"유사학교 대비 {label}가 {abs(diff):.1f}m 더 짧습니다"
    return f"유사학교 대비 {label}가 {format_delta(diff, integer=True)} 더 많습니다" if feature.endswith("_count") or feature in {"iso_playground_count"} else f"유사학교 대비 {label}가 {format_delta(diff)} 더 큽니다"


def weakness_text(feature: str, diff: float) -> str:
    label = FEATURE_LABELS[feature]
    if feature == "nearest_park_dist_m":
        return f"유사학교 대비 {label}가 {abs(diff):.1f}m 더 깁니다"
    return f"유사학교 대비 {label}가 {abs(round(diff))} 더 적습니다" if feature.endswith("_count") or feature in {"iso_playground_count"} else f"유사학교 대비 {label}가 {abs(diff):.1f} 더 작습니다"


def build_strengths_weaknesses(row: pd.Series, peer_mean: pd.Series, peer_std: pd.Series) -> tuple[str, str]:
    strengths: list[tuple[float, str]] = []
    weaknesses: list[tuple[float, str]] = []

    for feature in EVAL_FEATURES:
        value = float(row[feature])
        mean_value = float(peer_mean[feature])
        diff = value - mean_value
        denom = float(peer_std.get(feature, 0.0))
        z_like = abs(diff / denom) if denom > 0 else abs(diff)

        if feature == "nearest_park_dist_m":
            if diff < 0:
                strengths.append((z_like, strength_text(feature, diff)))
            elif diff > 0:
                weaknesses.append((z_like, weakness_text(feature, diff)))
        else:
            if diff > 0:
                strengths.append((z_like, strength_text(feature, diff)))
            elif diff < 0:
                weaknesses.append((z_like, weakness_text(feature, diff)))

    strengths.sort(key=lambda item: item[0], reverse=True)
    weaknesses.sort(key=lambda item: item[0], reverse=True)

    strength_texts = [text for _, text in strengths[:2]]
    weakness_texts = [text for _, text in weaknesses[:2]]

    if not strength_texts:
        strength_texts = ["유사학교 대비 두드러진 상대 강점이 크지 않습니다"]
    if not weakness_texts:
        weakness_texts = ["유사학교 대비 두드러진 상대 약점이 크지 않습니다"]

    return " | ".join(strength_texts), " | ".join(weakness_texts)


def process_group(group: pd.DataFrame, bundle_label: str) -> list[dict[str, object]]:
    feature_frame = group[SIMILARITY_FEATURES].copy()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(feature_frame)

    neighbor_count = min(6, len(group))
    if neighbor_count < 2:
        raise ValueError(f"{bundle_label} 그룹 학교 수가 너무 적어 유사학교를 계산할 수 없습니다.")

    model = NearestNeighbors(n_neighbors=neighbor_count, metric="euclidean")
    model.fit(scaled)
    distances, indices = model.kneighbors(scaled)

    rows: list[dict[str, object]] = []
    for idx, school in group.reset_index(drop=True).iterrows():
        neighbor_positions = [pos for pos in indices[idx].tolist() if pos != idx][:5]
        neighbor_distances = [dist for pos, dist in zip(indices[idx].tolist(), distances[idx].tolist()) if pos != idx][:5]

        peers = group.reset_index(drop=True).iloc[neighbor_positions].copy()
        peer_mean = peers[SIMILARITY_FEATURES].mean()
        peer_std = peers[SIMILARITY_FEATURES].std(ddof=0).replace(0, np.nan)

        common_points = build_common_points(school, peer_mean, peer_std.fillna(0))
        strengths, weaknesses = build_strengths_weaknesses(school, peer_mean, peer_std.fillna(0))

        row: dict[str, object] = {
            "학교ID": school["학교ID"],
            "학교명": school["학교명"],
            "gu": school["gu"],
            "similarity_group": bundle_label,
            "similarity_features": ", ".join(SIMILARITY_FEATURES),
            "common_points": common_points,
            "relative_strengths": strengths,
            "relative_weaknesses": weaknesses,
        }

        for rank in range(5):
            if rank < len(neighbor_positions):
                peer = peers.iloc[rank]
                row[f"similar_school_{rank + 1}_id"] = peer["학교ID"]
                row[f"similar_school_{rank + 1}_name"] = peer["학교명"]
                row[f"similar_school_{rank + 1}_gu"] = peer["gu"]
                row[f"similar_school_{rank + 1}_distance"] = round(float(neighbor_distances[rank]), 4)
            else:
                row[f"similar_school_{rank + 1}_id"] = ""
                row[f"similar_school_{rank + 1}_name"] = ""
                row[f"similar_school_{rank + 1}_gu"] = ""
                row[f"similar_school_{rank + 1}_distance"] = np.nan
        rows.append(row)
    return rows


def main() -> None:
    df = load_frame()
    groups = []
    for bundle_flag, bundle_label in [(0, "mainstream"), (1, "separate_bundle")]:
        group = df[df["is_separate_bundle_tag"] == bundle_flag].copy()
        groups.extend(process_group(group, bundle_label))

    result = pd.DataFrame(groups).sort_values(["similarity_group", "gu", "학교명"]).reset_index(drop=True)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUTPUT_CSV}")
    print(f"rows: {len(result)}")


if __name__ == "__main__":
    main()
