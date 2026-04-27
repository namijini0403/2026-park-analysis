"""Analyze student-weighted green accessibility across Incheon neighborhoods.

This script combines school-level priority metrics, student counts, and child
population context to create dong-level student-green indicators, correlation
tables, group tests, charts, and report summaries.
"""

from __future__ import annotations

import json
import math
import re
from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy import stats


BASE = Path(r"C:\2026_data_analysis_park")
PROCESSED = BASE / "data" / "processed"
REPORTS = BASE / "outputs" / "reports"
CHARTS = BASE / "outputs" / "charts"

SCHOOL_ASSIGNED_PATH = REPORTS / "incheon_vulnerable_green_school_assigned_20260423.csv"
DONG_BASE_PATH = REPORTS / "incheon_vulnerable_green_by_base_dong_20260423.csv"
PRIORITY_PATH = PROCESSED / "school_priority.csv"
STUDENT_TREND_PATH = PROCESSED / "student_trend.csv"
CHILD_TIMESERIES_PATH = PROCESSED / "incheon_dong_child_timeseries.csv"

OUT_DONG = REPORTS / "incheon_student_green_by_base_dong_20260424.csv"
OUT_SCHOOL = REPORTS / "incheon_student_green_school_assigned_20260424.csv"
OUT_CORR = REPORTS / "incheon_student_green_correlations_20260424.csv"
OUT_GROUP = REPORTS / "incheon_student_green_group_tests_20260424.csv"
OUT_JSON = REPORTS / "incheon_student_green_summary_20260424.json"
OUT_MD = REPORTS / "incheon_student_green_summary_20260424.md"
OUT_CHART_STUDENT_GREEN = CHARTS / "incheon_student_vs_green_scatter_20260424.png"
OUT_CHART_CHILD_LOWGREEN = CHARTS / "incheon_child_vs_lowgreen_scatter_20260424.png"

FONT_PATHS = [Path("C:/Windows/Fonts/malgun.ttf"), Path("C:/Windows/Fonts/NotoSansKR-VF.ttf")]


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


def corr_record(df: pd.DataFrame, x_col: str, y_col: str, method: str) -> dict[str, object]:
    x = pd.to_numeric(df[x_col], errors="coerce")
    y = pd.to_numeric(df[y_col], errors="coerce")
    mask = x.notna() & y.notna()
    x = x[mask]
    y = y[mask]
    if len(x) < 3 or x.nunique() < 2 or y.nunique() < 2:
        return {"method": method, "n": int(len(x)), "statistic": math.nan, "p_value": math.nan}
    if method == "pearson":
        stat, p_value = stats.pearsonr(x, y)
    elif method == "spearman":
        stat, p_value = stats.spearmanr(x, y)
    elif method == "kendall":
        stat, p_value = stats.kendalltau(x, y)
    else:
        raise ValueError(method)
    return {
        "method": method,
        "n": int(len(x)),
        "statistic": float(stat),
        "p_value": float(p_value),
    }


def mannwhitney_record(df: pd.DataFrame, group_col: str, metric_col: str) -> dict[str, object]:
    high = pd.to_numeric(df.loc[df[group_col], metric_col], errors="coerce").dropna()
    rest = pd.to_numeric(df.loc[~df[group_col], metric_col], errors="coerce").dropna()
    if len(high) < 2 or len(rest) < 2:
        return {
            "group": group_col,
            "metric": metric_col,
            "high_n": int(len(high)),
            "rest_n": int(len(rest)),
            "high_mean": float(high.mean()) if len(high) else math.nan,
            "rest_mean": float(rest.mean()) if len(rest) else math.nan,
            "mean_diff": math.nan,
            "u_statistic": math.nan,
            "p_value": math.nan,
        }
    u_stat, p_value = stats.mannwhitneyu(high, rest, alternative="two-sided")
    return {
        "group": group_col,
        "metric": metric_col,
        "high_n": int(len(high)),
        "rest_n": int(len(rest)),
        "high_mean": float(high.mean()),
        "rest_mean": float(rest.mean()),
        "mean_diff": float(high.mean() - rest.mean()),
        "u_statistic": float(u_stat),
        "p_value": float(p_value),
    }


