"""
2단계: 나사 격자 경계 SHP에서 인천 격자코드 추출
3단계: 격자 인구에서 인천만 필터링 → population_grid.csv
"""
import zipfile
import os
import csv
import sys
import geopandas as gpd
import tempfile
sys.stdout.reconfigure(encoding="utf-8")

ZIP_GRID  = r"c:\2026_data_analysis_park\data\raw\_grid_border_grid_2025_grid_나사_grid_나사.zip"
ZIP_POP   = r"c:\2026_data_analysis_park\data\raw\_census_reqdoc_1775457003738.zip"
POP_FILE  = "2024년_인구_나사_100M.csv"
OUT_CODES = r"c:\2026_data_analysis_park\data\processed\incheon_grid_codes.csv"
OUT_POP   = r"c:\2026_data_analysis_park\data\processed\population_grid.csv"

os.makedirs(r"c:\2026_data_analysis_park\data\processed", exist_ok=True)

# ── 2단계: SHP 추출 및 구조 파악 ──────────────────────────
print("=== 2단계: 격자 경계 SHP ===")

with tempfile.TemporaryDirectory() as tmpdir:
    # ZIP 전체 압축 해제
    with zipfile.ZipFile(ZIP_GRID) as z:
        print("ZIP 내부 파일:")
        for n in z.namelist():
            print(f"  {n}")
        z.extractall(tmpdir)

    # SHP 파일 찾기
    shp_files = [os.path.join(tmpdir, f) for f in os.listdir(tmpdir) if f.endswith(".shp")]
    print(f"\nSHP 파일: {shp_files}")

    # 첫 번째 SHP 읽기 (구조 파악)
    gdf = gpd.read_file(shp_files[0], encoding="euc-kr")
    print(f"\n총 격자 수: {len(gdf)}")
    print(f"CRS: {gdf.crs}")
    print(f"컬럼: {list(gdf.columns)}")
    print(f"\n[첫 3행]")
    print(gdf.head(3).to_string())

    # 인천 필터링 방법 결정
    # 행정구역 코드 컬럼 탐색
    print("\n[컬럼별 고유값 샘플]")
    for col in gdf.columns:
        if col == "geometry":
            continue
        uvals = gdf[col].unique()[:8]
        print(f"  {col}: {uvals}")

    # 인천광역시 코드: 28 (법정동 시도 코드)
    # 컬럼명에 따라 필터 조건 결정
    incheon_gdf = None
    for col in gdf.columns:
        if col == "geometry":
            continue
        sample = str(gdf[col].iloc[0])
        # 시도코드 28로 시작하는 컬럼 찾기
        if gdf[col].astype(str).str.startswith("28").any():
            print(f"\n→ 인천 필터 컬럼: '{col}' (값이 '28'로 시작)")
            incheon_gdf = gdf[gdf[col].astype(str).str.startswith("28")]
            print(f"  인천 격자 수: {len(incheon_gdf)}")
            break

    if incheon_gdf is None:
        # 격자코드 컬럼에서 '나사' 접두어 기준 필터
        for col in gdf.columns:
            if col == "geometry":
                continue
            if gdf[col].astype(str).str.contains("나사").any():
                print(f"\n→ 격자코드 컬럼: '{col}'")
                incheon_gdf = gdf.copy()
                break

    # 격자코드 컬럼 확인 및 인천 코드 목록 저장
    # 인구파일의 격자코드 형식: '나사405631'
    # SHP의 격자코드 컬럼명 찾기
    grid_code_col = None
    for col in gdf.columns:
        if col == "geometry":
            continue
        sample_vals = gdf[col].astype(str).head(5).tolist()
        print(f"  확인 중 '{col}': {sample_vals}")
        # 인구파일 형식과 매칭 시도
        if any("나사" in v for v in sample_vals):
            grid_code_col = col
            print(f"  → 격자코드 컬럼: '{col}'")
            break

    if incheon_gdf is not None and grid_code_col:
        codes = incheon_gdf[grid_code_col].astype(str).tolist()
    elif incheon_gdf is not None:
        # 격자코드를 직접 구성: 컬럼값에서 추출
        # 모든 코드 저장 후 인구파일에서 교차 확인
        print("\n격자코드 컬럼 미확인 → 모든 코드 저장")
        # 가장 유력한 컬럼(비기하) 사용
        non_geom = [c for c in incheon_gdf.columns if c != "geometry"]
        print(f"  저장할 컬럼 목록: {non_geom}")
        codes = None
    else:
        codes = None

    # SHP 속성 전체 저장 (참고용)
    attr_path = r"c:\2026_data_analysis_park\data\processed\grid_shp_attributes_sample.csv"
    gdf.head(20).drop(columns=["geometry"]).to_csv(attr_path, encoding="utf-8-sig", index=False)
    print(f"\nSHP 속성 샘플 저장: {attr_path}")

print("\n스크립트 완료 - SHP 구조 파악 단계")
