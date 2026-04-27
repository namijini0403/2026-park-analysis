from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

PRIORITY_CSV = DATA / "school_priority.csv"
LARGE_APT_CSV = DATA / "has_large_apt_diff.csv"
OUTPUT_CSV = DATA / "school_similar_schools_top5.csv"

BASE_FEATURES = [
    "nearest_park_dist_m",
    "iso_park_count",
    "buf_park_area",
    "iso_playground_count",
    "iso_child_total",
    "has_large_apt",
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
    "buf_park_area",
    "iso_playground_count",
    "iso_child_total",
    "has_large_apt",
    "redev_status_simple",
    "is_new_school",
]

EVAL_FEATURES = COMMON_FEATURES.copy()

REDEV_CODE = {"없음": 0, "완료": 1, "계획·진행": 2}

FEATURE_LABELS = {
    "nearest_park_dist_m": "최인근 공원 거리",
    "iso_park_count": "도보권 공원 수",
    "buf_park_area": "직선권 공원 면적",
    "iso_playground_count": "도보권 놀이터 수",
    "iso_child_total": "도보권 아동 수",
    "has_large_apt": "대단지 아파트 유무",
    "redev_status_simple": "재개발 상태",
    "is_new_school": "신설학교 여부",
}


def build_redev_status_simple(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    has_progress = (df["redev_진행중수"] > 0) | (df["redev_예정수"] > 0)
    has_done = df["redev_완료수"] > 0
    df["redev_status_simple"] = np.select(
        [has_progress, has_done],
        ["계획·진행", "완료"],
        default="없음",
    )
    df["redev_status_simple_code"] = df["redev_status_simple"].map(REDEV_CODE).astype(int)
    return df


def load_frame() -> pd.DataFrame:
    df = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    apt = pd.read_csv(LARGE_APT_CSV, encoding="utf-8-sig")[["학교ID", "has_large_apt"]].copy()
    apt["has_large_apt"] = apt["has_large_apt"].astype(bool)

    df = df.merge(apt, on="학교ID", how="left")
    df["has_large_apt"] = df["has_large_apt"].fillna(False).astype(int)
    df = build_redev_status_simple(df)

    required = [
        "학교ID",
        "학교명",
        "gu",
        "is_separate_bundle_tag",
        *BASE_FEATURES,
        "redev_status_simple",
        "redev_status_simple_code",
    ]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"필수 컬럼 누락: {missing}")

    similarity_related = set(BASE_FEATURES) | {"redev_status_simple", "redev_status_simple_code"}
    forbidden_used = sorted(similarity_related & FORBIDDEN_FEATURES)
    if forbidden_used:
        raise ValueError(f"금지 변수 사용 감지: {forbidden_used}")

    null_counts = df[required].isna().sum()
    null_counts = {k: int(v) for k, v in null_counts.items() if int(v) > 0}
    if null_counts:
        raise ValueError(f"유사학교 입력 결측 발견: {null_counts}")
    return df


def knn_feature_columns() -> list[str]:
    return [
        "nearest_park_dist_m",
        "iso_park_count",
        "buf_park_area",
        "iso_playground_count",
        "iso_child_total",
        "has_large_apt",
        "redev_status_simple_code",
        "is_new_school",
    ]


def similarity_feature_label_list() -> str:
    return ", ".join(
        [
            "nearest_park_dist_m",
            "iso_park_count",
            "buf_park_area",
            "iso_playground_count",
            "iso_child_total",
            "has_large_apt",
            "redev_status_simple",
            "is_new_school",
        ]
    )


def common_point_text(feature: str, row: pd.Series) -> str:
    if feature == "has_large_apt":
        return "유사학교 대비 대단지 아파트 유무가 비슷합니다"
    if feature == "redev_status_simple":
        return f"유사학교 대비 재개발 상태가 비슷합니다 ({row['redev_status_simple']})"
    if feature == "is_new_school":
        return "유사학교 대비 신설학교 여부가 비슷합니다"
    return f"유사학교 대비 {FEATURE_LABELS[feature]}가 비슷합니다"


def strength_text(feature: str, diff: float, row: pd.Series) -> str:
    label = FEATURE_LABELS[feature]
    if feature == "nearest_park_dist_m":
        return f"유사학교 대비 {label}가 {abs(diff):.1f}m 더 짧습니다"
    if feature == "has_large_apt":
        return "유사학교 대비 대단지 아파트가 있는 생활권입니다"
    if feature == "redev_status_simple":
        return f"유사학교 대비 재개발 상태가 더 활발합니다 ({row['redev_status_simple']})"
    if feature == "is_new_school":
        return "유사학교 대비 신설학교에 해당합니다"
    if feature in {"iso_park_count", "iso_playground_count"}:
        if abs(diff) < 1:
            return f"유사학교 대비 {label}가 소폭 더 많습니다"
        return f"유사학교 대비 {label}가 {int(round(diff))}개 더 많습니다"
    if feature == "iso_child_total":
        return f"유사학교 대비 {label}가 {int(round(diff))}명 더 많습니다"
    return f"유사학교 대비 {label}이 {diff:.1f} 더 큽니다"


