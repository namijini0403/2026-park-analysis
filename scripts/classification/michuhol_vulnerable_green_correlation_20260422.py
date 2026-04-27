from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats


BASE = Path(r"C:\2026_data_analysis_park")
RAW = BASE / "data/raw"
PROCESSED = BASE / "data/processed"
OUTPUT = BASE / "output"

RAW_SCHOOL_STANDARD_SIZE = 3370919
RAW_WELFARE_SIZE = 897


def read_by_size(directory: Path, size: int, encoding: str) -> pd.DataFrame:
    matches = [path for path in directory.iterdir() if path.is_file() and path.stat().st_size == size]
    if len(matches) != 1:
        raise FileNotFoundError(f"Expected exactly one file with size {size}, found {len(matches)}")
    return pd.read_csv(matches[0], encoding=encoding)


def base_dong(value: object) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    for name in ["숭의", "용현", "학익", "도화", "주안", "관교", "문학"]:
        if text.startswith(name) or f" {name}동" in text or f" {name}" in text:
            return f"{name}동"
    return text


def corr_record(df: pd.DataFrame, x_col: str, y_col: str, method: str) -> dict[str, float | int | str]:
    x = pd.to_numeric(df[x_col], errors="coerce")
    y = pd.to_numeric(df[y_col], errors="coerce")
    mask = x.notna() & y.notna()
    x = x[mask]
    y = y[mask]
    if len(x) < 3 or x.nunique() < 2 or y.nunique() < 2:
        return {"method": method, "n": int(len(x)), "statistic": math.nan, "p_value": math.nan}
    if method == "pearson":
        r, p = stats.pearsonr(x, y)
    elif method == "spearman":
        r, p = stats.spearmanr(x, y)
    elif method == "kendall":
        r, p = stats.kendalltau(x, y)
    else:
        raise ValueError(method)
    return {"method": method, "n": int(len(x)), "statistic": float(r), "p_value": float(p)}


