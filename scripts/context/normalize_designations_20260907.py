"""2026-09-07 추가 지정·지원 명단 정규화 (stdlib only).

원문(hwpx)은 data/context_sources/raw/ 에 그대로 두고, 표를 셀 병합(cellSpan)까지 풀어 읽어
builder(DESIGNATION_FILES) 규격의 CSV를 만든다. 학교명 약칭은 schools.csv 정식 명칭과
**접미 유일 일치**할 때만 확장하고, 그 외는 원문 표기를 남겨 builder QA(unmatched)에 드러나게 한다.

산출 (data/context_sources/):
  school_gyeoldaero_2025.csv / school_gyeoldaero_2026.csv   결대로자람학교 운영교(초) — 지정년도·자율학교 지정기간 결합
  school_autonomous_2025.csv / school_autonomous_2026.csv   자율학교 지정 현황(초, 결대로자람 유형 제외) — 실제 지정기간
  school_space_restructure_2026.csv                          공간재구조화(그린스마트) 사업 대상교(초) — 선정연도·건물·상태
  school_future_classroom_2024.csv / _2025.csv               미래교실 구축 지원교(초)
  school_ai_info_center_2025.csv                             2025 AI·정보(융합)교육 중심학교(초)

추가 컬럼(선택): designation_start_date, designation_end_date, period_basis, note
  - builder는 이 컬럼이 있으면 실제 기간으로 period_status를 계산하고(period_basis=official_period),
    없으면 기존처럼 학년도 추정(school_year_only)을 쓴다.
"""
from __future__ import annotations

import csv
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "context_sources" / "raw"
OUT_DIR = REPO_ROOT / "data" / "context_sources"
SCHOOLS_CSV = REPO_ROOT / "data_processed" / "schools.csv"
RETRIEVED_AT = "2026-09-07"
MANIFEST_OUT = RAW_DIR / "designation_raw_manifest_20260907.json"

COLUMNS = [
    "school_name", "school_level", "designation_type", "program_name", "year",
    "source_url", "source_file", "source_published_date", "retrieved_at",
    "financial_support_amount", "verification_status",
    "designation_start_date", "designation_end_date", "period_basis", "note",
]

# 게시글 페이지(source_url)·발행일 — 인천광역시교육청 사전정보공표 게시판
SRC = {
    "gyeol_2026": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3360283&bbsId=852&mi=11841", "2026-02-11"),
    "gyeol_2025": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3316288&bbsId=852&mi=11841", "2025-02-17"),
    "auto_end_2027": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3378038&bbsId=610&mi=11841", "2026-07-13"),
    "space_2026": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3367588&bbsId=840&mi=11841", "2026-04-10"),
    "future_2025": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3320373&bbsId=841&mi=11841", "2025-03-14"),
    "future_2024": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3281742&bbsId=841&mi=11841", "2024-03-29"),
    "ai_info_2025": ("https://www.ice.go.kr/ice/na/ntt/selectNttInfo.do?nttSn=3315152&bbsId=863&mi=11841", "2025-02-12"),
    "ginue_2026": ("https://www.ginue.ac.kr/kor/CMS/Contents/Contents.do?mCode=MN081", None),  # 2026학년도 교육실습 협력학교 현황(게시일 미표기)
}
# 자율학교 지정 현황 게시글은 main()에서 --auto-src 인자로 덮어쓸 수 있다 (기본값은 게시판 610 조회 결과로 채움)
AUTO_SRC = {
    "auto_2026": ("https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=11841&bbsId=610", None),
    "auto_2025": ("https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=11841&bbsId=610", None),
}


def tag(e):  # 네임스페이스 제거
    return e.tag.split("}")[-1]


