from __future__ import annotations

from pathlib import Path

import matplotlib.font_manager as fm
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import pandas as pd
from scipy import stats


BASE = Path(r"C:\2026_data_analysis_park")
OUTPUT = BASE / "output"
DONG_PATH = OUTPUT / "incheon_vulnerable_green_by_base_dong_20260423.csv"

OUT_SCATTER = OUTPUT / "fig_vulnerable_green_scatter_annotated.png"
OUT_SCATTER_LOG = OUTPUT / "fig_vulnerable_green_scatter_annotated_log.png"
OUT_MATRIX = OUTPUT / "fig_vulnerable_green_matrix.png"
OUT_B_CARD = OUTPUT / "fig_vulnerable_green_b_quadrant_card.png"

RED = "#1F4D4F"
GREY = "#7A8A99"
BLACK = "#162126"
LINE_GREY = "#AEBBC4"
GRID = "#D8E0E6"
GREEN_BG = "#DCE8E3"
RED_BG = "#D7E4E5"
GREY_BG = "#E9EEF1"
YELLOW_BG = "#E3ECE8"
WHITE = "#FFFFFF"


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
    plt.rcParams["font.size"] = 11


def save_fig(fig: plt.Figure, path: Path) -> None:
    fig.savefig(
        path,
        dpi=300,
        bbox_inches="tight",
        facecolor=WHITE,
        edgecolor=WHITE,
        transparent=False,
        pad_inches=0.08,
    )
    plt.close(fig)


def style_axis(ax: plt.Axes) -> None:
    ax.set_facecolor(WHITE)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#CBD5E1")
    ax.spines["bottom"].set_color("#CBD5E1")
    ax.yaxis.grid(True, color=GRID, linewidth=0.9)
    ax.xaxis.grid(False)
    ax.set_axisbelow(True)


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DONG_PATH, encoding="utf-8-sig").copy()
    df["dong_label"] = df["gu"] + " " + df["base_dong"]
    q75 = df["livelihood_recipients_total"].quantile(0.75)
    df["top25_flag"] = df["livelihood_recipients_total"] >= q75
    return df


