# -*- coding: utf-8 -*-
"""
Legacy filename retained, but current behavior is mirage-flag refresh only.

Input:
- data_processed/school_priority.csv

Output:
- overwrite the same CSV with `outlier_type`

Rules
- "착시" if either:
  A) buf_park_count >= 1 and iso_park_count == 0
  B) buf_playground_count >= 3 and iso_playground_count <= 2
- otherwise null
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
ROOT = Path(r"c:\2026_data_analysis_park")
CSV = ROOT / "data_processed" / "school_priority.csv"


def main() -> None:
    df = pd.read_csv(CSV, encoding="utf-8-sig")
    print(f"Loaded {len(df)} rows from {CSV}")

    for col in ["cluster", "is_outlier", "outlier_type"]:
        if col in df.columns:
            df = df.drop(columns=col)

    cond_a = (df["buf_park_count"] >= 1) & (df["iso_park_count"] == 0)
    cond_b = (df["buf_playground_count"] >= 3) & (df["iso_playground_count"] <= 2)
    df["outlier_type"] = np.where(cond_a | cond_b, "착시", pd.NA)

    print(f"outlier_type counts: {df['outlier_type'].fillna('normal').value_counts().to_dict()}")
    cols = [
        "학교명",
        "gu",
        "buf_park_count",
        "iso_park_count",
        "buf_playground_count",
        "iso_playground_count",
        "case_type",
        "priority_score",
    ]
    print("\n[행정착시 학교]")
    print(df[df["outlier_type"] == "착시"][cols].sort_values(["gu", "학교명"]).to_string(index=False))

    df.to_csv(CSV, index=False, encoding="utf-8-sig")
    print(f"\nSaved: {CSV}")


if __name__ == "__main__":
    main()
