"""Calculate completed urban park area per resident by Incheon district.

This script supports the final report section that compares district-level park
area supply. It reads the official urban park statistics workbook and resident
registration population file, then writes a CSV and Markdown summary under
`outputs/reports`.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd


BASE = Path(r"C:\2026_data_analysis_park")
RAW = BASE / "data" / "raw"
REPORTS = BASE / "outputs" / "reports"

OUT_CSV = REPORTS / "incheon_gu_park_area_per_capita_20260424.csv"
OUT_MD = REPORTS / "incheon_gu_park_area_per_capita_20260424.md"


def main() -> None:
    # Official 2025 urban park statistics sheet:
    # district rows and the following "조성" row indexes were manually verified from the workbook layout.
    gu_labels = ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군"]
    gu_actual_rows = [33, 37, 41, 45, 49, 53, 57, 61, 65]
    gu_pop_codes = [
        "2811000000",
        "2814000000",
        "2817700000",
        "2818500000",
        "2820000000",
        "2823700000",
        "2824500000",
        "2826000000",
        "2871000000",
    ]

    park_book = next(RAW.glob("*도시공원*통계자료*.xlsx"))
    park_sheet = pd.ExcelFile(park_book).sheet_names[0]
    park_df = pd.read_excel(park_book, sheet_name=park_sheet, header=None)
    gu_actual_area = [float(pd.to_numeric(park_df.iloc[row, 2], errors="coerce")) for row in gu_actual_rows]

    pop_file = next(RAW.glob("*202312_202512*주민등록인구및세대현황*연간.csv"))
    pop_df = pd.read_csv(pop_file, encoding="cp949")
    area_name = pop_df.iloc[:, 0].astype(str)
    pop_2025 = pd.to_numeric(pop_df.iloc[:, 13].astype(str).str.replace(",", ""), errors="coerce")
    code = area_name.str.extract(r"\((\d{10})\)")[0]
    pop_map = dict(zip(code, pop_2025))
    gu_population = [float(pop_map[code_value]) for code_value in gu_pop_codes]

    # Geographically reassigned completed park area from the same workbook.
    # This is more appropriate for "per gu" interpretation than leaving parks under agency-only labels.
    extras = {
        "중구": 2518966.1 + 1125400.0,  # 경제청(영종) + 월미공원사업소
        "연수구": 4730492.9,  # 경제청(송도)
        "남동구": 4745029.7,  # 인천대공원사업소
        "계양구": 1709026.8,  # 계양공원사업소
        "서구": 1451025.1,  # 경제청(청라)
    }

    result = pd.DataFrame(
        {
            "gu": gu_labels,
            "population_2025": gu_population,
            "park_area_m2_actual_base": gu_actual_area,
        }
    )
    result["park_area_m2_extra_reassigned"] = result["gu"].map(extras).fillna(0.0)
    result["park_area_m2_actual_adjusted"] = (
        result["park_area_m2_actual_base"] + result["park_area_m2_extra_reassigned"]
    )
    result["m2_per_person_base"] = result["park_area_m2_actual_base"] / result["population_2025"]
    result["m2_per_person_adjusted"] = result["park_area_m2_actual_adjusted"] / result["population_2025"]
    result["below_9m2_adjusted"] = result["m2_per_person_adjusted"] < 9
    result["below_50m2_adjusted"] = result["m2_per_person_adjusted"] < 50
    result = result.sort_values("m2_per_person_adjusted")

    REPORTS.mkdir(parents=True, exist_ok=True)
    result.to_csv(OUT_CSV, index=False, encoding="utf-8-sig")

    md_lines = [
        "# 인천 구별 1인당 조성공원면적 계산 (2026-04-24)",
        "",
        "- 분자: `(2025년 12월 기준) 도시공원·녹지 통계자료.xlsx`의 `조성` 면적",
        "- 분모: `202312_202512_주민등록인구및세대현황_연간.csv`의 2025년 총인구수",
        "- 보정: 송도·영종·청라 경제청, 인천대공원사업소, 월미공원사업소, 계양공원사업소의 조성면적을 실제 소재 구에 재배정",
        "",
        "| 구 | 2025 인구 | 조성공원면적(보정) | 1인당 공원면적(㎡) | 9㎡ 미만 | 50㎡ 미만 |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for row in result.itertuples(index=False):
        md_lines.append(
            f"| {row.gu} | {int(row.population_2025):,} | {row.park_area_m2_actual_adjusted:,.1f} | {row.m2_per_person_adjusted:.2f} | {'예' if row.below_9m2_adjusted else '아니오'} | {'예' if row.below_50m2_adjusted else '아니오'} |"
        )
    OUT_MD.write_text("\n".join(md_lines), encoding="utf-8")
    print("\n".join(md_lines))


if __name__ == "__main__":
    main()
