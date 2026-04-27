from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter, MaxNLocator
from scipy import stats


BASE = Path(r"C:\2026_data_analysis_park")
INPUT = BASE / "data/processed" / "school_priority.csv"
OUT_PNG = BASE / "output" / "park_count_vs_green_ratio_scatter_20260422.png"
OUT_JPG = BASE / "output" / "park_count_vs_green_ratio_scatter_20260422.jpg"

FONT_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")
font_manager.fontManager.addfont(str(FONT_REGULAR))
font_manager.fontManager.addfont(str(FONT_BOLD))
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

SCHOOL = "\ud559\uad50\uba85"


def main() -> None:
    df = pd.read_csv(INPUT, encoding="utf-8-sig")
    df = df[df["is_separate_bundle_tag"].fillna(0).eq(0)].copy()
    df = df.dropna(subset=["iso_park_count", "iso_green_ratio"])

    x = df["iso_park_count"].astype(float)
    y = df["iso_green_ratio"].astype(float)
    pearson = stats.pearsonr(x, y)
    spearman = stats.spearmanr(x, y)

    high_green_cut = float(df["iso_green_ratio"].quantile(0.75))
    low_green_cut = 2.0
    low_count_cut = 2
    high_count_cut = 5

    low_count_high_green = (df["iso_park_count"] <= low_count_cut) & (
        df["iso_green_ratio"] >= high_green_cut
    )
    high_count_low_green = (df["iso_park_count"] >= high_count_cut) & (
        df["iso_green_ratio"] < low_green_cut
    )

    colors = np.where(
        low_count_high_green,
        "#0F766E",
        np.where(high_count_low_green, "#E11D48", "#A8A29E"),
    )
    edge_colors = np.where(
        low_count_high_green | high_count_low_green,
        "white",
        "#F5F5F4",
    )
    sizes = np.clip(np.sqrt(df["iso_park_area"].fillna(0).astype(float)) * 2.2, 42, 380)

    fig, ax = plt.subplots(figsize=(12.5, 7.3), dpi=240)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#FAFAF9")

    ax.axvspan(
        -0.5,
        low_count_cut + 0.5,
        ymin=high_green_cut / 90,
        ymax=1,
        color="#CCFBF1",
        alpha=0.38,
        zorder=0,
    )
    ax.axvspan(
        high_count_cut - 0.5,
        18.8,
        ymin=0,
        ymax=low_green_cut / 90,
        color="#FFE4E6",
        alpha=0.72,
        zorder=0,
    )
    ax.axhline(high_green_cut, color="#99F6E4", lw=1.1, ls="--", zorder=0)
    ax.axhline(low_green_cut, color="#FDA4AF", lw=1.1, ls="--", zorder=0)
    ax.axvline(high_count_cut, color="#E7E5E4", lw=1.1, ls="--", zorder=0)

    ax.scatter(
        df["iso_park_count"],
        df["iso_green_ratio"],
        s=sizes,
        c=colors,
        edgecolors=edge_colors,
        linewidths=1.3,
        alpha=0.92,
        zorder=2,
    )

    label_names = {
        "\uc778\ucc9c\uccad\uc77c\ucd08\ub4f1\ud559\uad50",
        "\uc778\ucc9c\uc2b9\ud559\ucd08\ub4f1\ud559\uad50",
        "\uc778\ucc9c\uc6a9\uc815\ucd08\ub4f1\ud559\uad50",
        "\uc778\ucc9c\uc2e0\uad11\ucd08\ub4f1\ud559\uad50",
        "\uc778\ucc9c\ubd80\ud3c9\ucd08\ub4f1\ud559\uad50",
        "\uc778\ucc9c\ub0a8\ub3d9\ucd08\ub4f1\ud559\uad50",
    }
    offsets = {
        "\uc778\ucc9c\uccad\uc77c\ucd08\ub4f1\ud559\uad50": (10, 2),
        "\uc778\ucc9c\uc2b9\ud559\ucd08\ub4f1\ud559\uad50": (10, -4),
        "\uc778\ucc9c\uc6a9\uc815\ucd08\ub4f1\ud559\uad50": (10, 7),
        "\uc778\ucc9c\uc2e0\uad11\ucd08\ub4f1\ud559\uad50": (10, -2),
        "\uc778\ucc9c\ubd80\ud3c9\ucd08\ub4f1\ud559\uad50": (10, 7),
        "\uc778\ucc9c\ub0a8\ub3d9\ucd08\ub4f1\ud559\uad50": (10, 7),
    }
    for _, row in df[df[SCHOOL].isin(label_names)].iterrows():
        name = row[SCHOOL]
        dx, dy = offsets.get(name, (8, 6))
        color = "#0F766E" if low_count_high_green.loc[row.name] else "#BE123C"
        ax.annotate(
            name.replace("\uc778\ucc9c", ""),
            (row["iso_park_count"], row["iso_green_ratio"]),
            xytext=(dx, dy),
            textcoords="offset points",
            fontsize=10,
            fontweight="bold",
            color=color,
            zorder=4,
        )

    ax.text(
        0.04,
        0.92,
        "\uacf5\uc6d0 \uc218\ub294 \uc801\uc9c0\ub9cc\n\ub179\uc9c0\ube44\uc728\uc740 \ub192\uc740 \ud559\uad50",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=12,
        fontweight="bold",
        color="#0F766E",
        bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor="#99F6E4", alpha=0.9),
        zorder=5,
    )
    ax.text(
        0.57,
        0.17,
        "\uacf5\uc6d0 \uc218\ub294 \ub9ce\uc9c0\ub9cc\n\ub179\uc9c0\ube44\uc728\uc740 \ub0ae\uc740 \ud559\uad50",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=12,
        fontweight="bold",
        color="#BE123C",
        bbox=dict(boxstyle="round,pad=0.35", facecolor="white", edgecolor="#FDA4AF", alpha=0.9),
        zorder=5,
    )

    stats_text = (
        "Pearson r = "
        f"{pearson.statistic:.3f}\n"
        "\uc21c\uc704\uc0c1\uad00 \u03c1 = "
        f"{spearman.statistic:.3f}\n"
        "n = "
        f"{len(df)}"
    )
    ax.text(
        0.965,
        0.94,
        stats_text,
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=11,
        fontweight="bold",
        color="#111827",
        bbox=dict(boxstyle="round,pad=0.45", facecolor="white", edgecolor="#D1D5DB", alpha=0.96),
    )

    ax.set_title(
        "\ub3c4\ubcf4\uad8c \uacf5\uc6d0 \uc218\uc640 \ub179\uc9c0\ube44\uc728\uc740 \uac19\uc740 \uac83\uc744 \ub9d0\ud558\uc9c0 \uc54a\ub294\ub2e4",
        fontsize=18,
        fontweight="bold",
        pad=18,
    )
    ax.set_xlabel("\uc2e4\uc81c \ub3c4\ubcf4 500m \ub0b4 \uacf5\uc6d0 \uc218", fontsize=12, labelpad=12)
    ax.set_ylabel("\uc2e4\uc81c \ub3c4\ubcf4\uad8c \ub179\uc9c0\ube44\uc728(%)", fontsize=12, labelpad=12)
    ax.set_xlim(-0.4, 18.8)
    ax.set_ylim(-2, 90)
    ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _pos: f"{value:.0f}%"))
    ax.grid(True, color="#E7E5E4", lw=0.9)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#9CA3AF")
    ax.spines["bottom"].set_color("#9CA3AF")

    caption = (
        "\uc790\ub8cc: data_processed/school_priority.csv | "
        "\uc77c\ubc18 \ube44\uad50\uad70 242\uac1c\uad50, \uac15\ud654\u00b7\uc639\uc9c4\u00b7\ubd84\uad50 \ub4f1 \ubcc4\ub3c4 \ubb36\uc74c \uc81c\uc678 | "
        "\uc810 \ud06c\uae30\ub294 \ub3c4\ubcf4\uad8c \uacf5\uc6d0\uba74\uc801"
    )
    fig.subplots_adjust(left=0.10, right=0.98, top=0.88, bottom=0.16)
    fig.text(0.08, 0.025, caption, fontsize=9, color="#57534E")

    fig.savefig(OUT_PNG, bbox_inches="tight", facecolor="white")
    fig.savefig(OUT_JPG, bbox_inches="tight", facecolor="white", pil_kwargs={"quality": 95})
    print(OUT_PNG)
    print(OUT_JPG)
    print(f"pearson_r={pearson.statistic:.6f}, p={pearson.pvalue:.6g}")
    print(f"spearman_r={spearman.statistic:.6f}, p={spearman.pvalue:.6g}")


if __name__ == "__main__":
    main()