def regression_with_ci(x: np.ndarray, y: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    slope, intercept, _, _, _ = stats.linregress(x, y)
    n = len(x)
    x_line = np.linspace(x.min(), x.max(), 200)
    y_line = intercept + slope * x_line

    y_hat = intercept + slope * x
    s_err = np.sqrt(np.sum((y - y_hat) ** 2) / (n - 2))
    x_mean = x.mean()
    ssx = np.sum((x - x_mean) ** 2)
    t_val = stats.t.ppf(0.975, df=n - 2)
    ci = t_val * s_err * np.sqrt(1 / n + ((x_line - x_mean) ** 2) / ssx)
    return x_line, y_line, ci


def pick_labels(df: pd.DataFrame) -> pd.DataFrame:
    candidates = df.sort_values(
        ["under1_green_school_count", "livelihood_recipients_total", "school_count"],
        ascending=[False, False, False],
    ).head(8)
    labeled = candidates[candidates["under1_green_school_count"] >= 2].head(5).copy()
    if len(labeled) < 3:
        labeled = candidates.head(5).copy()
    return labeled


def create_scatter(df: pd.DataFrame, use_log_x: bool, out_path: Path) -> None:
    x_raw = df["livelihood_recipients_total"].to_numpy(dtype=float)
    y = df["under1_green_school_count"].to_numpy(dtype=float)
    x_model = np.log10(x_raw) if use_log_x else x_raw

    pearson_r, pearson_p = stats.pearsonr(x_raw, y)
    x_line, y_line, ci = regression_with_ci(x_model, y)

    fig, ax = plt.subplots(figsize=(9.5, 6.2), facecolor=WHITE)
    style_axis(ax)

    rest = df[~df["top25_flag"]]
    top = df[df["top25_flag"]]
    ax.scatter(
        rest["livelihood_recipients_total"],
        rest["under1_green_school_count"],
        s=58,
        color=GREY,
        alpha=0.9,
        edgecolors=WHITE,
        linewidths=0.5,
        label="나머지 동",
        zorder=3,
    )
    ax.scatter(
        top["livelihood_recipients_total"],
        top["under1_green_school_count"],
        s=70,
        color=RED,
        alpha=0.95,
        edgecolors=WHITE,
        linewidths=0.6,
        label="상위 25% 동",
        zorder=4,
    )

    if use_log_x:
        x_plot = 10 ** x_line
        ax.set_xscale("log")
    else:
        x_plot = x_line

    ax.fill_between(x_plot, y_line - ci, y_line + ci, color=LINE_GREY, alpha=0.35, zorder=1)
    ax.plot(x_plot, y_line, color=BLACK, linewidth=2.0, zorder=2)

    labels = pick_labels(df)
    offsets = [(20, 14), (18, -18), (-58, 16), (15, 18), (-45, -20)]
    for i, (_, row) in enumerate(labels.iterrows()):
        dx, dy = offsets[i % len(offsets)]
        ax.annotate(
            row["dong_label"],
            xy=(row["livelihood_recipients_total"], row["under1_green_school_count"]),
            xytext=(dx, dy),
            textcoords="offset points",
            fontsize=10.5,
            color=BLACK,
            arrowprops=dict(arrowstyle="-", color="#6B7280", lw=0.9),
            bbox=dict(boxstyle="round,pad=0.18", fc=WHITE, ec="none", alpha=0.9),
            zorder=5,
        )

    stats_text = f"Pearson r = {pearson_r:.3f}\np = {pearson_p:.3f} ***\nn = {len(df)}"
    ax.text(
        0.98,
        0.96,
        stats_text,
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=11,
        bbox=dict(boxstyle="round,pad=0.35", fc=WHITE, ec=BLACK, lw=0.9),
    )

    ax.set_xlabel("동별 기초생계급여 수급권자 수 (명)")
    ax.set_ylabel("동별 녹지 1% 미만 학교 수")
    ax.set_title("취약계층 집중 동에서 극단 결핍 학교가 집중된다", fontsize=15, pad=14, weight="bold")
    ax.legend(loc="upper left", frameon=False)
    ax.set_ylim(-0.2, max(y) + 1.1)
    save_fig(fig, out_path)


def create_matrix(df: pd.DataFrame) -> None:
    x_cut = df["livelihood_recipients_total"].quantile(0.75)
    y_cut = df["under1_green_school_count"].median()

    plot_df = df.copy()
    plot_df["x_group"] = np.where(plot_df["livelihood_recipients_total"] >= x_cut, "상위 25%", "나머지")
    plot_df["y_group"] = np.where(plot_df["under1_green_school_count"] > y_cut, "상위 50%", "하위 50%")

    quad_map = {
        ("나머지", "상위 50%"): "A",
        ("상위 25%", "상위 50%"): "B",
        ("나머지", "하위 50%"): "C",
        ("상위 25%", "하위 50%"): "D",
    }
    plot_df["quadrant"] = plot_df.apply(lambda r: quad_map[(r["x_group"], r["y_group"])], axis=1)

    counts = plot_df["quadrant"].value_counts().to_dict()
    backgrounds = {"A": GREEN_BG, "B": RED_BG, "C": GREY_BG, "D": YELLOW_BG}
    positions = {
        "A": (0, 1, "나머지", "상위 50%"),
        "B": (1, 1, "상위 25%", "상위 50%"),
        "C": (0, 0, "나머지", "하위 50%"),
        "D": (1, 0, "상위 25%", "하위 50%"),
    }

    b_df = plot_df[plot_df["quadrant"] == "B"].sort_values(
        ["under1_green_school_count", "livelihood_recipients_total"],
        ascending=[False, False],
    )
    a_df = plot_df[plot_df["quadrant"] == "A"].sort_values(
        ["under1_green_school_count", "livelihood_recipients_total"],
        ascending=[False, False],
    )
    b_share = len(b_df) / len(plot_df) * 100
    high_share_in_top25 = len(b_df) / max(1, len(plot_df[plot_df["x_group"] == "상위 25%"])) * 100

    fig, ax = plt.subplots(figsize=(10.6, 7.0), facecolor=WHITE)
    ax.set_facecolor(WHITE)
    ax.set_xlim(0, 3.0)
    ax.set_ylim(0, 2)
    ax.axis("off")

    for quad, (x0, y0, _, _) in positions.items():
        rect = patches.Rectangle((x0, y0), 1, 1, facecolor=backgrounds[quad], edgecolor=WHITE, linewidth=2)
        ax.add_patch(rect)
        ax.text(
            x0 + 0.08,
            y0 + 0.86,
            quad,
            fontsize=16,
            fontweight="bold",
            color=BLACK,
        )
        ax.text(
            x0 + 0.08,
            y0 + 0.68,
            f"동 {counts.get(quad, 0)}개",
            fontsize=14,
            color=BLACK,
        )

    if not a_df.empty:
        a_names = "\n".join(a_df["dong_label"].tolist())
        ax.text(
            0.08,
            1.55,
            a_names,
            fontsize=9.0,
            color=BLACK,
            va="top",
            ha="left",
            linespacing=1.15,
        )

    if not b_df.empty:
        ax.text(1.08, 1.55, "★ 이중 취약", fontsize=15, fontweight="bold", color=RED)
        b_names = "\n".join(b_df["dong_label"].tolist())
        ax.text(
            1.08,
            1.41,
            b_names,
            fontsize=9.0,
            color=BLACK,
            va="top",
            ha="left",
            linespacing=1.15,
        )

    ax.plot([1, 1], [0, 2], color=WHITE, linewidth=2)
    ax.plot([0, 2], [1, 1], color=WHITE, linewidth=2)

    ax.text(0.5, -0.05, "나머지", ha="center", va="top", fontsize=12, color=BLACK)
    ax.text(1.5, -0.05, "기초생계급여 상위 25%", ha="center", va="top", fontsize=12, color=BLACK)
    ax.text(-0.05, 0.5, "1% 미만 학교 수 하위 50%", ha="right", va="center", fontsize=12, color=BLACK, rotation=90)
    ax.text(-0.05, 1.5, "1% 미만 학교 수 상위 50%", ha="right", va="center", fontsize=12, color=BLACK, rotation=90)

    summary = (
        f"이중 취약 B 사분면: {len(b_df)}개 동 ({b_share:.1f}%)\n"
        f"취약계층 상위 동의 {high_share_in_top25:.1f}%가 극단 결핍 집중 구역과 중첩"
    )
    ax.text(
        2.12,
        1.86,
        summary,
        ha="left",
        va="top",
        fontsize=11,
        color=BLACK,
        bbox=dict(boxstyle="round,pad=0.35", fc=WHITE, ec="#D1D5DB", lw=0.9),
    )
    ax.text(
        0.0,
        2.08,
        "취약계층-극단 결핍 중첩 매트릭스",
        fontsize=15,
        fontweight="bold",
        color=BLACK,
        ha="left",
    )

    save_fig(fig, OUT_MATRIX)

    print(f"B quadrant count: {len(b_df)} / {len(plot_df)} ({b_share:.1f}%)")
    print(f"Overlap in top25 vulnerable dongs: {high_share_in_top25:.1f}%")
    print("B quadrant dongs:")
    for _, row in b_df.iterrows():
        print(f"- {row['dong_label']} ({int(row['livelihood_recipients_total'])}명, 1%미만 {int(row['under1_green_school_count'])}개)")


def create_b_quadrant_card(df: pd.DataFrame) -> None:
    x_cut = df["livelihood_recipients_total"].quantile(0.75)
    y_cut = df["under1_green_school_count"].median()
    b_df = df[
        (df["livelihood_recipients_total"] >= x_cut) & (df["under1_green_school_count"] > y_cut)
    ].sort_values(
        ["under1_green_school_count", "livelihood_recipients_total"],
        ascending=[False, False],
    )

    fig, ax = plt.subplots(figsize=(7.6, 5.4), facecolor=WHITE)
    ax.set_facecolor(WHITE)
    ax.axis("off")

    card = patches.FancyBboxPatch(
        (0.03, 0.06),
        0.94,
        0.88,
        boxstyle="round,pad=0.015,rounding_size=0.02",
        transform=ax.transAxes,
        facecolor=RED_BG,
        edgecolor="#FCA5A5",
        linewidth=1.2,
    )
    ax.add_patch(card)

    ax.text(0.07, 0.88, "B 사분면", transform=ax.transAxes, fontsize=15, fontweight="bold", color=BLACK)
    ax.text(0.20, 0.88, "★ 이중 취약", transform=ax.transAxes, fontsize=15, fontweight="bold", color=RED)
    ax.text(
        0.07,
        0.81,
        f"기초생계급여 상위 25% + 1% 미만 학교 수 상위 50%\n총 {len(b_df)}개 동",
        transform=ax.transAxes,
        fontsize=10.5,
        color="#374151",
        va="top",
    )

    y = 0.68
    for _, row in b_df.iterrows():
        ax.text(
            0.08,
            y,
            f"{row['dong_label']}",
            transform=ax.transAxes,
            fontsize=11.5,
            color=BLACK,
            fontweight="bold",
            va="top",
        )
        ax.text(
            0.54,
            y,
            f"{int(row['livelihood_recipients_total'])}명 / 1% 미만 {int(row['under1_green_school_count'])}개",
            transform=ax.transAxes,
            fontsize=10.5,
            color="#374151",
            va="top",
        )
        y -= 0.085

    save_fig(fig, OUT_B_CARD)


def main() -> None:
    setup_font()
    df = load_data()
    x_skew = df["livelihood_recipients_total"].skew()
    use_log = x_skew > 1.5

    create_scatter(df, use_log_x=False, out_path=OUT_SCATTER_LOG if use_log else OUT_SCATTER)
    if use_log:
        create_scatter(df, use_log_x=True, out_path=OUT_SCATTER)
    create_matrix(df)
    create_b_quadrant_card(df)

    pearson_r, pearson_p = stats.pearsonr(
        df["livelihood_recipients_total"].to_numpy(dtype=float),
        df["under1_green_school_count"].to_numpy(dtype=float),
    )
    print("# 취약계층 주석 시각화 생성 완료")
    print(f"use_log_x_for_main={use_log}")
    print(f"pearson_r={pearson_r:.3f}, p={pearson_p:.3f}, n={len(df)}")
    print(f"x_q75={df['livelihood_recipients_total'].quantile(0.75):.1f}")
    print(f"y_median={df['under1_green_school_count'].median():.1f}")
    print(f"- {OUT_SCATTER}")
    if use_log:
        print(f"- {OUT_SCATTER_LOG}")
    print(f"- {OUT_MATRIX}")
    print(f"- {OUT_B_CARD}")


if __name__ == "__main__":
    main()
