from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "data_quality" / "park_function_counterfactual_by_school_20260518.csv"
LONG_INPUT = ROOT / "data_quality" / "park_function_counterfactual_nearest_long_20260518.csv"
OUT_DIR = ROOT / "outputs" / "park_distance_comparison"
COMPAT_OUT_DIR = ROOT / "outputs" / "case_reclassification"

DISTANCE_SERIES = [
    {
        "label": "전체 공원 포함",
        "scenario": "baseline_all_classes",
        "short_label": "현재",
        "color": "#2f7d6b",
    },
    {
        "label": "놀이터급 제외",
        "scenario": "exclude_playground_like",
        "short_label": "놀이터급 제외",
        "color": "#d5a33f",
    },
    {
        "label": "소규모 공원 이하 제외\n(3,000㎡ 이상만)",
        "scenario": "exclude_playground_and_small_child",
        "short_label": "소규모 이하 제외",
        "color": "#d06545",
    },
]


def percentile(values: pd.Series, q: float) -> float:
    return float(values.quantile(q, interpolation="linear"))


def summarize(label: str, values: pd.Series) -> dict[str, object]:
    return {
        "basis": label.replace("\n", " "),
        "n": int(values.count()),
        "mean_m": round(float(values.mean()), 1),
        "q1_m": round(percentile(values, 0.25), 1),
        "median_m": round(percentile(values, 0.5), 1),
        "q3_m": round(percentile(values, 0.75), 1),
        "min_m": round(float(values.min()), 1),
        "max_m": round(float(values.max()), 1),
        "over_500m_school_count": int((values > 500).sum()),
        "over_1000m_school_count": int((values > 1000).sum()),
    }


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"
    plt.rcParams["axes.facecolor"] = "white"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    COMPAT_OUT_DIR.mkdir(parents=True, exist_ok=True)
    setup_style()

    frame = pd.read_csv(INPUT, encoding="utf-8-sig")
    target = frame[frame["stored_current_case_type_norm"].notna()].copy()
    active_school_ids = set(target["school_id"].astype(str))
    long_frame = pd.read_csv(LONG_INPUT, encoding="utf-8-sig")
    long_frame = long_frame[long_frame["school_id"].astype(str).isin(active_school_ids)].copy()

    plot_values: list[pd.Series] = []
    stats_rows: list[dict[str, object]] = []
    for item in DISTANCE_SERIES:
        scenario_rows = long_frame[long_frame["scenario"].eq(item["scenario"])]
        values = pd.to_numeric(scenario_rows["nearest_eligible_park_dist_m_straight"], errors="coerce").dropna()
        plot_values.append(values)
        stats_rows.append(summarize(item["short_label"], values))

    stats_df = pd.DataFrame(stats_rows)
    stats_path = OUT_DIR / "park_distance_boxplot_stats_active_policy_target.csv"
    stats_df.to_csv(stats_path, index=False, encoding="utf-8-sig")

    fig, ax = plt.subplots(figsize=(8.38, 3.65), dpi=180)
    fig.patch.set_facecolor("white")
    fig.patch.set_edgecolor("#3f3f3f")
    fig.patch.set_linewidth(1.2)

    colors = [item["color"] for item in DISTANCE_SERIES]
    box = ax.boxplot(
        plot_values,
        patch_artist=True,
        widths=0.48,
        showfliers=False,
        showmeans=True,
        meanprops={
            "marker": "D",
            "markerfacecolor": "#26384f",
            "markeredgecolor": "white",
            "markersize": 5,
        },
        medianprops={"color": "white", "linewidth": 2.3},
        whiskerprops={"color": "#738197", "linewidth": 1.4},
        capprops={"color": "#738197", "linewidth": 1.4},
    )
    for patch, color in zip(box["boxes"], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.82)
        patch.set_edgecolor("#344052")
        patch.set_linewidth(1.2)

    rng = np.random.default_rng(42)
    for idx, (values, color) in enumerate(zip(plot_values, colors), start=1):
        clipped = values.clip(upper=1500)
        sample = clipped.sample(min(len(clipped), 120), random_state=idx)
        x = rng.normal(idx, 0.035, size=len(sample))
        ax.scatter(x, sample, s=9, color=color, alpha=0.22, edgecolors="none", zorder=2)

    ax.axhline(500, color="#d33f2f", linestyle="--", linewidth=1.6, alpha=0.9)
    ax.text(
        2.45,
        510,
        "500m 생활권 기준",
        ha="right",
        va="bottom",
        fontsize=9.5,
        color="#b42318",
        fontweight="bold",
    )

    labels = [item["label"] for item in DISTANCE_SERIES]
    ax.set_xticks([1, 2, 3])
    ax.set_xticklabels(labels, fontsize=10, color="#26384f")
    ax.set_ylabel("직선 최단거리 (m)", fontsize=10.5, color="#26384f", labelpad=7)
    ax.set_title(
        "소규모 공원 제외 시 가까운 공원까지의 거리 변화",
        fontsize=14,
        fontweight="bold",
        color="#26384f",
        pad=16,
    )
    ax.set_ylim(0, 1550)
    ax.set_yticks([0, 250, 500, 750, 1000, 1250, 1500])
    ax.tick_params(axis="y", labelsize=9, colors="#26384f")
    ax.tick_params(axis="x", colors="#26384f")
    ax.yaxis.grid(True, color="#d8dde6", linewidth=0.9)
    ax.set_axisbelow(True)

    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.spines["left"].set_color("#9aa8bb")
    ax.spines["bottom"].set_color("#9aa8bb")
    ax.spines["left"].set_linewidth(1.0)
    ax.spines["bottom"].set_linewidth(1.0)

    for idx, row in enumerate(stats_rows, start=1):
        ax.text(
            idx,
            1450,
            f"평균 {row['mean_m']}m\n1분위 {row['q1_m']}m\n중앙 {row['median_m']}m\n3분위 {row['q3_m']}m",
            ha="center",
            va="top",
            fontsize=8.6,
            color="#26384f",
            linespacing=1.25,
            bbox={
                "boxstyle": "round,pad=0.28",
                "facecolor": "white",
                "edgecolor": "#d8dde6",
                "linewidth": 0.9,
                "alpha": 0.92,
            },
        )

    fig.text(
        0.08,
        0.035,
        "대상: 현재 앱 case가 부여된 242교. 세 시나리오는 동일한 직선 최단거리 counterfactual 기준으로 비교.",
        fontsize=8.8,
        color="#5b6678",
    )
    fig.subplots_adjust(left=0.08, right=0.985, bottom=0.2, top=0.86)

    output_path = OUT_DIR / "park_distance_boxplot_active_policy_target.png"
    fig.savefig(output_path, dpi=180, facecolor=fig.get_facecolor(), edgecolor=fig.get_edgecolor())

    # Compatibility copy for decks that already referenced the old chart path.
    compat_path = COMPAT_OUT_DIR / "case_reclassification_active_policy_target.png"
    fig.savefig(compat_path, dpi=180, facecolor=fig.get_facecolor(), edgecolor=fig.get_edgecolor())
    plt.close(fig)

    print(f"saved: {output_path}")
    print(f"saved: {compat_path}")
    print(f"saved: {stats_path}")
    print(stats_df.to_string(index=False))


if __name__ == "__main__":
    main()
