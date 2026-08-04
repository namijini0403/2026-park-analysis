# -*- coding: utf-8 -*-
from pathlib import Path

import pandas as pd


ROOT = Path(r"c:\2026_data_analysis_park")
DATA = ROOT / "data/processed"

LAT_MIN = 37.3
LAT_MAX = 37.7
LON_MIN = 126.5
LON_MAX = 126.9


def print_header(title: str) -> None:
    print()
    print(f"=== {title} ===")


def print_status(status: str, message: str) -> None:
    print(f"[{status}] {message}")


def read_csv(path: Path) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig")


def find_lat_lon_outliers(df: pd.DataFrame, lat_col: str = "위도", lon_col: str = "경도") -> pd.DataFrame:
    return df[
        (df[lat_col] < LAT_MIN)
        | (df[lat_col] > LAT_MAX)
        | (df[lon_col] < LON_MIN)
        | (df[lon_col] > LON_MAX)
    ].copy()


def validate_schools() -> None:
    path = DATA / "schools.csv"
    print_header(path.name)

    if not path.exists():
        print_status("FAIL", f"파일 없음: {path}")
        return

    df = read_csv(path)
    row_count = len(df)
    if row_count == 272:
        print_status("PASS", f"행수 272개 확인")
    else:
        print_status("FAIL", f"행수 불일치: 기대 272, 실제 {row_count}")

    outliers = find_lat_lon_outliers(df)
    if outliers.empty:
        print_status("PASS", "위경도 범위 이상치 없음")
    else:
        print_status("WARN", f"위경도 범위 이상치 {len(outliers)}개")
        cols = [c for c in ["학교ID", "학교명", "위도", "경도", "소재지도로명주소"] if c in outliers.columns]
        print(outliers[cols].to_string(index=False))


def validate_parks() -> None:
    path = DATA / "parks.csv"
    print_header(path.name)

    if not path.exists():
        print_status("FAIL", f"파일 없음: {path}")
        return

    df = read_csv(path)
    row_count = len(df)
    if row_count == 1093:
        print_status("PASS", "행수 1093개 확인")
    else:
        print_status("FAIL", f"행수 불일치: 기대 1093, 실제 {row_count}")

    if "gu" in df.columns:
        gu_values = sorted(df["gu"].dropna().astype(str).unique().tolist())
        print_status("PASS", f"gu 컬럼 값 목록: {', '.join(gu_values)}")
    else:
        print_status("FAIL", "gu 컬럼 없음")

    outliers = find_lat_lon_outliers(df)
    if outliers.empty:
        print_status("PASS", "위경도 범위 이상치 없음")
    else:
        print_status("WARN", f"위경도 범위 이상치 {len(outliers)}개")
        cols = [c for c in ["관리번호", "공원명", "gu", "위도", "경도"] if c in outliers.columns]
        print(outliers[cols].to_string(index=False))


def validate_population_grid() -> None:
    path = DATA / "population_grid_1k.csv"
    print_header(path.name)

    if not path.exists():
        print_status("FAIL", f"파일 없음: {path}")
        return

    df = read_csv(path)
    child_cols = ["child_pop_0_5", "child_pop_6_12"]

    negative_rows = df[(df[child_cols[0]] < 0) | (df[child_cols[1]] < 0)].copy()
    if negative_rows.empty:
        print_status("PASS", "아동인구 음수 행 없음")
    else:
        print_status("FAIL", f"아동인구 음수 행 {len(negative_rows)}개")
        print(negative_rows[["격자코드", "total_pop", "child_pop_0_5", "child_pop_6_12"]].to_string(index=False))

    over_rows = df[(df[child_cols[0]] + df[child_cols[1]]) > df["total_pop"]].copy()
    if over_rows.empty:
        print_status("PASS", "child_pop 합계가 total_pop 초과하는 행 없음")
    else:
        print_status("WARN", f"child_pop 합계가 total_pop 초과하는 행 {len(over_rows)}개")
        print(over_rows[["격자코드", "total_pop", "child_pop_0_5", "child_pop_6_12"]].to_string(index=False))

    ratio_df = df.copy()
    ratio_df["child_sum"] = ratio_df["child_pop_0_5"] + ratio_df["child_pop_6_12"]
    ratio_df["child_ratio"] = ratio_df["child_sum"] / ratio_df["total_pop"].where(ratio_df["total_pop"] > 0)

    valid_ratio = ratio_df["child_ratio"].dropna()
    if valid_ratio.empty:
        print_status("WARN", "total_pop > 0 인 격자가 없어 비율 분포를 계산하지 못함")
    else:
        desc = valid_ratio.describe(percentiles=[0.1, 0.25, 0.5, 0.75, 0.9])
        print_status("PASS", "격자별 (child_pop_0_5 + child_pop_6_12) / total_pop 비율 분포")
        print(desc.to_string())