def build_admin_to_base_map() -> dict[str, str]:
    df = pd.read_csv(DONG_BASE_PATH)
    mapping: dict[str, str] = {}
    for row in df.itertuples(index=False):
        base_dong = str(row.base_dong).strip()
        for token in str(row.source_admin_dongs).split(","):
            admin = token.strip()
            if admin:
                mapping[admin] = base_dong
    return mapping


def admin_name_to_base_dong(dong_name: object, admin_to_base: dict[str, str]) -> str:
    leaf = str(dong_name or "").strip().split()[-1]
    if not leaf:
        return ""
    if leaf in admin_to_base:
        return admin_to_base[leaf]
    if leaf.endswith(("읍", "면")):
        return leaf
    match = re.match(r"(.+?)(?:\d+|[\d,]+)동$", leaf)
    if match:
        return f"{match.group(1)}동"
    return leaf


def weighted_mean(values: pd.Series, weights: pd.Series) -> float:
    values_num = pd.to_numeric(values, errors="coerce")
    weights_num = pd.to_numeric(weights, errors="coerce")
    mask = values_num.notna() & weights_num.notna() & weights_num.gt(0)
    if not mask.any():
        return float(values_num.mean())
    return float(np.average(values_num[mask], weights=weights_num[mask]))


def latest_students_by_school() -> pd.DataFrame:
    trend = pd.read_csv(STUDENT_TREND_PATH)
    latest = (
        trend.sort_values(["학교ID", "연도"])
        .groupby("학교ID", as_index=False)
        .tail(1)
        .rename(columns={"연도": "student_data_year", "학생수": "current_students"})
    )
    return latest[["학교ID", "current_students", "student_data_year"]]


def build_school_level_dataset() -> pd.DataFrame:
    school = pd.read_csv(SCHOOL_ASSIGNED_PATH)
    priority = pd.read_csv(PRIORITY_PATH)[["학교ID", "iso_park_area"]]
    students = latest_students_by_school()

    school = school[school["is_core_case"].fillna(False)].copy()
    school = school[school["is_island_tag"].fillna(0).eq(0)].copy()
    school = school.merge(priority, on="학교ID", how="left")
    school = school.merge(students, on="학교ID", how="left")
    school["current_students"] = pd.to_numeric(school["current_students"], errors="coerce")
    school["iso_green_ratio"] = pd.to_numeric(school["iso_green_ratio"], errors="coerce")
    school["nearest_park_dist_m"] = pd.to_numeric(school["nearest_park_dist_m"], errors="coerce")
    school["iso_park_count"] = pd.to_numeric(school["iso_park_count"], errors="coerce")
    school["iso_park_area"] = pd.to_numeric(school["iso_park_area"], errors="coerce")
    school["under1_green_flag"] = school["under1_green_flag"].fillna(False).astype(bool)
    school["park_area_per_student_school"] = school["iso_park_area"] / school["current_students"]
    school.loc[~np.isfinite(school["park_area_per_student_school"]), "park_area_per_student_school"] = np.nan
    return school


def build_child_by_base_dong() -> pd.DataFrame:
    admin_to_base = build_admin_to_base_map()
    child = pd.read_csv(CHILD_TIMESERIES_PATH)
    latest_year = int(child["year"].max())
    child = child[child["year"].eq(latest_year)].copy()
    child["base_dong"] = child["dong_name"].map(lambda value: admin_name_to_base_dong(value, admin_to_base))
    child["child_0_12"] = pd.to_numeric(child["child_0_12"], errors="coerce")
    grouped = (
        child.groupby(["gu_name", "base_dong"], as_index=False)
        .agg(
            child_0_12=("child_0_12", "sum"),
            source_admin_dong_count=("dong_code", "nunique"),
            source_admin_dongs=("dong_name", lambda s: ", ".join(sorted(set(map(str, s))))),
        )
        .rename(columns={"gu_name": "gu"})
    )
    grouped["child_data_year"] = latest_year
    return grouped