def add_total_welfare_columns(welfare: pd.DataFrame) -> pd.DataFrame:
    result = welfare.copy()
    household_cols = [col for col in result.columns if col.endswith("가구수")]
    person_cols = [col for col in result.columns if col.endswith("자수")]
    for col in household_cols + person_cols:
        result[col] = pd.to_numeric(result[col], errors="coerce").fillna(0)
    result["vulnerable_households_total"] = result[household_cols].sum(axis=1)
    result["vulnerable_persons_total"] = result[person_cols].sum(axis=1)
    result["base_dong"] = result["동명"].map(base_dong)
    return result


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)

    welfare = add_total_welfare_columns(read_by_size(RAW, RAW_WELFARE_SIZE, "cp949"))
    priority = pd.read_csv(PROCESSED / "school_priority.csv", encoding="utf-8-sig")
    schools_michuhol = pd.read_csv(PROCESSED / "schools_michuhol.csv", encoding="utf-8-sig")
    school_standard = read_by_size(RAW, RAW_SCHOOL_STANDARD_SIZE, "cp949")

    school_ids = schools_michuhol["학교ID"]
    standard_subset = school_standard[school_standard["학교ID"].isin(school_ids)][
        ["학교ID", "소재지지번주소"]
    ].copy()
    standard_subset["base_dong"] = standard_subset["소재지지번주소"].map(base_dong)

    school_green = (
        schools_michuhol[["학교ID", "학교명", "위도", "경도"]]
        .merge(standard_subset, on="학교ID", how="left")
        .merge(
            priority[
                [
                    "학교ID",
                    "iso_green_ratio",
                    "nearest_park_dist_m",
                    "case_type",
                    "case_label",
                    "iso_park_count",
                    "iso_playground_count",
                ]
            ],
            on="학교ID",
            how="left",
        )
    )

    welfare_by_dong = (
        welfare.groupby("base_dong", as_index=False)
        .agg(
            vulnerable_households_total=("vulnerable_households_total", "sum"),
            vulnerable_persons_total=("vulnerable_persons_total", "sum"),
            welfare_source_rows=("동명", lambda s: ", ".join(s.astype(str))),
        )
    )

    green_by_dong = (
        school_green.groupby("base_dong", as_index=False)
        .agg(
            school_count=("학교ID", "count"),
            avg_green_ratio=("iso_green_ratio", "mean"),
            median_green_ratio=("iso_green_ratio", "median"),
            min_green_ratio=("iso_green_ratio", "min"),
            avg_nearest_public_park_dist_m=("nearest_park_dist_m", "mean"),
            case1_2_school_count=("case_type", lambda s: int(pd.Series(s).isin([1.0, 2.0]).sum())),
            school_names=("학교명", lambda s: ", ".join(s.astype(str))),
        )
    )

    dong_analysis = welfare_by_dong.merge(green_by_dong, on="base_dong", how="inner").sort_values(
        "vulnerable_persons_total", ascending=False
    )
    dong_analysis["case1_2_share"] = dong_analysis["case1_2_school_count"] / dong_analysis["school_count"]

    school_sensitivity = school_green.merge(welfare_by_dong, on="base_dong", how="left")

    dong_corrs = []
    for y_col in [
        "avg_green_ratio",
        "median_green_ratio",
        "min_green_ratio",
        "avg_nearest_public_park_dist_m",
        "case1_2_share",
    ]:
        for method in ["pearson", "spearman", "kendall"]:
            rec = corr_record(dong_analysis, "vulnerable_persons_total", y_col, method)
            rec["x"] = "vulnerable_persons_total"
            rec["y"] = y_col
            rec["analysis_level"] = "base_dong"
            dong_corrs.append(rec)

    school_corrs = []
    for y_col in ["iso_green_ratio", "nearest_park_dist_m"]:
        for method in ["pearson", "spearman", "kendall"]:
            rec = corr_record(school_sensitivity, "vulnerable_persons_total", y_col, method)
            rec["x"] = "vulnerable_persons_total_assigned_by_base_dong"
            rec["y"] = y_col
            rec["analysis_level"] = "school_sensitivity_clustered"
            school_corrs.append(rec)

    corrs = pd.DataFrame(dong_corrs + school_corrs)

    out_dong = OUTPUT / "michuhol_vulnerable_green_by_dong_20260422.csv"
    out_school = OUTPUT / "michuhol_vulnerable_green_school_sensitivity_20260422.csv"
    out_corr = OUTPUT / "michuhol_vulnerable_green_correlation_20260422.csv"
    out_json = OUTPUT / "michuhol_vulnerable_green_correlation_20260422.json"
    out_md = OUTPUT / "michuhol_vulnerable_green_correlation_20260422.md"

    dong_analysis.to_csv(out_dong, index=False, encoding="utf-8-sig")
    school_sensitivity.to_csv(out_school, index=False, encoding="utf-8-sig")
    corrs.to_csv(out_corr, index=False, encoding="utf-8-sig")

    summary = {
        "dong_n": int(len(dong_analysis)),
        "school_n": int(len(school_sensitivity)),
        "dong_analysis": dong_analysis.to_dict(orient="records"),
        "correlations": corrs.to_dict(orient="records"),
    }
    out_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    primary = corrs[
        (corrs["analysis_level"] == "base_dong")
        & (corrs["x"] == "vulnerable_persons_total")
        & (corrs["y"] == "avg_green_ratio")
    ].copy()
    lines = [
        "# 미추홀구 기초수급자 수와 학교 도보권 녹지비율 상관분석",
        "",
        "## 분석 단위",
        "- 기초수급자 데이터: `data_raw/인천광역시 미추홀구_기초생활수급현황_20250430.csv`",
        "- 녹지비율 데이터: `data_processed/school_priority.csv`의 `iso_green_ratio`",
        "- 결합 방식: 학교 지번주소의 법정동을 기준으로 행정동 기초수급자 수를 7개 법정동 그룹으로 합산",
        "- 원본 `data_raw` 파일은 수정하지 않음",
        "",
        "## 주 분석 결과: 취약계층 인구수 vs 동별 평균 녹지비율",
    ]
    for _, row in primary.iterrows():
        lines.append(
            f"- {row['method']}: n={int(row['n'])}, r={row['statistic']:.3f}, p={row['p_value']:.3f}"
        )
    lines.extend(
        [
            "",
            "## 해석 주의",
            "- 표본이 7개 동 그룹으로 작아 p-value의 검정력은 낮음",
            "- 학교 도보권 녹지비율을 동 전체 녹지비율의 proxy로 사용했으므로 동 전체 환경을 직접 측정한 값은 아님",
            "- 학교 단위 민감도 분석은 같은 동의 취약계층 수가 여러 학교에 반복 배정되므로 독립 표본 검정으로 해석하면 안 됨",
            "",
            "## 산출 파일",
            f"- `{out_dong}`",
            f"- `{out_school}`",
            f"- `{out_corr}`",
            f"- `{out_json}`",
        ]
    )
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print("dong analysis")
    print(dong_analysis.to_string(index=False))
    print("\ncorrelations")
    print(corrs.to_string(index=False))
    print(f"\nsaved: {out_md}")


if __name__ == "__main__":
    main()
