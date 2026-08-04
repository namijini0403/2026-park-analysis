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
RAW = BASE / "data/raw"
PROCESSED = BASE / "data/processed"
OUTPUT = BASE / "output"

WELFARE_PATH = RAW / "인천광역시_국민기초생활수급자 연령별 읍면동 단위 현황_20241231.csv"
SCHOOL_STANDARD_PATH = RAW / "전국초중등학교위치표준데이터.csv"
PRIORITY_PATH = PROCESSED / "school_priority.csv"

OUT_DONG = OUTPUT / "incheon_vulnerable_green_by_base_dong_20260423.csv"
OUT_SCHOOL = OUTPUT / "incheon_vulnerable_green_school_assigned_20260423.csv"
OUT_CORR = OUTPUT / "incheon_vulnerable_green_correlations_20260423.csv"
OUT_JSON = OUTPUT / "incheon_vulnerable_green_summary_20260423.json"
OUT_MD = OUTPUT / "incheon_vulnerable_green_summary_20260423.md"
OUT_SCATTER_GREEN = OUTPUT / "incheon_vulnerable_vs_green_scatter_20260423.png"
OUT_SCATTER_LOW = OUTPUT / "incheon_vulnerable_vs_under1_green_scatter_20260423.png"

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

LEGAL_TO_ADMIN_BASE = {
    "중구": {
        "답동": "신포동",
        "전동": "신포동",
        "송학동": "개항동",
        "송학동1가": "개항동",
        "송학동2가": "개항동",
        "송학동3가": "개항동",
        "신흥동1가": "신흥동",
        "신흥동2가": "신흥동",
        "신흥동3가": "신흥동",
        "항동": "연안동",
        "항동1가": "연안동",
        "항동2가": "연안동",
        "항동3가": "연안동",
        "항동4가": "연안동",
        "항동5가": "연안동",
        "항동6가": "연안동",
        "항동7가": "연안동",
        "남북동": "용유동",
        "운남동": "영종동",
        "운북동": "영종동",
        "중산동": "영종동",
    },
    "동구": {
        "창영동": "금창동",
        "화평동": "화평동",
        "화수동": "화수동",
    },
    "남동구": {
        "남촌동": "남촌도림동",
        "도림동": "남촌도림동",
        "고잔동": "논현고잔동",
        "서창동": "서창동",
        "장수동": "장수서창동",
    },
    "계양구": {
        "서운동": "작전서운동",
        "병방동": "계양동",
        "동양동": "계양동",
        "귤현동": "계양동",
        "장기동": "계양동",
        "상야동": "계양동",
        "박촌동": "계양동",
        "용종동": "계양동",
    },
    "서구": {
        "검암동": "검암경서동",
        "경서동": "검암경서동",
        "공촌동": "연희동",
        "심곡동": "연희동",
        "신현동": "신현원창동",
        "원창동": "신현원창동",
        "불로동": "불로대곡동",
        "대곡동": "불로대곡동",
        "오류동": "오류왕길동",
        "왕길동": "오류왕길동",
        "금곡동": "검단동",
        "백석동": "검암경서동",
    },
    "부평구": {
        "구산동": "일신동",
    },
}


def normalize_name(value: object) -> str:
    return str(value or "").strip().replace("·", ".").replace(" ", "")


def simplify_admin_dong(value: object) -> list[str]:
    """Map administrative dong labels to broad legal-dong-like groups.

    Examples:
    - 주안1동 -> 주안동
    - 용현1,4동 -> 용현동
    - 송림3·5동 -> 송림동
    - 화수1·화평동 -> 화수동, 화평동
    """
    text = normalize_name(value)
    if not text:
        return []

    text = re.sub(r"출장소|출장.*지소|지소", "", text)
    parts = re.split(r"[.,/]", text)
    names: list[str] = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        part = re.sub(r"\d+", "", part)
        part = part.replace(",", "")
        if part and not part.endswith(("동", "읍", "면")):
            part = f"{part}동"
        if part and part not in names:
            names.append(part)
    return names or [text]


def extract_school_base_dong(address: object, gu: object) -> str:
    text = str(address or "").strip()
    gu_text = str(gu or "").strip()
    if not text:
        return ""
    tokens = text.split()
    if "강화군" in gu_text or "옹진군" in gu_text:
        for token in tokens:
            if token.endswith(("읍", "면")):
                return token
    for token in tokens:
        cleaned = re.sub(r"\d+가$", "동", token)
        if token.endswith("동") or re.search(r"동\d+가$", token):
            return LEGAL_TO_ADMIN_BASE.get(gu_text, {}).get(token, cleaned)
    return ""


