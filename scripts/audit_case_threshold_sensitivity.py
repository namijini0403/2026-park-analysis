"""Case 분류 임계값 민감도 분석.

기존 로직 수정 없음 — 읽기 전용 재분류만 수행.
Case 1 조건 고정: nearest_park_dist_m >= 500 AND iso_park_count == 0 AND display_green_ratio == 0
Case 2/3/4 경계: lower_pct (현재 1%) / upper_pct (현재 5%) 변화에 따른 학교 수 변화 측정.
대상: is_separate_bundle_tag == 0, 242교.
"""
from __future__ import annotations

from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data_processed"
OUT_DIR = ROOT / "outputs" / "case_threshold_sensitivity"

SCHOOL_FILE = DATA / "school_priority_with_functional_park_layer.csv"

LOWER_CURRENT = 1.0
UPPER_CURRENT = 5.0

LOWER_RANGE = [0.5, 1.0, 1.5, 2.0, 3.0]
UPPER_RANGE = [3.0, 5.0, 7.0, 10.0]


def setup_style() -> None:
    plt.rcParams["font.family"] = ["Malgun Gothic", "DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "white"


def load_target() -> pd.DataFrame:
    df = pd.read_csv(SCHOOL_FILE, encoding="utf-8-sig")
    df = df[df["is_separate_bundle_tag"] == 0].copy()
    for col in ["display_green_ratio", "nearest_park_dist_m", "iso_park_count"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
    assert len(df) == 242, f"예상 242교, 실제 {len(df)}교"
    return df


def case1_mask(df: pd.DataFrame) -> pd.Series:
    return (
        (df["nearest_park_dist_m"] >= 500)
        & (df["iso_park_count"] == 0)
        & (df["display_green_ratio"] == 0)
    )


def classify(df: pd.DataFrame, lower: float, upper: float) -> pd.Series:
    c1 = case1_mask(df)
    acc = ~c1
    gr = df["display_green_ratio"]
    case = pd.Series(0, index=df.index, dtype=int)
    case[c1] = 1
    case[acc & (gr < lower)] = 2
    case[acc & (gr >= lower) & (gr < upper)] = 3
    case[acc & (gr >= upper)] = 4
    return case


def build_sensitivity_table(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for lower in LOWER_RANGE:
        for upper in UPPER_RANGE:
            if lower >= upper:
                continue
            cases = classify(df, lower, upper)
            vc = cases.value_counts()
            rows.append(
                {
                    "lower_pct": lower,
                    "upper_pct": upper,
                    "case1": int(vc.get(1, 0)),
                    "case2": int(vc.get(2, 0)),
                    "case3": int(vc.get(3, 0)),
                    "case4": int(vc.get(4, 0)),
                    "case1_2": int(vc.get(1, 0)) + int(vc.get(2, 0)),
                    "case1_2_3": int(vc.get(1, 0)) + int(vc.get(2, 0)) + int(vc.get(3, 0)),
                    "is_current": (lower == LOWER_CURRENT and upper == UPPER_CURRENT),
                }
            )
    result = pd.DataFrame(rows)
    cur = result[result["is_current"]].iloc[0]
    result["delta_case2"] = result["case2"] - int(cur["case2"])
    result["delta_case1_2"] = result["case1_2"] - int(cur["case1_2"])
    result["delta_case1_2_3"] = result["case1_2_3"] - int(cur["case1_2_3"])
    return result


def green_ratio_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """display_green_ratio 누적 분포 — 임계값 결정 근거."""
    gr = df.loc[~case1_mask(df), "display_green_ratio"].sort_values()
    total = len(gr)
    bins = [0, 0.05, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0, float("inf")]
    labels = ["0", "0~0.05", "0.05~0.5", "0.5~1", "1~1.5", "1.5~2", "2~3", "3~5", "5~7", "7~10", "10+"]
    rows = []
    for i, (lo, hi) in enumerate(zip(bins[:-1], bins[1:])):
        n = int(((gr >= lo) & (gr < hi)).sum())
        rows.append({"구간": labels[i + 1] if i > 0 else "0", "학교수": n, "비율(%)": round(n / total * 100, 1)})
    # 실제로는 0 포함 accessible 구간만
    rows2 = []
    for i, (lo, hi) in enumerate(zip(bins, bins[1:])):
        n = int(((gr >= lo) & (gr < hi)).sum())
        rows2.append({"구간": f"{lo}~{hi}", "학교수": n, "비율(%)": round(n / total * 100, 1)})
    return pd.DataFrame(rows2)


def make_heatmap(result: pd.DataFrame) -> Path:
    fig, axes = plt.subplots(1, 3, figsize=(16, 5), dpi=160)

    for ax, col, title in zip(
        axes,
        ["case2", "case1_2", "delta_case1_2"],
        ["Case 2 학교 수", "Case 1+2 학교 수", "Case 1+2 현재 대비 변화"],
    ):
        pivot = result.pivot(index="lower_pct", columns="upper_pct", values=col)
        im = ax.imshow(pivot.values, cmap="RdYlGn" if "delta" not in col else "RdBu_r", aspect="auto")
        ax.set_xticks(range(len(pivot.columns)))
        ax.set_xticklabels([f"{v}%" for v in pivot.columns])
        ax.set_yticks(range(len(pivot.index)))
        ax.set_yticklabels([f"{v}%" for v in pivot.index])
        ax.set_xlabel("upper 임계값")
        ax.set_ylabel("lower 임계값")
        ax.set_title(title, weight="bold")

        for r in range(len(pivot.index)):
            for c in range(len(pivot.columns)):
                val = pivot.values[r, c]
                is_cur = (
                    pivot.index[r] == LOWER_CURRENT and pivot.columns[c] == UPPER_CURRENT
                )
                if np.isnan(val):
                    txt = "-"
                elif "delta" in col:
                    txt = f"{int(val):+d}"
                else:
                    txt = str(int(val))
                ax.text(
                    c, r, txt,
                    ha="center", va="center",
                    fontsize=11 if not is_cur else 13,
                    weight="bold" if is_cur else "normal",
                    color="black",
                )
                if is_cur:
                    ax.add_patch(plt.Rectangle((c - 0.5, r - 0.5), 1, 1, fill=False, edgecolor="#ef4444", linewidth=2.5))

        plt.colorbar(im, ax=ax, shrink=0.8)

    fig.suptitle(
        "녹지율 임계값 민감도: lower(Case2 경계) × upper(Case4 경계) — 빨간 테두리=현재(1%/5%)",
        fontsize=14, weight="bold",
    )
    fig.tight_layout(rect=[0, 0, 1, 0.94])
    path = OUT_DIR / "case_threshold_sensitivity_heatmap.png"
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def make_bar_chart(result: pd.DataFrame) -> Path:
    """upper=5% 고정, lower 변화에 따른 Case 분포 바그래프."""
    sub = result[result["upper_pct"] == UPPER_CURRENT].copy().reset_index(drop=True)
    labels = [f"lower={r.lower_pct}%" + (" (현재)" if r.is_current else "") for r in sub.itertuples()]

    cases = ["case1", "case2", "case3", "case4"]
    case_labels = ["Case 1", "Case 2", "Case 3", "Case 4"]
    colors = ["#c8cdd4", "#1e3a6e", "#e8753a", "#7a8694"]

    n_groups = len(sub)
    n_bars = len(cases)
    bar_w = 0.18
    x = np.arange(n_groups)

    fig, ax = plt.subplots(figsize=(13.33, 6.2), dpi=180)
    fig.patch.set_facecolor("white")
    ax.set_facecolor("white")

    for i, (col, label, color) in enumerate(zip(cases, case_labels, colors)):
        offset = (i - (n_bars - 1) / 2) * bar_w
        vals = sub[col].to_numpy()
        bars = ax.bar(x + offset, vals, width=bar_w, label=label, color=color, zorder=3)
        for bar, val in zip(bars, vals):
            ax.text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height() + 1.5,
                str(val),
                ha="center", va="bottom",
                fontsize=9.5, color="#222222",
            )

    # 현재 임계값 그룹 강조 박스
    cur_idx = int(sub[sub["is_current"]].index[0])
    ax.axvspan(cur_idx - 0.45, cur_idx + 0.45, color="#fef9c3", zorder=0, alpha=0.85)

    ax.set_xticks(x)
    ax.set_xticklabels(labels, fontsize=11)
    ax.set_ylabel("학교 수", fontsize=11)
    ax.set_xlabel("녹지율 하한 임계값  (Case2 경계, upper=5% 고정)", fontsize=11)
    ax.set_ylim(0, 160)
    ax.yaxis.set_major_locator(ticker.MultipleLocator(20))
    ax.grid(axis="y", alpha=0.25, zorder=0)
    ax.spines[["top", "right"]].set_visible(False)

    legend = ax.legend(
        loc="upper right", fontsize=10.5, framealpha=0.9,
        edgecolor="#cccccc", ncol=4,
    )

    ax.set_title(
        "녹지율 임계값별 Case 분류 학교 수  (upper=5% 고정, 노란 배경=현재 기준)",
        loc="left", fontsize=13, weight="bold", pad=12,
    )

    fig.tight_layout()
    path = OUT_DIR / "case_threshold_sensitivity_bar.png"
    fig.savefig(path, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return path


def main() -> None:
    setup_style()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = load_target()

    # --- 기초 분포 확인 ---
    gr_accessible = df.loc[~case1_mask(df), "display_green_ratio"]
    print("=== 접근 가능 학교 (225교) display_green_ratio 분포 ===")
    print(gr_accessible.describe().round(3))
    print()

    # --- 현재 분류 검산 ---
    cur = classify(df, LOWER_CURRENT, UPPER_CURRENT)
    print("=== 현재 분류 검산 (lower=1%, upper=5%) ===")
    print(cur.value_counts().sort_index().to_string())
    print()

    # --- 민감도 테이블 ---
    result = build_sensitivity_table(df)
    csv_path = OUT_DIR / "case_threshold_sensitivity.csv"
    result.to_csv(csv_path, index=False, encoding="utf-8-sig")

    print("=== 임계값 민감도 전체 ===")
    display_cols = ["lower_pct", "upper_pct", "case1", "case2", "case3", "case4",
                    "case1_2", "delta_case2", "delta_case1_2", "is_current"]
    print(result[display_cols].to_string(index=False))
    print()

    # --- lower=1% 고정 / upper 변화 ---
    print("=== lower=1% 고정, upper 변화 ===")
    sub = result[result["lower_pct"] == LOWER_CURRENT][display_cols]
    print(sub.to_string(index=False))
    print()

    # --- upper=5% 고정 / lower 변화 ---
    print("=== upper=5% 고정, lower 변화 ===")
    sub2 = result[result["upper_pct"] == UPPER_CURRENT][display_cols]
    print(sub2.to_string(index=False))
    print()

    # --- 분포 경계 근거: lower 임계값 근방 학교 수 ---
    print("=== lower 임계값 근방 분포 (접근 가능 225교) ===")
    for lo, hi in [(0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 3.0)]:
        n = int(((gr_accessible >= lo) & (gr_accessible < hi)).sum())
        print(f"  {lo}% ~ {hi}%: {n}교")
    print()
    print("=== upper 임계값 근방 분포 ===")
    for lo, hi in [(3.0, 5.0), (5.0, 7.0), (7.0, 10.0)]:
        n = int(((gr_accessible >= lo) & (gr_accessible < hi)).sum())
        print(f"  {lo}% ~ {hi}%: {n}교")
    print()

    # --- 히트맵 ---
    heatmap_path = make_heatmap(result)

    # --- 바그래프 ---
    bar_path = make_bar_chart(result)

    print(f"CSV: {csv_path.relative_to(ROOT)}")
    print(f"히트맵: {heatmap_path.relative_to(ROOT)}")
    print(f"바그래프: {bar_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
