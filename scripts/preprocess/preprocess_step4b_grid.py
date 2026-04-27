"""
2단계 수정: 나사 격자 경계 SHP(100M)에서 인천 격자코드 추출
3단계: 격자 인구에서 인천만 필터링
"""
import zipfile
import os
import sys
import csv
import geopandas as gpd
import tempfile
import io

sys.stdout.reconfigure(encoding="utf-8")

ZIP_GRID  = r"c:\2026_data_analysis_park\data\raw\_grid_border_grid_2025_grid_나사_grid_나사.zip"
ZIP_POP   = r"c:\2026_data_analysis_park\data\raw\_census_reqdoc_1775457003738.zip"
POP_FILE  = "2024년_인구_나사_100M.csv"
OUT_CODES = r"c:\2026_data_analysis_park\data\processed\incheon_grid_codes.csv"
OUT_POP   = r"c:\2026_data_analysis_park\data\processed\population_grid.csv"

os.makedirs(r"c:\2026_data_analysis_park\data\processed", exist_ok=True)

# ── 2단계: SHP 파일 읽기 ──────────────────────────────────
print("=== 2단계: 격자 경계 SHP(100M) ===")

with tempfile.TemporaryDirectory() as tmpdir:
    with zipfile.ZipFile(ZIP_GRID) as z:
        # 파일명 바이트로 직접 처리 (한글 깨짐 우회)
        for item in z.infolist():
            try:
                fname = item.filename.encode("cp437").decode("cp949")
            except Exception:
                fname = item.filename
            # 100M SHP/DBF/SHX/PRJ/CPG만 추출
            if "100M" in fname or "100M" in item.filename:
                data_bytes = z.read(item.filename)
                # 실제 저장 파일명 결정 (해상도 접미사로 단순화)
                ext = os.path.splitext(fname)[1]
                out_path = os.path.join(tmpdir, f"grid_100M{ext}")
                with open(out_path, "wb") as f:
                    f.write(data_bytes)
                print(f"  추출: {fname} → grid_100M{ext}")

    # SHP 읽기
    shp_path = os.path.join(tmpdir, "grid_100M.shp")
    if not os.path.exists(shp_path):
        print("ERROR: grid_100M.shp 없음")
        print("tmpdir 내용:", os.listdir(tmpdir))
        sys.exit(1)

    print(f"\ngeopandas로 읽는 중...")
    # encoding 시도
    gdf = None
    for enc in ["euc-kr", "cp949", "utf-8"]:
        try:
            gdf = gpd.read_file(shp_path, encoding=enc)
            if len(gdf) > 1:  # 1행이면 경계용이므로 스킵
                print(f"  인코딩: {enc} / 행 수: {len(gdf)} / CRS: {gdf.crs}")
                break
        except Exception as e:
            print(f"  {enc} 실패: {e}")

    if gdf is None or len(gdf) <= 1:
        print(f"  읽기 실패 또는 데이터 없음 (행수={len(gdf) if gdf is not None else 'None'})")
        sys.exit(1)

    print(f"컬럼: {list(gdf.columns)}")
    print(f"\n[첫 5행 속성]")
    print(gdf.drop(columns=["geometry"]).head(5).to_string())

    # 인천 필터링
    # 격자코드 컬럼 찾기
    grid_col = None
    admin_col = None
    for col in gdf.columns:
        if col == "geometry":
            continue
        sample = str(gdf[col].iloc[0])
        uvals = gdf[col].dropna().unique()[:5]
        print(f"  '{col}' 샘플: {list(uvals)[:5]}")
        if any("나사" in str(v) for v in uvals):
            grid_col = col
        if any(str(v).startswith("28") for v in uvals):
            admin_col = col

    print(f"\n→ 격자코드 컬럼: {grid_col}")
    print(f"→ 행정코드 컬럼: {admin_col}")

    # 인천 필터
    if admin_col:
        incheon_gdf = gdf[gdf[admin_col].astype(str).str.startswith("28")]
        print(f"행정코드 '28' 기준 인천 격자: {len(incheon_gdf)}개")
    elif grid_col:
        # 인구파일 격자코드와 교차 확인으로 인천 추출
        print("행정코드 컬럼 없음 → 인구파일 교차 방식 사용")
        incheon_gdf = gdf  # 일단 전체 사용
    else:
        incheon_gdf = gdf

    # 격자코드 목록 저장
    if grid_col:
        codes = incheon_gdf[grid_col].astype(str).tolist()
        with open(OUT_CODES, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["격자코드"])
            for c in codes:
                writer.writerow([c])
        print(f"\nincheon_grid_codes.csv 저장: {len(codes)}개")
    else:
        print("격자코드 컬럼 미발견 → 인구파일 직접 사용")
        codes = None

# ── 3단계: 격자 인구 필터링 ─────────────────────────────
print("\n=== 3단계: 격자 인구 필터링 ===")

# 인구 파일 로드
with zipfile.ZipFile(ZIP_POP) as z:
    raw = z.read(POP_FILE)
pop_rows = list(csv.reader(raw.decode("euc-kr").splitlines()))
print(f"인구 파일 전체 행: {len(pop_rows)}")

# 컬럼: 연도, 격자코드, 항목코드, 값 (헤더 없음)
# to_in_001 = 총인구
all_codes_in_pop = set(r[1] for r in pop_rows if len(r) >= 2)
print(f"인구 파일 격자코드 수: {len(all_codes_in_pop)}")

if codes:
    incheon_codes_set = set(codes)
    # 인구파일 코드와 교차
    matched = incheon_codes_set & all_codes_in_pop
    print(f"SHP 인천코드 {len(incheon_codes_set)}개 중 인구파일 매칭: {len(matched)}개")
    filter_codes = matched if matched else all_codes_in_pop
else:
    # SHP에서 코드 못 얻은 경우: 인구 파일 전체가 인천이라 가정
    print("→ 격자코드 필터 없이 전체 사용 (인구파일이 인천 전용으로 추정)")
    filter_codes = all_codes_in_pop

# to_in_001(총인구)만 필터링
result = []
for r in pop_rows:
    if len(r) < 4:
        continue
    if r[2] == "to_in_001" and r[1] in filter_codes:
        result.append({"격자코드": r[1], "총인구": r[3]})

print(f"최종 인천 격자 수: {len(result)}")

with open(OUT_POP, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["격자코드", "총인구"])
    writer.writeheader()
    writer.writerows(result)

print(f"저장 완료: {OUT_POP}")

# 검증
total_pop = sum(int(r["총인구"]) for r in result)
nonzero = sum(1 for r in result if int(r["총인구"]) > 0)
print(f"\n[검증] 격자 수: {len(result)} / 총인구 합계: {total_pop:,} / 인구>0 격자: {nonzero}")