def hwpx_tables(path: Path) -> list[list[list[str]]]:
    """hwpx의 모든 표를 [행][열] 문자열 격자로. 병합 셀은 원점 텍스트를 복사해 채운다."""
    z = zipfile.ZipFile(path)
    grids: list[list[list[str]]] = []
    for name in sorted(n for n in z.namelist() if n.startswith("Contents/section")):
        root = ET.fromstring(z.read(name))
        for tbl in (t for t in root.iter() if tag(t) == "tbl"):
            cells: dict[tuple[int, int], str] = {}
            for tr in (x for x in tbl.iter() if tag(x) == "tr"):
                for tc in (c for c in tr if tag(c) == "tc"):
                    addr = next(c for c in tc.iter() if tag(c) == "cellAddr")
                    span = next((c for c in tc.iter() if tag(c) == "cellSpan"), None)
                    txt = " ".join((t.text or "") for t in tc.iter() if tag(t) == "t")
                    txt = re.sub(r"\s+", " ", txt).strip()
                    c0, r0 = int(addr.get("colAddr")), int(addr.get("rowAddr"))
                    cs = int(span.get("colSpan")) if span is not None else 1
                    rs = int(span.get("rowSpan")) if span is not None else 1
                    for dr in range(rs):
                        for dc in range(cs):
                            cells[(r0 + dr, c0 + dc)] = txt
            if not cells:
                continue
            nrows = max(r for r, _ in cells) + 1
            ncols = max(c for _, c in cells) + 1
            grids.append([[cells.get((r, c), "") for c in range(ncols)] for r in range(nrows)])
    return grids


def load_school_names() -> list[str]:
    with open(SCHOOLS_CSV, encoding="utf-8-sig", newline="") as f:
        return [row["학교명"].strip() for row in csv.DictReader(f)]


# 원문 표기 → schools.csv 정식 명칭 (무모호 확인: 주소 '인천광역시 계양구 안남로 612' 일치)
EXPLICIT_ALIASES = {"경인교대부설초등학교": "경인교육대학교부설초등학교"}


class NameResolver:
    """약칭 → 정식 명칭. 접미 유일 일치(예: '합일초' → '합일초등학교', '인천대화초' → '인천대화초등학교')."""

    def __init__(self, names: list[str]):
        self.names = names
        self.exact = set(names)
        self.stats = {"exact": 0, "expanded": 0, "unresolved": [], "ambiguous": []}

    def resolve(self, short: str) -> str:
        s = re.sub(r"\s+", "", short)
        if not s:
            return s
        if s in EXPLICIT_ALIASES and EXPLICIT_ALIASES[s] in self.exact:
            self.stats["expanded"] += 1
            return EXPLICIT_ALIASES[s]
        if s in self.exact:
            self.stats["exact"] += 1
            return s
        candidates = [s]
        if s.endswith("초") and not s.endswith("초등학교"):
            candidates.append(s + "등학교")
        if "분교" in s and "초등학교" not in s:
            candidates.append(s.replace("초", "초등학교", 1) + ("" if s.endswith("장") else "장"))
        for full in candidates:
            if full in self.exact:
                self.stats["expanded"] += 1
                return full
            # '인천' 접두 생략형만 허용 (그 외 부분일치는 동명이교 위험 → 확장하지 않음)
            hits = [n for n in self.names if n == "인천" + full]
            if len(hits) == 1:
                self.stats["expanded"] += 1
                return hits[0]
            if len(hits) > 1:
                self.stats["ambiguous"].append(short)
                return short
        self.stats["unresolved"].append(short)
        return short


def level_of(text: str) -> str | None:
    t = text.strip()
    if t.startswith("초") or t == "초등학교":
        return "초등학교"
    if t.startswith("중"):
        return "중학교"
    if t.startswith("고"):
        return "고등학교"
    if t.startswith("특"):
        return "특수학교"
    return None


def iso(date_text: str) -> str | None:
    m = re.search(r"(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})", date_text or "")
    if not m:
        return None
    y, mo, d = (int(g) for g in m.groups())
    return f"{y:04d}-{mo:02d}-{d:02d}"


def write_csv(name: str, rows: list[dict]) -> Path:
    out = OUT_DIR / name
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        for r in rows:
            w.writerow({k: ("" if r.get(k) is None else r.get(k)) for k in COLUMNS})
    return out


