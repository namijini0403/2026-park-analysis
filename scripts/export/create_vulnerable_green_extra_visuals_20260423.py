from __future__ import annotations

from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


BASE = Path(r"C:\2026_data_analysis_park")
OUTPUT = BASE / "output"

DONG_PATH = OUTPUT / "incheon_vulnerable_green_by_base_dong_20260423.csv"
OUT_QUARTILE = OUTPUT / "fig_vulnerable_quartile_extreme_green.jpg"
OUT_TOP25 = OUTPUT / "fig_top25_vs_rest_comparison.jpg"

GREY = "#475569"
GREY_LIGHT = "#94A3B8"
RED = "#EF4444"
GREEN = "#10B981"
BG = "white"
TEXT = "#111827"
GRID = "#E5E7EB"


def setup_font() -> None:
    font_paths = [
        Path("C:/Windows/Fonts/Pretendard-Regular.otf"),
        Path("C:/Windows/Fonts/NanumGothic.ttf"),
        Path("C:/Windows/Fonts/malgun.ttf"),
    ]
    for path in font_paths:
        if path.exists():
            prop = fm.FontProperties(fname=str(path))
            plt.rcParams["font.family"] = prop.get_name()
            break
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["font.size"] = 12


def style_axis(ax: plt.Axes) -> None:
    ax.set_facecolor(BG)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.tick_params(colors=TEXT)
    ax.yaxis.grid(True, color=GRID, linewidth=0.9)
    ax.xaxis.grid(False)
    ax.set_axisbelow(True)


def save_fig(fig: plt.Figure, path: Path) -> None:
    fig.savefig(
        path,
        dpi=300,
        bbox_inches="tight",
        facecolor=BG,
        edgecolor=BG,
        transparent=False,
        pad_inches=0.08,
    )
    plt.close(fig)


def add_bar_labels(ax: plt.Axes, bars, suffix: str = "%", dy: float = 0.8) -> None:
    for bar in bars:
        value = bar.get_height()
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            value + dy,
            f"{value:.1f}{suffix}",
            ha="center",
            va="bottom",
            fontsize=11,
            color=TEXT,
            fontweight="bold",
        )


def load_dong() -> pd.DataFrame:
    df = pd.read_csv(DONG_PATH, encoding="utf-8-sig")
    required = {
        "livelihood_recipients_total",
        "school_count",
        "avg_green_ratio",
        "under1_green_school_count",
        "under1_green_school_share",
    }
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing columns in {DONG_PATH}: {missing}")
    df = df.copy()
    df["under1_green_school_share_pct"] = df["under1_green_school_share"] * 100
    return df


def assign_quartiles(df: pd.DataFrame) -> pd.DataFrame:
    labels = ["하위 25%", "25~50%", "50~75%", "상위 25%"]
    out = df.copy()
    out["vulnerable_quartile"] = pd.qcut(
        out["livelihood_recipients_total"],
        q=4,
        labels=labels,
        duplicates="drop",
    )
    if out["vulnerable_quartile"].nunique() != 4:
        raise ValueError("Unable to split vulnerability population into four quartiles.")
    return out


def create_quartile_chart(df: pd.DataFrame) -> pd.DataFrame:
    labels = ["하위 25%", "25~50%", "50~75%", "상위 25%"]
    quartile = (
        df.groupby("vulnerable_quartile", observed=False)
        .agg(
            dong_count=("vulnerable_quartile", "size"),
            school_count=("school_count", "sum"),
            under1_share_pct=("under1_green_school_share_pct", "mean"),
            weighted_under1_share_pct=(
                "under1_green_school_count",
                lambda s: np.nan,
            ),
            livelihood_min=("livelihood_recipients_total", "min"),
            livelihood_max=("livelihood_recipients_total", "max"),
        )
        .reindex(labels)
    )
    weighted = (
        df.groupby("vulnerable_quartile", observed=False)
        .apply(
            lambda g: g["under1_green_school_count"].sum()
            / g["school_count"].sum()
            * 100
            if g["school_count"].sum()
            else np.nan
        )
        .reindex(labels)
    )
    quartile["weighted_under1_share_pct"] = weighted

    overall_avg = df["under1_green_school_share_pct"].mean()
    values = quartile["under1_share_pct"].to_numpy()
    x = np.arange(len(labels))
    colors = [GREY_LIGHT, GREY_LIGHT, GREY, RED]

    fig, ax = plt.subplots(figsize=(8.6, 5.2), facecolor=BG)
    style_axis(ax)
    bars = ax.bar(x, values, width=0.58, color=colors, edgecolor="none")
    add_bar_labels(ax, bars)

    ax.axhline(overall_avg, color=GREEN, linewidth=1.6, linestyle=(0, (4, 3)))
    ax.text(
        len(labels) - 0.55,
        overall_avg + 0.7,
        f"전체 평균 {overall_avg:.1f}%",
        color=GREEN,
        fontsize=11,
        ha="right",
        va="bottom",
        fontweight="bold",
    )

    xtick_labels = [
        f"{label}\n(n={int(quartile.loc[label, 'dong_count'])}, 학교 {int(quartile.loc[label, 'school_count'])})"
        for label in labels
    ]
    ax.set_xticks(x)
    ax.set_xticklabels(xtick_labels, fontsize=11)
    ax.set_ylabel("1% 미만 녹지 학교 비율 (%)", color=TEXT)
    ax.set_ylim(0, max(40, np.nanmax(values) + 9))
    ax.margins(x=0.05)
    save_fig(fig, OUT_QUARTILE)
    return quartile


