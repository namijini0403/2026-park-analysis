from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data/processed"
OUTPUT_DIR = BASE_DIR / "output"

PUBLIC_PLAYGROUND_NAME_EXCEPTIONS = {
    # CONTEXT.md 2026-04-22: public park name correction exceptions.
    "가경공원": 3015.4,
    "수차공원": 2348.0,
}


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_m = 6_371_008.8
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    )
    return radius_m * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def classify_extra(extra_m: float) -> str:
    if extra_m < 0:
        return "negative"
    if extra_m < 50:
        return "0-50m"
    if extra_m < 100:
        return "50-100m"
    if extra_m < 200:
        return "100-200m"
    if extra_m < 300:
        return "200-300m"
    if extra_m < 500:
        return "300-500m"
    return "500m+"


def classify_ratio(ratio: float) -> str:
    if pd.isna(ratio):
        return "not_applicable"
    if ratio < 1.2:
        return "1.0-1.2x"
    if ratio < 1.5:
        return "1.2-1.5x"
    if ratio < 2.0:
        return "1.5-2.0x"
    if ratio < 3.0:
        return "2.0-3.0x"
    return "3.0x+"


def pct(series: pd.Series, q: float) -> float:
    return float(series.quantile(q))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    nearest = pd.read_csv(DATA_DIR / "school_nearest_park.csv")
    schools = pd.read_csv(DATA_DIR / "schools.csv")
    parks = pd.read_csv(DATA_DIR / "parks.csv")
    priority = pd.read_csv(
        DATA_DIR / "school_priority.csv",
        usecols=["학교ID", "gu", "case_type", "is_separate_bundle_tag", "is_island_tag"],
    )

    public_parks = parks[
        parks["시설유형"].ne("놀이터")
        | parks["공원명"].isin(PUBLIC_PLAYGROUND_NAME_EXCEPTIONS)
    ].copy()
    for park_name, area_m2 in PUBLIC_PLAYGROUND_NAME_EXCEPTIONS.items():
        mask = public_parks["공원명"].eq(park_name) & public_parks["공원면적"].isna()
        public_parks.loc[mask, "공원면적"] = area_m2

    rows: list[dict[str, object]] = []
    unmatched: list[dict[str, object]] = []

    for row in nearest.itertuples(index=False):
        school = schools.loc[schools["학교ID"].eq(row.학교ID)]
        if school.empty:
            unmatched.append(
                {"학교ID": row.학교ID, "학교명": row.학교명, "reason": "school_not_found"}
            )
            continue

        school_row = school.iloc[0]
        park_candidates = public_parks.loc[public_parks["공원명"].eq(row.nearest_park_name)]
        if park_candidates.empty:
            unmatched.append(
                {"학교ID": row.학교ID, "학교명": row.학교명, "reason": "park_not_found"}
            )
            continue

        s_lat = float(school_row["위도"])
        s_lon = float(school_row["경도"])
        candidates = []
        for park in park_candidates.itertuples(index=False):
            straight_m = haversine_m(s_lat, s_lon, float(park.위도), float(park.경도))
            candidates.append((straight_m, park))

        straight_center_m, matched_park = min(candidates, key=lambda item: item[0])
        park_area_m2 = float(matched_park.공원면적) if pd.notna(matched_park.공원면적) else 0.0
        park_radius_m = math.sqrt(max(park_area_m2, 0.0) / math.pi)
        straight_edge_m = max(0.0, straight_center_m - park_radius_m)
        walk_m = float(row.nearest_park_dist_m)
        extra_center_m = walk_m - straight_center_m
        extra_edge_m = walk_m - straight_edge_m
        ratio_edge = walk_m / straight_edge_m if straight_edge_m > 0 else float("nan")
        ratio_center = walk_m / straight_center_m if straight_center_m > 0 else float("nan")

        rows.append(
            {
                "학교ID": row.학교ID,
                "학교명": row.학교명,
                "nearest_park_name": row.nearest_park_name,
                "matched_park_id": matched_park.관리번호,
                "matched_park_gu": matched_park.gu,
                "matched_park_type": matched_park.공원구분,
                "matched_park_area_m2": round(park_area_m2, 1),
                "estimated_park_radius_m": round(park_radius_m, 1),
                "walk_distance_m": round(walk_m, 1),
                "straight_center_distance_m": round(straight_center_m, 1),
                "straight_edge_est_distance_m": round(straight_edge_m, 1),
                "extra_walk_vs_center_m": round(extra_center_m, 1),
                "extra_walk_vs_edge_est_m": round(extra_edge_m, 1),
                "extra_walk_vs_edge_clamped_m": round(max(0.0, extra_edge_m), 1),
                "walk_to_center_ratio": round(ratio_center, 3),
                "walk_to_edge_est_ratio": round(ratio_edge, 3)
                if pd.notna(ratio_edge)
                else float("nan"),
                "extra_bucket": classify_extra(extra_edge_m),
                "ratio_bucket": classify_ratio(ratio_edge),
                "park_name_candidate_count": int(len(park_candidates)),
            }
        )

    result = pd.DataFrame(rows)
    result = result.merge(priority, on="학교ID", how="left")
    result["is_core_case"] = (
        pd.to_numeric(result["case_type"], errors="coerce").notna()
        & pd.to_numeric(result["is_separate_bundle_tag"], errors="coerce").fillna(0).eq(0)
    )
    result = result.sort_values(
        ["extra_walk_vs_edge_est_m", "walk_to_edge_est_ratio"], ascending=False
    )

    csv_path = OUTPUT_DIR / "nearest_park_walk_vs_straight_20260423.csv"
    json_path = OUTPUT_DIR / "nearest_park_walk_vs_straight_summary_20260423.json"
    md_path = OUTPUT_DIR / "nearest_park_walk_vs_straight_summary_20260423.md"
    unmatched_path = OUTPUT_DIR / "nearest_park_walk_vs_straight_unmatched_20260423.csv"

    result.to_csv(csv_path, index=False, encoding="utf-8-sig")
    pd.DataFrame(unmatched).to_csv(unmatched_path, index=False, encoding="utf-8-sig")

    matched = result.copy()
    core = matched[matched["is_core_case"]].copy()
    valid_ratio = core.dropna(subset=["walk_to_edge_est_ratio"]).copy()

    def metric_summary(df: pd.DataFrame, col: str) -> dict[str, float]:
        return {
            "mean": round(float(df[col].mean()), 1),
            "median": round(float(df[col].median()), 1),
            "p75": round(pct(df[col], 0.75), 1),
            "p90": round(pct(df[col], 0.90), 1),
            "max": round(float(df[col].max()), 1),
        }

    summary = {
        "n_schools_total": int(len(nearest)),
        "n_matched": int(len(matched)),
        "n_unmatched": int(len(unmatched)),
        "n_core_case_matched": int(len(core)),
        "n_non_core_matched": int(len(matched) - len(core)),
        "walk_distance_m_core": metric_summary(core, "walk_distance_m"),
        "straight_center_distance_m_core": metric_summary(core, "straight_center_distance_m"),
        "straight_edge_est_distance_m_core": metric_summary(
            core, "straight_edge_est_distance_m"
        ),
        "extra_walk_vs_center_m_core": metric_summary(core, "extra_walk_vs_center_m"),
        "extra_walk_vs_edge_est_m_core": metric_summary(core, "extra_walk_vs_edge_est_m"),
        "extra_walk_vs_edge_clamped_m_core": metric_summary(
            core, "extra_walk_vs_edge_clamped_m"
        ),
        "walk_to_edge_est_ratio_core": {
            "mean": round(float(valid_ratio["walk_to_edge_est_ratio"].mean()), 3),
            "median": round(float(valid_ratio["walk_to_edge_est_ratio"].median()), 3),
            "p75": round(pct(valid_ratio["walk_to_edge_est_ratio"], 0.75), 3),
            "p90": round(pct(valid_ratio["walk_to_edge_est_ratio"], 0.90), 3),
            "max": round(float(valid_ratio["walk_to_edge_est_ratio"].max()), 3),
        },
        "extra_bucket_counts_core": core["extra_bucket"].value_counts().sort_index().to_dict(),
        "extra_clamped_bucket_counts_core": pd.cut(
            core["extra_walk_vs_edge_clamped_m"],
            bins=[-0.1, 0, 50, 100, 200, 300, 500, float("inf")],
            labels=["0m", "0-50m", "50-100m", "100-200m", "200-300m", "300-500m", "500m+"],
        )
        .value_counts()
        .sort_index()
        .to_dict(),
        "ratio_bucket_counts_core": core["ratio_bucket"].value_counts().sort_index().to_dict(),
        "case_type_summary": (
            core.groupby("case_type", dropna=False)
            .agg(
                schools=("학교ID", "count"),
                mean_walk_m=("walk_distance_m", "mean"),
                mean_straight_edge_est_m=("straight_edge_est_distance_m", "mean"),
                mean_extra_edge_est_m=("extra_walk_vs_edge_est_m", "mean"),
                mean_ratio_edge_est=("walk_to_edge_est_ratio", "mean"),
            )
            .round(2)
            .reset_index()
            .to_dict(orient="records")
        ),
        "top_extra": core.head(15).to_dict(orient="records"),
        "top_ratio": valid_ratio.sort_values("walk_to_edge_est_ratio", ascending=False)
        .head(15)
        .to_dict(orient="records"),
        "outputs": {
            "csv": str(csv_path.relative_to(BASE_DIR)),
            "json": str(json_path.relative_to(BASE_DIR)),
            "markdown": str(md_path.relative_to(BASE_DIR)),
            "unmatched_csv": str(unmatched_path.relative_to(BASE_DIR)),
        },
    }

    json_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    top_extra_lines = "\n".join(
        f"| {r['학교명']} | {r['nearest_park_name']} | {r['walk_distance_m']:.1f} | "
        f"{r['straight_edge_est_distance_m']:.1f} | {r['extra_walk_vs_edge_est_m']:.1f} | "
        f"{r['walk_to_edge_est_ratio']:.2f} |"
        for r in summary["top_extra"][:10]
    )
    extra_bucket_lines = "\n".join(
        f"| {bucket} | {count} |"
        for bucket, count in summary["extra_bucket_counts_core"].items()
    )
    extra_clamped_bucket_lines = "\n".join(
        f"| {bucket} | {count} |"
        for bucket, count in summary["extra_clamped_bucket_counts_core"].items()
    )
    ratio_bucket_lines = "\n".join(
        f"| {bucket} | {count} |"
        for bucket, count in summary["ratio_bucket_counts_core"].items()
    )

    md = f"""# 최근접 공원 직선거리 vs 도보거리 비교 (2026-04-23)

## 기준
- 대상: 전체 학교 {summary['n_schools_total']}개교
- 매칭 성공: {summary['n_matched']}개교
- 본류 case1~4 매칭 성공: {summary['n_core_case_matched']}개교
- 도보거리 기준: `data_processed/school_nearest_park.csv`
- 직선거리 기준: 학교 좌표와 도보 최근접 공원 경계 간 추정거리
- 공원 경계는 공원면적을 원형으로 환산한 반지름을 공원 중심점 직선거리에서 차감해 근사
- 공원명 중복 시 같은 이름 후보 중 학교에서 직선으로 가장 가까운 공원을 사용

## 전체 요약
| 지표 | 평균 | 중앙값 | 75분위 | 90분위 | 최대 |
|---|---:|---:|---:|---:|---:|
| 도보거리(m) | {summary['walk_distance_m_core']['mean']} | {summary['walk_distance_m_core']['median']} | {summary['walk_distance_m_core']['p75']} | {summary['walk_distance_m_core']['p90']} | {summary['walk_distance_m_core']['max']} |
| 직선거리 추정(m) | {summary['straight_edge_est_distance_m_core']['mean']} | {summary['straight_edge_est_distance_m_core']['median']} | {summary['straight_edge_est_distance_m_core']['p75']} | {summary['straight_edge_est_distance_m_core']['p90']} | {summary['straight_edge_est_distance_m_core']['max']} |
| 추가 도보거리(m) | {summary['extra_walk_vs_edge_est_m_core']['mean']} | {summary['extra_walk_vs_edge_est_m_core']['median']} | {summary['extra_walk_vs_edge_est_m_core']['p75']} | {summary['extra_walk_vs_edge_est_m_core']['p90']} | {summary['extra_walk_vs_edge_est_m_core']['max']} |
| 실질 추가거리(m, 음수 0 처리) | {summary['extra_walk_vs_edge_clamped_m_core']['mean']} | {summary['extra_walk_vs_edge_clamped_m_core']['median']} | {summary['extra_walk_vs_edge_clamped_m_core']['p75']} | {summary['extra_walk_vs_edge_clamped_m_core']['p90']} | {summary['extra_walk_vs_edge_clamped_m_core']['max']} |
| 도보/직선 배율 | {summary['walk_to_edge_est_ratio_core']['mean']} | {summary['walk_to_edge_est_ratio_core']['median']} | {summary['walk_to_edge_est_ratio_core']['p75']} | {summary['walk_to_edge_est_ratio_core']['p90']} | {summary['walk_to_edge_est_ratio_core']['max']} |

## 추가 도보거리 분포
| 구간 | 학교 수 |
|---|---:|
{extra_bucket_lines}

## 실질 추가거리 분포
| 구간 | 학교 수 |
|---|---:|
{extra_clamped_bucket_lines}

## 도보/직선 배율 분포
| 구간 | 학교 수 |
|---|---:|
{ratio_bucket_lines}

## 추가 도보거리 상위 10개교
| 학교명 | 최근접 공원 | 도보(m) | 직선(m) | 추가(m) | 배율 |
|---|---|---:|---:|---:|---:|
{top_extra_lines}
"""
    md_path.write_text(md, encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
