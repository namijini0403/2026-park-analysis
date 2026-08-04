from __future__ import annotations

import json
import re
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "outputs" / "robust_xai" / "ppt_assets"
RECOMMENDATIONS = ROOT / "outputs" / "robust_xai" / "robust_candidate_recommendations.csv"
EXPLANATIONS = ROOT / "outputs" / "robust_xai" / "shap_candidate_explanations.json"


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"
    plt.rcParams["axes.facecolor"] = "white"


def natural_feature_label(feature: str) -> str:
    name = feature.lower()
    if "proximity" in name or "route_length" in name or "school_dist" in name:
        return "학교와 가까운 위치"
    if "park" in name or "access_gap" in name or "green" in name:
        return "기존 공원 공백 보완"
    if "child" in name or "demand" in name or "beneficiar" in name:
        return "주변 아동·미래 수요"
    if "apt" in name:
        return "대단지 아파트 수요 신호"
    if "redev" in name:
        return "재개발·정비사업 신호"
    if "playground" in name or re.search(r"(^|_)pg($|_)", name):
        return "주변 놀이공간 부족"
    if any(key in name for key in ["motorway", "trunk", "primary", "secondary", "tertiary"]):
        return "도로 횡단 부담"
    if "linked_school" in name:
        return "여러 학교 생활권 연결"
    if "case" in name or "priority" in name:
        return "환경 취약성 신호"
    if "w_hat" in name:
        return "격자 인구 배분 신호"
    return "기타 수요 설명 신호"


def make_sampling_distribution() -> Path:
    df = pd.read_csv(RECOMMENDATIONS)
    stable = int((df["top5_stability_score"] >= 0.8).sum())
    total = len(df)
    pareto = df["pareto_candidate"].astype(bool)
    stable_mask = df["top5_stability_score"] >= 0.8
    pareto_rate = pareto.mean() * 100
    stable_rate = stable_mask.mean() * 100
    robust_rate = (pareto & stable_mask).mean() * 100

    fig = plt.figure(figsize=(13.33, 7.5), dpi=180)
    grid = fig.add_gridspec(1, 2, width_ratios=[1.08, 0.92], wspace=0.28)
    ax_hist = fig.add_subplot(grid[0, 0])
    ax_scatter = fig.add_subplot(grid[0, 1])

    bins = np.linspace(0, 1, 11)
    ax_hist.hist(df["top5_stability_score"], bins=bins, color="#2563eb", edgecolor="white", linewidth=1.2)
    ax_hist.axvline(0.8, color="#dc2626", linewidth=2.5, linestyle="--")
    ax_hist.text(0.805, ax_hist.get_ylim()[1] * 0.92, "안정형 기준 80%", color="#dc2626", fontsize=13, weight="bold")
    ax_hist.set_title("1,000회 가중치 샘플링: Top5 안정성 분포", fontsize=18, weight="bold", loc="left")
    ax_hist.set_xlabel("Top5 안정성 점수")
    ax_hist.set_ylabel("학교-후보 조합 수")
    ax_hist.grid(axis="y", alpha=0.22)
    ax_hist.spines[["top", "right"]].set_visible(False)

    colors = np.where(df["pareto_candidate"].astype(bool), "#10b981", "#94a3b8")
    ax_scatter.scatter(df["mean_rank"], df["rank_std"], c=colors, s=18, alpha=0.72, edgecolors="none")
    ax_scatter.set_title("평균 순위 vs 순위 변동성", fontsize=18, weight="bold", loc="left")
    ax_scatter.set_xlabel("평균 순위: 낮을수록 우수")
    ax_scatter.set_ylabel("순위 표준편차: 낮을수록 안정")
    ax_scatter.grid(alpha=0.22)
    ax_scatter.spines[["top", "right"]].set_visible(False)
    ax_scatter.text(
        0.02,
        0.97,
        "초록: Pareto 후보",
        transform=ax_scatter.transAxes,
        va="top",
        fontsize=12,
        color="#065f46",
        weight="bold",
    )

    fig.text(
        0.05,
        0.035,
        f"해석: {total:,}개 학교-후보 조합 중 Pareto {pareto_rate:.1f}% · Top5 안정성 80% 이상 {stable:,}개({stable_rate:.1f}%) · 두 조건 동시 충족 {robust_rate:.1f}% · 가중치 seed=42",
        fontsize=13,
        color="#334155",
    )
    target = OUT_DIR / "slide14_sampling_stability_distribution.png"
    fig.savefig(target, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return target


def make_shap_plain_summary() -> Path:
    explanations = json.loads(EXPLANATIONS.read_text(encoding="utf-8"))
    rows = []
    for item in explanations:
        for driver in item.get("positive_drivers", []) + item.get("negative_drivers", []):
            rows.append(
                {
                    "label": natural_feature_label(driver.get("feature", "")),
                    "abs_shap": abs(float(driver.get("shap_value", 0))),
                }
            )
    df = pd.DataFrame(rows)
    summary = (
        df.groupby("label", as_index=False)["abs_shap"]
        .sum()
        .sort_values("abs_shap", ascending=False)
        .head(8)
    )
    summary["share"] = summary["abs_shap"] / summary["abs_shap"].sum()

    fig, ax = plt.subplots(figsize=(13.33, 7.5), dpi=180)
    y = np.arange(len(summary))
    colors = ["#2563eb", "#10b981", "#f59e0b", "#6366f1", "#14b8a6", "#ef4444", "#64748b", "#a855f7"][: len(summary)]
    ax.barh(y, summary["share"] * 100, color=colors)
    ax.set_yticks(y, summary["label"])
    ax.invert_yaxis()
    ax.set_xlim(0, max(35, (summary["share"] * 100).max() * 1.18))
    ax.set_xlabel("상위 SHAP 설명 신호 내 비중(%)")
    ax.set_title("SHAP 후보 진단: 미래 수혜 아동 수 예측을 움직인 쉬운 근거", fontsize=20, weight="bold", loc="left")
    ax.grid(axis="x", alpha=0.18)
    ax.spines[["top", "right", "left"]].set_visible(False)

    for idx, share in enumerate(summary["share"] * 100):
        ax.text(share + 0.6, idx, f"{share:.1f}%", va="center", fontsize=13, weight="bold", color="#0f172a")

    fig.text(
        0.08,
        0.035,
        "주의: SHAP은 최종 추천 순위를 설명하지 않고, 견고 후보의 미래 수요 예측값을 후보 단위로 진단하는 보조 정보입니다.",
        fontsize=13,
        color="#334155",
    )
    target = OUT_DIR / "slide15_shap_plain_summary.png"
    fig.savefig(target, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return target


def main() -> None:
    setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    created = [make_sampling_distribution(), make_shap_plain_summary()]
    for path in created:
        print(path.relative_to(ROOT))


if __name__ == "__main__":
    main()
