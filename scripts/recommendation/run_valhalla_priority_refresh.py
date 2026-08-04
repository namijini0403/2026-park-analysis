# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"
OUTPUT = ROOT / "output"

CONTEXT_MD = ROOT / "CONTEXT.md"
SCHOOLS_CSV = DATA / "schools.csv"
PRIORITY_CSV = DATA / "school_priority.csv"
NEAREST_PARK_CSV = DATA / "school_nearest_park.csv"
CASE1_V2_CSV = OUTPUT / "case1_priority_v2.csv"
BENEFICIARY_CSV = DATA / "beneficiary_forecast.csv"

SEALED_JSON = OUTPUT / "sealed_nearest_park_dist.json"


def parse_sealed_distances() -> tuple[dict[str, float | None], dict[str, str]]:
    schools = pd.read_csv(SCHOOLS_CSV, encoding="utf-8-sig")[["학교ID", "학교명"]].drop_duplicates("학교명")
    name_to_id = dict(zip(schools["학교명"], schools["학교ID"]))

    lines = CONTEXT_MD.read_text(encoding="utf-8").splitlines()
    sealed_by_id: dict[str, float | None] = {}
    sealed_by_name: dict[str, str] = {}
    in_section = False

    for raw_line in lines:
        line = raw_line.strip()
        if line.startswith("## ⚠️ 실측 봉인 데이터"):
            in_section = True
            continue
        if in_section and line.startswith("## ") and not line.startswith("## ⚠️ 실측 봉인 데이터"):
            break
        if not in_section or " | " not in line:
            continue

        parts = [part.strip() for part in line.split("|")]
        if len(parts) != 3:
            continue

        school_name, _, dist_text = parts
        if school_name not in name_to_id:
            raise KeyError(f"학교명을 schools.csv에서 찾을 수 없습니다: {school_name}")

        match = re.fullmatch(r"(-|\d+(?:\.\d+)?)m?", dist_text)
        if not match:
            continue

        value = None if match.group(1) == "-" else float(match.group(1))
        school_id = name_to_id[school_name]
        sealed_by_id[school_id] = value
        sealed_by_name[school_name] = dist_text

    SEALED_JSON.write_text(
        json.dumps(sealed_by_id, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return sealed_by_id, sealed_by_name


def run_script(script_name: str) -> None:
    subprocess.run([sys.executable, str(ROOT / script_name)], cwd=ROOT, check=True)


def restore_nearest_distance(sealed_by_id: dict[str, float | None]) -> tuple[pd.DataFrame, int]:
    rebuilt = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    nearest_source = pd.read_csv(NEAREST_PARK_CSV, encoding="utf-8-sig")

    nearest = nearest_source[["학교ID", "nearest_park_dist_m"]].drop_duplicates("학교ID")
    rebuilt = rebuilt.drop(columns=["nearest_park_dist_m"], errors="ignore")
    rebuilt = rebuilt.merge(nearest, on="학교ID", how="left")

    rebuilt["nearest_park_dist_m"] = rebuilt["nearest_park_dist_m"].astype(float)
    for school_id, sealed_value in sealed_by_id.items():
        rebuilt.loc[rebuilt["학교ID"] == school_id, "nearest_park_dist_m"] = sealed_value

    rebuilt.to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")
    matched = int(rebuilt["학교ID"].isin(sealed_by_id).sum())
    return rebuilt, matched


def join_case1_priority() -> int:
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    case1 = pd.read_csv(CASE1_V2_CSV, encoding="utf-8-sig")[["학교ID", "student_slope", "trend_score", "priority_rank"]]
    case1 = case1.drop_duplicates("학교ID")
    priority = priority.drop(columns=["student_slope", "trend_score", "priority_rank"], errors="ignore")
    priority = priority.merge(case1, on="학교ID", how="left")
    priority.to_csv(PRIORITY_CSV, index=False, encoding="utf-8-sig")
    return int(priority["priority_rank"].notna().sum())


def validate_priority(sealed_by_id: dict[str, float | None]) -> dict[str, object]:
    priority = pd.read_csv(PRIORITY_CSV, encoding="utf-8-sig")
    null_ratio = priority.isna().mean().sort_values(ascending=False)

    sealed_check = priority.loc[priority["학교ID"].isin(sealed_by_id), ["학교ID", "nearest_park_dist_m"]].copy()
    sealed_check["expected"] = sealed_check["학교ID"].map(sealed_by_id)
    lhs = sealed_check["nearest_park_dist_m"].fillna(-999999.0).to_numpy(dtype=float)
    rhs = sealed_check["expected"].fillna(-999999.0).to_numpy(dtype=float)
    mismatch = sealed_check[~np.isclose(lhs, rhs, atol=1e-9)]

    return {
        "rows": int(len(priority)),
        "duplicate_ids": int(priority["학교ID"].duplicated().sum()),
        "null_ratio_max": float(null_ratio.iloc[0]),
        "null_ratio_by_col": {k: float(v) for k, v in null_ratio[null_ratio > 0].to_dict().items()},
        "sealed_match_count": int(len(sealed_check) - len(mismatch)),
        "sealed_expected_count": int(len(sealed_by_id)),
        "sealed_mismatch_count": int(len(mismatch)),
    }


def main() -> None:
    sealed_by_id, _ = parse_sealed_distances()
    print(f"task0_saved={len(sealed_by_id)}")

    run_script("rebuild_priority_with_redev.py")
    _, sealed_restored = restore_nearest_distance(sealed_by_id)

    validation = validate_priority(sealed_by_id)
    print(f"task2_rows={validation['rows']}")
    print(f"task2_duplicates={validation['duplicate_ids']}")
    print(f"task2_null_ratio_max={validation['null_ratio_max']}")
    print(f"task2_null_cols={json.dumps(validation['null_ratio_by_col'], ensure_ascii=False)}")
    print(f"task2_sealed_restored={sealed_restored}")
    print(f"task2_sealed_match={validation['sealed_match_count']}")
    print(f"task2_sealed_expected={validation['sealed_expected_count']}")
    print(f"task2_sealed_mismatch={validation['sealed_mismatch_count']}")

    case1_count = join_case1_priority()
    print(f"task3_case1_count={case1_count}")

    run_script("analysis_ml_models.py")
    forecast = pd.read_csv(BENEFICIARY_CSV, encoding="utf-8-sig")
    print(f"task4_rows={len(forecast)}")


if __name__ == "__main__":
    main()

