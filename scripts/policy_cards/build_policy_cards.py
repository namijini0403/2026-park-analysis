#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
P3 Task 1: Rule-based policy action card generator.

Reads three CSVs (park case layer, library access, enrollment forecast) plus
modules/reading.yaml, and pre-computes a policy action card for every one of
the 272 Incheon elementary schools, across all 12 budget|site|access scenario
combinations. No LLM, no weighted-sum scoring, no ML classification is used
anywhere in this file -- every action comes from the decision table in
docs/superpowers/plans/2026-08-09-p3-policy-cards.md (Tables A-F).

Canonical pipeline order (this script is step 4 and depends on steps 2-3
having already populated school_library_access.csv with the
reading_gap_type/demand_high columns it reads):
    1) scripts/reading_module/geocode_missing_libraries.py (선택)
    2) scripts/reading_module/build_library_layer.py
    3) scripts/reading_module/apply_reading_gap_types.py  -- must precede 4)
    4) scripts/policy_cards/build_policy_cards.py (this script)

Output: data_processed/policy_action_cards.json

Usage:
    python scripts/policy_cards/build_policy_cards.py
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
PARK_CSV = ROOT / "data_processed" / "school_priority_with_functional_park_layer.csv"
LIBRARY_CSV = ROOT / "data_processed" / "school_library_access.csv"
FORECAST_CSV = ROOT / "data_processed" / "school_enrollment_forecast_20260418_model1.csv"
READING_YAML = ROOT / "modules" / "reading.yaml"
OUTPUT_JSON = ROOT / "data_processed" / "policy_action_cards.json"

# 7-action enum, exactly as scripts/validate_module_contract.mjs::POLICY_ACTION_ENUM
POLICY_ACTION_ENUM = {
    "internal_investment",
    "external_supply_new",
    "institution_link",
    "mobile_service",
    "access_route_improvement",
    "shared_hub",
    "maintain_monitor",
}

BUDGET_AXIS = ["sufficient", "moderate", "constrained"]
SITE_AXIS = ["available", "unavailable"]
ACCESS_AXIS = ["feasible", "infeasible"]

READING_MEDIAN_PER_BOOK = "49.1"  # docs/reading_module_thresholds.md 인당장서수 중앙값(인천 초등)

# Table A: park_need per case (case1..case4)
PARK_NEED_BY_CASE = {1: 3, 2: 2, 3: 1, 4: 0}

# Table A: reading_need per gap_type ("추가 확인 필요" handled separately -> None)
READING_NEED_BY_GAP_TYPE = {
    "direct_investment_first": 3,
    "school_hub_mobile": 2,
    "public_link": 1,
    "maintain_monitor": 0,
}
READING_GAP_DATA_MISSING = "추가 확인 필요"

# Table C: fixed base-action -> alternative mapping
ALTERNATIVE_BY_BASE_ACTION = {
    "external_supply_new": "shared_hub",
    "internal_investment": "mobile_service",
    "mobile_service": "institution_link",
    "institution_link": "mobile_service",
    "access_route_improvement": "shared_hub",
    "maintain_monitor": None,  # "해당 없음 — 정기 재진단"
}

# Table F: fixed roles per action
ROLES_BY_ACTION = {
    "external_supply_new": {"교육청": "수요 근거 제공", "지자체": "부지·조성 주관", "학교": "활용 계획"},
    "internal_investment": {"교육청": "예산·인력 배치", "지자체": "—", "학교": "공간 확보·운영"},
    "mobile_service": {"교육청": "운영 협약", "지자체": "차량·시설 지원", "학교": "수요 조사·일정"},
    "institution_link": {"교육청": "협약 지원", "지자체": "공공도서관 프로그램", "학교": "연계 프로그램 운영"},
    "access_route_improvement": {"교육청": "실태 근거 제공", "지자체": "도로·안전시설 개선", "학교": "통학로 지도 관리"},
    "shared_hub": {"교육청": "권역 협약 주관", "지자체": "거점 시설 지원", "학교": "공동 이용 참여"},
    "maintain_monitor": {"교육청": "정기 재진단", "지자체": "—", "학교": "모니터링 협조"},
}

