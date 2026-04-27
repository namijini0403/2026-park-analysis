from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data/processed"
OUTPUT_DIR = BASE_DIR / "output"
BUFFER_500M_AREA_M2 = math.pi * 500**2


def pct(series: pd.Series, q: float) -> float:
    return float(series.quantile(q))


def metric_summary(series: pd.Series, decimals: int = 2) -> dict[str, float]:
    clean = pd.to_numeric(series, errors="coerce").dropna()
    return {
        "mean": round(float(clean.mean()), decimals),
        "median": round(float(clean.median()), decimals),
        "p25": round(pct(clean, 0.25), decimals),
        "p75": round(pct(clean, 0.75), decimals),
        "p90": round(pct(clean, 0.90), decimals),
        "min": round(float(clean.min()), decimals),
        "max": round(float(clean.max()), decimals),
    }


def loss_bucket(loss_pp: float) -> str:
    if loss_pp <= 0:
        return "도보권이 같거나 높음"
    if loss_pp < 1:
        return "0-1%p 감소"
    if loss_pp < 5:
        return "1-5%p 감소"
    if loss_pp < 10:
        return "5-10%p 감소"
    if loss_pp < 20:
        return "10-20%p 감소"
    if loss_pp < 50:
        return "20-50%p 감소"
    return "50%p+ 감소"


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(DATA_DIR / "school_priority.csv")
    numeric_cols = [
        "buf_park_area",
        "iso_park_area",
        "iso_green_ratio",
        "iso_green_ratio_raw",
        "isochrone_area_m2",
        "case_type",
        "is_separate_bundle_tag",
        "is_island_tag",
    ]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    out = df[
        [
            "학교ID",
            "학교명",
            "gu",
            "case_type",
            "is_separate_bundle_tag",
            "is_island_tag",
            "buf_park_count",
            "iso_park_count",
            "buf_park_area",
            "iso_park_area",
            "isochrone_area_m2",
            "iso_green_ratio",
            "iso_green_ratio_raw",
        ]
    ].copy()

    out["buffer_500m_area_m2"] = round(BUFFER_500M_AREA_M2, 2)
    out["buffer_green_ratio_raw"] = out["buf_park_area"] / BUFFER_500M_AREA_M2 * 100.0
    out["buffer_green_ratio"] = out["buffer_green_ratio_raw"].clip(lower=0.0, upper=100.0)
    out["walk_green_ratio_raw_calc"] = np.where(
        out["isochrone_area_m2"] > 0,
        out["iso_park_area"] / out["isochrone_area_m2"] * 100.0,
        0.0,
    )
    out["walk_green_ratio"] = out["iso_green_ratio"].clip(lower=0.0, upper=100.0)
    out["walk_minus_buffer_pp"] = out["walk_green_ratio"] - out["buffer_green_ratio"]
    out["buffer_to_walk_loss_pp"] = out["buffer_green_ratio"] - out["walk_green_ratio"]
    out["retained_green_ratio_pct"] = np.where(
        out["buffer_green_ratio"] > 0,
        out["walk_green_ratio"] / out["buffer_green_ratio"] * 100.0,
        np.nan,
    )
    out["loss_bucket"] = out["buffer_to_walk_loss_pp"].apply(loss_bucket)
    out["is_core_case"] = (
        out["case_type"].notna() & out["is_separate_bundle_tag"].fillna(0).eq(0)
    )

    round_cols = [
        "buffer_green_ratio_raw",
        "buffer_green_ratio",
        "walk_green_ratio_raw_calc",
        "walk_green_ratio",
        "walk_minus_buffer_pp",
        "buffer_to_walk_loss_pp",
        "retained_green_ratio_pct",
    ]
    out[round_cols] = out[round_cols].round(4)

    out = out.sort_values("buffer_to_walk_loss_pp", ascending=False)

    csv_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_20260423.csv"
    json_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_summary_20260423.json"
    md_path = OUTPUT_DIR / "buffer_500m_vs_walk_500m_green_ratio_summary_20260423.md"

    out.to_csv(csv_path, index=False, encoding="utf-8-sig")

    core = out[out["is_core_case"]].copy()
    all_valid = out.copy()

    def make_summary(label: str, data: pd.DataFrame) -> dict[str, object]:
        loss = pd.to_numeric(data["buffer_to_walk_loss_pp"], errors="coerce")
        return {
            "label": label,
            "schools": int(len(data)),
            "buffer_green_ratio": metric_summary(data["buffer_green_ratio"]),
            "walk_green_ratio": metric_summary(data["walk_green_ratio"]),
            "buffer_to_walk_loss_pp": metric_summary(loss),
            "walk_minus_buffer_pp": metric_summary(data["walk_minus_buffer_pp"]),
            "retained_green_ratio_pct": metric_summary(data["retained_green_ratio_pct"]),
            "schools_walk_lower": int((loss > 0).sum()),
            "schools_walk_same_or_higher": int((loss <= 0).sum()),
            "schools_loss_5pp_plus": int((loss >= 5).sum()),
            "schools_loss_10pp_plus": int((loss >= 10).sum()),
            "schools_loss_20pp_plus": int((loss >= 20).sum()),
            "loss_bucket_counts": data["loss_bucket"].value_counts().to_dict(),
        }

    summary = {
        "basis": {
            "buffer_green_ratio": "buf_park_area / (pi * 500^2) * 100, clipped to 0-100 for main comparison",
            "walk_green_ratio": "school_priority.csv iso_green_ratio, already clipped to 0-100 under current rules",
            "difference_pp": "walk_green_ratio - buffer_green_ratio; negative means the walkable 500m area has less green ratio",
            "loss_pp": "buffer_green_ratio - walk_green_ratio; positive means loss from straight buffer to walkable area",
        },
        "all_schools": make_summary("all_schools", all_valid),
        "core_case_schools": make_summary("core_case_schools", core),
        "case_type_summary_core": (
            core.groupby("case_type", dropna=False)
            .agg(
                schools=("학교ID", "count"),
                mean_buffer_green_ratio=("buffer_green_ratio", "mean"),
                mean_walk_green_ratio=("walk_green_ratio", "mean"),
                mean_loss_pp=("buffer_to_walk_loss_pp", "mean"),
                median_loss_pp=("buffer_to_walk_loss_pp", "median"),
                loss_10pp_plus=("buffer_to_walk_loss_pp", lambda s: int((s >= 10).sum())),
            )
            .round(2)
            .reset_index()
            .to_dict(orient="records")
        ),
        "gu_summary_core": (
            core.groupby("gu", dropna=False)
            .agg(
                schools=("학교ID", "count"),
                mean_buffer_green_ratio=("buffer_green_ratio", "mean"),
                mean_walk_green_ratio=("walk_green_ratio", "mean"),
                mean_loss_pp=("buffer_to_walk_loss_pp", "mean"),
                median_loss_pp=("buffer_to_walk_loss_pp", "median"),
                loss_10pp_plus=("buffer_to_walk_loss_pp", lambda s: int((s >= 10).sum())),
            )
            .round(2)
            .reset_index()
            .sort_values("mean_loss_pp", ascending=False)
            .to_dict(orient="records")
        ),
        "top_loss_core": core.head(15).to_dict(orient="records"),
        "top_walk_higher_core": core.sort_values("walk_minus_buffer_pp", ascending=False)
        .head(15)
        .to_dict(orient="records"),
        "outputs": {
            "csv": str(csv_path.relative_to(BASE_DIR)),
            "json": str(json_path.relative_to(BASE_DIR)),
            "markdown": str(md_path.relative_to(BASE_DIR)),
        },
    }

    json_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    def table_rows(records: list[dict[str, object]], limit: int = 10) -> str:
        return "\n".join(
            "| {school} | {gu} | {buf:.2f} | {walk:.2f} | {loss:.2f} | {case} |".format(
                school=r["학교명"],
                gu=r["gu"],
                buf=float(r["buffer_green_ratio"]),
                walk=float(r["walk_green_ratio"]),
                loss=float(r["buffer_to_walk_loss_pp"]),
                case=r["case_type"],
            )
            for r in records[:limit]
        )

    core_summary = summary["core_case_schools"]
    all_summary = summary["all_schools"]
    bucket_lines = "\n".join(
        f"| {bucket} | {count} |"
        for bucket, count in core_summary["loss_bucket_counts"].items()
    )
    case_lines = "\n".join(
        "| {case} | {schools} | {buf:.2f} | {walk:.2f} | {loss:.2f} | {loss10} |".format(
            case=r["case_type"],
            schools=r["schools"],
            buf=float(r["mean_buffer_green_ratio"]),
            walk=float(r["mean_walk_green_ratio"]),
            loss=float(r["mean_loss_pp"]),
            loss10=int(r["loss_10pp_plus"]),
        )
        for r in summary["case_type_summary_core"]
    )

    md = f"""# 반경 500m vs 도보 500m 녹지비율 비교 (2026-04-23)

## 기준
- 대상: 전체 272개교, 본류 case1~4 {core_summary['schools']}개교
- 반경 500m 녹지비율: `buf_park_area / (π × 500²) × 100`
- 도보 500m 녹지비율: `school_priority.csv`의 `iso_green_ratio`
- 메인 비교값은 0~100%로 클립한 녹지비율 기준
- 차이: `도보 녹지비율 - 반경 녹지비율`
- 손실: `반경 녹지비율 - 도보 녹지비율`

## 전체 요약
| 대상 | 학교 수 | 반경 평균(%) | 도보 평균(%) | 평균 손실(%p) | 중앙 손실(%p) | 10%p+ 손실 |
|---|---:|---:|---:|---:|---:|---:|
| 전체 | {all_summary['schools']} | {all_summary['buffer_green_ratio']['mean']} | {all_summary['walk_green_ratio']['mean']} | {all_summary['buffer_to_walk_loss_pp']['mean']} | {all_summary['buffer_to_walk_loss_pp']['median']} | {all_summary['schools_loss_10pp_plus']} |
| 본류 case1~4 | {core_summary['schools']} | {core_summary['buffer_green_ratio']['mean']} | {core_summary['walk_green_ratio']['mean']} | {core_summary['buffer_to_walk_loss_pp']['mean']} | {core_summary['buffer_to_walk_loss_pp']['median']} | {core_summary['schools_loss_10pp_plus']} |

## 본류 case1~4 분위값
| 지표 | 평균 | 중앙값 | 25분위 | 75분위 | 90분위 | 최소 | 최대 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 반경 녹지비율(%) | {core_summary['buffer_green_ratio']['mean']} | {core_summary['buffer_green_ratio']['median']} | {core_summary['buffer_green_ratio']['p25']} | {core_summary['buffer_green_ratio']['p75']} | {core_summary['buffer_green_ratio']['p90']} | {core_summary['buffer_green_ratio']['min']} | {core_summary['buffer_green_ratio']['max']} |
| 도보 녹지비율(%) | {core_summary['walk_green_ratio']['mean']} | {core_summary['walk_green_ratio']['median']} | {core_summary['walk_green_ratio']['p25']} | {core_summary['walk_green_ratio']['p75']} | {core_summary['walk_green_ratio']['p90']} | {core_summary['walk_green_ratio']['min']} | {core_summary['walk_green_ratio']['max']} |
| 손실(%p) | {core_summary['buffer_to_walk_loss_pp']['mean']} | {core_summary['buffer_to_walk_loss_pp']['median']} | {core_summary['buffer_to_walk_loss_pp']['p25']} | {core_summary['buffer_to_walk_loss_pp']['p75']} | {core_summary['buffer_to_walk_loss_pp']['p90']} | {core_summary['buffer_to_walk_loss_pp']['min']} | {core_summary['buffer_to_walk_loss_pp']['max']} |

## 손실 분포
| 구간 | 학교 수 |
|---|---:|
{bucket_lines}

## case별 평균
| case | 학교 수 | 반경 평균(%) | 도보 평균(%) | 평균 손실(%p) | 10%p+ 손실 학교 |
|---|---:|---:|---:|---:|---:|
{case_lines}

## 손실 상위 10개교
| 학교명 | 구 | 반경 녹지(%) | 도보 녹지(%) | 손실(%p) | case |
|---|---|---:|---:|---:|---:|
{table_rows(summary['top_loss_core'])}
"""
    md_path.write_text(md, encoding="utf-8")

    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
