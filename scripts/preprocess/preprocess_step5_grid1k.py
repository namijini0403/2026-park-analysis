# -*- coding: utf-8 -*-
"""
population_grid_1k.csv 생성
- 입력: 2024년_인구_나사_1K.csv + 2024년_인구_다사_1K.csv (census ZIP)
- 인천 필터: population_grid.csv(100M) 격자코드 → 1K prefix 변환
- 출력: data_processed/population_grid_1k.csv
  컬럼: 격자코드, total_pop, child_pop_0_5, child_pop_6_12
- 검증: data_processed/age_ratio_incheon.csv

안분 기준
- 1K 격자 연령코드 in_age_001~021는 5세 단위 구간임
  (001=0~4세, 002=5~9세, 003=10~14세, ...)
- KOSIS 「행정구역(시군구)별/1세별 주민등록인구(DT_1B04006)」
  인천광역시 2024-12 수치를 하드코딩하여 5~9세, 10~14세 내부 비율을 분할
"""

import zipfile, io, sys, os
import pandas as pd

sys.stdout.reconfigure(encoding="utf-8")

ZIP_POP  = r"c:\2026_data_analysis_park\data\raw\_census_reqdoc_1775457003738.zip"
GRID_100M = r"c:\2026_data_analysis_park\data\processed\population_grid.csv"
OUT      = r"c:\2026_data_analysis_park\data\processed\population_grid_1k.csv"
OUT_RATIO = r"c:\2026_data_analysis_park\data\processed\age_ratio_incheon.csv"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

AGE_COUNTS_2024_12 = {
    0: 15433,
    1: 15014,
    2: 16369,
    3: 16845,
    4: 17730,
    5: 19526,
    6: 20660,
    7: 21926,
    8: 24927,
    9: 26766,
    10: 26262,
    11: 26299,
    12: 28903,
    13: 28645,
    14: 27991,
}

AGE_0_4_TOTAL = sum(AGE_COUNTS_2024_12[i] for i in range(0, 5))
AGE_5_9_TOTAL = sum(AGE_COUNTS_2024_12[i] for i in range(5, 10))
AGE_10_14_TOTAL = sum(AGE_COUNTS_2024_12[i] for i in range(10, 15))

AGE5_SHARE_IN_5_9 = AGE_COUNTS_2024_12[5] / AGE_5_9_TOTAL
AGE6_9_SHARE_IN_5_9 = sum(AGE_COUNTS_2024_12[i] for i in range(6, 10)) / AGE_5_9_TOTAL
AGE10_12_SHARE_IN_10_14 = sum(AGE_COUNTS_2024_12[i] for i in range(10, 13)) / AGE_10_14_TOTAL


# ── 1단계: 인천 1K 격자코드 집합 추출 (100M → 1K prefix 변환) ──────────────
print("=== 1단계: 인천 1K 격자코드 집합 생성 ===")

def to_1k(code):
    for prefix in ["나사", "다사"]:
        if code.startswith(prefix):
            digits = code[len(prefix):]      # '405631'
            row = int(digits[:3]) // 10      # 405 → 40
            col = int(digits[3:]) // 10      # 631 → 63
            return f"{prefix}{row:02d}{col:02d}"
    return None

df_100m = pd.read_csv(GRID_100M, encoding="utf-8-sig", usecols=["격자코드"])
df_100m["code_1k"] = df_100m["격자코드"].apply(to_1k)

incheon_1k = set(df_100m["code_1k"].dropna())
nasa_1k    = {c for c in incheon_1k if c.startswith("나사")}
dasa_1k    = {c for c in incheon_1k if c.startswith("다사")}

print(f"인천 1K 코드: 총 {len(incheon_1k)}개 (나사 {len(nasa_1k)}, 다사 {len(dasa_1k)})")


# ── 2단계: 1K CSV 읽기 ────────────────────────────────────────────────────────
print("\n=== 2단계: 1K 인구 CSV 읽기 ===")
COLS = ["연도", "격자코드", "항목코드", "값"]

def read_1k(zip_obj, filename):
    raw = zip_obj.read(filename)
    # 첫 행이 데이터 (헤더 없음) → header=None
    df = pd.read_csv(io.BytesIO(raw), encoding="cp949",
                     header=None, names=COLS)
    print(f"  {filename}: {len(df):,}행 / 격자코드 {df['격자코드'].nunique()}개")
    return df

with zipfile.ZipFile(ZIP_POP) as z:
    df_nasa = read_1k(z, "2024년_인구_나사_1K.csv")
    df_dasa = read_1k(z, "2024년_인구_다사_1K.csv")


# ── 3단계: concat + 인천 필터 ────────────────────────────────────────────────
print("\n=== 3단계: concat + 인천 필터링 ===")

df_all = pd.concat([df_nasa, df_dasa], ignore_index=True)
print(f"concat 전체: {len(df_all):,}행 / 격자코드 {df_all['격자코드'].nunique()}개")

