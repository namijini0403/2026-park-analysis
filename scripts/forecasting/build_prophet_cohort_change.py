# -*- coding: utf-8 -*-
from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd
from prophet import Prophet

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw"
DATA = ROOT / "data/processed"

OUT_TS = DATA / "incheon_child_pop_timeseries.csv"
OUT_GU = DATA / "incheon_gu_child_timeseries.csv"
OUT_DONG = DATA / "incheon_dong_child_timeseries.csv"
OUT_GU_COHORT = DATA / "gu_cohort_change_prophet.csv"
SCHOOL_PRIORITY_CSV = DATA / "school_priority.csv"
BENEFICIARY_CSV = DATA / "beneficiary_forecast.csv"

YEARS = list(range(2014, 2026))

GU_NAME_MAP = {
    "2811000000": "중구",
    "2814000000": "동구",
    "2817700000": "미추홀구",
    "2818500000": "연수구",
    "2820000000": "남동구",
    "2823700000": "부평구",
    "2824500000": "계양구",
    "2826000000": "서구",
    "2871000000": "강화군",
    "2872000000": "옹진군",
}

GU_CODE_NORMALIZE = {
    "2817000000": "2817700000",  # 인천광역시 남구 -> 미추홀구
    "2811400000": "2811000000",  # 중구영종출장소 -> 중구
    "2811800000": "2811000000",  # 중구용유출장소 -> 중구
    "2826500000": "2826000000",  # 서구검단출장소 -> 서구
}


def find_year_file(year: int) -> Path:
    prefix = f"{year}12_{year}12"
    for path in RAW.iterdir():
        if path.is_file() and path.name.startswith(prefix) and "연령별인구현황_연간.csv" in path.name:
            return path
    raise FileNotFoundError(f"{year} 파일을 찾을 수 없습니다.")


def read_csv_auto(path: Path) -> pd.DataFrame:
    last_error = None
    for enc in ["cp949", "utf-8-sig", "utf-8"]:
        try:
            return pd.read_csv(path, encoding=enc)
        except Exception as exc:
            last_error = exc
    raise last_error


def parse_code(name: str) -> tuple[str, str]:
    match = re.search(r"\((\d{10})\)", str(name))
    if not match:
        raise ValueError(f"adm_code 추출 실패: {name}")
    code = match.group(1)
    clean_name = re.sub(r"\s*\(\d{10}\)\s*$", "", str(name)).strip()
    return code, clean_name


def build_timeseries() -> pd.DataFrame:
    records = []
    for year in YEARS:
        path = find_year_file(year)
        df = read_csv_auto(path)
        region_col = df.columns[0]
        # [전국 확장] from scripts.config.region_config import CITY_NAME
        target_rows = df[df[region_col].astype(str).str.contains("인천광역시", na=False)].copy()

        age_cols = [f"{year}년_계_{age}세" for age in range(13)]
        missing_age = [col for col in age_cols if col not in target_rows.columns]
        if missing_age:
            raise ValueError(f"{year} 파일 연령 컬럼 누락: {missing_age}")

        for col in age_cols:
            target_rows[col] = pd.to_numeric(target_rows[col].astype(str).str.replace(",", ""), errors="coerce")

        target_rows["child_0_12"] = target_rows[age_cols].sum(axis=1)
        target_rows["year"] = year

        parsed = target_rows[region_col].apply(parse_code)
        target_rows["adm_code"] = parsed.str[0]
        target_rows["adm_name"] = parsed.str[1]
        records.append(target_rows[["adm_code", "adm_name", "year", "child_0_12"]])

    ts = pd.concat(records, ignore_index=True)
    ts["adm_code"] = ts["adm_code"].astype(str)
    ts["child_0_12"] = pd.to_numeric(ts["child_0_12"], errors="coerce")
    ts.to_csv(OUT_TS, index=False, encoding="utf-8-sig")
    return ts


def normalize_gu_code(code: str) -> str:
    return GU_CODE_NORMALIZE.get(str(code), str(code))


