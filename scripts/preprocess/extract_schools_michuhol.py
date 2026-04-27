# -*- coding: utf-8 -*-
from pathlib import Path

import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
IN_PATH = ROOT / "data/processed" / "schools.csv"
OUT_PATH = ROOT / "data/processed" / "schools_michuhol.csv"


def main() -> None:
    df = pd.read_csv(IN_PATH, encoding="utf-8-sig")

    # schools.csv에는 gu 컬럼이 없어 도로명주소에서 구명을 판별한다.
    michuhol = "\ubbf8\ucd94\ud640\uad6c"
    namgu = "\ub0a8\uad6c"
    gu_series = df["소재지도로명주소"].fillna("").astype(str)
    result = df[
        gu_series.str.contains(michuhol, regex=False, na=False)
        | gu_series.str.contains(namgu, regex=False, na=False)
    ].copy()

    result.to_csv(OUT_PATH, index=False, encoding="utf-8-sig")

    print(f"저장 완료: {OUT_PATH}")
    print(f"행수: {len(result)}")
    print("학교명 목록:")
    for name in result["학교명"].tolist():
        print(f"- {name}")


if __name__ == "__main__":
    main()