def aggregate_dong_metrics(school: pd.DataFrame, child: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    dong_rows: list[dict[str, object]] = []
    for (gu, base_dong), group in school.groupby(["gu", "base_dong"], dropna=False):
        total_students = pd.to_numeric(group["current_students"], errors="coerce").sum()
        low_green_students = pd.to_numeric(
            group.loc[group["under1_green_flag"], "current_students"], errors="coerce"
        ).sum()
        no_park_students = pd.to_numeric(
            group.loc[group["iso_park_count"].fillna(0).le(0), "current_students"], errors="coerce"
        ).sum()
        dong_rows.append(
            {
                "gu": gu,
                "base_dong": base_dong,
                "school_count": int(len(group)),
                "school_names": ", ".join(group["학교명"].astype(str)),
                "total_students": float(total_students),
                "mean_school_size": float(pd.to_numeric(group["current_students"], errors="coerce").mean()),
                "weighted_green_ratio": weighted_mean(group["iso_green_ratio"], group["current_students"]),
                "weighted_nearest_park_dist_m": weighted_mean(
                    group["nearest_park_dist_m"], group["current_students"]
                ),
                "mean_green_ratio": float(pd.to_numeric(group["iso_green_ratio"], errors="coerce").mean()),
                "median_green_ratio": float(pd.to_numeric(group["iso_green_ratio"], errors="coerce").median()),
                "min_green_ratio": float(pd.to_numeric(group["iso_green_ratio"], errors="coerce").min()),
                "sum_iso_park_area": float(pd.to_numeric(group["iso_park_area"], errors="coerce").sum()),
                "park_area_per_student": float(
                    pd.to_numeric(group["iso_park_area"], errors="coerce").sum() / total_students
                )
                if total_students > 0
                else math.nan,
                "low_green_school_count": int(group["under1_green_flag"].sum()),
                "low_green_student_count": float(low_green_students),
                "low_green_student_share": float(low_green_students / total_students)
                if total_students > 0
                else math.nan,
                "no_park_student_count": float(no_park_students),
                "no_park_student_share": float(no_park_students / total_students)
                if total_students > 0
                else math.nan,
            }
        )

    dong = pd.DataFrame(dong_rows)
    dong = dong.merge(child, on=["gu", "base_dong"], how="left")
    dong["student_per_child_ratio"] = dong["total_students"] / dong["child_0_12"]
    dong.loc[~np.isfinite(dong["student_per_child_ratio"]), "student_per_child_ratio"] = np.nan

    dong["student_qcut"] = pd.qcut(dong["total_students"], 4, labels=["Q1", "Q2", "Q3", "Q4"])
    dong["child_qcut"] = pd.qcut(dong["child_0_12"], 4, labels=["Q1", "Q2", "Q3", "Q4"])
    dong["high_student_concentration"] = dong["student_qcut"].eq("Q4")
    dong["high_child_population"] = dong["child_qcut"].eq("Q4")
    dong["student_green_pressure_index"] = dong["total_students"] * (1 - dong["weighted_green_ratio"] / 100)
    dong = dong.sort_values(["high_student_concentration", "total_students", "weighted_green_ratio"], ascending=[False, False, True])

    school_with_dong = school.merge(
        dong[
            [
                "gu",
                "base_dong",
                "total_students",
                "child_0_12",
                "student_qcut",
                "child_qcut",
                "high_student_concentration",
                "high_child_population",
            ]
        ].rename(
            columns={
                "total_students": "dong_total_students",
                "child_0_12": "dong_child_0_12",
            }
        ),
        on=["gu", "base_dong"],
        how="left",
    )
    return dong, school_with_dong


def build_correlation_tables(dong: pd.DataFrame, school: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    dong_corrs: list[dict[str, object]] = []
    school_corrs: list[dict[str, object]] = []

    dong_x_cols = ["total_students", "child_0_12"]
    dong_y_cols = [
        "weighted_green_ratio",
        "weighted_nearest_park_dist_m",
        "park_area_per_student",
        "low_green_student_share",
        "no_park_student_share",
        "student_per_child_ratio",
    ]
    for x_col in dong_x_cols:
        for y_col in dong_y_cols:
            for method in ["pearson", "spearman", "kendall"]:
                row = corr_record(dong, x_col, y_col, method)
                row.update({"analysis_level": "base_dong", "x": x_col, "y": y_col})
                dong_corrs.append(row)

    school_x_cols = ["dong_total_students", "dong_child_0_12", "current_students"]
    school_y_cols = ["iso_green_ratio", "nearest_park_dist_m", "park_area_per_student_school"]
    for x_col in school_x_cols:
        for y_col in school_y_cols:
            for method in ["pearson", "spearman", "kendall"]:
                row = corr_record(school, x_col, y_col, method)
                row.update({"analysis_level": "school_level", "x": x_col, "y": y_col})
                school_corrs.append(row)

    return pd.DataFrame(dong_corrs + school_corrs), pd.DataFrame(
        [mannwhitney_record(dong, group_col, metric_col) for group_col in ["high_student_concentration", "high_child_population"] for metric_col in dong_y_cols[:-1]]
    )


def regression_line(ax: plt.Axes, x: np.ndarray, y: np.ndarray, color: str) -> None:
    mask = np.isfinite(x) & np.isfinite(y)
    x = x[mask]
    y = y[mask]
    if len(x) < 2:
        return
    slope, intercept = np.polyfit(x, y, 1)
    xs = np.linspace(x.min(), x.max(), 100)
    ax.plot(xs, slope * xs + intercept, color=color, linewidth=2)


def save_scatter_plots(dong: pd.DataFrame) -> None:
    CHARTS.mkdir(parents=True, exist_ok=True)

    fig, ax = plt.subplots(figsize=(7.6, 4.6))
    x = dong["total_students"].to_numpy(dtype=float)
    y = dong["weighted_green_ratio"].to_numpy(dtype=float)
    sizes = 40 + dong["school_count"].to_numpy(dtype=float) * 18
    ax.scatter(x, y, s=sizes, color="#2563EB", alpha=0.72, edgecolor="white", linewidth=0.8)
    regression_line(ax, x, y, "#EF4444")
    focus = dong[
        dong["high_student_concentration"]
        | dong["weighted_green_ratio"].le(dong["weighted_green_ratio"].quantile(0.15))
    ]
    for row in focus.itertuples(index=False):
        ax.annotate(
            f"{row.gu} {row.base_dong}",
            (row.total_students, row.weighted_green_ratio),
            xytext=(5, 4),
            textcoords="offset points",
            fontsize=8,
            fontproperties=FONT,
        )
    ax.set_xlabel("동별 초등학생 수(학교 기준, 최신연도)", fontproperties=FONT)
    ax.set_ylabel("학생가중 평균 녹지비율(%)", fontproperties=FONT)
    ax.set_title("학생이 많이 몰린 동네의 학교 녹지 접근성", fontproperties=FONT, fontsize=12)
    ax.grid(color="#E5E7EB", linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    fig.savefig(OUT_CHART_STUDENT_GREEN, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)

    child_ready = dong[dong["child_0_12"].notna()].copy()
    fig, ax = plt.subplots(figsize=(7.6, 4.6))
    x = child_ready["child_0_12"].to_numpy(dtype=float)
    y = child_ready["low_green_student_share"].to_numpy(dtype=float) * 100
    sizes = 40 + child_ready["school_count"].to_numpy(dtype=float) * 18
    ax.scatter(x, y, s=sizes, color="#059669", alpha=0.72, edgecolor="white", linewidth=0.8)
    regression_line(ax, x, y, "#F97316")
    focus = child_ready[
        child_ready["high_child_population"]
        | child_ready["low_green_student_share"].ge(child_ready["low_green_student_share"].quantile(0.85))
    ]
    for row in focus.itertuples(index=False):
        ax.annotate(
            f"{row.gu} {row.base_dong}",
            (row.child_0_12, row.low_green_student_share * 100),
            xytext=(5, 4),
            textcoords="offset points",
            fontsize=8,
            fontproperties=FONT,
        )
    ax.set_xlabel("동별 0~12세 아동인구", fontproperties=FONT)
    ax.set_ylabel("저녹지 학교 재학생 비중(%)", fontproperties=FONT)
    ax.set_title("아동이 많은 동네의 저녹지 노출 정도", fontproperties=FONT, fontsize=12)
    ax.grid(color="#E5E7EB", linewidth=0.8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")
    fig.savefig(OUT_CHART_CHILD_LOWGREEN, dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)


def write_outputs(dong: pd.DataFrame, school: pd.DataFrame, corrs: pd.DataFrame, group_tests: pd.DataFrame) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    dong.to_csv(OUT_DONG, index=False, encoding="utf-8-sig")
    school.to_csv(OUT_SCHOOL, index=False, encoding="utf-8-sig")
    corrs.to_csv(OUT_CORR, index=False, encoding="utf-8-sig")
    group_tests.to_csv(OUT_GROUP, index=False, encoding="utf-8-sig")
    save_scatter_plots(dong)

    primary = corrs[
        (corrs["analysis_level"].eq("base_dong"))
        & (corrs["x"].isin(["total_students", "child_0_12"]))
        & (corrs["y"].isin(["weighted_green_ratio", "weighted_nearest_park_dist_m", "park_area_per_student", "low_green_student_share"]))
    ].copy()
    school_primary = corrs[
        (corrs["analysis_level"].eq("school_level"))
        & (corrs["x"].isin(["dong_total_students", "dong_child_0_12"]))
        & (corrs["y"].isin(["iso_green_ratio", "nearest_park_dist_m", "park_area_per_student_school"]))
    ].copy()

    top_pressure = dong.sort_values(
        ["high_student_concentration", "low_green_student_share", "park_area_per_student"],
        ascending=[False, False, True],
    ).head(12)

    summary = {
        "sources": {
            "school_assigned": str(SCHOOL_ASSIGNED_PATH.relative_to(BASE)),
            "school_priority": str(PRIORITY_PATH.relative_to(BASE)),
            "student_trend": str(STUDENT_TREND_PATH.relative_to(BASE)),
            "dong_child_timeseries": str(CHILD_TIMESERIES_PATH.relative_to(BASE)),
        },
        "coverage": {
            "dong_n": int(len(dong)),
            "school_n": int(len(school)),
            "student_data_year_min": int(school["student_data_year"].min()),
            "student_data_year_max": int(school["student_data_year"].max()),
            "child_data_year": int(dong["child_data_year"].dropna().max()),
            "student_missing_school_n": int(school["current_students"].isna().sum()),
            "child_missing_dong_n": int(dong["child_0_12"].isna().sum()),
        },
        "primary_correlations": primary.to_dict(orient="records"),
        "school_level_correlations": school_primary.to_dict(orient="records"),
        "group_tests": group_tests.to_dict(orient="records"),
        "top_pressure_dongs": top_pressure.to_dict(orient="records"),
        "outputs": {
            "dong_csv": str(OUT_DONG.relative_to(BASE)),
            "school_csv": str(OUT_SCHOOL.relative_to(BASE)),
            "correlation_csv": str(OUT_CORR.relative_to(BASE)),
            "group_test_csv": str(OUT_GROUP.relative_to(BASE)),
            "summary_json": str(OUT_JSON.relative_to(BASE)),
            "summary_md": str(OUT_MD.relative_to(BASE)),
            "student_scatter": str(OUT_CHART_STUDENT_GREEN.relative_to(BASE)),
            "child_scatter": str(OUT_CHART_CHILD_LOWGREEN.relative_to(BASE)),
        },
    }
    OUT_JSON.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    def corr_lines(df: pd.DataFrame) -> str:
        lines = []
        for row in df.itertuples(index=False):
            lines.append(
                f"| {row.analysis_level} | {row.x} | {row.y} | {row.method} | {int(row.n)} | {row.statistic:.3f} | {row.p_value:.3f} |"
            )
        return "\n".join(lines)

    def group_lines(df: pd.DataFrame) -> str:
        lines = []
        for row in df.itertuples(index=False):
            lines.append(
                f"| {row.group} | {row.metric} | {int(row.high_n)} | {int(row.rest_n)} | {row.high_mean:.3f} | {row.rest_mean:.3f} | {row.mean_diff:.3f} | {row.p_value:.3f} |"
            )
        return "\n".join(lines)

    top_rows = "\n".join(
        "| {gu} {base_dong} | {schools} | {students:.0f} | {child:.0f} | {green:.2f} | {per_student:.2f} | {low_share:.1%} |".format(
            gu=row.gu,
            base_dong=row.base_dong,
            schools=row.school_count,
            students=row.total_students,
            child=0 if pd.isna(row.child_0_12) else row.child_0_12,
            green=row.weighted_green_ratio,
            per_student=row.park_area_per_student,
            low_share=row.low_green_student_share,
        )
        for row in top_pressure.itertuples(index=False)
    )

    md = f"""# 인천 학생수 집중도와 학교 녹지 접근성 분석 (2026-04-24)

## 분석 개요
- 분석 단위: `base_dong` (학교 지번주소 기반으로 단순화한 동 단위 그룹)
- 학교 범위: 본류 case 학교 중 비도서 242개교
- 학생수 데이터: `data/processed/student_trend.csv`의 학교별 최신 연도 학생수
- 아동인구 데이터: `data/processed/incheon_dong_child_timeseries.csv`의 2025년 `child_0_12`
- 핵심 해석 지표:
  - `weighted_green_ratio`: 동 내 학교들의 학생수 가중 평균 녹지비율
  - `weighted_nearest_park_dist_m`: 학생수 가중 평균 최근접 공공공원 거리
  - `park_area_per_student`: 학교 생활권 기준 접근 가능 공원면적 합 / 재학생 수
  - `low_green_student_share`: 녹지비율 1% 미만 학교에 다니는 학생 비중

## 동 단위 상관분석
| 수준 | X | Y | 방법 | n | 계수 | p |
|---|---|---|---|---:|---:|---:|
{corr_lines(primary)}

## 학교 단위 민감도 분석
| 수준 | X | Y | 방법 | n | 계수 | p |
|---|---|---|---|---:|---:|---:|
{corr_lines(school_primary)}

## 상위 분위 비교
| 그룹 | 지표 | 상위집단 n | 나머지 n | 상위 평균 | 나머지 평균 | 차이 | p |
|---|---|---:|---:|---:|---:|---:|---:|
{group_lines(group_tests)}

## 학생 집중 압력 상위 동
| 동 | 학교 수 | 학생 수 | 0~12세 | 학생가중 녹지비율 | 학생 1인당 공원면적 | 저녹지 학생 비중 |
|---|---:|---:|---:|---:|---:|---:|
{top_rows}

## 해석 메모
- 이 분석은 `동 면적`을 붙인 엄밀한 밀도 분석이 아니라, 우선 `학생수 집중도`와 `아동인구 규모`가 큰 동에서 학교 기반 녹지 접근성이 어떻게 달라지는지 본 것이다.
- `park_area_per_student`는 학교 생활권을 합산한 지표라, 인접 학교 생활권이 겹치는 경우 공원면적이 중복 집계될 수 있다. 따라서 절대면적보다 `학생 1인당 상대적 여유도` 해석에 적합하다.
- strict한 `아동 인구 밀도`까지 보려면 다음 단계에서 동 경계 면적 또는 행정동 폴리곤을 붙이면 된다.

## 산출물
- `{OUT_DONG.relative_to(BASE)}`
- `{OUT_SCHOOL.relative_to(BASE)}`
- `{OUT_CORR.relative_to(BASE)}`
- `{OUT_GROUP.relative_to(BASE)}`
- `{OUT_JSON.relative_to(BASE)}`
- `{OUT_CHART_STUDENT_GREEN.relative_to(BASE)}`
- `{OUT_CHART_CHILD_LOWGREEN.relative_to(BASE)}`
"""
    OUT_MD.write_text(md, encoding="utf-8")
    print(md)


def main() -> None:
    school = build_school_level_dataset()
    child = build_child_by_base_dong()
    dong, school_with_dong = aggregate_dong_metrics(school, child)
    corrs, group_tests = build_correlation_tables(dong, school_with_dong)
    write_outputs(dong, school_with_dong, corrs, group_tests)


if __name__ == "__main__":
    main()
