# -*- coding: utf-8 -*-
"""scripts/build_context_layers.py 검증 (stdlib unittest, 의존성 없음).

실행: python -m unittest discover -s tests -v  (리포 루트 2026-park-analysis에서)

outputs/audit_20260906/context_review_round1.md 의 결함 재발 방지 회귀 테스트 포함:
  - 도서(백령·대청) 학교 좌표가 범위 밖으로 거절되는 문제
  - 부분 지역 수집이 미수집 구 학교의 0건으로 둔갑하는 문제
  - 좌표 전부 결측/빈 CSV가 '수집 완료'로 승격되는 문제
  - 불가능 달력일(2026-02-31 등) 수용 문제
  - 위험 스킴 URL 통과 문제
  - 학년도 추정을 확정 지정기간처럼 표시하는 문제
"""

import csv
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = REPO_ROOT.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import build_context_layers as bcl  # noqa: E402


def write_csv(path, columns, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


SCHOOL_COLUMNS = ["학교ID", "학교명", "위도", "경도", "소재지도로명주소", "시도교육청명"]

BASE_SCHOOLS = [
    {"학교ID": "B0001", "학교명": "테스트초등학교", "위도": "37.500000", "경도": "126.700000",
     "소재지도로명주소": "인천광역시 연수구 테스트로 1", "시도교육청명": "인천광역시교육청"},
    {"학교ID": "B0002", "학교명": "중복초등학교", "위도": "37.510000", "경도": "126.710000",
     "소재지도로명주소": "인천광역시 미추홀구 테스트로 2", "시도교육청명": "인천광역시교육청"},
    {"학교ID": "B0003", "학교명": "중복초등학교", "위도": "37.520000", "경도": "126.720000",
     "소재지도로명주소": "인천광역시 부평구 테스트로 3", "시도교육청명": "인천광역시교육청"},
    {"학교ID": "B0004", "학교명": "좌표없는초등학교", "위도": "", "경도": "",
     "소재지도로명주소": "인천광역시 서구 테스트로 4", "시도교육청명": "인천광역시교육청"},
    # 백령도 실제 좌표대 — 광역 범위에 반드시 포함되어야 한다 (review round1 P1)
    {"학교ID": "B0005", "학교명": "섬마을초등학교", "위도": "37.975382", "경도": "124.715333",
     "소재지도로명주소": "인천광역시 옹진군 백령면 테스트로 5", "시도교육청명": "인천광역시교육청"},
]

DESIG_COLUMNS = [
    "school_name", "school_level", "designation_type", "program_name", "year",
    "source_url", "source_file", "source_published_date", "retrieved_at",
    "financial_support_amount", "verification_status",
]

NIGHTLIFE_COLUMNS = [
    "source_record_id", "facility_name", "facility_type", "subtype", "address",
    "latitude", "longitude", "source_as_of", "retrieved_at", "source_url",
    "source_download_url", "business_status", "source_updated_at", "source_modified_at",
    "coordinate_source", "coordinate_status", "scope", "original_x", "original_y",
]

CONSTRUCTION_COLUMNS = [
    "source_record_id", "source_row", "facility_type", "facility_name", "address",
    "latitude", "longitude", "coordinate_status", "match_reason", "matched_address_key",
    "coordinate_matching_record_count", "coordinate_unique_point_count",
    "coordinate_max_pairwise_distance_m", "coordinate_source_record_ids",
    "coordinate_source", "coordinate_source_url", "coordinate_source_as_of",
    "source_url", "source_as_of", "retrieved_at", "construction_status",
    "construction_type", "permit_date", "start_date", "approval_date",
    "main_use", "site_area_sqm", "coordinate_limitations",
]


def desig_row(**kwargs):
    row = {
        "school_name": "테스트초등학교", "school_level": "초등학교",
        "designation_type": "선도학교", "program_name": "AI·디지털 활용", "year": "2026",
        "source_url": "https://example.ice.go.kr/notice/1", "source_file": "roster.xlsx",
        "source_published_date": "2025-12-30", "retrieved_at": "2026-09-06",
        "financial_support_amount": "", "verification_status": "official_roster",
    }
    row.update(kwargs)
    return row


def nightlife_row(**kwargs):
    row = {
        "source_record_id": "3510500-102-2001-00001", "facility_name": "테스트업소",
        "facility_type": "유흥주점영업", "subtype": "룸살롱",
        "address": "인천광역시 연수구 테스트로 10",
        "latitude": "37.500000", "longitude": "126.700000",
        "source_as_of": "", "retrieved_at": "2026-09-06",
        "source_url": "https://www.data.go.kr/data/15045018/fileData.do",
        "source_download_url": "https://file.localdata.go.kr/file/download/entertainment_bars/info",
        "business_status": "영업/정상",
        "source_updated_at": "2026-07-01 09:21:24", "source_modified_at": "2016-12-02 09:40:42",
        "coordinate_source": "EPSG:5174 original transformed to EPSG:4326",
        "coordinate_status": "official_coordinate", "scope": "인천광역시",
        "original_x": "1", "original_y": "1",
    }
    row.update(kwargs)
    return row


def construction_row(**kwargs):
    row = {
        "source_record_id": "15029299:3", "source_row": "3", "facility_type": "건축행정기록",
        "facility_name": "가설건축물", "address": "인천광역시 연수구 송도동 348",
        "latitude": "37.3510425", "longitude": "126.5948126",
        "coordinate_status": "estimated_from_exact_parcel_address",
        "match_reason": "exact_parcel_address_match", "matched_address_key": "k",
        "coordinate_matching_record_count": "1", "coordinate_unique_point_count": "1",
        "coordinate_max_pairwise_distance_m": "0", "coordinate_source_record_ids": "MA1",
        "coordinate_source": "소상공인 상가주소 위치 기반 추정",
        "coordinate_source_url": "https://www.data.go.kr/data/15083033/fileData.do",
        "coordinate_source_as_of": "2026-06-30",
        "source_url": "https://www.data.go.kr/data/15029299/fileData.do",
        "source_as_of": "2026-03-09", "retrieved_at": "2026-09-06",
        "construction_status": "administrative_record_only_not_confirmed_active",
        "construction_type": "가설건축물축조허가", "permit_date": "2026-01-08",
        "start_date": "2026-01-23", "approval_date": "", "main_use": "가설건축물",
        "site_area_sqm": "255353.40", "coordinate_limitations": "주소 기반 추정",
    }
    row.update(kwargs)
    return row


class ContextLayersTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="ctx_layers_test_"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.sources = self.tmp / "context_sources"
        self.sources.mkdir()
        self.schools_csv = self.tmp / "schools.csv"
        self.output_dir = self.tmp / "context_out"
        self.qa_path = self.tmp / "qa.json"
        write_csv(self.schools_csv, SCHOOL_COLUMNS, BASE_SCHOOLS)

    def run_build(self, desig_rows=None, nightlife_rows=None, construction_rows=None,
                  as_of="2026-09-06"):
        if desig_rows is not None:
            write_csv(self.sources / "school_designations_2026.csv", DESIG_COLUMNS, desig_rows)
        if nightlife_rows is not None:
            write_csv(self.sources / "incheon_nightlife_geocoded.csv", NIGHTLIFE_COLUMNS, nightlife_rows)
        if construction_rows is not None:
            write_csv(self.sources / "construction_geocoded_exact.csv", CONSTRUCTION_COLUMNS, construction_rows)
        return bcl.build(
            sources_dir=self.sources, schools_csv=self.schools_csv,
            output_dir=self.output_dir, qa_path=self.qa_path, as_of=as_of,
        )

    # ── 결정론 ──────────────────────────────────────────────
    def test_build_is_deterministic(self):
        args = dict(
            desig_rows=[desig_row(), desig_row(school_name="중복초등학교")],
            nightlife_rows=[nightlife_row(), nightlife_row(source_record_id="X2", facility_name="업소2")],
            construction_rows=[construction_row()],
        )
        self.run_build(**args)
        first = {p.name: p.read_bytes() for p in self.output_dir.iterdir()}
        self.run_build(**args)
        second = {p.name: p.read_bytes() for p in self.output_dir.iterdir()}
        self.assertEqual(first, second)

    # ── 날짜 검증 (회귀: 불가능 달력일 수용) ────────────────
    def test_impossible_dates_rejected_real_leap_day_accepted(self):
        self.assertIsNone(bcl.parse_date("2026-02-31"))
        self.assertIsNone(bcl.parse_date("2025-02-29"))
        self.assertIsNone(bcl.parse_date("0000-01-01"))
        self.assertEqual(bcl.parse_date("2024-02-29"), "2024-02-29")
        self.assertEqual(bcl.parse_date("2026.03.09"), "2026-03-09")
        self.assertEqual(bcl.parse_date("20260309"), "2026-03-09")

    def test_invalid_as_of_raises(self):
        with self.assertRaises(ValueError):
            self.run_build(desig_rows=[desig_row()], as_of="2026-02-31")

    # ── 좌표 범위 (회귀: 백령·대청 거절) ────────────────────
    def test_island_school_and_facility_included(self):
        result = self.run_build(
            desig_rows=[desig_row(school_name="섬마을초등학교")],
            nightlife_rows=[nightlife_row(source_record_id="ISL1", latitude="37.975900", longitude="124.715333")],
        )
        island = result["summaries"]["B0005"]
        self.assertEqual(island["nightlife"]["observed_count"], 1)
        rec = next(r for r in result["records"] if r["school_name"] == "섬마을초등학교")
        self.assertEqual(rec["match"]["school_id"], "B0005")

    def test_all_272_real_school_coordinates_within_bounds(self):
        schools = bcl.load_schools()
        missing = [s["school_name"] for s in schools if s["lat"] is None]
        self.assertEqual(missing, [], f"실제 학교 좌표가 범위 검사에서 탈락: {missing}")

    # ── 부분 지역 커버리지 (회귀: 미수집 구가 0건으로 표시) ─
    def test_construction_uncovered_gu_is_unknown_not_zero(self):
        result = self.run_build(desig_rows=[desig_row()], construction_rows=[construction_row()])
        yeonsu = result["summaries"]["B0001"]      # 연수구
        michuhol = result["summaries"]["B0002"]    # 미추홀구 (미수집)
        self.assertEqual(yeonsu["construction"]["status"], "partial")
        self.assertIsNotNone(yeonsu["construction"]["observed_count"])
        self.assertEqual(michuhol["construction"]["status"], "unknown")
        self.assertIsNone(michuhol["construction"]["observed_count"])
        self.assertIsNone(michuhol["construction"]["total_count"])
        layer = result["manifest"]["layers"]["construction_records"]
        self.assertEqual(layer["coverage_regions"], ["연수구"])

    # ── 좌표 전부 결측 / 빈 CSV (회귀: 수집 완료 승격) ──────
    def test_all_coordinates_missing_is_not_available(self):
        rows = [nightlife_row(source_record_id=f"N{i}", latitude="", longitude="",
                              coordinate_status="missing_or_invalid") for i in range(3)]
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=rows)
        layer = result["manifest"]["layers"]["nightlife_permits"]
        self.assertEqual(layer["status"], "unavailable")
        node = result["summaries"]["B0001"]["nightlife"]
        self.assertEqual(node["status"], "unknown")
        self.assertIsNone(node["observed_count"])

    def test_header_only_csv_is_not_available(self):
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=[])
        layer = result["manifest"]["layers"]["nightlife_permits"]
        self.assertEqual(layer["status"], "unavailable")
        self.assertIsNone(result["summaries"]["B0001"]["nightlife"]["observed_count"])

    def test_designations_missing_input_gives_unknown_status(self):
        result = self.run_build(nightlife_rows=[nightlife_row()])
        node = result["summaries"]["B0001"]["designations"]
        self.assertEqual(node["status"], "unknown")
        self.assertEqual(result["manifest"]["layers"]["school_designations"]["status"], "unavailable")

    # ── 미수집 ≠ 0건 ────────────────────────────────────────
    def test_unknown_coverage_is_not_zero(self):
        result = self.run_build(desig_rows=[desig_row()])
        for key in ("nightlife", "construction"):
            node = result["summaries"]["B0001"][key]
            self.assertEqual(node["status"], "unknown")
            self.assertIsNone(node["observed_count"])
            self.assertIsNone(node["total_count"])

    def test_partial_layer_total_count_always_null(self):
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=[nightlife_row()])
        for summary in result["summaries"].values():
            self.assertIsNone(summary["nightlife"]["total_count"])

    # ── 폐업·상태미상 제외 (방어적 재검사) ──────────────────
    def test_inactive_and_unknown_status_excluded_from_observed(self):
        rows = [
            nightlife_row(source_record_id="A1"),
            nightlife_row(source_record_id="A2", business_status="폐업"),
            nightlife_row(source_record_id="A3", business_status=""),
        ]
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=rows)
        node = result["summaries"]["B0001"]["nightlife"]
        self.assertEqual(node["observed_count"], 1)
        self.assertEqual(node["records"][0]["facility_id"], "A1")
        self.assertEqual(result["qa"]["nightlife"]["unknown_status"], 1)

    # ── 거리 경계 ───────────────────────────────────────────
    def test_distance_boundary_500m(self):
        near_lat = 37.5 + 499.0 / 111132.0
        far_lat = 37.5 + 501.5 / 111132.0
        rows = [
            nightlife_row(source_record_id="NEAR", latitude=f"{near_lat:.8f}"),
            nightlife_row(source_record_id="FAR", latitude=f"{far_lat:.8f}"),
        ]
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=rows)
        node = result["summaries"]["B0001"]["nightlife"]
        self.assertEqual(node["observed_count"], 1)
        self.assertEqual([r["facility_id"] for r in node["records"]], ["NEAR"])
        self.assertLessEqual(node["nearest_observed_m"], 500.0)

    # ── 중복 ID ─────────────────────────────────────────────
    def test_duplicate_source_ids_collapsed(self):
        rows = [nightlife_row(), nightlife_row(facility_name="다른이름")]
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=rows)
        self.assertEqual(result["qa"]["nightlife"]["duplicates_collapsed"], 1)
        self.assertEqual(result["summaries"]["B0001"]["nightlife"]["observed_count"], 1)

    # ── URL 스킴 검증 (회귀: javascript: 통과) ──────────────
    def test_unsafe_source_url_dropped(self):
        result = self.run_build(desig_rows=[desig_row(source_url="javascript:alert(1)")])
        self.assertIsNone(result["records"][0]["source"]["url"])
        self.assertEqual(result["qa"]["designations"]["unsafe_urls_dropped"], 1)
        self.assertEqual(bcl.sanitize_url("https://ok.example/a"), "https://ok.example/a")
        self.assertIsNone(bcl.sanitize_url("data:text/html,x"))

    # ── 학년도 추정 표시 (회귀: 확정 기간처럼 표시) ─────────
    def test_period_basis_is_school_year_only_with_null_dates(self):
        result = self.run_build(desig_rows=[
            desig_row(year="2026"),
            desig_row(school_name="좌표없는초등학교", year="2025",
                      designation_type="디지털튜터 운영교", program_name="디지털튜터"),
            desig_row(school_name="섬마을초등학교", year="2027"),
        ], as_of="2026-09-06")
        by_year = {r["school_year"]: r for r in result["records"]}
        for rec in result["records"]:
            self.assertEqual(rec["period_basis"], "school_year_only")
            self.assertIsNone(rec["designation_start_date"])
            self.assertIsNone(rec["designation_end_date"])
        self.assertEqual(by_year[2026]["period_status"], "current")
        self.assertEqual(by_year[2025]["period_status"], "expired")
        self.assertEqual(by_year[2027]["period_status"], "upcoming")
        # 과거 학년도(2025 디지털튜터)는 current가 아니라 historical로
        node = result["summaries"]["B0004"]["designations"]
        self.assertEqual(node["current"], [])
        self.assertEqual(len(node["historical"]), 1)

    # ── 학교 매칭 ───────────────────────────────────────────
    def test_school_matching_states(self):
        result = self.run_build(desig_rows=[
            desig_row(school_name="테스트초등학교"),
            desig_row(school_name="존재하지않는초등학교"),
            desig_row(school_name="중복초등학교"),
            desig_row(school_name="테스트중학교", school_level="중학교"),
        ])
        by_name = {r["school_name"]: r for r in result["records"]}
        self.assertEqual(by_name["테스트초등학교"]["match"],
                         {"school_id": "B0001", "matching_status": "matched_exact"})
        self.assertEqual(by_name["존재하지않는초등학교"]["match"]["matching_status"], "unmatched")
        self.assertEqual(by_name["중복초등학교"]["match"]["matching_status"], "ambiguous")
        self.assertIsNone(by_name["중복초등학교"]["match"]["school_id"])
        self.assertEqual(by_name["테스트중학교"]["match"]["matching_status"], "out_of_scope_level")

    def test_no_financial_support_inference(self):
        result = self.run_build(desig_rows=[desig_row(financial_support_amount="")])
        self.assertIsNone(result["records"][0]["financial_support_amount"])

    # ── 공사장 행정기록 의미론 ──────────────────────────────
    def test_construction_semantics_and_unlocated_retained(self):
        rows = [
            construction_row(source_record_id="C1", latitude="37.5005", longitude="126.7000",
                             approval_date=""),
            construction_row(source_record_id="C2", latitude="37.5006", longitude="126.7001",
                             approval_date="2026-02-03"),
            construction_row(source_record_id="C3", latitude="", longitude="",
                             coordinate_status="unmatched"),
        ]
        result = self.run_build(desig_rows=[desig_row()], construction_rows=rows)
        node = result["summaries"]["B0001"]["construction"]
        self.assertEqual(node["observed_count"], 2)
        self.assertEqual(node["observed_completed_count"], 1)  # 사용승인 완료는 별도 표기
        self.assertIn("현재 공사 여부 미확인", node["label_ko"])
        self.assertEqual(result["qa"]["construction"]["unlocated_records"], 1)
        geo = json.loads((self.output_dir / "facilities_construction.geojson").read_text(encoding="utf-8"))
        self.assertEqual(len(geo["features"]), 3)
        self.assertEqual(sum(1 for f in geo["features"] if f["geometry"] is None), 1)
        c2 = next(f for f in geo["features"] if f["properties"]["facility_id"] == "C2")
        self.assertTrue(c2["properties"]["use_approved"])
        self.assertEqual(c2["properties"]["construction_status"],
                         "administrative_record_only_not_confirmed_active")

    def test_school_without_coordinates_has_null_counts(self):
        result = self.run_build(desig_rows=[desig_row()], nightlife_rows=[nightlife_row()])
        node = result["summaries"]["B0004"]["nightlife"]
        self.assertIsNone(node["observed_count"])
        self.assertEqual(node["status"], "unknown")

    def test_summary_covers_all_schools(self):
        result = self.run_build(desig_rows=[desig_row()])
        self.assertEqual(set(result["summaries"].keys()),
                         {"B0001", "B0002", "B0003", "B0004", "B0005"})

    def test_haversine_known_distance(self):
        d = bcl.haversine_m(37.5, 126.7, 37.51, 126.7)
        self.assertAlmostEqual(d, 1111.3, delta=2.0)