def age_start(age_band: object) -> int | None:
    text = str(age_band or "")
    match = re.match(r"(\d+)세", text)
    if not match:
        return None
    return int(match.group(1))


def corr_record(df: pd.DataFrame, x_col: str, y_col: str, method: str) -> dict[str, object]:
    x = pd.to_numeric(df[x_col], errors="coerce")
    y = pd.to_numeric(df[y_col], errors="coerce")
    mask = x.notna() & y.notna()
    x = x[mask]
    y = y[mask]
    if len(x) < 3 or x.nunique() < 2 or y.nunique() < 2:
        return {"method": method, "n": int(len(x)), "statistic": math.nan, "p_value": math.nan}
    if method == "pearson":
        stat, p = stats.pearsonr(x, y)
    elif method == "spearman":
        stat, p = stats.spearmanr(x, y)
    elif method == "kendall":
        stat, p = stats.kendalltau(x, y)
    else:
        raise ValueError(method)
    return {"method": method, "n": int(len(x)), "statistic": float(stat), "p_value": float(p)}


def build_welfare_by_base_dong() -> pd.DataFrame:
    welfare = pd.read_csv(WELFARE_PATH, encoding="cp949")
    welfare = welfare[welfare["읍면동"].ne(welfare["시군구"])].copy()
    welfare["수급권자수"] = pd.to_numeric(welfare["수급권자수"], errors="coerce").fillna(0)
    welfare["age_start"] = welfare["연령구간(5세단위)"].map(age_start)
    welfare["is_child_0_14"] = welfare["age_start"].between(0, 14, inclusive="both")
    welfare["is_child_0_19"] = welfare["age_start"].between(0, 19, inclusive="both")
    welfare["is_livelihood"] = welfare["자격"].eq("기초생계급여")

    expanded_rows: list[dict[str, object]] = []
    for row in welfare.itertuples(index=False):
        base_names = simplify_admin_dong(row.읍면동)
        if not base_names:
            continue
        share = float(row.수급권자수) / len(base_names)
        for base in base_names:
            expanded_rows.append(
                {
                    "gu": row.시군구,
                    "admin_dong": row.읍면동,
                    "base_dong": base,
                    "qualification": row.자격,
                    "age_band": getattr(row, "_3"),
                    "recipient_count_alloc": share,
                    "is_child_0_14": bool(row.is_child_0_14),
                    "is_child_0_19": bool(row.is_child_0_19),
                    "is_livelihood": bool(row.is_livelihood),
                }
            )

    expanded = pd.DataFrame(expanded_rows)
    grouped = (
        expanded.groupby(["gu", "base_dong"], as_index=False)
        .agg(
            livelihood_recipients_total=(
                "recipient_count_alloc",
                lambda s: float(s[expanded.loc[s.index, "is_livelihood"]].sum()),
            ),
            livelihood_child_0_14=(
                "recipient_count_alloc",
                lambda s: float(
                    s[
                        expanded.loc[s.index, "is_livelihood"]
                        & expanded.loc[s.index, "is_child_0_14"]
                    ].sum()
                ),
            ),
            livelihood_child_0_19=(
                "recipient_count_alloc",
                lambda s: float(
                    s[
                        expanded.loc[s.index, "is_livelihood"]
                        & expanded.loc[s.index, "is_child_0_19"]
                    ].sum()
                ),
            ),
            all_benefit_records_total=("recipient_count_alloc", "sum"),
            source_admin_dongs=("admin_dong", lambda s: ", ".join(sorted(set(map(str, s))))),
        )
    )
    return grouped


def build_school_green() -> pd.DataFrame:
    standard = pd.read_csv(SCHOOL_STANDARD_PATH, encoding="cp949")
    priority = pd.read_csv(PRIORITY_PATH)
    incheon_standard = standard[
        standard["학교ID"].isin(priority["학교ID"])
        & standard["시도교육청명"].eq("인천광역시교육청")
    ].copy()

    cols = [
        "학교ID",
        "학교명",
        "gu",
        "iso_green_ratio",
        "nearest_park_dist_m",
        "case_type",
        "is_separate_bundle_tag",
        "is_island_tag",
        "iso_park_count",
        "iso_playground_count",
    ]
    school = priority[cols].merge(
        incheon_standard[["학교ID", "소재지지번주소"]],
        on="학교ID",
        how="left",
    )
    school["base_dong"] = school.apply(
        lambda row: extract_school_base_dong(row["소재지지번주소"], row["gu"]), axis=1
    )
    school["is_core_case"] = (
        pd.to_numeric(school["case_type"], errors="coerce").notna()
        & pd.to_numeric(school["is_separate_bundle_tag"], errors="coerce").fillna(0).eq(0)
    )
    school["under1_green_flag"] = pd.to_numeric(
        school["iso_green_ratio"], errors="coerce"
    ).lt(1.0)
    return school


