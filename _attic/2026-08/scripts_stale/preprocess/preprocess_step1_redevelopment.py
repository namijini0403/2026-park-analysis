# -*- coding: utf-8 -*-
"""
1단계: 인천 재개발 구역 통합 파일 생성
입력: 인천광역시_도시 및 주거환경 정비사업 추진현황.csv
      인천광역시_소규모주택정비추진현황.csv
출력: data_processed/redevelopment.csv
컬럼: 구명, 구역명, 위치, 면적, 사업유형, 진행단계
"""

import pandas as pd
import os

RAW = "c:/2026_data_analysis_park/data/raw"
OUT = "c:/2026_data_analysis_park/data/processed"
os.makedirs(OUT, exist_ok=True)

# ── 파일 1: 도시 및 주거환경 정비사업 ──────────────────────────────────────
df1 = pd.read_csv(
    os.path.join(RAW, "인천광역시_도시 및 주거환경 정비사업 추진현황.csv"),
    encoding="cp949"
)

# 컬럼 정리
df1 = df1.rename(columns={
    "구명": "구명",
    "구 역 명": "구역명",
    "위치": "위치",
    "면적(제곱미터)     ": "면적",
    "사업유형": "사업유형",
    "진행단계": "진행단계",
})

# 혹시 공백 포함된 컬럼명 처리 (strip)
df1.columns = df1.columns.str.strip()
df1 = df1[["구명", "구역명", "위치", "면적", "사업유형", "진행단계"]].copy()
df1["출처"] = "도시정비"

print(f"도시정비 원본: {len(df1)}행")
print(f"  사업유형 종류: {df1['사업유형'].unique().tolist()}")
print(f"  진행단계 종류: {df1['진행단계'].unique().tolist()}")

# ── 파일 2: 소규모주택정비 ────────────────────────────────────────────────
df2 = pd.read_csv(
    os.path.join(RAW, "인천광역시_소규모주택정비추진현황.csv"),
    encoding="cp949"
)

df2 = df2.rename(columns={
    "구청": "구명",
    "구역명": "구역명",
    "위치": "위치",
    "면적": "면적",
    "사업유형": "사업유형",
    "추진단계": "진행단계",
})

# 필요 컬럼만 선택 (strip 포함)
df2.columns = df2.columns.str.strip()
df2 = df2[["구명", "구역명", "위치", "면적", "사업유형", "진행단계"]].copy()
df2["출처"] = "소규모정비"

print(f"\n소규모정비 원본: {len(df2)}행")
print(f"  사업유형 종류: {df2['사업유형'].unique().tolist()}")
print(f"  진행단계 종류: {df2['진행단계'].unique().tolist()}")

# ── 통합 ──────────────────────────────────────────────────────────────────
result = pd.concat([df1, df2], ignore_index=True)

# 기본 정제
result["구명"] = result["구명"].astype(str).str.strip()
result["구역명"] = result["구역명"].astype(str).str.strip()
result["위치"] = result["위치"].astype(str).str.strip()
result["면적"] = pd.to_numeric(result["면적"], errors="coerce")
result["사업유형"] = result["사업유형"].astype(str).str.strip()
result["진행단계"] = result["진행단계"].astype(str).str.strip()

# 결측·중복 확인
print(f"\n통합 전체: {len(result)}행")
print(f"결측값:\n{result[['구명','구역명','위치','면적','사업유형','진행단계']].isnull().sum().to_string()}")

dups = result.duplicated(subset=["구명", "구역명"], keep=False)
if dups.sum() > 0:
    print(f"\n[경고] 구명+구역명 중복 {dups.sum()}행:")
    print(result[dups][["구명", "구역명", "사업유형", "출처"]].to_string())

# 출력 컬럼: 구명, 구역명, 위치, 면적, 사업유형, 진행단계 (출처 포함)
out_path = os.path.join(OUT, "redevelopment.csv")
result.to_csv(out_path, index=False, encoding="utf-8-sig")

print(f"\n[완료] 저장: {out_path}")
print(f"   총 {len(result)}행 | 구별 분포:")
print(result["구명"].value_counts().to_string())