class RealBuildOutputTestCase(unittest.TestCase):
    """실제 리포 산출물 불변식 + 독립 기준선(outputs/audit_20260906) 대조."""

    @classmethod
    def setUpClass(cls):
        cls.output_dir = REPO_ROOT / "data_processed" / "context"
        if not (cls.output_dir / "school_context_summary.json").exists():
            raise unittest.SkipTest("실제 빌드 산출물 없음 (python scripts/build_context_layers.py 먼저 실행)")
        cls.summary = json.loads((cls.output_dir / "school_context_summary.json").read_text(encoding="utf-8"))
        cls.manifest = json.loads((cls.output_dir / "context_layers_manifest.json").read_text(encoding="utf-8"))

    def test_real_totals_match_independent_baseline(self):
        baseline_path = WORKSPACE_ROOT / "outputs" / "audit_20260906" / "nightlife_independent_baseline.json"
        if not baseline_path.exists():
            raise unittest.SkipTest("독립 기준선 파일 없음")
        baseline = json.loads(baseline_path.read_text(encoding="utf-8-sig"))
        schools = self.summary["schools"]
        observed_schools = sum(1 for v in schools.values() if (v["nightlife"].get("observed_count") or 0) > 0)
        pairs = sum(len(v["nightlife"].get("records") or []) for v in schools.values())
        max_count = max((v["nightlife"].get("observed_count") or 0) for v in schools.values())
        self.assertEqual(observed_schools, baseline["summary"]["schools_with_observed_facilities"])
        self.assertEqual(pairs, baseline["summary"]["school_facility_observed_pairs"])
        self.assertEqual(max_count, baseline["summary"]["max_observed_count"])
        by_id = {b["school_id"]: b for b in baseline["schools"]}
        for school_id, node in schools.items():
            expected = by_id[school_id]
            mine = sorted(h["facility_id"] for h in (node["nightlife"].get("records") or []))
            theirs = sorted(m["source_record_id"] for m in (expected["matches"] or []))
            self.assertEqual(mine, theirs, f"record ID 불일치: {school_id}")

    def test_real_totals_never_presented_as_complete(self):
        for node in (v["nightlife"] for v in self.summary["schools"].values()):
            self.assertIsNone(node.get("total_count"))
        layer = self.manifest["layers"]["nightlife_permits"]
        self.assertEqual(layer["status"], "partial")
        self.assertEqual(layer["unlocated_record_count"], 312)

    def test_real_construction_covered_only_yeonsu(self):
        for node in self.summary["schools"].values():
            c = node["construction"]
            if node.get("gu") == "연수구":
                self.assertIn(c["status"], ("partial", "unknown"))
            else:
                self.assertEqual(c["status"], "unknown")
                self.assertIsNone(c["observed_count"])

    def test_real_designations_all_sourced_with_safe_urls(self):
        data = json.loads((self.output_dir / "school_designations.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["records"]), 267)
        for rec in data["records"]:
            url = rec["source"]["url"]
            self.assertTrue(url and url.startswith("https://"), rec["designation_id"])
            self.assertEqual(rec["period_basis"], "school_year_only")


if __name__ == "__main__":
    unittest.main()