def build_outputs() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    welfare_by_dong = build_welfare_by_base_dong()
    school_green = build_school_green()

    school_assigned = school_green.merge(welfare_by_dong, on=["gu", "base_dong"], how="left")
    school_assigned["vulnerability_match_status"] = np.where(
        school_assigned["livelihood_recipients_total"].notna(), "matched", "unmatched"
    )

    matched_core = school_assigned[
        school_assigned["is_core_case"]
        & school_assigned["livelihood_recipients_total"].notna()
    ].copy()

    green_by_dong = (
        matched_core.groupby(["gu", "base_dong"], as_index=False)
        .agg(
            school_count=("학교ID", "count"),
            avg_green_ratio=("iso_green_ratio", "mean"),
            median_green_ratio=("iso_green_ratio", "median"),
            min_green_ratio=("iso_green_ratio", "min"),
            under1_green_school_count=("under1_green_flag", "sum"),
            avg_nearest_public_park_dist_m=("nearest_park_dist_m", "mean"),
            case1_2_school_count=("case_type", lambda s: int(pd.Series(s).isin([1.0, 2.0]).sum())),
            school_names=("학교명", lambda s: ", ".join(s.astype(str))),
        )
    )
    dong_analysis = welfare_by_dong.merge(green_by_dong, on=["gu", "base_dong"], how="inner")
    dong_analysis["under1_green_school_share"] = (
        dong_analysis["under1_green_school_count"] / dong_analysis["school_count"]
    )
    dong_analysis["case1_2_share"] = (
        dong_analysis["case1_2_school_count"] / dong_analysis["school_count"]
    )
    dong_analysis = dong_analysis.sort_values("livelihood_recipients_total", ascending=False)

    corr_rows: list[dict[str, object]] = []
    dong_y_cols = [
        "avg_green_ratio",
        "median_green_ratio",
        "min_green_ratio",
        "under1_green_school_count",
        "under1_green_school_share",
        "avg_nearest_public_park_dist_m",
        "case1_2_share",
    ]
    x_cols = [
        "livelihood_recipients_total",
        "livelihood_child_0_14",
        "livelihood_child_0_19",
        "all_benefit_records_total",
    ]
    for x_col in x_cols:
        for y_col in dong_y_cols:
            for method in ["pearson", "spearman", "kendall"]:
                rec = corr_record(dong_analysis, x_col, y_col, method)
                rec.update({"analysis_level": "base_dong", "x": x_col, "y": y_col})
                corr_rows.append(rec)

    school_y_cols = ["iso_green_ratio", "under1_green_flag", "nearest_park_dist_m"]
    for x_col in x_cols:
        for y_col in school_y_cols:
            for method in ["pearson", "spearman", "kendall"]:
                rec = corr_record(matched_core, x_col, y_col, method)
                rec.update({"analysis_level": "school_assigned_by_base_dong", "x": x_col, "y": y_col})
                corr_rows.append(rec)

    corrs = pd.DataFrame(corr_rows)
    return dong_analysis, school_assigned, corrs


def regression_line(ax: plt.Axes, x: np.ndarray, y: np.ndarray, color: str) -> None:
    mask = np.isfinite(x) & np.isfinite(y)
    x = x[mask]
    y = y[mask]
    if len(x) < 2:
        return
    m, b = np.polyfit(x, y, 1)
    xs = np.linspace(x.min(), x.max(), 100)
    ax.plot(xs, m * xs + b, color=color, linewidth=2)


