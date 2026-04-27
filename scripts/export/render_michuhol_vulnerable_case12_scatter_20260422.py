from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.ticker import FuncFormatter
from scipy import stats


BASE = Path(r"C:\2026_data_analysis_park")
INPUT = BASE / "output" / "michuhol_vulnerable_green_school_sensitivity_20260422.csv"
OUT_PNG = BASE / "output" / "michuhol_vulnerable_under1_green_scatter_20260422.png"
OUT_JPG = BASE / "output" / "michuhol_vulnerable_under1_green_scatter_20260422.jpg"

FONT_REGULAR = Path(r"C:\Windows\Fonts\malgun.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\malgunbd.ttf")
font_manager.fontManager.addfont(str(FONT_REGULAR))
font_manager.fontManager.addfont(str(FONT_BOLD))
plt.rcParams["font.family"] = "Malgun Gothic"
plt.rcParams["axes.unicode_minus"] = False

JUAN = "\uc8fc\uc548\ub3d9"
YONGHYEON = "\uc6a9\ud604\ub3d9"
GWANGYO = "\uad00\uad50\ub3d9"


def main() -> None:
    school_df = pd.read_csv(INPUT, encoding="utf-8-sig")
    school_df["is_under1_green"] = school_df["iso_green_ratio"] < 1.0
    df = (
        school_df.groupby("base_dong", as_index=False)
        .agg(
            vulnerable_persons_total=("vulnerable_persons_total", "first"),
            school_count=("\ud559\uad50ID", "count"),
            under1_green_school_count=("is_under1_green", "sum"),
        )
        .sort_values("vulnerable_persons_total", ascending=False)
    )
    df["under1_green_pct"] = df["under1_green_school_count"] / df["school_count"] * 100.0

    x = df["vulnerable_persons_total"].astype(float).to_numpy()
    y = df["under1_green_pct"].astype(float).to_numpy()
    r, p = stats.pearsonr(x, y)
    slope, intercept, *_ = stats.linregress(x, y)

    x_min = max(0, x.min() * 0.78)
    x_max = x.max() * 1.10
    xx = np.linspace(x_min, x_max, 200)
    yy = slope * xx + intercept

    colors: list[str] = []
    sizes: list[int] = []
    for dong in df["base_dong"]:
        if dong in [JUAN, YONGHYEON]:
            colors.append("#E11D48")
            sizes.append(260)
        elif dong == GWANGYO:
            colors.append("#2563EB")
            sizes.append(240)
        else:
            colors.append("#737373")
            sizes.append(160)

    fig, ax = plt.subplots(figsize=(12.2, 7.3), dpi=240)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("#FAFAF9")

    x_med = float(np.median(x))
    y_med = float(np.median(y))
    ax.axvline(x_med, color="#D6D3D1", lw=1.1, ls="--", zorder=0)
    ax.axhline(y_med, color="#D6D3D1", lw=1.1, ls="--", zorder=0)

    ax.plot(xx, yy, color="#111827", lw=2.8, zorder=1)
    ax.scatter(x, y, s=sizes, c=colors, edgecolors="white", linewidths=1.8, zorder=3)

    offsets = {
        JUAN: (-82, -2),
        YONGHYEON: (12, -18),
        GWANGYO: (12, 8),
        "\ub3c4\ud654\ub3d9": (14, 7),
        "\uc22d\uc758\ub3d9": (12, -16),
        "\ud559\uc775\ub3d9": (12, 8),
        "\ubb38\ud559\ub3d9": (12, 8),
    }
    for _, row in df.iterrows():
        dong = row["base_dong"]
        dx, dy = offsets.get(dong, (10, 6))
        if dong in [JUAN, YONGHYEON]:
            label_color = "#BE123C"
            weight = "bold"
        elif dong == GWANGYO:
            label_color = "#1D4ED8"
            weight = "bold"
        else:
            label_color = "#374151"
            weight = "normal"
        ax.annotate(
            dong,
            (row["vulnerable_persons_total"], row["under1_green_pct"]),
            xytext=(dx, dy),
            textcoords="offset points",
            fontsize=11,
            fontweight=weight,
            color=label_color,
            zorder=4,
        )

    ax.text(
        0.035,
        0.94,
        "\ucde8\uc57d\uacc4\uce35 \uc778\uad6c \uc0c1\uc704 2\uac1c \ub3d9: \uc8fc\uc548\u00b7\uc6a9\ud604",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=11,
        color="#BE123C",
        fontweight="bold",
    )
    ax.text(
        0.035,
        0.895,
        "\ucde8\uc57d\uacc4\uce35 \uc778\uad6c \ud558\uc704: \uad00\uad50",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=11,
        color="#1D4ED8",
        fontweight="bold",
    )

    stats_text = "Pearson r = 0.901\np = 0.006\nn = 7"
    ax.text(
        0.965,
        0.115,
        stats_text,
        transform=ax.transAxes,
        ha="right",
        va="bottom",
        fontsize=12,
        fontweight="bold",
        color="#111827",
        bbox=dict(boxstyle="round,pad=0.45", facecolor="white", edgecolor="#D1D5DB", alpha=0.97),
    )

    ax.text(
        x_med + 45,
        96,
        "\uae30\ucd08\uc218\uae09\uc790 \uc218 \uc911\uc559\uac12",
        fontsize=9,
        color="#78716C",
        va="top",
    )
    ax.text(
        x_min + 65,
        y_med + 1.4,
        "\ub179\uc9c0\ube44\uc728 1% \ubbf8\ub9cc \ud559\uad50 \ube44\uc728 \uc911\uc559\uac12",
        fontsize=9,
        color="#78716C",
    )

    ax.set_title(
        "\ubbf8\ucd94\ud640\uad6c \ucde8\uc57d\uacc4\uce35 \uc778\uad6c\uc640 \uc800\ub179\uc9c0 \ud559\uad50 \ubd84\ud3ec\uc758 \uad00\uacc4",
        fontsize=18,
        fontweight="bold",
        pad=18,
    )
    ax.set_xlabel(
        "\uae30\ucd08\uc218\uae09\uc790 \uc218(\uba85, \ud589\uc815\ub3d9 \uc790\ub8cc\ub97c \ubc95\uc815\ub3d9 \uadf8\ub8f9\uc73c\ub85c \ud569\uc0b0)",
        fontsize=12,
        labelpad=12,
    )
    ax.set_ylabel("\ub179\uc9c0\ube44\uc728 1% \ubbf8\ub9cc \ud559\uad50 \ube44\uc728(%)", fontsize=12, labelpad=12)

    ax.set_xlim(x_min, x_max)
    ax.set_ylim(-5, 100)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda value, _pos: f"{int(value):,}"))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda value, _pos: f"{value:.0f}%"))
    ax.grid(True, color="#E7E5E4", lw=0.9)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#9CA3AF")
    ax.spines["bottom"].set_color("#9CA3AF")

    caption = (
        "\uc790\ub8cc: \ubbf8\ucd94\ud640\uad6c \uae30\ucd08\uc0dd\ud65c\uc218\uae09\ud604\ud669(2025.04.30), "
        "\ud559\uad50\ubcc4 \uc2e4\uc81c \ub3c4\ubcf4\uad8c \ub179\uc9c0\ube44\uc728 | "
        "n=7 \ubc95\uc815\ub3d9 \uadf8\ub8f9"
    )
    fig.subplots_adjust(left=0.10, right=0.98, top=0.88, bottom=0.18)
    fig.text(0.08, 0.02, caption, fontsize=9, color="#57534E")

    fig.savefig(OUT_PNG, bbox_inches="tight", facecolor="white")
    fig.savefig(OUT_JPG, bbox_inches="tight", facecolor="white", pil_kwargs={"quality": 95})
    print(OUT_PNG)
    print(OUT_JPG)
    print(f"r={r:.6f}, p={p:.6f}, n={len(df)}")


if __name__ == "__main__":
    main()
