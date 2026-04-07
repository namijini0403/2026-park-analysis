# -*- coding: utf-8 -*-
"""
Isolation Forest only.

Input:
- data_processed/school_priority.csv

Output:
- overwrite the same CSV with `outlier_type`

Rules
- features: iso_park_count, iso_park_area, iso_child_total, access_ratio, gap_count
- access_ratio NaN -> 0
- contamination=0.05
- remove any legacy cluster / is_outlier columns from the saved CSV
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler


ROOT = Path(r"c:\2026_data_analysis_park")
CSV = ROOT / "data_processed" / "school_priority.csv"
FEATURES = ["iso_park_count", "iso_park_area", "iso_child_total", "access_ratio", "gap_count"]


def classify_outlier_type(outliers: pd.DataFrame) -> np.ndarray:
    ranked = outliers.copy()
    ranked["low_iso_score"] = 1 - ranked["iso_park_count"].rank(method="average", pct=True)
    ranked["low_access_score"] = 1 - ranked["access_ratio"].rank(method="average", pct=True)
    ranked["high_iso_score"] = ranked["iso_park_count"].rank(method="average", pct=True)
    ranked["high_gap_score"] = ranked["gap_count"].rank(method="average", pct=True)
    ranked["low_score"] = ranked["low_iso_score"] + ranked["low_access_score"]
    ranked["high_score"] = ranked["high_iso_score"] + ranked["high_gap_score"]
    return np.where(ranked["low_score"] >= ranked["high_score"], "low", "high")


def main() -> None:
    df = pd.read_csv(CSV, encoding="utf-8-sig")
    print(f"Loaded {len(df)} rows from {CSV}")

    for col in ["cluster", "is_outlier", "outlier_type"]:
        if col in df.columns:
            df = df.drop(columns=col)

    work = df.copy()
    work["access_ratio"] = work["access_ratio"].fillna(0)
    scaled = StandardScaler().fit_transform(work[FEATURES])

    forest = IsolationForest(contamination=0.05, random_state=42)
    pred = forest.fit_predict(scaled)
    work["is_outlier"] = (pred == -1).astype(int)

    outliers = work[work["is_outlier"] == 1].copy()
    work["outlier_type"] = pd.Series(pd.NA, index=work.index, dtype="object")
    if not outliers.empty:
        work.loc[outliers.index, "outlier_type"] = classify_outlier_type(outliers)

    print(f"Isolation Forest outliers: {len(outliers)}")
    print(f"outlier_type counts: {work['outlier_type'].fillna('normal').value_counts().to_dict()}")

    cols = ["학교명", "gu", "iso_park_count", "buf_park_count", "access_ratio", "gap_count", "case_type", "priority_score"]
    print("\n[outlier_low]")
    print(work[work["outlier_type"] == "low"][cols].sort_values(["priority_score", "gap_count"], ascending=[False, True]).to_string(index=False))
    print("\n[outlier_high]")
    print(work[work["outlier_type"] == "high"][cols].sort_values(["gap_count", "iso_park_count"], ascending=[False, False]).to_string(index=False))

    saved = work.drop(columns=["is_outlier"])
    saved.to_csv(CSV, index=False, encoding="utf-8-sig")
    print(f"\nSaved: {CSV}")


if __name__ == "__main__":
    main()