def create_top25_chart(df: pd.DataFrame) -> pd.DataFrame:
    threshold = df["livelihood_recipients_total"].quantile(0.75)
    high = df[df["livelihood_recipients_total"] >= threshold]
    rest = df[df["livelihood_recipients_total"] < threshold]
    rows = pd.DataFrame(
        [
            {
                "group": "상위 25%",
                "dong_count": len(high),
                "school_count": int(high["school_count"].sum()),
                "avg_green_ratio": high["avg_green_ratio"].mean(),
                "under1_share_pct": high["under1_green_school_share_pct"].mean(),
            },
            {
                "group": "나머지",
                "dong_count": len(rest),
                "school_count": int(rest["school_count"].sum()),
                "avg_green_ratio": rest["avg_green_ratio"].mean(),
                "under1_share_pct": rest["under1_green_school_share_pct"].mean(),
            },
        ]
    )

    metrics = ["평균 녹지비율", "1% 미만 학교 비율"]
    high_values = [
        rows.loc[rows["group"] == "상위 25%", "avg_green_ratio"].iloc[0],
        rows.loc[rows["group"] == "상위 25%", "under1_share_pct"].iloc[0],
    ]
    rest_values = [
        rows.loc[rows["group"] == "나머지", "avg_green_ratio"].iloc[0],
        rows.loc[rows["group"] == "나머지", "under1_share_pct"].iloc[0],
    ]

    x = np.arange(len(metrics))
    width = 0.34
    fig, ax = plt.subplots(figsize=(8.2, 5.0), facecolor=BG)
    style_axis(ax)
    bars_rest = ax.bar(
        x - width / 2,
        rest_values,
        width,
        color=GREY,
        edgecolor="none",
        label="나머지 동",
    )
    bars_high = ax.bar(
        x + width / 2,
        high_values,
        width,
        color=RED,
        edgecolor="none",
        label="취약계층 상위 25% 동",
    )
    add_bar_labels(ax, bars_rest)
    add_bar_labels(ax, bars_high)

    diff = high_values[1] - rest_values[1]
    ax.set_ylabel("비율 (%)", color=TEXT)
    ax.set_xticks(x)
    ax.set_xticklabels(metrics, fontsize=12)
    ax.set_ylim(0, max(high_values + rest_values) + 9)
    ax.legend(
        loc="upper left",
        bbox_to_anchor=(0.0, 1.0),
        frameon=False,
        fontsize=10.5,
    )
    save_fig(fig, OUT_TOP25)
    return rows


def main() -> None:
    setup_font()
    df = assign_quartiles(load_dong())
    quartile = create_quartile_chart(df)
    top25 = create_top25_chart(df)

    print("# 취약계층-녹지 추가 시각화 생성 완료")
    print(f"- {OUT_QUARTILE}")
    print(f"- {OUT_TOP25}")
    print("\n## 4분위 경계 및 결과")
    for label, row in quartile.iterrows():
        print(
            f"{label}: "
            f"{row['livelihood_min']:.0f}~{row['livelihood_max']:.0f}명, "
            f"동 {int(row['dong_count'])}개, "
            f"학교 {int(row['school_count'])}개, "
            f"1% 미만 비율 {row['under1_share_pct']:.1f}% "
            f"(학교가중 {row['weighted_under1_share_pct']:.1f}%)"
        )
    print("\n## 상위 25% vs 나머지")
    for _, row in top25.iterrows():
        print(
            f"{row['group']}: "
            f"동 {int(row['dong_count'])}개, 학교 {int(row['school_count'])}개, "
            f"평균 녹지 {row['avg_green_ratio']:.2f}%, "
            f"1% 미만 학교 비율 {row['under1_share_pct']:.1f}%"
        )


if __name__ == "__main__":
    main()