def base_row(name, level, dtype, program, year, src_key, src_file, **extra):
    url, published = SRC.get(src_key) or AUTO_SRC.get(src_key)
    row = {
        "school_name": name, "school_level": level, "designation_type": dtype, "program_name": program,
        "year": year, "source_url": url, "source_file": src_file, "source_published_date": published,
        "retrieved_at": RETRIEVED_AT, "financial_support_amount": None, "verification_status": "official_roster",
        "designation_start_date": None, "designation_end_date": None, "period_basis": None, "note": None,
    }
    row.update(extra)
    return row


# ── 자율학교 지정 현황 (2025·2026) ──────────────────────────────────────────
def parse_autonomous(path: Path) -> list[dict]:
    """[{type, level, name, start, end, remark}] — 표: 연번|지정 유형|학교급|학교명|지정기간|비고"""
    out = []
    for grid in hwpx_tables(path):
        if not grid or "학교명" not in grid[0]:
            continue
        idx = {h: i for i, h in enumerate(grid[0])}
        for row in grid[1:]:
            name = row[idx["학교명"]].strip()
            if not name or name == "학교명":
                continue
            period = row[idx.get("지정기간", idx.get("지정 기간", 4))]
            dates = re.findall(r"\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}", period)
            out.append({
                "type": re.sub(r"\s+", " ", row[idx["지정 유형"] if "지정 유형" in idx else 1]).strip(),
                "level": level_of(row[idx["학교급"]]),
                "name": re.sub(r"\s+", "", name),
                "start": iso(dates[0]) if dates else None,
                "end": iso(dates[1]) if len(dates) > 1 else None,
                "period_text": period.strip(),
                "remark": row[idx["비고"]].strip() if "비고" in idx else "",
            })
    return out


def parse_end_review_2027(path: Path) -> dict[str, dict]:
    """2027.2.28.자 자율학교 종료교 심의 결과 → {학교명: {start, end, type, result}}"""
    out = {}
    for grid in hwpx_tables(path):
        if not grid or "학교명" not in grid[0]:
            continue
        idx = {h: i for i, h in enumerate(grid[0])}
        for row in grid[1:]:
            name = re.sub(r"\s+", "", row[idx["학교명"]])
            if not name:
                continue
            out[name] = {
                "start": iso(row[idx["최근 지정일"]]), "end": iso(row[idx["지정 완료일"]]),
                "type": row[idx["지정유형"]].strip(), "result": row[idx["심의결과"]].strip(),
            }
    return out


# ── 결대로자람학교 운영교 현황 (지정년도 × 학교급 × 교육지원청 매트릭스) ───────
def parse_gyeoldaero(path: Path, resolver: NameResolver) -> list[dict]:
    grids = hwpx_tables(path)
    grid = next(g for g in grids if g and g[0] and g[0][0].startswith("지정년도"))
    header = grid[0]
    office_cols = [i for i, h in enumerate(header) if h.endswith("교육지원청")]
    out = []
    for row in grid[1:]:
        if level_of(row[1]) != "초등학교":
            continue
        ym = re.search(r"(20\d{2})", row[0])
        if not ym:
            continue
        year = int(ym.group(1))
        seen = set()
        for c in office_cols:
            office = header[c]
            for token in re.split(r"[\s,，、]+", row[c]):
                token = token.strip()
                if not token or token in {"·", "-", "ㆍ"}:
                    continue
                key = (token, office)
                if key in seen:  # 병합 셀 복사(북부 2열) 중복 제거
                    continue
                seen.add(key)
                out.append({"short": token, "name": resolver.resolve(token), "designated_year": year, "office": office})
    return out


# ── 공간재구조화 사업 대상교 ─────────────────────────────────────────────
def parse_space_restructure(path: Path, resolver: NameResolver) -> list[dict]:
    out = []
    for grid in hwpx_tables(path):
        if not grid or "학교명" not in grid[0]:
            continue
        idx = {h.replace(" ", ""): i for i, h in enumerate(grid[0])}
        for row in grid[1:]:
            if level_of(row[idx["급별"]]) != "초등학교":
                continue
            short = row[idx["학교명"]]
            if not short.strip():
                continue
            year_m = re.search(r"(2\s*0\s*\d\s*\d)", row[idx["년도"]])
            sel_year = int(re.sub(r"\s+", "", year_m.group(1))) if year_m else None
            area = row[idx.get("재건축연면적(㎡)", idx.get("연면적(㎡)", -1))] if idx else ""
            out.append({
                "name": resolver.resolve(short), "short": short, "selected_year": sel_year,
                "building": row[idx["건물명"]].strip(), "built": row[idx.get("준공연도", idx.get("준공년도", -1))].strip(),
                "area": area.strip(), "remark": row[idx["비고"]].strip() if "비고" in idx else "",
            })
    return out