def split_levels(ts: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    is_city = ts["adm_code"].str.endswith("00000000")
    is_gu = ts["adm_code"].str.endswith("00000") & ~is_city
    is_dong = ~is_city & ~is_gu

    city = ts[is_city].copy()

    gu = ts[is_gu].copy()
    gu["gu_code"] = gu["adm_code"].map(normalize_gu_code)
    gu = gu.groupby(["gu_code", "year"], as_index=False)["child_0_12"].sum()
    gu["gu_name"] = gu["gu_code"].map(GU_NAME_MAP)
    gu = gu[["gu_code", "gu_name", "year", "child_0_12"]].sort_values(["gu_code", "year"]).reset_index(drop=True)

    dong = ts[is_dong].copy().rename(columns={"adm_code": "dong_code", "adm_name": "dong_name"})
    dong["gu_code"] = dong["dong_code"].str[:5] + "00000"
    dong["gu_code"] = dong["gu_code"].map(normalize_gu_code)
    dong["gu_name"] = dong["gu_code"].map(GU_NAME_MAP)
    dong = dong[["dong_code", "dong_name", "gu_code", "gu_name", "year", "child_0_12"]].sort_values(["dong_code", "year"]).reset_index(drop=True)

    gu.to_csv(OUT_GU, index=False, encoding="utf-8-sig")
    dong.to_csv(OUT_DONG, index=False, encoding="utf-8-sig")
    return city, gu, dong


def forecast_gu(gu_df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for gu_code, group in gu_df.groupby("gu_code", sort=True):
        gu_name = group["gu_name"].iloc[0]
        train = group[["year", "child_0_12"]].copy()
        train["ds"] = pd.to_datetime(train["year"].astype(str) + "-12-31")
        train = train.rename(columns={"child_0_12": "y"})[["ds", "y"]]

        model = Prophet(
            changepoint_prior_scale=0.3,
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
        )
        model.fit(train)

        future = pd.DataFrame({"ds": pd.to_datetime([f"{y}-12-31" for y in range(2026, 2032)])})
        forecast = model.predict(future)[["ds", "yhat"]]
        pred_2029 = float(forecast.loc[forecast["ds"] == pd.Timestamp("2029-12-31"), "yhat"].iloc[0])
        pred_2031 = float(forecast.loc[forecast["ds"] == pd.Timestamp("2031-12-31"), "yhat"].iloc[0])
        actual_2024 = float(group.loc[group["year"] == 2024, "child_0_12"].iloc[0])

        rows.append(
            {
                "gu_code": str(gu_code),
                "gu_name": gu_name,
                "actual_2024": int(round(actual_2024)),
                "predicted_2029": int(round(max(pred_2029, 0))),
                "predicted_2031": int(round(max(pred_2031, 0))),
                "cohort_change_2029": float(max(pred_2029, 0) / actual_2024) if actual_2024 > 0 else np.nan,
                "cohort_change_2031": float(max(pred_2031, 0) / actual_2024) if actual_2024 > 0 else np.nan,
            }
        )

    out = pd.DataFrame(rows).sort_values("gu_code").reset_index(drop=True)
    out.to_csv(OUT_GU_COHORT, index=False, encoding="utf-8-sig")
    return out


def update_school_priority(gu_cohort: pd.DataFrame) -> tuple[bool, int]:
    priority = pd.read_csv(SCHOOL_PRIORITY_CSV, encoding="utf-8-sig")
    beneficiary = pd.read_csv(BENEFICIARY_CSV, encoding="utf-8-sig")

    heuristic = beneficiary[["gu", "cohort_change_2029", "cohort_change_2031"]].drop_duplicates("gu")
    prophet = gu_cohort[["gu_name", "cohort_change_2029", "cohort_change_2031"]].rename(
        columns={
            "gu_name": "gu",
            "cohort_change_2029": "cohort_change_2029_prophet",
            "cohort_change_2031": "cohort_change_2031_prophet",
        }
    )

    priority = priority.drop(
        columns=["cohort_change_2029", "cohort_change_2031", "cohort_change_2029_prophet", "cohort_change_2031_prophet"],
        errors="ignore",
    )
    priority = priority.merge(heuristic, on="gu", how="left")
    priority = priority.merge(prophet, on="gu", how="left")
    priority.to_csv(SCHOOL_PRIORITY_CSV, index=False, encoding="utf-8-sig")

    added = all(
        col in priority.columns
        for col in ["cohort_change_2029", "cohort_change_2031", "cohort_change_2029_prophet", "cohort_change_2031_prophet"]
    )
    null_school_count = int(priority[["cohort_change_2029_prophet", "cohort_change_2031_prophet"]].isna().any(axis=1).sum())
    return added, null_school_count


def main() -> None:
    ts = build_timeseries()
    _, gu, dong = split_levels(ts)
    gu_cohort = forecast_gu(gu)
    added, null_school_count = update_school_priority(gu_cohort)

    overall = ts[ts["adm_code"].str.endswith("00000000")].sort_values("year")
    overall_map = dict(zip(overall["year"], overall["child_0_12"]))
    null_exists = bool(ts.isna().any().any())

    heuristic = pd.read_csv(BENEFICIARY_CSV, encoding="utf-8-sig")[["gu", "cohort_change_2029"]].drop_duplicates("gu")
    compare = gu_cohort.merge(heuristic, left_on="gu_name", right_on="gu", how="left", suffixes=("_prophet", "_heuristic"))
    compare["abs_diff"] = (compare["cohort_change_2029_prophet"] - compare["cohort_change_2029_heuristic"]).abs()
    max_diff_row = compare.sort_values("abs_diff", ascending=False).iloc[0]
    outliers = gu_cohort[(gu_cohort["cohort_change_2029"] < 0.5) | (gu_cohort["cohort_change_2029"] > 1.5)]

    print("??1:")
    print(f"  ?? ? ? (??? x ??): {len(ts)}")
    print(f"  ?? ?? ???? 2014 / 2020 / 2025: {int(overall_map[2014])} / {int(overall_map[2020])} / {int(overall_map[2025])}")
    print(f"  null ??: {null_exists}")
    print("??2:")
    print(f"  ? ?? ???? ?: {gu['gu_code'].nunique()}")
    print(f"  ??? ?? ???? ?: {dong['dong_code'].nunique()}")
    print("??3:")
    print("  ?? cohort_change_2029 ??:")
    for _, row in gu_cohort[["gu_name", "cohort_change_2029"]].sort_values("gu_name").iterrows():
        print(f"    {row['gu_name']}: {row['cohort_change_2029']:.4f}")
    print(f"  ?? ???? ?? ?? ? ?? ?: {max_diff_row['gu_name']} ({max_diff_row['abs_diff']:.4f})")
    print(f"  ??? ??: {'??' if not outliers.empty else '??'}")
    if not outliers.empty:
        print(outliers[["gu_name", "cohort_change_2029"]].to_string(index=False))
    print("??4:")
    print(f"  school_priority.csv ?? ?? ??: {added}")
    print(f"  null ?? ?: {null_school_count}")


if __name__ == "__main__":
    main()
