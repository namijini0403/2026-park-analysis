from __future__ import annotations

import math
from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency, fisher_exact, mannwhitneyu, norm


BASE = Path(__file__).resolve().parents[2]
OUT_DIR = BASE / "outputs" / "verification"
PPT_DOC = BASE / "docs" / "PPT_DATA_PACK_20260505.md"
SCHOOL_PATH = BASE / "data_processed" / "school_priority_with_functional_park_layer.csv"

SCHOOL_NAME_COL = "학교명"


def setup_font() -> None:
    for font_path in [
        Path("C:/Windows/Fonts/malgun.ttf"),
        Path("C:/Windows/Fonts/NanumGothic.ttf"),
        Path("C:/Windows/Fonts/NotoSansKR-Regular.otf"),
    ]:
        if font_path.exists():
            fm.fontManager.addfont(str(font_path))
            prop = fm.FontProperties(fname=str(font_path))
            plt.rcParams["font.family"] = prop.get_name()
            break
    plt.rcParams["axes.unicode_minus"] = False


def parse_ppt_dong_table() -> pd.DataFrame:
    lines = PPT_DOC.read_text(encoding="utf-8").splitlines()
    rows: list[dict[str, object]] = []
    in_table = False
    for line in lines:
        if line.startswith("| 동 | 학교수 | 학교명 | 취약아동비율"):
            in_table = True
            continue
        if not in_table:
            continue
        if line.startswith("| ---"):
            continue
        if not line.startswith("|"):
            if rows:
                break
            continue

        parts = [part.strip() for part in line.strip("|").split("|")]
        if len(parts) < 9:
            continue

        def num(value: str) -> float:
            return float(value.replace(",", "").replace("%", ""))

        for school_name in [name.strip() for name in parts[2].split(",")]:
            rows.append(
                {
                    "school_name": school_name,
                    "dong": parts[0],
                    "vulnerable_child_ratio_pct": num(parts[3]),
                }
            )
    return pd.DataFrame(rows)


def build_school_quartiles() -> pd.DataFrame:
    assigned = parse_ppt_dong_table()
    schools = pd.read_csv(SCHOOL_PATH, encoding="utf-8-sig")
    schools["case_type_num"] = pd.to_numeric(schools["case_type"], errors="coerce")
    schools["display_green_ratio_num"] = pd.to_numeric(
        schools["display_green_ratio"], errors="coerce"
    )
    active = schools[
        pd.to_numeric(schools.get("is_separate_bundle_tag", 0), errors="coerce")
        .fillna(0)
        .eq(0)
        & schools["case_type_num"].notna()
    ][[SCHOOL_NAME_COL, "display_green_ratio_num"]].rename(
        columns={SCHOOL_NAME_COL: "school_name"}
    )

    df = assigned.merge(active, on="school_name", how="left")
    missing = df[df["display_green_ratio_num"].isna()]
    if len(missing):
        raise ValueError(f"Missing current app rows: {missing['school_name'].tolist()}")

    df["under1_green"] = df["display_green_ratio_num"] < 1.0
    df["quartile_num"] = pd.qcut(
        df["vulnerable_child_ratio_pct"],
        4,
        labels=[1, 2, 3, 4],
        duplicates="drop",
    ).astype(int)
    return df


def cochran_armitage(successes: list[int], totals: list[int]) -> tuple[float, float, float]:
    scores = [1, 2, 3, 4]
    total_n = sum(totals)
    total_success = sum(successes)
    score_mean = sum(n * score for n, score in zip(totals, scores)) / total_n
    numerator = sum(
        score * (success - total * total_success / total_n)
        for success, total, score in zip(successes, totals, scores)
    )
    denominator = math.sqrt(
        total_success
        * (total_n - total_success)
        / (total_n * (total_n - 1))
        * sum(total * (score - score_mean) ** 2 for total, score in zip(totals, scores))
    )
    z = numerator / denominator
    one_sided_p = 1 - norm.cdf(z)
    two_sided_p = 2 * (1 - norm.cdf(abs(z)))
    return z, one_sided_p, two_sided_p