def save_scatter_plots(dong_analysis: pd.DataFrame) -> None:
    for y_col, y_label, out_path, caption in [
        (
            "avg_green_ratio",
            "동 내 학교 평균 도보 녹지비율(%)",
            OUT_SCATTER_GREEN,
            "기초생계 수급자가 많은 동일수록 평균 녹지비율은 낮아지는 경향",
        ),
        (
            "under1_green_school_share",
            "녹지 1% 미만 학교 비율",
            OUT_SCATTER_LOW,
            "기초생계 수급자가 많은 동일수록 1% 미만 학교 비율이 높아지는 경향",
        ),
    ]:
        fig, ax = plt.subplots(figsize=(7.2, 4.3))
        x = dong_analysis["livelihood_recipients_total"].astype(float).to_numpy()
        y = dong_analysis[y_col].astype(float).to_numpy()
        sizes = 35 + dong_analysis["school_count"].astype(float).to_numpy() * 10
        ax.scatter(x, y, s=sizes, color="#2563EB", alpha=0.72, edgecolor="white", linewidth=0.8)
        regression_line(ax, x, y, "#EF4444")
        for row in dong_analysis.itertuples(index=False):
            if row.livelihood_recipients_total >= dong_analysis["livelihood_recipients_total"].quantile(0.85) or getattr(row, y_col) >= dong_analysis[y_col].quantile(0.85):
                ax.annotate(
                    f"{row.gu} {row.base_dong}",
                    (row.livelihood_recipients_total, getattr(row, y_col)),
                    xytext=(5, 4),
                    textcoords="offset points",
                    fontsize=8,
                    fontproperties=FONT,
                )
        ax.set_xlabel("기초생계급여 수급권자수", fontproperties=FONT)
        ax.set_ylabel(y_label, fontproperties=FONT)
        ax.set_title(caption, fontproperties=FONT, fontsize=12)
        ax.grid(color="#E5E7EB", linewidth=0.8)
        ax.spines[["top", "right"]].set_visible(False)
        fig.patch.set_facecolor("white")
        ax.set_facecolor("white")
        fig.savefig(out_path, dpi=300, bbox_inches="tight", facecolor="white")
        plt.close(fig)


