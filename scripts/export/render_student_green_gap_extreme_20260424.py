"""Render the extreme-gap figure for student-accessible park area.

The figure contrasts the lower and upper quartiles of dong-level
`park_area_per_student` values produced by the student-green analysis step.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


BASE = Path(r"C:\2026_data_analysis_park")
REPORTS = BASE / "outputs" / "reports"
CHARTS = BASE / "outputs" / "charts"
INPUT = REPORTS / "incheon_student_green_by_base_dong_20260424.csv"
OUT_PNG = CHARTS / "fig_student_green_gap_extreme_20260424.png"
OUT_JPG = CHARTS / "fig_student_green_gap_extreme_20260424.jpg"

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


def fmt_num(value: float) -> str:
    return f"{value:,.1f}"


def main() -> None:
    CHARTS.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(INPUT)
    metric = "park_area_per_student"
    q1 = df[metric].quantile(0.25)
    q3 = df[metric].quantile(0.75)

    low = df[df[metric] <= q1].copy().sort_values(metric, ascending=True)
    high = df[df[metric] >= q3].copy().sort_values(metric, ascending=False)

    low_mean = float(low[metric].mean())
    high_mean = float(high[metric].mean())
    low_median = float(low[metric].median())
    high_median = float(high[metric].median())
    mean_ratio = high_mean / low_mean
    median_ratio = high_median / low_median

    fig = plt.figure(figsize=(14, 8), facecolor="#f6f3ee")
    gs = fig.add_gridspec(2, 3, height_ratios=[1.18, 1], width_ratios=[1.18, 1, 1], hspace=0.24, wspace=0.2)

    ax_main = fig.add_subplot(gs[:, 0])
    ax_dist = fig.add_subplot(gs[0, 1:])
    ax_low = fig.add_subplot(gs[1, 1])
    ax_high = fig.add_subplot(gs[1, 2])

    for ax in [ax_main, ax_dist, ax_low, ax_high]:
        ax.set_facecolor("#fcfaf7")

    colors = {"low": "#cf3f2e", "high": "#117a65"}

    # Main comparison bars
    categories = ["하위 25%", "상위 25%"]
    means = [low_mean, high_mean]
    bars = ax_main.bar(categories, means, color=[colors["low"], colors["high"]], width=0.58)
    ax_main.set_ylim(0, max(means) * 1.18)
    ax_main.set_ylabel("학생 1인당 접근 가능 공원면적", fontproperties=FONT, fontsize=12)
    ax_main.set_title("상위 25% vs 하위 25%", fontproperties=FONT, fontsize=21, loc="left", pad=10)
    ax_main.grid(axis="y", color="#e9e2d8", linewidth=1.0)
    ax_main.spines[["top", "right"]].set_visible(False)
    ax_main.spines["left"].set_color("#9d8d7a")
    ax_main.spines["bottom"].set_color("#9d8d7a")

    for bar, value in zip(bars, means):
        ax_main.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(means) * 0.03,
            fmt_num(value),
            ha="center",
            va="bottom",
            fontproperties=FONT,
            fontsize=16,
            fontweight="bold",
            color="#2d241d",
        )

    ax_main.text(
        0.5,
        0.76,
        f"{mean_ratio:.1f}x",
        transform=ax_main.transAxes,
        ha="center",
        va="center",
        fontproperties=FONT,
        fontsize=36,
        fontweight="bold",
        color="#cf3f2e",
        bbox=dict(boxstyle="round,pad=0.42", facecolor="#fff1eb", edgecolor="#cf3f2e", linewidth=1.8),
    )
    ax_main.text(
        0.03,
        0.03,
        f"중앙값 {median_ratio:.1f}x  |  상위 {fmt_num(high_median)}  |  하위 {fmt_num(low_median)}",
        transform=ax_main.transAxes,
        ha="left",
        va="bottom",
        fontproperties=FONT,
        fontsize=10,
        color="#5b4636",
    )

    # Distribution panel
    low_x = np.full(len(low), 0.9) + np.linspace(-0.08, 0.08, len(low))
    high_x = np.full(len(high), 2.1) + np.linspace(-0.08, 0.08, len(high))
    ax_dist.scatter(low_x, low[metric], s=72, color=colors["low"], alpha=0.85, edgecolor="white", linewidth=0.9)
    ax_dist.scatter(high_x, high[metric], s=72, color=colors["high"], alpha=0.85, edgecolor="white", linewidth=0.9)
    ax_dist.hlines(low_mean, 0.62, 1.18, color=colors["low"], linewidth=4)
    ax_dist.hlines(high_mean, 1.82, 2.38, color=colors["high"], linewidth=4)
    ax_dist.set_xlim(0.45, 2.55)
    ax_dist.set_xticks([0.9, 2.1], ["하위 25%", "상위 25%"], fontproperties=FONT)
    ax_dist.set_ylabel("동별 값 분포", fontproperties=FONT, fontsize=11)
    ax_dist.set_title("분포", fontproperties=FONT, fontsize=16, loc="left", pad=10)
    ax_dist.grid(axis="y", color="#ece5db", linewidth=0.9)
    ax_dist.spines[["top", "right"]].set_visible(False)
    ax_dist.spines["left"].set_color("#9d8d7a")
    ax_dist.spines["bottom"].set_color("#9d8d7a")
    ax_dist.text(0.9, low_mean + 8, fmt_num(low_mean), ha="center", fontproperties=FONT, fontsize=11, color=colors["low"])
    ax_dist.text(2.1, high_mean + 8, fmt_num(high_mean), ha="center", fontproperties=FONT, fontsize=11, color=colors["high"])

    # Lowest list
    low_show = low.head(6).iloc[::-1]
    ax_low.barh(low_show["base_dong"], low_show[metric], color=colors["low"], alpha=0.88)
    ax_low.set_title("하위 25%", fontproperties=FONT, fontsize=15, loc="left", pad=10)
    ax_low.grid(axis="x", color="#ece5db", linewidth=0.9)
    ax_low.spines[["top", "right"]].set_visible(False)
    ax_low.spines["left"].set_color("#9d8d7a")
    ax_low.spines["bottom"].set_color("#9d8d7a")
    ax_low.tick_params(axis="y", labelsize=10)
    for label in ax_low.get_yticklabels():
        label.set_fontproperties(FONT)
    for idx, value in enumerate(low_show[metric]):
        ax_low.text(value + 1.5, idx, fmt_num(value), va="center", fontproperties=FONT, fontsize=10, color="#2d241d")

    # Highest list
    high_show = high.head(6).iloc[::-1]
    ax_high.barh(high_show["base_dong"], high_show[metric], color=colors["high"], alpha=0.88)
    ax_high.set_title("상위 25%", fontproperties=FONT, fontsize=15, loc="left", pad=10)
    ax_high.grid(axis="x", color="#ece5db", linewidth=0.9)
    ax_high.spines[["top", "right"]].set_visible(False)
    ax_high.spines["left"].set_color("#9d8d7a")
    ax_high.spines["bottom"].set_color("#9d8d7a")
    ax_high.tick_params(axis="y", labelsize=10)
    for label in ax_high.get_yticklabels():
        label.set_fontproperties(FONT)
    for idx, value in enumerate(high_show[metric]):
        ax_high.text(value + 3, idx, fmt_num(value), va="center", fontproperties=FONT, fontsize=10, color="#2d241d")

    fig.suptitle(
        "학생 1인당 녹지 격차",
        fontproperties=FONT,
        fontsize=28,
        fontweight="bold",
        x=0.05,
        ha="left",
        y=0.965,
        color="#2d241d",
    )

    fig.savefig(OUT_PNG, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    fig.savefig(OUT_JPG, dpi=220, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)

    print(f"saved: {OUT_PNG}")
    print(f"saved: {OUT_JPG}")


if __name__ == "__main__":
    main()