df_inch = df_all[df_all["격자코드"].isin(incheon_1k)].copy()
print(f"인천 필터 후: {len(df_inch):,}행 / 격자코드 {df_inch['격자코드'].nunique()}개")

# 항목코드 목록 확인
all_item_codes = set(df_inch["항목코드"].unique())
print(f"항목코드 수: {len(all_item_codes)}")


# ── 4단계: pivot_table ────────────────────────────────────────────────────────
print("\n=== 4단계: pivot_table ===")

df_inch["값"] = pd.to_numeric(df_inch["값"], errors="coerce").fillna(0)

pivot = df_inch.pivot_table(
    index="격자코드",
    columns="항목코드",
    values="값",
    aggfunc="sum",
    fill_value=0
)
pivot.columns.name = None
pivot = pivot.reset_index()

print(f"pivot 행수: {len(pivot)} / 컬럼 수: {len(pivot.columns)}")
print(f"컬럼 목록: {pivot.columns.tolist()}")


# ── 5단계: 파생 컬럼 생성 ────────────────────────────────────────────────────
print("\n=== 5단계: 파생 컬럼 생성 ===")
cols = set(pivot.columns)

def safe_sum(df, code_list):
    exist = [c for c in code_list if c in df.columns]
    missing = [c for c in code_list if c not in df.columns]
    if missing:
        print(f"  [경고] 없는 컬럼: {missing} → 0 처리")
    if exist:
        return df[exist].sum(axis=1)
    return pd.Series(0, index=df.index)

# total_pop
if "to_in_001" in cols:
    pivot["total_pop"] = pivot["to_in_001"]
    print(f"  total_pop: to_in_001 사용")
else:
    pivot["total_pop"] = 0
    print(f"  [경고] to_in_001 없음 → 0")

# 1K 격자 연령구간:
#   in_age_001 = 0~4세
#   in_age_002 = 5~9세
#   in_age_003 = 10~14세

age_0_4 = safe_sum(pivot, ["in_age_001"])
age_5_9 = safe_sum(pivot, ["in_age_002"])
age_10_14 = safe_sum(pivot, ["in_age_003"])

pivot["child_pop_0_5"] = age_0_4 + (age_5_9 * AGE5_SHARE_IN_5_9)
print(
    "  child_pop_0_5 = in_age_001 + in_age_002 * "
    f"{AGE5_SHARE_IN_5_9:.6f}  (KOSIS 2024-12 인천 5세 비중)"
)

pivot["child_pop_6_12"] = (
    age_5_9 * AGE6_9_SHARE_IN_5_9
    + age_10_14 * AGE10_12_SHARE_IN_10_14
)
print(
    "  child_pop_6_12 = in_age_002 * "
    f"{AGE6_9_SHARE_IN_5_9:.6f} + in_age_003 * {AGE10_12_SHARE_IN_10_14:.6f}"
)


# ── 6단계: 최종 컬럼 추출 및 저장 ────────────────────────────────────────────
print("\n=== 6단계: 저장 ===")

result = pivot[["격자코드", "total_pop", "child_pop_0_5", "child_pop_6_12"]].copy()

# 정수 변환
for col in ["total_pop", "child_pop_0_5", "child_pop_6_12"]:
    result[col] = result[col].astype(int)

result.to_csv(OUT, index=False, encoding="utf-8-sig")

# 인천 전체 기준 연령별 검증표 저장
ratio_rows = []

for age, pop in AGE_COUNTS_2024_12.items():
    if age <= 4:
        source_group = "in_age_001"
        share = pop / AGE_0_4_TOTAL
    elif age <= 9:
        source_group = "in_age_002"
        share = pop / AGE_5_9_TOTAL
    else:
        source_group = "in_age_003"
        share = pop / AGE_10_14_TOTAL

    ratio_rows.append({
        "age": age,
        "population": pop,
        "source_group_1k": source_group,
        "share_within_source_group": share,
    })

ratio_df = pd.DataFrame(ratio_rows)
ratio_df.to_csv(OUT_RATIO, index=False, encoding="utf-8-sig")

print(f"저장 완료: {OUT}")
print(f"검증표 저장 완료: {OUT_RATIO}")
print(f"  행수: {len(result):,}")
print(f"  컬럼: {result.columns.tolist()}")
print(f"\n[검증]")
print(f"  total_pop 합계: {result['total_pop'].sum():,}")
print(f"  child_pop_0_5 합계: {result['child_pop_0_5'].sum():,}")
print(f"  child_pop_6_12 합계: {result['child_pop_6_12'].sum():,}")
print(f"  인구>0 격자: {(result['total_pop']>0).sum():,}")
print(f"\n[샘플]")
print(result[result["total_pop"] > 0].head(10).to_string(index=False))