def write_summary(dong_analysis: pd.DataFrame, school_assigned: pd.DataFrame, corrs: pd.DataFrame) -> None:
    OUTPUT.mkdir(exist_ok=True)
    dong_analysis.to_csv(OUT_DONG, index=False, encoding="utf-8-sig")
    school_assigned.to_csv(OUT_SCHOOL, index=False, encoding="utf-8-sig")
    corrs.to_csv(OUT_CORR, index=False, encoding="utf-8-sig")
    save_scatter_plots(dong_analysis)

    matched_core = school_assigned[
        school_assigned["is_core_case"]
        & school_assigned["livelihood_recipients_total"].notna()
    ].copy()
    unmatched = school_assigned[school_assigned["vulnerability_match_status"].eq("unmatched")]

    primary = corrs[
        (corrs["analysis_level"].eq("base_dong"))
        & (corrs["x"].eq("livelihood_recipients_total"))
        & (corrs["y"].isin(["avg_green_ratio", "under1_green_school_share", "under1_green_school_count"]))
    ].copy()
    school_primary = corrs[
        (corrs["analysis_level"].eq("school_assigned_by_base_dong"))
        & (corrs["x"].eq("livelihood_recipients_total"))
        & (corrs["y"].isin(["iso_green_ratio", "under1_green_flag"]))
    ].copy()

    high_vul_cut = dong_analysis["livelihood_recipients_total"].quantile(0.75)
    high_vul = dong_analysis[dong_analysis["livelihood_recipients_total"].ge(high_vul_cut)]
    low_vul = dong_analysis[dong_analysis["livelihood_recipients_total"].lt(high_vul_cut)]

    summary = {
        "source": {
            "welfare": str(WELFARE_PATH.relative_to(BASE)),
            "school_priority": str(PRIORITY_PATH.relative_to(BASE)),
            "school_standard": str(SCHOOL_STANDARD_PATH.relative_to(BASE)),
            "note": "Main vulnerability metric is livelihood benefit recipients because benefit categories can overlap.",
        },
        "coverage": {
            "dong_n": int(len(dong_analysis)),
            "matched_core_school_n": int(len(matched_core)),
            "unmatched_school_n": int(len(unmatched)),
            "unmatched_schools": unmatched[["학교ID", "학교명", "gu", "base_dong"]].to_dict(orient="records"),
        },
        "primary_correlations": primary.to_dict(orient="records"),
        "school_level_correlations": school_primary.to_dict(orient="records"),
        "high_vulnerability_q4": {
            "threshold_livelihood_recipients": float(high_vul_cut),
            "dong_n": int(len(high_vul)),
            "avg_green_ratio": float(high_vul["avg_green_ratio"].mean()),
            "under1_green_school_share": float(high_vul["under1_green_school_share"].mean()),
        },
        "lower_vulnerability_q1_q3": {
            "dong_n": int(len(low_vul)),
            "avg_green_ratio": float(low_vul["avg_green_ratio"].mean()),
            "under1_green_school_share": float(low_vul["under1_green_school_share"].mean()),
        },
        "top_vulnerable_dongs": dong_analysis.head(15).to_dict(orient="records"),
        "outputs": {
            "dong_csv": str(OUT_DONG.relative_to(BASE)),
            "school_csv": str(OUT_SCHOOL.relative_to(BASE)),
            "correlation_csv": str(OUT_CORR.relative_to(BASE)),
            "json": str(OUT_JSON.relative_to(BASE)),
            "markdown": str(OUT_MD.relative_to(BASE)),
            "scatter_green": str(OUT_SCATTER_GREEN.relative_to(BASE)),
            "scatter_under1": str(OUT_SCATTER_LOW.relative_to(BASE)),
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

    top_rows = "\n".join(
        "| {gu} {dong} | {vul:.0f} | {school_count} | {green:.2f} | {under1:.1%} | {names} |".format(
            gu=row.gu,
            dong=row.base_dong,
            vul=row.livelihood_recipients_total,
            school_count=int(row.school_count),
            green=row.avg_green_ratio,
            under1=row.under1_green_school_share,
            names=row.school_names,
        )
        for row in dong_analysis.head(10).itertuples(index=False)
    )

    md = f"""# 인천 경제 취약계층과 도보권 녹지비율 상관분석 (2026-04-23)

## 분석 기준
- 취약계층 데이터: `data_raw/인천광역시_국민기초생활수급자 연령별 읍면동 단위 현황_20241231.csv`
- 메인 취약계층 지표: `기초생계급여` 수급권자수
- 보조 취약계층 지표: 전체 급여 자격 건수 합, 0~14세/0~19세 기초생계급여 수급권자수
- 녹지 지표: `data_processed/school_priority.csv`의 `iso_green_ratio`
- 결합 단위: 학교 지번주소에서 추출한 법정동/읍면과 복합 행정동명을 단순화한 `base_dong`
- 본류 case1~4 학교 중 취약계층 동 매칭 성공: {len(matched_core)}개교
- 학교가 포함된 분석 동 수: {len(dong_analysis)}개

## 핵심 상관
| 분석수준 | X | Y | 방법 | n | 상관계수 | p |
|---|---|---|---|---:|---:|---:|
{corr_lines(primary)}

## 학교 단위 민감도
| 분석수준 | X | Y | 방법 | n | 상관계수 | p |
|---|---|---|---|---:|---:|---:|
{corr_lines(school_primary)}

## 취약계층 상위 25% 동 vs 나머지
| 구분 | 동 수 | 평균 녹지비율 | 1% 미만 학교 비율 |
|---|---:|---:|---:|
| 기초생계 수급자 상위 25% | {len(high_vul)} | {high_vul['avg_green_ratio'].mean():.2f}% | {high_vul['under1_green_school_share'].mean():.1%} |
| 나머지 75% | {len(low_vul)} | {low_vul['avg_green_ratio'].mean():.2f}% | {low_vul['under1_green_school_share'].mean():.1%} |

## 취약계층 많은 동 상위 10개
| 동 | 기초생계 수급권자수 | 학교 수 | 평균 녹지비율 | 1% 미만 학교 비율 | 학교 |
|---|---:|---:|---:|---:|---|
{top_rows}

## 해석
- 동 단위에서 `기초생계급여 수급권자수`와 평균 녹지비율은 약한 음의 방향이지만, 통계적으로 강하다고 보기는 어렵다.
- 대신 `1% 미만 녹지 학교 수`는 취약계층 인구와 뚜렷한 양의 상관을 보인다.
- `1% 미만 녹지 학교 비율`은 양의 방향이지만 약하므로, 학교 수가 많은 동의 규모 효과를 함께 해석해야 한다.
- 학교 단위 민감도에서는 취약계층 인구가 많은 동에 속한 학교일수록 녹지비율이 낮은 경향이 나타난다.
- 단, 행정동 자료를 법정동/읍면 그룹으로 단순화했기 때문에 정밀한 동 경계 기반 분석은 후속 보완 지점이다.
- 급여 자격은 중복 가능성이 있어, 전체 급여 합계는 실제 고유 인구가 아니라 보조 지표로만 해석해야 한다.

## 산출물
- `{OUT_DONG.relative_to(BASE)}`
- `{OUT_SCHOOL.relative_to(BASE)}`
- `{OUT_CORR.relative_to(BASE)}`
- `{OUT_JSON.relative_to(BASE)}`
- `{OUT_SCATTER_GREEN.relative_to(BASE)}`
- `{OUT_SCATTER_LOW.relative_to(BASE)}`
"""
    OUT_MD.write_text(md, encoding="utf-8")

    print(md)


def main() -> None:
    dong_analysis, school_assigned, corrs = build_outputs()
    write_summary(dong_analysis, school_assigned, corrs)


if __name__ == "__main__":
    main()