def validate_school_access_compare() -> None:
    path = DATA / "school_access_compare.csv"
    print_header(path.name)

    if not path.exists():
        print_status("WARN", f"파일 없음, 검증 스킵: {path}")
        return

    df = read_csv(path)

    if "access_ratio" not in df.columns:
        print_status("FAIL", "access_ratio 컬럼 없음")
        return

    outliers = df[(df["access_ratio"] <= 0) | (df["access_ratio"] > 1.5)].copy()
    if outliers.empty:
        print_status("PASS", "access_ratio 이상치 없음")
    else:
        print_status("WARN", f"access_ratio 이상치 {len(outliers)}개")
        cols = [c for c in ["school_id", "학교ID", "학교명", "gu", "access_ratio"] if c in outliers.columns]
        print(outliers[cols].to_string(index=False))

    if "gu" not in df.columns:
        print_status("FAIL", "gu 컬럼 없음, gu별 평균 계산 불가")
        return

    gu_mean = df.groupby("gu", dropna=False)["access_ratio"].mean().sort_values()
    print_status("PASS", "gu별 access_ratio 평균")
    print(gu_mean.to_string())


def validate_school_priority() -> None:
    path = DATA / "school_priority.csv"
    print_header(path.name)

    if not path.exists():
        print_status("FAIL", f"파일 없음: {path}")
        return

    df = read_csv(path)

    invalid_case_type = df[~df["case_type"].isin([1, 2, 3, 4])].copy()
    if invalid_case_type.empty:
        print_status("PASS", "case_type 값이 1~4 범위 안에 있음")
    else:
        print_status("FAIL", f"case_type 이상값 {len(invalid_case_type)}개")
        print(invalid_case_type[["학교ID", "학교명", "gu", "case_type"]].to_string(index=False))

    invalid_priority = df[~df["priority_score"].isin([1, 2, 3, 4])].copy()
    if invalid_priority.empty:
        print_status("PASS", "priority_score 값이 1~4 범위 안에 있음")
    else:
        print_status("FAIL", f"priority_score 이상값 {len(invalid_priority)}개")
        print(invalid_priority[["학교ID", "학교명", "gu", "priority_score"]].to_string(index=False))

    invalid_cluster = df[~df["cluster"].isin([0, 1, 2])].copy()
    if invalid_cluster.empty:
        print_status("PASS", "cluster 값이 0~2 범위 안에 있음")
    else:
        print_status("FAIL", f"cluster 이상값 {len(invalid_cluster)}개")
        print(invalid_cluster[["학교ID", "학교명", "gu", "cluster"]].to_string(index=False))

    target_schools = [
        "인천주안초등학교",
        "인천남부초등학교",
        "인천주안남초등학교",
        "인천석암초등학교",
        "인천대화초등학교",
    ]
    found = df[(df["gu"] == "미추홀구") & (df["학교명"].isin(target_schools))].copy()

    if len(found) == len(target_schools):
        print_status("PASS", "미추홀구 우선지원 5개교 존재 확인")
        print(found[["학교명", "gu", "priority_score", "case_type", "cluster"]].sort_values("학교명").to_string(index=False))
    else:
        print_status("FAIL", f"미추홀구 우선지원 5개교 미충족: 기대 {len(target_schools)}, 실제 {len(found)}")
        print(found[["학교명", "gu", "priority_score", "case_type", "cluster"]].sort_values("학교명").to_string(index=False))


def main() -> None:
    print(f"검증 시작: {ROOT}")
    validate_schools()
    validate_parks()
    validate_population_grid()
    validate_school_priority()
    validate_school_access_compare()


if __name__ == "__main__":
    main()
