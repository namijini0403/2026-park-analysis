# -*- coding: utf-8 -*-
"""
2단계: 미추홀구 영유아 기관 통합 파일 생성
입력: 인천광역시 미추홀구_어린이집현황_20240805.csv
      인천광역시 미추홀구_유치원현황_20241025.csv
출력: data_processed/childcare_michuhol.csv
컬럼: 기관명, 기관유형, 위도, 경도, 주소, 정원수
"""

import pandas as pd
import os

RAW = "c:/2026_data_analysis_park/data/raw"
OUT = "c:/2026_data_analysis_park/data/processed"
os.makedirs(OUT, exist_ok=True)

# ── 파일 1: 어린이집 ──────────────────────────────────────────────────────
df_cc = pd.read_csv(
    os.path.join(RAW, "인천광역시 미추홀구_어린이집현황_20240805.csv"),
    encoding="cp949"
)

df_cc = df_cc.rename(columns={
    "어린이집명": "기관명",
    "어린이집유형구분": "기관유형",
    "위도": "위도",
    "경도": "경도",
    "도로명주소": "주소",
    "정원수": "정원수",
})

df_cc = df_cc[["기관명", "기관유형", "위도", "경도", "주소", "정원수"]].copy()
df_cc["출처"] = "어린이집"

print(f"어린이집 원본: {len(df_cc)}행")
print(f"  유형 종류: {df_cc['기관유형'].unique().tolist()}")

# ── 파일 2: 유치원 ────────────────────────────────────────────────────────
df_kg = pd.read_csv(
    os.path.join(RAW, "인천광역시 미추홀구_유치원현황_20241025.csv"),
    encoding="cp949"
)

# 유치원엔 정원수 컬럼 없음 → NaN 처리
df_kg = df_kg.rename(columns={
    "학교명": "기관명",
    "설립기준": "기관유형",
    "위도": "위도",
    "경도": "경도",
    "도로명주소": "주소",
})

df_kg["정원수"] = pd.NA
df_kg["기관유형"] = "유치원_" + df_kg["기관유형"].astype(str).str.strip()  # 유치원_사립, 유치원_공립

df_kg = df_kg[["기관명", "기관유형", "위도", "경도", "주소", "정원수"]].copy()
df_kg["출처"] = "유치원"

print(f"\n유치원 원본: {len(df_kg)}행")
print(f"  유형 종류: {df_kg['기관유형'].unique().tolist()}")

# ── 통합 ──────────────────────────────────────────────────────────────────
result = pd.concat([df_cc, df_kg], ignore_index=True)

# 기본 정제
result["기관명"] = result["기관명"].astype(str).str.strip()
result["기관유형"] = result["기관유형"].astype(str).str.strip()
result["주소"] = result["주소"].astype(str).str.strip()
result["위도"] = pd.to_numeric(result["위도"], errors="coerce")
result["경도"] = pd.to_numeric(result["경도"], errors="coerce")
result["정원수"] = pd.to_numeric(result["정원수"], errors="coerce")

# 기관명 NaN인 빈 행 제거 (원본 파일 말미 빈 행)
before = len(result)
result = result[result["기관명"].notna() & (result["기관명"] != "nan")].copy()
removed = before - len(result)
if removed > 0:
    print(f"\n빈 행 {removed}개 제거 (기관명 NaN)")

# 좌표 결측 확인
coord_missing = result[result["위도"].isna() | result["경도"].isna()]
print(f"\n좌표 결측: {len(coord_missing)}행")
if len(coord_missing) > 0:
    print(coord_missing[["기관명", "기관유형", "주소", "출처"]].to_string())

    # 지오코딩 실패 목록 저장
    fail_path = os.path.join(OUT, "childcare_coord_missing.csv")
    coord_missing[["기관명", "기관유형", "주소", "출처"]].to_csv(
        fail_path, index=False, encoding="utf-8-sig"
    )
    print(f"  -> 좌표 결측 목록 저장: {fail_path}")

# 중복 확인
dups = result.duplicated(subset=["기관명", "주소"], keep=False)
if dups.sum() > 0:
    print(f"\n[경고] 기관명+주소 중복 {dups.sum()}행:")
    print(result[dups][["기관명", "기관유형", "주소", "출처"]].to_string())

# 최종 출력 컬럼: 기관명, 기관유형, 위도, 경도, 주소, 정원수 (+ 출처)
out_path = os.path.join(OUT, "childcare_michuhol.csv")
result.to_csv(out_path, index=False, encoding="utf-8-sig")

print(f"\n[완료] 저장: {out_path}")
print(f"   총 {len(result)}행")
print(f"   기관유형 분포:")
print(result["기관유형"].value_counts().to_string())
print(f"\n   정원수 합계(어린이집): {result[result['출처']=='어린이집']['정원수'].sum():.0f}명")
print(f"   좌표 보유: {result['위도'].notna().sum()}/{len(result)}행")