def summarize(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float | list[list[int]]]]:
    summary = (
        df.groupby("quartile_num", as_index=False)
        .agg(
            school_count=("school_name", "count"),
            under1_count=("under1_green", "sum"),
            dong_count=("dong", "nunique"),
            vuln_min=("vulnerable_child_ratio_pct", "min"),
            vuln_max=("vulnerable_child_ratio_pct", "max"),
        )
        .sort_values("quartile_num")
    )
    summary["under1_pct"] = summary["under1_count"] / summary["school_count"] * 100

    successes = summary["under1_count"].astype(int).tolist()
    totals = summary["school_count"].astype(int).tolist()
    non_successes = [total - success for success, total in zip(successes, totals)]

    table = [
        [sum(successes[2:]), sum(non_successes[2:])],
        [sum(successes[:2]), sum(non_successes[:2])],
    ]
    odds_ratio = (table[0][0] / table[0][1]) / (table[1][0] / table[1][1])
    _, chi_no_yates_p, _, _ = chi2_contingency(table, correction=False)
    _, chi_yates_p, _, _ = chi2_contingency(table, correction=True)
    fisher_one_p = fisher_exact(table, alternative="greater").pvalue
    fisher_two_p = fisher_exact(table, alternative="two-sided").pvalue
    ca_z, ca_one_p, ca_two_p = cochran_armitage(successes, totals)

    lower = [1] * sum(successes[:2]) + [0] * sum(non_successes[:2])
    upper = [1] * sum(successes[2:]) + [0] * sum(non_successes[2:])
    mann_two_p = mannwhitneyu(upper, lower, alternative="two-sided").pvalue
    mann_one_p = mannwhitneyu(upper, lower, alternative="greater").pvalue

    stats = {
        "table_high_vs_low_deficit_nondeficit": table,
        "odds_ratio": odds_ratio,
        "cochran_armitage_z": ca_z,
        "cochran_armitage_one_sided_p": ca_one_p,
        "cochran_armitage_two_sided_p": ca_two_p,
        "fisher_one_sided_p": fisher_one_p,
        "fisher_two_sided_p": fisher_two_p,
        "chi_square_no_yates_p": chi_no_yates_p,
        "chi_square_yates_p": chi_yates_p,
        "mann_whitney_two_sided_p": mann_two_p,
        "mann_whitney_one_sided_p": mann_one_p,
    }
    return summary, stats


def save_plot(summary: pd.DataFrame, stats: dict[str, float | list[list[int]]]) -> None:
    setup_font()
    colors = ["#94B29F", "#A9BA98", "#CD8D73", "#B94E42"]
    fig, ax = plt.subplots(figsize=(10.2, 5.4), facecolor="white")
    x = np.arange(len(summary))
    bars = ax.bar(
        x,
        summary["under1_pct"],
        color=colors,
        edgecolor="#555555",
        width=0.62,
    )
    for idx, bar in enumerate(bars):
        pct = summary.iloc[idx]["under1_pct"]
        count = int(summary.iloc[idx]["under1_count"])
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            pct + 1.0,
            f"{pct:.1f}%",
            ha="center",
            va="bottom",
            fontsize=13,
            fontweight="bold",
            color="#222222",
        )
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            pct - 3.0,
            f"{count}개교",
            ha="center",
            va="top",
            fontsize=10.5,
            fontweight="bold",
            color="white",
        )

    stat_text = (
        f"상위 절반 결핍 오즈 × {stats['odds_ratio']:.2f}\n"
        f"Cochran-Armitage one-sided p = {stats['cochran_armitage_one_sided_p']:.3f}\n"
        f"Fisher exact one-sided p = {stats['fisher_one_sided_p']:.3f}\n"
        f"Chi-square no Yates p = {stats['chi_square_no_yates_p']:.3f}"
    )
    ax.text(
        0.02,
        0.96,
        stat_text,
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=9,
        bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor="#999999", alpha=0.92),
    )

    ax.set_title("취약계층 비율 분위별 -- 도보권 녹지 1% 미만 학교 비율", fontsize=15, fontweight="bold", pad=10)
    ax.set_ylabel("도보권 녹지 1% 미만 학교 비율 (%)")
    ax.set_xlabel("동별 0-14세 취약계층 비율 분위 (학교 행 기준 qcut; 원천 동 n=56)")
    ax.set_xticks(x)
    ax.set_xticklabels(["Q1\n(낮음)", "Q2", "Q3", "Q4\n(높음)"])
    ax.set_ylim(0, 60)
    ax.set_yticks(np.arange(0, 61, 10))
    ax.set_yticklabels([f"{value}%" for value in range(0, 61, 10)])
    ax.grid(axis="y", linestyle="--", linewidth=0.5, alpha=0.45)
    ax.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    fig.tight_layout()
    fig.savefig(
        OUT_DIR / "vulnerable_green_quartile_reproduced_20260520.png",
        dpi=200,
        bbox_inches="tight",
        facecolor="white",
    )
    plt.close(fig)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = build_school_quartiles()
    summary, stats = summarize(df)
    summary.to_csv(
        OUT_DIR / "vulnerable_green_quartile_reproduced_20260520.csv",
        index=False,
        encoding="utf-8-sig",
    )
    pd.DataFrame([stats]).to_json(
        OUT_DIR / "vulnerable_green_quartile_stats_20260520.json",
        orient="records",
        force_ascii=False,
        indent=2,
    )
    save_plot(summary, stats)

    print(summary.to_string(index=False))
    for key, value in stats.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