# ── 미래교실 구축 지원교 ────────────────────────────────────────────────
def parse_future_classroom(path: Path) -> list[dict]:
    out = []
    grids = hwpx_tables(path)
    current_type = "교실형 미래교실"
    for grid in grids:
        if not grid:
            continue
        flat = " ".join(grid[0])
        if "도서지역" in flat and "미래교실" in flat and "학교(기관)명" not in flat:
            current_type = "도서지역 교실형 미래교실"
            continue
        if "교실형 미래교실" in flat and "학교(기관)명" not in flat:
            current_type = "교실형 미래교실"
            continue
        if "학교(기관)명" not in grid[0]:
            continue
        idx = {h: i for i, h in enumerate(grid[0])}
        for row in grid[1:]:
            name = re.sub(r"\s+", "", row[idx["학교(기관)명"]])
            if not name or level_of(row[idx["학교급"]]) != "초등학교":
                continue
            out.append({"name": name, "type": current_type, "gu": row[idx.get("구", 3)].strip(),
                        "theme": re.sub(r"\s+", " ", row[idx.get("사업 신청 주제명", -1)]).strip()})
    return out


# ── 2025 AI·정보(융합)교육 중심학교 ───────────────────────────────────────
def parse_ai_info_center(path: Path) -> list[dict]:
    out = []
    for grid in hwpx_tables(path):
        if not grid or "학교명" not in grid[0]:
            continue
        idx = {h: i for i, h in enumerate(grid[0])}
        for row in grid[1:]:
            name = re.sub(r"\s+", "", row[idx["학교명"]])
            if not name:
                continue
            out.append({"name": name, "type": re.sub(r"\s+", " ", row[idx["정책학교 유형"]]).strip(),
                        "level": level_of(row[idx["학교급"]]) or row[idx["학교급"]].strip()})
    return out