def weakness_text(feature: str, diff: float, row: pd.Series) -> str:
    label = FEATURE_LABELS[feature]
    if feature == "nearest_park_dist_m":
        return f"유사학교 대비 {label}가 {abs(diff):.1f}m 더 깁니다"
    if feature == "has_large_apt":
        return "유사학교 대비 대단지 아파트가 없는 생활권입니다"
    if feature == "redev_status_simple":
        return f"유사학교 대비 재개발 상태가 더 약합니다 ({row['redev_status_simple']})"
    if feature == "is_new_school":
        return "유사학교 대비 신설학교가 아닙니다"
    if feature in {"iso_park_count", "iso_playground_count"}:
        if abs(diff) < 1:
            return f"유사학교 대비 {label}가 소폭 더 적습니다"
        return f"유사학교 대비 {label}가 {abs(int(round(diff)))}개 더 적습니다"
    if feature == "iso_child_total":
        return f"유사학교 대비 {label}가 {abs(int(round(diff)))}명 더 적습니다"
    return f"유사학교 대비 {label}이 {abs(diff):.1f} 더 작습니다"


def build_common_points(row: pd.Series, peer_mean: pd.Series, peer_std: pd.Series) -> str:
    ranked: list[tuple[float, str]] = []
    for feature in COMMON_FEATURES:
        if feature in {"has_large_apt", "is_new_school"}:
            score = 0.0 if int(row[feature]) == int(round(float(peer_mean[feature]))) else 1.0
        elif feature == "redev_status_simple":
            score = abs(
                int(row["redev_status_simple_code"])
                - int(round(float(peer_mean["redev_status_simple_code"])))
            )
        else:
            denom = float(peer_std.get(feature, 0.0))
            diff = abs(float(row[feature]) - float(peer_mean[feature]))
            score = diff / denom if denom > 0 else diff
        ranked.append((score, common_point_text(feature, row)))

    ranked.sort(key=lambda item: item[0])
    selected: list[str] = []
    for _, text in ranked:
        if text not in selected:
            selected.append(text)
        if len(selected) == 3:
            break
    return " | ".join(selected)


def build_strengths_weaknesses(
    row: pd.Series,
    peer_mean: pd.Series,
    peer_std: pd.Series,
) -> tuple[str, str]:
    strengths: list[tuple[float, str]] = []
    weaknesses: list[tuple[float, str]] = []

    for feature in EVAL_FEATURES:
        if feature in {"has_large_apt", "is_new_school"}:
            diff = int(row[feature]) - int(round(float(peer_mean[feature])))
            magnitude = abs(diff)
        elif feature == "redev_status_simple":
            diff = int(row["redev_status_simple_code"]) - int(
                round(float(peer_mean["redev_status_simple_code"]))
            )
            magnitude = abs(diff)
        else:
            diff = float(row[feature]) - float(peer_mean[feature])
            denom = float(peer_std.get(feature, 0.0))
            magnitude = abs(diff / denom) if denom > 0 else abs(diff)

        if magnitude == 0:
            continue

        if feature == "nearest_park_dist_m":
            if diff < 0:
                strengths.append((magnitude, strength_text(feature, diff, row)))
            else:
                weaknesses.append((magnitude, weakness_text(feature, diff, row)))
        else:
            if diff > 0:
                strengths.append((magnitude, strength_text(feature, diff, row)))
            else:
                weaknesses.append((magnitude, weakness_text(feature, diff, row)))

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
    group = group.reset_index(drop=True).copy()
    scaler = StandardScaler()
    scaled = scaler.fit_transform(group[knn_feature_columns()])

    neighbor_count = min(6, len(group))
    if neighbor_count < 2:
        raise ValueError(f"{bundle_label} 그룹 학교 수가 너무 적어 유사학교를 계산할 수 없습니다.")

    model = NearestNeighbors(n_neighbors=neighbor_count, metric="euclidean")
    model.fit(scaled)
    distances, indices = model.kneighbors(scaled)

    rows: list[dict[str, object]] = []
    for idx, school in group.iterrows():
        neighbor_positions = [pos for pos in indices[idx].tolist() if pos != idx][:5]
        neighbor_distances = [
            dist for pos, dist in zip(indices[idx].tolist(), distances[idx].tolist()) if pos != idx
        ][:5]
        peers = group.iloc[neighbor_positions].copy()

        peer_mean = peers[
            [
                "nearest_park_dist_m",
                "iso_park_count",
                "buf_park_area",
                "iso_playground_count",
                "iso_child_total",
                "has_large_apt",
                "redev_status_simple_code",
                "is_new_school",
            ]
        ].mean()
        peer_std = peers[
            [
                "nearest_park_dist_m",
                "iso_park_count",
                "buf_park_area",
                "iso_playground_count",
                "iso_child_total",
            ]
        ].std(ddof=0).replace(0, np.nan)

        strengths, weaknesses = build_strengths_weaknesses(school, peer_mean, peer_std.fillna(0))
        row: dict[str, object] = {
            "학교ID": school["학교ID"],
            "학교명": school["학교명"],
            "gu": school["gu"],
            "similarity_group": bundle_label,
            "similarity_features": similarity_feature_label_list(),
            "large_apt_flag": int(school["has_large_apt"]),
            "redev_status_simple": school["redev_status_simple"],
            "common_points": build_common_points(school, peer_mean, peer_std.fillna(0)),
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
    rows: list[dict[str, object]] = []
    for bundle_flag, bundle_label in [(0, "mainstream"), (1, "separate_bundle")]:
        group = df[df["is_separate_bundle_tag"] == bundle_flag].copy()
        rows.extend(process_group(group, bundle_label))

    result = pd.DataFrame(rows).sort_values(["similarity_group", "gu", "학교명"]).reset_index(drop=True)
    result.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUTPUT_CSV}")
    print(f"rows: {len(result)}")


if __name__ == "__main__":
    main()
