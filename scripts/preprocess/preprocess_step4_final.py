"""
2단계: 나사 격자 경계 SHP → incheon_grid_codes.csv
3단계: 격자 인구 필터링 → population_grid.csv
"""
import zipfile, os, sys, csv, shapefile, tempfile

sys.stdout.reconfigure(encoding="utf-8")

ZIP_GRID  = r"c:\2026_data_analysis_park\data\raw\_grid_border_grid_2025_grid_나사_grid_나사.zip"
ZIP_POP   = r"c:\2026_data_analysis_park\data\raw\_census_reqdoc_1775457003738.zip"
POP_FILE  = "2024년_인구_나사_100M.csv"
OUT_CODES = r"c:\2026_data_analysis_park\data\processed\incheon_grid_codes.csv"
OUT_POP   = r"c:\2026_data_analysis_park\data\processed\population_grid.csv"

os.makedirs(r"c:\2026_data_analysis_park\data\processed", exist_ok=True)

# ── 2단계: SHP에서 인천 격자코드 전체 추출 ───────────────
print("=== 2단계: incheon_grid_codes.csv 생성 ===")

shp_codes = []
tmpdir = tempfile.mkdtemp()
try:
    # ZIP 압축 해제 (100M 해상도만)
    with zipfile.ZipFile(ZIP_GRID) as z:
        for item in z.infolist():
            try:
                fname = item.filename.encode("cp437").decode("cp949")
            except Exception:
                fname = item.filename
            if "100M" in fname:
                ext = os.path.splitext(fname)[1]
                with open(os.path.join(tmpdir, f"g{ext}"), "wb") as f:
                    f.write(z.read(item.filename))

    # SHP 읽기 (UTF-8 인코딩) - 명시적으로 닫아서 파일 잠금 해제
    sf = shapefile.Reader(os.path.join(tmpdir, "g.shp"), encoding="utf-8")
    shp_codes = [list(rec)[0] for rec in sf.iterRecords()]
    bbox = sf.bbox
    sf.close()
    print(f"SHP 전체 격자 수: {len(shp_codes)}")
    print(f"bbox: x {bbox[0]:.0f}~{bbox[2]:.0f}, y {bbox[1]:.0f}~{bbox[3]:.0f}")
    print(f"샘플 코드: {shp_codes[:5]}")
finally:
    import shutil
    shutil.rmtree(tmpdir, ignore_errors=True)

# incheon_grid_codes.csv 저장
with open(OUT_CODES, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["격자코드"])
    for c in shp_codes:
        writer.writerow([c])
print(f"저장 완료: {OUT_CODES}")

# ── 3단계: 격자 인구 필터링 ──────────────────────────────
print("\n=== 3단계: population_grid.csv 생성 ===")

# 인구 파일 로드
with zipfile.ZipFile(ZIP_POP) as z:
    raw = z.read(POP_FILE)
pop_rows = list(csv.reader(raw.decode("euc-kr").splitlines()))

# 교차 확인
incheon_set = set(shp_codes)
pop_codes   = set(r[1] for r in pop_rows if len(r) >= 2)
matched     = incheon_set & pop_codes

print(f"인천 SHP 코드: {len(incheon_set)}개")
print(f"인구파일 코드: {len(pop_codes)}개")
print(f"교차 일치: {len(matched)}개")

if not matched:
    # 인구파일이 SHP 범위 이내지만 코드 형식 차이가 있는 경우 → 전체 사용
    print("→ 교차 없음: 인구파일 전체 사용 (이미 인천 전용 파일)")
    matched = pop_codes

# to_in_001(총인구)만 필터링
result = []
for r in pop_rows:
    if len(r) < 4:
        continue
    if r[2] == "to_in_001" and r[1] in matched:
        result.append({"격자코드": r[1], "총인구": r[3]})

print(f"최종 격자 수: {len(result)}")

with open(OUT_POP, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["격자코드", "총인구"])
    writer.writeheader()
    writer.writerows(result)
print(f"저장 완료: {OUT_POP}")

# 검증
total_pop = sum(int(r["총인구"]) for r in result)
nonzero   = sum(1 for r in result if int(r["총인구"]) > 0)
zero_pct  = (len(result) - nonzero) / len(result) * 100
print(f"\n[검증]")
print(f"  격자 수: {len(result)}")
print(f"  총인구 합계: {total_pop:,}")
print(f"  인구>0 격자: {nonzero} ({100-zero_pct:.1f}%)")
print(f"  인구=0 격자: {len(result)-nonzero} ({zero_pct:.1f}%)")
print(f"\n[인구 분포 상위 10개]")
top = sorted(result, key=lambda x: -int(x["총인구"]))[:10]
for r in top:
    print(f"  {r['격자코드']}: {r['총인구']}명")

print(f"\n⚠ 주의: 인구파일({len(pop_codes)}개 격자)이 SHP({len(incheon_set)}개 격자) 대비 일부만 커버")
print(f"  → 통계청 격자 인구 다운로드가 특정 구역 한정이었을 수 있음")
print(f"  → PHASE 2 공간분석 전 전체 인천 100m 격자 인구 추가 수집 필요")
