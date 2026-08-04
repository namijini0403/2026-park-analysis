from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib import font_manager


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_processed"
OUTPUT = ROOT / "outputs" / "green_ratio_threshold"

SOURCE_CSV = DATA / "school_priority_with_functional_park_layer.csv"
SUMMARY_CSV = OUTPUT / "green_ratio_distribution_005_threshold.csv"
UNDER_005_CSV = OUTPUT / "green_ratio_under_005_schools.csv"
CHART_PNG = OUTPUT / "green_ratio_distribution_005_threshold.png"
CHART_WHITE_PNG = OUTPUT / "green_ratio_distribution_005_threshold_white.png"


def setup_korean_font() -> None:
    font_candidates = [
        r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\malgunbd.ttf",
    ]
    for candidate in font_candidates:
        path = Path(candidate)
        if path.exists():
            font_manager.fontManager.addfont(str(path))
            plt.rcParams["font.family"] = "Malgun Gothic"
            break
    plt.rcParams["axes.unicode_minus"] = False


def bucket(value: float) -> str:
    if value < 0.05:
        return "<0.05%"
    if value < 5:
        return "0.05~5%"
    if value < 10:
        return "5~10%"
    return "10%↑"


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    setup_korean_font()

    df = pd.read_csv(SOURCE_CSV, encoding="utf-8-sig")
    main = df[
        (pd.to_numeric(df["is_separate_bundle_tag"], errors="coerce").fillna(0) != 1)
        & (pd.to_numeric(df["is_island_tag"], errors="coerce").fillna(0) != 1)
    ].copy()
    main["display_green_ratio"] = pd.to_numeric(main["display_green_ratio"], errors="coerce").fillna(0.0)
    main["green_ratio_bucket_005"] = main["display_green_ratio"].apply(bucket)

    order = ["<0.05%", "0.05~5%", "5~10%", "10%↑"]
    counts = main["green_ratio_bucket_005"].value_counts().reindex(order, fill_value=0).astype(int)
    summary = pd.DataFrame(
        {
            "bucket": order,
            "school_count": counts.to_list(),
            "share_pct": [count / len(main) * 100 for count in counts.to_list()],
        }
    )
    summary.to_csv(SUMMARY_CSV, index=False, encoding="utf-8-sig")

    main.loc[
        main["display_green_ratio"] < 0.05,
        ["학교ID", "학교명", "gu", "display_green_ratio", "case_type", "case_label", "nearest_park_dist_m"],
    ].sort_values(["gu", "학교명"]).to_csv(UNDER_005_CSV, index=False, encoding="utf-8-sig")

    colors = ["#b93a3e", "#cc7f2a", "#d8af34", "#225833"]

    # White-background PPT variant. Counts and bucket logic are identical to the
    # original dark chart; only the presentation colors are adjusted.
    fig_white, ax_white = plt.subplots(figsize=(10.8, 6.1), dpi=180)
    fig_white.patch.set_facecolor("#ffffff")
    ax_white.set_facecolor("#ffffff")
    bars_white = ax_white.bar(order, counts.to_list(), color=colors, width=0.62)
    ax_white.set_title("도보 500m 녹지비율 분포 (n=242)", color="#164b7a", fontsize=15, fontweight="bold", pad=12)
    ax_white.set_ylim(0, 150)
    ax_white.set_yticks([0, 50, 100, 150])
    ax_white.tick_params(axis="x", colors="#14384a", labelsize=11)
    ax_white.tick_params(axis="y", colors="#167457", labelsize=10)
    ax_white.grid(axis="y", linestyle=(0, (2, 2)), linewidth=1.0, color="#9ea7b3", alpha=0.85)
    ax_white.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax_white.spines[spine].set_visible(False)
    ax_white.spines["left"].set_color("#6f8d76")
    ax_white.spines["bottom"].set_color("#6f8d76")
    for bar, count in zip(bars_white, counts.to_list()):
        ax_white.text(
            bar.get_x() + bar.get_width() / 2,
            count + 3,
            f"{count}",
            ha="center",
            va="bottom",
            color="#14384a",
            fontsize=13,
            fontweight="bold",
            clip_on=False,
        )
    under_5 = int(counts["<0.05%"] + counts["0.05~5%"])
    under_5_pct = under_5 / len(main) * 100
    ax_white.text(
        0.98,
        -0.17,
        f"5% 미만 합산 {under_5}개 ({under_5_pct:.1f}%)",
        transform=ax_white.transAxes,
        ha="right",
        va="top",
        color="#b93a3e",
        fontsize=11,
        fontweight="bold",
    )
    fig_white.tight_layout(pad=2)
    fig_white.savefig(CHART_WHITE_PNG, facecolor=fig_white.get_facecolor(), bbox_inches="tight")
    plt.close(fig_white)

    fig, ax = plt.subplots(figsize=(10.8, 6.1), dpi=180)
    fig.patch.set_facecolor("#000000")
    ax.set_facecolor("#000000")

    bars = ax.bar(order, counts.to_list(), color=colors, width=0.62)
    ax.set_title("도보 500m 녹지비율 분포 (n=242)", color="#164b7a", fontsize=15, fontweight="bold", pad=12)
    ax.set_ylim(0, 150)
    ax.set_yticks([0, 50, 100, 150])
    ax.tick_params(axis="x", colors="#0f4f62", labelsize=11)
    ax.tick_params(axis="y", colors="#0f9c72", labelsize=10)
    ax.grid(axis="y", linestyle=(0, (2, 2)), linewidth=1.0, color="#d7d7d7", alpha=0.75)
    ax.set_axisbelow(True)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#6f8d76")
    ax.spines["bottom"].set_color("#6f8d76")

    for bar, count in zip(bars, counts.to_list()):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            count + 3,
            f"{count}",
            ha="center",
            va="bottom",
            color="#f0d235",
            fontsize=13,
            fontweight="bold",
        )

    ax.text(
        0.98,
        -0.17,
        f"5% 미만 합산 {under_5}개 ({under_5_pct:.1f}%)",
        transform=ax.transAxes,
        ha="right",
        va="top",
        color="#ff3b4d",
        fontsize=11,
        fontweight="bold",
    )

    fig.tight_layout(pad=2)
    fig.savefig(CHART_PNG, facecolor=fig.get_facecolor(), bbox_inches="tight")
    plt.close(fig)

    print(f"summary={SUMMARY_CSV}")
    print(f"under_005={UNDER_005_CSV}")
    print(f"chart={CHART_PNG}")
    print(f"chart_white={CHART_WHITE_PNG}")


if __name__ == "__main__":
    main()
