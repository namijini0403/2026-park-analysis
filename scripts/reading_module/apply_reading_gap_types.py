# -*- coding: utf-8 -*-
"""
P2 Task 2: 격차 유형 산출 + 임계값 근거 문서

data_processed/school_library_access.csv (Task 1 산출물, 272행)에
external_shortage / internal_shortage / demand_high / reading_gap_type /
reading_gap_reason 컬럼을 추가(제자리 수정)하고,
data_processed/school_enrollment_forecast_20260418_model1.csv 와 학교ID로
조인해 미래 수요 지표를 사용한다.

재실행해도 동일한 결과가 나오도록(idempotent) 기존에 추가된 5개 컬럼이
있으면 먼저 제거한 뒤 다시 계산한다.

실행: py scripts/reading_module/apply_reading_gap_types.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
ACCESS_CSV = REPO_ROOT / "data_processed" / "school_library_access.csv"
FORECAST_CSV = (
    REPO_ROOT / "data_processed" / "school_enrollment_forecast_20260418_model1.csv"
)
THRESHOLDS_DOC = REPO_ROOT / "docs" / "reading_module_thresholds.md"

ADDED_COLUMNS = [
    "external_shortage",
    "internal_shortage",
    "demand_high",
    "reading_gap_type",
    "reading_gap_reason",
]

UNRESOLVED = "추가 확인 필요"

# ADDED_COLUMNS 를 제외한 Task 1 원본 컬럼 순서(브리프 Interfaces 명세와 동일).
BASE_COLUMNS = [
    "학교ID",
    "학교명",
    "iso_library_count",
    "iso_public_library_count",
    "nearest_library_name",
    "nearest_library_euclid_m",
    "장서수",
    "좌석수",
    "사서교사수",
    "사서직원수",
    "사서합계",
    "학생수",
    "인당장서수",
    "좌석당학생수",
    "matched",
    "기준일",
]


def load_access() -> pd.DataFrame:
    df = pd.read_csv(ACCESS_CSV, dtype=str, keep_default_na=False)
    # 재실행 idempotency: 이전 실행에서 추가된 컬럼이 있으면 제거하고 원본 컬럼 순서로 복원
    for col in ADDED_COLUMNS:
        if col in df.columns:
            df = df.drop(columns=[col])
    missing = [c for c in BASE_COLUMNS if c not in df.columns]
    if missing:
        raise SystemExit(f"school_library_access.csv 필수 컬럼 누락: {missing}")
    df = df[BASE_COLUMNS].copy()

    # 숫자 컬럼 타입 변환. matched=0 행은 KESS 파생 컬럼이 '추가 확인 필요' 문자열이므로
    # errors='coerce' 로 NaN 처리(해당 행은 별도 로직으로 처리됨).
    df["iso_library_count"] = pd.to_numeric(df["iso_library_count"])
    df["iso_public_library_count"] = pd.to_numeric(df["iso_public_library_count"])
    df["nearest_library_euclid_m"] = pd.to_numeric(df["nearest_library_euclid_m"])
    df["matched"] = pd.to_numeric(df["matched"]).astype(int)

    for col in ["장서수", "좌석수", "사서교사수", "사서직원수", "사서합계", "학생수",
                "인당장서수", "좌석당학생수"]:
        df[col + "__num"] = pd.to_numeric(df[col], errors="coerce")

    return df


def load_forecast() -> pd.DataFrame:
    fc = pd.read_csv(FORECAST_CSV, dtype=str, keep_default_na=False)
    fc["forecast_2029"] = pd.to_numeric(fc["forecast_2029"], errors="coerce")
    return fc[["학교ID", "forecast_2029"]]


def compute_distribution(df: pd.DataFrame, forecast: pd.DataFrame) -> dict:
    """분포 산출(Step 1). matched==1 행만 KESS 파생 지표 분포에 사용."""
    matched = df[df["matched"] == 1]

    quartiles = {}
    for col in ["인당장서수__num", "좌석당학생수__num", "사서합계__num"]:
        q = matched[col].quantile([0.25, 0.5, 0.75])
        quartiles[col.replace("__num", "")] = {
            "min": matched[col].min(),
            "q25": q.loc[0.25],
            "median": q.loc[0.5],
            "q75": q.loc[0.75],
            "max": matched[col].max(),
            "mean": matched[col].mean(),
        }

    quartiles["iso_public_library_count"] = {
        "min": df["iso_public_library_count"].min(),
        "q25": df["iso_public_library_count"].quantile(0.25),
        "median": df["iso_public_library_count"].median(),
        "q75": df["iso_public_library_count"].quantile(0.75),
        "max": df["iso_public_library_count"].max(),
        "mean": df["iso_public_library_count"].mean(),
        "zero_count": int((df["iso_public_library_count"] == 0).sum()),
        "n": len(df),
    }

    merged_demand = df.merge(forecast, on="학교ID", how="left")
    quartiles["forecast_2029"] = {
        "min": merged_demand["forecast_2029"].min(),
        "q25": merged_demand["forecast_2029"].quantile(0.25),
        "median": merged_demand["forecast_2029"].median(),
        "q75": merged_demand["forecast_2029"].quantile(0.75),
        "max": merged_demand["forecast_2029"].max(),
        "mean": merged_demand["forecast_2029"].mean(),
        "na_count": int(merged_demand["forecast_2029"].isna().sum()),
    }
    quartiles["학생수_current"] = {
        "min": matched["학생수__num"].min(),
        "q25": matched["학생수__num"].quantile(0.25),
        "median": matched["학생수__num"].median(),
        "q75": matched["학생수__num"].quantile(0.75),
        "max": matched["학생수__num"].max(),
        "mean": matched["학생수__num"].mean(),
    }
    quartiles["n_matched"] = len(matched)
    quartiles["n_total"] = len(df)
    quartiles["n_saseo_zero"] = int((matched["사서합계__num"] == 0).sum())
    return quartiles


def classify(df: pd.DataFrame, forecast: pd.DataFrame, dist: dict) -> pd.DataFrame:
    """Step 2/3: 임계값 확정 및 분기 적용."""
    median_books = dist["인당장서수"]["median"]
    internal_book_threshold = median_books * 0.5
    demand_q75 = dist["forecast_2029"]["q75"]

    merged = df.merge(forecast, on="학교ID", how="left")

    external_shortage = merged["iso_public_library_count"] == 0
    demand_high = merged["forecast_2029"] >= demand_q75

    internal_shortage = pd.Series(index=merged.index, dtype=object)
    reading_gap_type = pd.Series(index=merged.index, dtype=object)
    reading_gap_reason = pd.Series(index=merged.index, dtype=object)

    for idx, row in merged.iterrows():
        ext = bool(external_shortage.loc[idx])
        demand = bool(demand_high.loc[idx])

        if row["matched"] == 0:
            internal_shortage.loc[idx] = UNRESOLVED
            reading_gap_type.loc[idx] = UNRESOLVED
            reading_gap_reason.loc[idx] = (
                "KESS 학교도서관현황 2025 원천에 해당 학교 레코드가 없어 "
                "사서합계·인당장서수 등 내부 지표를 산출할 수 없음(내부 결핍 여부 판정 불가). "
                "도보 500m 내 공공/어린이도서관 " + ("0개" if ext else f"{int(row['iso_public_library_count'])}개")
                + "·2029년 예측 학생수 상위 25%" + ("" if demand else " 아님")
                + " 확인됨. KESS 데이터 보완 후 재분류 필요."
            )
            continue

        saseo = row["사서합계__num"]
        bookspp = row["인당장서수__num"]
        internal = bool((saseo == 0) or (bookspp < internal_book_threshold))
        internal_shortage.loc[idx] = internal

        ext_txt = "도보500m 내 공공도서관 0개" if ext else "도보500m 내 공공도서관 확보"
        if saseo == 0 and bookspp < internal_book_threshold:
            int_txt = "사서 미배치·인당장서수 중앙값 50% 미만"
        elif saseo == 0:
            int_txt = "사서 미배치"
        elif bookspp < internal_book_threshold:
            int_txt = "인당장서수 중앙값 50% 미만"
        else:
            int_txt = "내부 지표(사서·인당장서수) 양호"
        demand_txt = "수요 상위 25%(2029 예측)" if demand else "수요 상위 25% 아님"

        if ext and internal:
            gap_type = "direct_investment_first"
            if demand:
                reason = f"{ext_txt}·{int_txt}·{demand_txt} → 외부·내부 모두 부족+수요 높음, 직접투자 최우선"
            else:
                reason = (
                    f"{ext_txt}·{int_txt}·{demand_txt} → 외부·내부 모두 부족하나 수요는 상위 25% 미만"
                    "(edge case: 문서 원문의 '수요 높음' 조건 미충족. 직접투자 필요성은 유지하되 "
                    "우선순위는 수요충족군보다 후순위로 기록)"
                )
        elif ext and not internal:
            gap_type = "school_hub_mobile"
            reason = f"{ext_txt}·{int_txt} → 외부만 부족, 학교거점 순회/모바일 서비스로 보완"
        elif internal and not ext:
            gap_type = "public_link"
            reason = f"{ext_txt}·{int_txt} → 내부만 부족, 인근 공공도서관 연계로 보완"
        else:
            gap_type = "maintain_monitor"
            reason = f"{ext_txt}·{int_txt} → 외부·내부 모두 양호, 현행 유지 및 모니터링"

        reading_gap_type.loc[idx] = gap_type
        reading_gap_reason.loc[idx] = reason

    merged["external_shortage"] = external_shortage
    merged["internal_shortage"] = internal_shortage
    merged["demand_high"] = demand_high
    merged["reading_gap_type"] = reading_gap_type
    merged["reading_gap_reason"] = reading_gap_reason

    return merged, internal_book_threshold, demand_q75


def main() -> None:
    df = load_access()
    forecast = load_forecast()
    dist = compute_distribution(df, forecast)

    merged, internal_book_threshold, demand_q75 = classify(df, forecast, dist)

    # 검증(Step 4)
    n_total = len(merged)
    n_classified = merged["reading_gap_type"].notna().sum()
    assert n_total == 272, f"행 수가 272가 아님: {n_total}"
    assert n_classified == n_total, "미분류 행 존재"

    counts = merged["reading_gap_type"].value_counts()
    print("=== reading_gap_type 분포 ===")
    for t in ["direct_investment_first", "school_hub_mobile", "public_link",
              "maintain_monitor", UNRESOLVED]:
        print(f"  {t}: {int(counts.get(t, 0))}")
    print(f"  합계: {int(counts.sum())} / 272")

    zero_types = [t for t in ["direct_investment_first", "school_hub_mobile",
                               "public_link", "maintain_monitor"] if counts.get(t, 0) == 0]
    if zero_types:
        print(f"[WARN] 0개 유형 존재: {zero_types} — 임계값 재검토 필요")

    # 최종 컬럼 순서: 기존 16개 컬럼 그대로 + 신규 5개 컬럼 append
    out = merged[BASE_COLUMNS + ADDED_COLUMNS].copy()

    # bool -> Python bool literal 로 저장(True/False), UNRESOLVED 는 문자열 그대로 유지
    for col in ["external_shortage", "demand_high"]:
        out[col] = out[col].map(lambda v: bool(v))
    out["internal_shortage"] = out["internal_shortage"].map(
        lambda v: v if v == UNRESOLVED else bool(v)
    )

    out.to_csv(ACCESS_CSV, index=False, encoding="utf-8", lineterminator="\r\n")
    print(f"\n{ACCESS_CSV} 갱신 완료 ({len(out)}행, 컬럼 {len(out.columns)}개)")

    print(f"\n임계값: 인당장서수 내부결핍선={internal_book_threshold:.2f} "
          f"(매칭 271교 중앙값 {dist['인당장서수']['median']:.2f}의 50%), "
          f"수요상위25% 컷오프(2029예측학생수)={demand_q75:.2f}")


if __name__ == "__main__":
    main()