TRANSITION_TEXT = {
    "external_supply_new_barrier": [
        "부지 확보 불가 시 권역 공동활용·거점화(shared_hub)로 전환",
        "예산 제약 시 보행부담 여건에 따라 접근경로·안전 개선(access_route_improvement)으로 전환, "
        "접근성 개선까지 불가하면 권역 공동활용·거점화로 재전환",
    ],
    "external_supply_new_no_barrier": [
        "부지 확보 불가 시 권역 공동활용·거점화(shared_hub)로 전환",
        "예산 제약 시 권역 공동활용·거점화(shared_hub)로 전환",
    ],
    "access_route_improvement": [
        "접근성 개선이 불가능하면 권역 공동활용·거점화(shared_hub)로 전환",
    ],
    "internal_investment": [
        "공간·예산 제약 시 이동도서관·순회(mobile_service)로 전환",
    ],
}


def read_csv_utf8sig(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def fnum(value: str, decimals: int = 0) -> str:
    """Format a numeric CSV string for evidence text (trims trailing .0)."""
    f = float(value)
    if decimals == 0:
        return str(int(round(f)))
    text = f"{f:.{decimals}f}"
    return text


def barrier_evidence_text(row: dict) -> str:
    basis = (row.get("functional_access_physical_barrier_basis") or "").strip()
    return f"보행부담 동반({basis})" if basis else "보행부담 동반(주요도로 횡단 등)"


def park_evidence_pool(row: dict) -> list[str]:
    """Table E park pool, in fixed order. Only condition-gated items are
    filtered by their flag; the two numeric items are included whenever a
    value is present (near-universal)."""
    items: list[str] = []
    if row.get("no_functional_park_flag") == "True":
        items.append("도보 500m 내 활동규모 공원 없음")
    dist = row.get("nearest_functional_park_dist_m")
    if dist not in (None, ""):
        items.append(f"최근접 활동규모 공원 도보 {fnum(dist)}m")
    green = row.get("display_green_ratio")
    if green not in (None, ""):
        items.append(f"도보권 녹지비율 {fnum(green, 1)}%")
    if row.get("functional_access_physical_barrier_flag") == "True":
        items.append(barrier_evidence_text(row))
    return items


def reading_evidence_pool(row: dict) -> list[str]:
    """Table E reading pool, in fixed order (only for rows with real data,
    i.e. reading_gap_type != '추가 확인 필요')."""
    items: list[str] = []
    if row.get("iso_public_library_count") == "0":
        items.append("도보 500m 내 공공도서관 0개")
    if row.get("사서합계") == "0":
        items.append("사서 미배치")
    per_book = row.get("인당장서수")
    if per_book not in (None, ""):
        items.append(f"1인당 장서수 {fnum(per_book, 1)}권(인천 중앙값 {READING_MEDIAN_PER_BOOK}권 대비)")
    seats = row.get("좌석수")
    if seats not in (None, ""):
        items.append(f"좌석 {fnum(seats)}석")
    return items


def demand_evidence_text(forecast_2029: str) -> str:
    return f"2029 예측수요 {fnum(forecast_2029)}명(상위 25%)"


def park_base_action(case_num: int, barrier_flag: bool) -> str:
    """Table B, park side."""
    if case_num in (1, 2):
        return "external_supply_new"
    if case_num == 3:
        return "access_route_improvement" if barrier_flag else "maintain_monitor"
    return "maintain_monitor"  # case4


def apply_scenario_rules(base_action: str, barrier_flag: bool, budget: str, site: str, access: str) -> str:
    """Table D: applied in fixed order (site -> budget -> access), each rule
    reading the *current* action so later rules see earlier transitions."""
    action = base_action

    # Rule 1
    if action == "external_supply_new" and site == "unavailable":
        action = "shared_hub"

    # Rule 2 (only fires if rule 1 did not already convert the action)
    if action == "external_supply_new" and budget == "constrained":
        action = "access_route_improvement" if barrier_flag else "shared_hub"

    # Rule 3
    if action == "internal_investment" and (site == "unavailable" or budget == "constrained"):
        action = "mobile_service"

    # Rule 4 (may fire after rule 2 produced access_route_improvement, or on
    # an access_route_improvement base action directly)
    if action == "access_route_improvement" and access == "infeasible":
        action = "shared_hub"

    # mobile_service / institution_link / shared_hub / maintain_monitor:
    # low-cost / low-constraint actions, unconditionally stable (rule 5).
    return action


def build_scenarios(base_action: str, barrier_flag: bool) -> dict[str, str]:
    scenarios = {}
    for budget in BUDGET_AXIS:
        for site in SITE_AXIS:
            for access in ACCESS_AXIS:
                key = f"{budget}|{site}|{access}"
                scenarios[key] = apply_scenario_rules(base_action, barrier_flag, budget, site, access)
    return scenarios


def transition_conditions_for(base_action: str, barrier_flag: bool) -> list[str]:
    if base_action == "external_supply_new":
        return list(TRANSITION_TEXT["external_supply_new_barrier" if barrier_flag else "external_supply_new_no_barrier"])
    if base_action == "access_route_improvement":
        return list(TRANSITION_TEXT["access_route_improvement"])
    if base_action == "internal_investment":
        return list(TRANSITION_TEXT["internal_investment"])
    return []


def build_evidence(
    *,
    is_separate_track: bool,
    gu: str,
    primary_module: str,
    reading_data_gap: bool,
    park_row: dict,
    lib_row: dict,
    demand_high: bool,
    forecast_2029: str,
) -> list[str]:
    if is_separate_track:
        evidence = [f"도서 지역({gu}) — 별도 정책 트랙 대상"]
        remaining_pool = park_evidence_pool(park_row)
        evidence.extend(remaining_pool[: 3 - len(evidence)])
        if len(evidence) < 3 and demand_high:
            evidence.append(demand_evidence_text(forecast_2029))
        while len(evidence) < 3:
            evidence.append("정기 재진단 대상 — 별도 정책 트랙")
        return evidence[:3]

    if primary_module == "park":
        primary_pool = park_evidence_pool(park_row)
        secondary_pool = [] if reading_data_gap else reading_evidence_pool(lib_row)
    else:
        primary_pool = reading_evidence_pool(lib_row)
        secondary_pool = park_evidence_pool(park_row)

    evidence = list(primary_pool[:2])

    if demand_high:
        evidence.append(demand_evidence_text(forecast_2029))
    elif secondary_pool:
        evidence.append(secondary_pool[0])
    elif reading_data_gap:
        evidence.append("독서환경 데이터 추가 확인 필요(KESS 학교도서관현황 미매칭)")
    else:
        evidence.append(demand_evidence_text(forecast_2029))

    # Backfill in the rare case primary_pool had < 2 items.
    idx = 1
    while len(evidence) < 3 and idx < len(primary_pool):
        evidence.append(primary_pool[idx])
        idx += 1
    while len(evidence) < 3:
        evidence.append(demand_evidence_text(forecast_2029))
    return evidence[:3]


def main() -> None:
    with READING_YAML.open("r", encoding="utf-8") as fh:
        reading_module = yaml.safe_load(fh)
    gap_type_actions = reading_module["gap_type_actions"]
    for gap_type, action in gap_type_actions.items():
        assert action in POLICY_ACTION_ENUM, f"reading.yaml gap_type_actions.{gap_type} not in enum: {action}"

    park_rows = {row["학교ID"]: row for row in read_csv_utf8sig(PARK_CSV)}
    lib_rows = {row["학교ID"]: row for row in read_csv_utf8sig(LIBRARY_CSV)}
    forecast_rows = {row["학교ID"]: row for row in read_csv_utf8sig(FORECAST_CSV)}

    if lib_rows:
        lib_columns = set(next(iter(lib_rows.values())).keys())
        missing_cols = {"reading_gap_type", "demand_high"} - lib_columns
        if missing_cols:
            raise SystemExit(
                "school_library_access.csv에 reading_gap_type/demand_high 컬럼이 없습니다 "
                "— apply_reading_gap_types.py를 먼저 실행하세요"
            )

    assert len(park_rows) == 272, f"park csv row count != 272 ({len(park_rows)})"
    assert set(park_rows) == set(lib_rows) == set(forecast_rows), "school_id sets differ across inputs"

    schools: dict[str, dict] = {}
    action_dist_base: dict[str, int] = {}
    stability_hist: dict[str, int] = {}
    separate_track_count = 0
    data_gap_count = 0

    for school_id, park_row in park_rows.items():
        lib_row = lib_rows[school_id]
        forecast_row = forecast_rows[school_id]
        school_name = park_row["학교명"]
        gu = park_row["gu"]
        forecast_2029 = forecast_row["forecast_2029"]

        is_separate_track = park_row.get("is_separate_bundle_tag") == "1"
        barrier_flag = park_row.get("functional_access_physical_barrier_flag") == "True"
        demand_high = lib_row.get("demand_high") == "True"

        reading_gap_type = lib_row.get("reading_gap_type", "")
        reading_data_gap = reading_gap_type == READING_GAP_DATA_MISSING
        reading_need = None if reading_data_gap else READING_NEED_BY_GAP_TYPE[reading_gap_type]

        case_num = None
        park_need = None
        if not is_separate_track:
            case_num = int(float(park_row["case_type"]))
            park_need = PARK_NEED_BY_CASE[case_num]

        # Table A: primary_module = higher need side; tie (incl. 0==0) -> park;
        # a None need is always treated as lower priority than any real need.
        pn_cmp = park_need if park_need is not None else -1
        rn_cmp = reading_need if reading_need is not None else -1
        primary_module = "park" if pn_cmp >= rn_cmp else "reading"

        data_gap = "reading" if reading_data_gap else None
        if data_gap:
            data_gap_count += 1
        if is_separate_track:
            separate_track_count += 1

        if is_separate_track:
            base_action = "maintain_monitor"
        elif primary_module == "park":
            base_action = park_base_action(case_num, barrier_flag)
        else:
            base_action = gap_type_actions[reading_gap_type]

        assert base_action in POLICY_ACTION_ENUM, f"{school_id}: base_action {base_action} not in enum"
        alternative = ALTERNATIVE_BY_BASE_ACTION[base_action]

        scenarios = build_scenarios(base_action, barrier_flag)
        for combo_key, action in scenarios.items():
            assert action in POLICY_ACTION_ENUM, f"{school_id}: scenario {combo_key} produced {action} (not in enum)"

        stable_count = sum(1 for a in scenarios.values() if a == base_action)
        stability = round(stable_count / 12, 4)
        transition_conditions = [] if is_separate_track else transition_conditions_for(base_action, barrier_flag)

        evidence = build_evidence(
            is_separate_track=is_separate_track,
            gu=gu,
            primary_module=primary_module,
            reading_data_gap=reading_data_gap,
            park_row=park_row,
            lib_row=lib_row,
            demand_high=demand_high,
            forecast_2029=forecast_2029,
        )
        assert len(evidence) == 3, f"{school_id}: evidence count != 3 ({len(evidence)})"

        roles = ROLES_BY_ACTION[base_action]

        schools[school_id] = {
            "학교명": school_name,
            "separate_track": is_separate_track,
            "data_gap": data_gap,
            "primary_module": primary_module,
            "park_need": park_need,
            "reading_need": reading_need,
            "base": {"primary_action": base_action, "alternative": alternative},
            "evidence": evidence,
            "stability": stability,
            "transition_conditions": transition_conditions,
            "scenarios": scenarios,
            "roles": roles,
        }

        action_dist_base[base_action] = action_dist_base.get(base_action, 0) + 1
        stability_hist[str(stability)] = stability_hist.get(str(stability), 0) + 1

    # ---- self-verification ----
    assert len(schools) == 272, f"expected 272 schools, got {len(schools)}"
    for school_id, card in schools.items():
        assert len(card["scenarios"]) == 12, f"{school_id}: scenario key count != 12"
        for combo_key, action in card["scenarios"].items():
            assert action in POLICY_ACTION_ENUM, f"{school_id}: {combo_key}={action} not in enum (FAIL)"

    output = {
        "generated_note": "규칙 기반 사전계산 — docs/policy_cards_rules.md 참조",
        "scenario_axes": {"budget": BUDGET_AXIS, "site": SITE_AXIS, "access": ACCESS_AXIS},
        "schools": schools,
    }

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(output, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")

    report_lines = []
    report_lines.append(f"entries: {len(schools)}")
    report_lines.append(f"action distribution (base scenario): {action_dist_base}")
    report_lines.append(f"stability histogram: {stability_hist}")
    report_lines.append(f"separate_track count: {separate_track_count}")
    report_lines.append(f"data_gap count: {data_gap_count}")
    report_lines.append("all-enum assertion: PASS (every base + scenario action checked in-loop)")
    report_lines.append(f"scenario keys per school: 12 (verified)")

    report_text = "\n".join(report_lines)
    print(report_text)

    verify_path = ROOT / ".superpowers" / "sdd" / "2026-08-09-p3-policy-cards" / "task-1-verification.txt"
    verify_path.parent.mkdir(parents=True, exist_ok=True)
    verify_path.write_text(report_text + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
