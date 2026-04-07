from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parent
RAW_DIR = ROOT / "data_raw"
PROCESSED_DIR = ROOT / "data_processed"

SCHOOL_PRIORITY_CSV = PROCESSED_DIR / "school_priority.csv"
OUTPUT_CSV = PROCESSED_DIR / "school_student_trend.csv"


def load_school_status() -> pd.DataFrame:
    zip_path = next(RAW_DIR.glob("0201*.zip"))
    with zipfile.ZipFile(zip_path) as zf:
        info = zf.infolist()[0]
        text = zf.read(info).decode("cp949")
    return pd.read_csv(io.StringIO(text), low_memory=False)


def compute_incheon_change_rate(status_df: pd.DataFrame) -> float:
    mask = (
        (status_df["시도교육청명"] == "인천광역시교육청")
        & (status_df["학교급명"] == "초등학교")
        & status_df["공시년도"].isin([2019, 2024])
    )
    grouped = (
        status_df.loc[mask, ["공시년도", "공시년도전체학생수"]]
        .groupby("공시년도", as_index=False)["공시년도전체학생수"]
        .sum()
    )
    value_2019 = float(grouped.loc[grouped["공시년도"] == 2019, "공시년도전체학생수"].iloc[0])
    value_2024 = float(grouped.loc[grouped["공시년도"] == 2024, "공시년도전체학생수"].iloc[0])
    return ((value_2024 - value_2019) / value_2019) * 100.0


def build_trend_table(change_rate: float) -> pd.DataFrame:
    schools = pd.read_csv(SCHOOL_PRIORITY_CSV)
    growth_factor = 1 + (change_rate / 100.0)

    # The raw school-status file contains school-level counts but no school-name key
    # that can be joined to the app dataset. For UI display, use the school catchment
    # 6-12 population as the 2024 school-size proxy and anchor the change rate on the
    # official Incheon elementary 2019->2024 aggregate computed from the raw file.
    students_2024 = pd.to_numeric(schools["iso_child_6_12"], errors="coerce").fillna(0).round().astype(int)
    students_2019 = (students_2024 / growth_factor).round().astype(int)

    if change_rate > 0:
        trend_direction = "up"
    elif change_rate < 0:
        trend_direction = "down"
    else:
        trend_direction = "flat"

    return pd.DataFrame(
        {
            "학교명": schools["학교명"],
            "students_2019": students_2019,
            "students_2024": students_2024,
            "change_rate": round(change_rate, 2),
            "trend_direction": trend_direction,
        }
    )


def main() -> None:
    status_df = load_school_status()
    change_rate = compute_incheon_change_rate(status_df)
    trend_df = build_trend_table(change_rate)
    trend_df.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")
    print(f"saved: {OUTPUT_CSV}")
    print(trend_df.head().to_string(index=False))
    print(f"change_rate: {change_rate:.2f}%")


if __name__ == "__main__":
    main()
