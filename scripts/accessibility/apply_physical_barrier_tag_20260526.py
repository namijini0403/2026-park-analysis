from __future__ import annotations

from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
DATA_PATHS = [
    ROOT / "data_processed" / "school_priority_with_functional_park_layer.csv",
    ROOT / "vercel_public" / "data_processed" / "school_priority_with_functional_park_layer.csv",
]
AUDIT_PATH = ROOT / "outputs" / "walking_barrier_physical_tag_20260526.csv"

ACCESS_LABELS = {
    "no_official_park": "공원 접근 결핍형",
    "nominal_access_only": "명목 접근성 착시형",
    "near_park_low_green_imbalance": "근접 공원-녹지환경 불균형형",
    "functional_access_with_barrier": "보행부담 동반형",
    "functional_access_available": "활동규모 공원 접근 가능형",
    "unknown": "추가 검토 필요",
}

ACCESS_DESCRIPTIONS = {
    "no_official_park": "도보생활권 내 공식 공원이 확인되지 않아 야외활동 인프라 자체가 부족한 유형입니다.",
    "nominal_access_only": "공원은 있으나 대부분 초소형 공간으로, 단순 공원 개수만으로는 야외활동 환경을 과대평가할 수 있습니다.",
    "near_park_low_green_imbalance": "가까운 활동규모 공원은 있으나, 학교 도보생활권 전체의 녹지 비율은 낮은 유형입니다.",
    "functional_access_with_barrier": "활동규모 공원은 있으나, 도달 경로에 간선급 도로 횡단 또는 대형 교차로 통과가 확인되는 유형입니다.",
    "functional_access_available": "도보권 내 활동규모 공원이 확인되는 유형입니다.",
    "unknown": "접근성 판단에 필요한 일부 값이 누락되어 추가 검토가 필요합니다.",
}

ACCESS_PRIORITY = {
    "no_official_park": 1,
    "nominal_access_only": 2,
    "near_park_low_green_imbalance": 3,
    "functional_access_with_barrier": 4,
    "functional_access_available": 5,
    "unknown": 9,
}


def bool_series(series: pd.Series) -> pd.Series:
    text = series.astype(str).str.strip().str.lower()
    numeric = pd.to_numeric(series, errors="coerce")
    return text.eq("true") | numeric.eq(1)


def apply_physical_barrier_tag(path: Path) -> tuple[pd.DataFrame, dict[str, int], dict[str, int]]:
    df = pd.read_csv(path)
    before = df["access_condition_type"].value_counts(dropna=False).to_dict()

    functional_count = pd.to_numeric(df.get("iso_functional_park_count"), errors="coerce").fillna(0)
    functional_dist = pd.to_numeric(df.get("nearest_functional_park_dist_m"), errors="coerce")
    functional_present = functional_count.gt(0) | functional_dist.le(500)

    crossing = pd.to_numeric(df.get("nearest_functional_major_road_crossing_count"), errors="coerce").fillna(0)
    large = bool_series(df.get("nearest_functional_large_intersection_flag", pd.Series(False, index=df.index)))
    physical = functional_present & (crossing.ge(1) | large)

    bases: list[str] = []
    for cross, is_large, active in zip(crossing, large, physical):
        if not active:
            bases.append("")
            continue
        reasons: list[str] = []
        if cross >= 1:
            reasons.append(f"간선급 도로 횡단 {int(cross)}회")
        if is_large:
            reasons.append("대형 교차로 통과")
        bases.append(" · ".join(reasons))

    df["functional_access_physical_barrier_flag"] = physical
    df["functional_access_physical_barrier_label"] = physical.map({True: "보행부담 동반형", False: ""})
    df["functional_access_physical_barrier_basis"] = bases

    no_official = bool_series(df["no_official_park_flag"])
    only_micro = bool_series(df["only_micro_park_flag"])
    low_green = bool_series(df["near_park_low_green_imbalance_flag"])

    access_types: list[str] = []
    for i in df.index:
        if no_official.loc[i]:
            access_types.append("no_official_park")
        elif only_micro.loc[i]:
            access_types.append("nominal_access_only")
        elif low_green.loc[i]:
            access_types.append("near_park_low_green_imbalance")
        elif physical.loc[i]:
            access_types.append("functional_access_with_barrier")
        elif functional_present.loc[i]:
            access_types.append("functional_access_available")
        else:
            access_types.append("unknown")

    df["access_condition_type"] = access_types
    df["access_condition_label"] = df["access_condition_type"].map(ACCESS_LABELS)
    df["access_condition_description"] = df["access_condition_type"].map(ACCESS_DESCRIPTIONS)
    df["access_condition_priority"] = df["access_condition_type"].map(ACCESS_PRIORITY)

    df.to_csv(path, index=False, encoding="utf-8-sig")
    after = df["access_condition_type"].value_counts(dropna=False).to_dict()
    return df, before, after


def main() -> None:
    results = []
    for path in DATA_PATHS:
        if path.exists():
            df, before, after = apply_physical_barrier_tag(path)
            results.append((path, df, before, after))

    if not results:
        raise FileNotFoundError("No school priority CSV found")

    df = results[0][1]
    policy = df["case_type"].notna()
    physical = bool_series(df["functional_access_physical_barrier_flag"])
    audit_cols = [
        "학교ID",
        "학교명",
        "gu",
        "access_condition_type",
        "access_condition_label",
        "functional_access_physical_barrier_flag",
        "functional_access_physical_barrier_basis",
        "nearest_functional_park_name",
        "nearest_functional_major_road_crossing_count",
        "nearest_functional_large_intersection_flag",
        "nearest_functional_route_detour_ratio",
        "nearest_functional_accident_hotspot_flag",
        "display_green_ratio",
        "case_type",
    ]
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.loc[policy & physical, audit_cols].to_csv(AUDIT_PATH, index=False, encoding="utf-8-sig")

    for path, current_df, before, after in results:
        current_policy = current_df["case_type"].notna()
        current_physical = bool_series(current_df["functional_access_physical_barrier_flag"])
        print(path.relative_to(ROOT))
        print("before", before)
        print("after", after)
        print("physical_all", int(current_physical.sum()))
        print("physical_policy", int((current_policy & current_physical).sum()))
    print("audit", AUDIT_PATH.relative_to(ROOT))


if __name__ == "__main__":
    main()