# ── 경인교대 2026학년도 교육실습 협력학교 현황 (HTML 표: 지역|학년|학교명|홈페이지|주소) ──
def parse_teaching_practice(path: Path, resolver: NameResolver) -> list[dict]:
    text = path.read_text(encoding="utf-8")
    start = text.find("교육실습 협력학교 현황")
    if start < 0:
        return []
    seg = text[start:]
    end = seg.find("</table>")
    seg = seg[: end if end > 0 else len(seg)]
    rows_html = seg.split("<tr")[1:]
    out = []
    region = ""
    for row in rows_html:
        cells = []
        for part in row.split("<td")[1:]:
            inner = part.split(">", 1)[1] if ">" in part else ""
            inner = inner.split("</td>")[0]
            plain = " ".join(re.sub(r"<[^>]+>", " ", inner).split())
            plain = plain.replace("&amp;", "&")
            cells.append(plain)
        if not cells:
            continue
        if len(cells) >= 4 and cells[0] in ("인천", "경기"):
            region = cells[0]
            cells = cells[1:]
        if len(cells) < 3:
            continue
        grade, name, homepage = cells[0], cells[1], cells[2]
        address = cells[3] if len(cells) > 3 else ""
        if not name.endswith("초등학교") or region != "인천":
            continue
        out.append({"name": resolver.resolve(name), "raw_name": name, "grade": grade, "homepage": homepage, "address": address})
    return out


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    # --auto-src 2026=<url>@<date> 2025=<url>@<date>
    for a in argv:
        m = re.match(r"--auto-src-(2025|2026)=(\S+)@(\d{4}-\d{2}-\d{2})$", a)
        if m:
            AUTO_SRC[f"auto_{m.group(1)}"] = (m.group(2), m.group(3))

    resolver = NameResolver(load_school_names())
    manifest: list[dict] = []
    summary: dict[str, int] = {}

    # 1) 자율학교 (실제 지정기간) — 결대로자람 유형은 결대로 파일에서 기간 결합용으로만 사용
    gyeol_period: dict[str, dict] = {}
    for year, raw in ((2025, "ice_autonomous_school_2025_designation.hwpx"),
                      (2026, "ice_autonomous_school_2026_designation.converted.hwpx")):
        rows = parse_autonomous(RAW_DIR / raw)
        out_rows = []
        for r in rows:
            if "결대로" in r["type"]:
                if r["level"] == "초등학교":
                    gyeol_period.setdefault(r["name"], r)
                continue
            if r["level"] != "초등학교":
                continue
            note = f"지정기간 {r['period_text']}" + (f" · {r['remark']}" if r["remark"] else "")
            out_rows.append(base_row(r["name"], "초등학교", r["type"], "자율학교", year, f"auto_{year}", raw,
                                     designation_start_date=r["start"], designation_end_date=r["end"],
                                     period_basis="official_period" if r["start"] else None, note=note))
        path = write_csv(f"school_autonomous_{year}.csv", out_rows)
        summary[path.name] = len(out_rows)
        types = sorted({r["type"] for r in rows})
        manifest.append({"raw": raw, "normalized_to": path.name, "rows_total": len(rows), "rows_elementary_non_gyeol": len(out_rows),
                         "types": types, "gyeol_rows_used_for_period": sum(1 for r in rows if "결대로" in r["type"])})
        print(f"[autonomous {year}] 원문 {len(rows)}행 → 초등(결대로 제외) {len(out_rows)}행 · 유형 {types}")

    end_review = parse_end_review_2027(RAW_DIR / "ice_autonomous_end_review_2027.hwpx")
    print(f"[end-review 2027] {len(end_review)}교 (결대로 {sum(1 for v in end_review.values() if '결대로' in v['type'])})")

    # 2) 결대로자람학교 운영교 (2025·2026 현황)
    for year, raw in ((2025, "ice_gyeoldaero_jaram_2025_operating_schools.hwpx"),
                      (2026, "ice_gyeoldaero_jaram_2026_operating_schools.hwpx")):
        rows = parse_gyeoldaero(RAW_DIR / raw, resolver)
        out_rows = []
        for r in rows:
            name = r["name"]
            period = gyeol_period.get(name) or {}
            review = end_review.get(name) if "결대로" in (end_review.get(name) or {}).get("type", "") else None
            start = period.get("start") or (review or {}).get("start") or f"{r['designated_year']}-03-01"
            end = period.get("end") or (review or {}).get("end")
            basis = "official_period" if (period.get("start") or review) else "designation_year_only"
            note = f"{r['designated_year']}년 지정 · {r['office']}" + (
                f" · 자율학교 지정기간 {period.get('period_text')}" if period.get("period_text") else "") + (
                f" · 2027.2.28. 종료교 심의 {review['result']}" if review else "")
            out_rows.append(base_row(name, "초등학교", "운영교", "결대로자람학교", year, f"gyeol_{year}", raw,
                                     designation_start_date=start, designation_end_date=end, period_basis=basis, note=note))
        path = write_csv(f"school_gyeoldaero_{year}.csv", out_rows)
        summary[path.name] = len(out_rows)
        manifest.append({"raw": raw, "normalized_to": path.name, "rows_elementary": len(out_rows),
                         "with_official_period": sum(1 for x in out_rows if x["period_basis"] == "official_period")})
        print(f"[gyeoldaero {year}] 초등 {len(out_rows)}행 · 실제 기간 결합 {manifest[-1]['with_official_period']}")

    # 3) 공간재구조화 (2026 누적 명단)
    rows = parse_space_restructure(RAW_DIR / "ice_space_restructure_2026.hwpx", resolver)
    out_rows = []
    for r in rows:
        note_parts = [f"{r['selected_year']}년 선정" if r["selected_year"] else None, r["building"] or None,
                      f"준공 {r['built']}" if r["built"] else None, f"재건축 연면적 {r['area']}㎡" if r["area"] else None,
                      r["remark"] or None]
        out_rows.append(base_row(r["name"], "초등학교", "사업 대상교", "공간재구조화(그린스마트 미래학교)", 2026, "space_2026",
                                 "ice_space_restructure_2026.hwpx",
                                 designation_start_date=f"{r['selected_year']}-01-01" if r["selected_year"] else None,
                                 period_basis="selection_year_only" if r["selected_year"] else None,
                                 note=" · ".join(p for p in note_parts if p)))
    path = write_csv("school_space_restructure_2026.csv", out_rows)
    summary[path.name] = len(out_rows)
    manifest.append({"raw": "ice_space_restructure_2026.hwpx", "normalized_to": path.name, "rows_elementary": len(out_rows)})
    print(f"[space 2026] 초등 {len(out_rows)}행")

    # 4) 미래교실 (2024·2025)
    for year, raw in ((2024, "ice_future_classroom_2024.hwpx"), (2025, "ice_future_classroom_2025.hwpx")):
        rows = parse_future_classroom(RAW_DIR / raw)
        out_rows = [base_row(r["name"], "초등학교", r["type"], "미래교실 구축 지원", year, f"future_{year}", raw,
                             note=f"주제: {r['theme']}" if r["theme"] else None) for r in rows]
        path = write_csv(f"school_future_classroom_{year}.csv", out_rows)
        summary[path.name] = len(out_rows)
        manifest.append({"raw": raw, "normalized_to": path.name, "rows_elementary": len(out_rows)})
        print(f"[future {year}] 초등 {len(out_rows)}행")

    # 5) 2025 AI·정보(융합)교육 중심학교
    rows = parse_ai_info_center(RAW_DIR / "ice_ai_info_center_school_2025.hwpx")
    out_rows = [base_row(r["name"], "초등학교", r["type"], "AI·정보(융합)교육 중심학교", 2025, "ai_info_2025",
                         "ice_ai_info_center_school_2025.hwpx") for r in rows if r["level"] == "초등학교"]
    path = write_csv("school_ai_info_center_2025.csv", out_rows)
    summary[path.name] = len(out_rows)
    manifest.append({"raw": "ice_ai_info_center_school_2025.hwpx", "normalized_to": path.name, "rows_total": len(rows), "rows_elementary": len(out_rows)})
    print(f"[ai-info 2025] 전체 {len(rows)}행 → 초등 {len(out_rows)}행")

    # 6) 경인교대 교육실습 협력학교 (인천 소재만)
    rows = parse_teaching_practice(RAW_DIR / "ginue_teaching_practice_MN081.html", resolver)
    out_rows = [base_row(r["name"], "초등학교", f"교육실습학교 ({r['grade']})", "교육실습 협력학교(경인교대)", 2026, "ginue_2026",
                         "ginue_teaching_practice_MN081.html",
                         note=f"실습 학년 {r['grade']} · {r['address']}" if r["address"] else f"실습 학년 {r['grade']}") for r in rows]
    path = write_csv("school_teaching_practice_2026.csv", out_rows)
    summary[path.name] = len(out_rows)
    manifest.append({"raw": "ginue_teaching_practice_MN081.html", "normalized_to": path.name, "rows_incheon_elementary": len(out_rows),
                     "note": "경기 소재 협력학교는 제외. 게시일 미표기 → source_published_date null"})
    print(f"[teaching-practice 2026] 인천 초등 {len(out_rows)}행")

    print(f"[names] exact {resolver.stats['exact']} · expanded {resolver.stats['expanded']} · "
          f"unresolved {sorted(set(resolver.stats['unresolved']))} · ambiguous {sorted(set(resolver.stats['ambiguous']))}")
    payload = {"generated_by": "scripts/context/normalize_designations_20260907.py", "retrieved_at": RETRIEVED_AT,
               "sources": {**SRC, **AUTO_SRC}, "normalized": manifest, "summary": summary,
               "name_resolution": {k: (sorted(set(v)) if isinstance(v, list) else v) for k, v in resolver.stats.items()}}
    with open(MANIFEST_OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
