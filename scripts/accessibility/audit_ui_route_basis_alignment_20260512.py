from __future__ import annotations

import csv
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCHOOL_CSV = ROOT / "data_processed" / "school_priority_with_functional_park_layer.csv"
OUT_CSV = ROOT / "data_quality" / "ui_route_basis_mismatch_audit_20260512.csv"
OUT_MD = ROOT / "reports" / "ui_route_basis_mismatch_audit_20260512.md"


def text(row: dict[str, str], key: str) -> str:
    return str(row.get(key, "") or "").strip()


def number(row: dict[str, str], key: str) -> float | None:
    value = text(row, key)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def flag(row: dict[str, str], key: str) -> bool:
    value = text(row, key).lower()
    return value in {"1", "true", "t", "yes", "y"}


def gt(left: float | None, right: float | None) -> bool:
    return left is not None and right is not None and left > right


def fmt(value: float | None) -> str:
    if value is None:
        return ""
    if value.is_integer():
        return str(int(value))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def audit_row(row: dict[str, str]) -> dict[str, str]:
    official_name = text(row, "nearest_official_park_name") or text(row, "nearest_park_name")
    functional_name = text(row, "nearest_functional_park_name")
    official_level = number(row, "nearest_official_barrier_level")
    functional_level = number(row, "nearest_functional_barrier_level")
    official_crossing = number(row, "nearest_official_major_road_crossing_count")
    functional_crossing = number(row, "nearest_functional_major_road_crossing_count")
    official_large = flag(row, "nearest_official_large_intersection_flag")
    functional_large = flag(row, "nearest_functional_large_intersection_flag")
    official_accident = flag(row, "nearest_official_accident_hotspot_flag")
    functional_accident = flag(row, "nearest_functional_accident_hotspot_flag")

    reasons: list[str] = []
    if gt(functional_level, official_level):
        reasons.append("보행부담 등급")
    if gt(functional_crossing, official_crossing):
        reasons.append("간선도로 횡단")
    if functional_large and not official_large:
        reasons.append("대형 교차로")
    if functional_accident and not official_accident:
        reasons.append("사고위험 지점")

    route_diff = bool(official_name and functional_name and official_name != functional_name)
    functional_risk = (
        (functional_level is not None and functional_level >= 2)
        or (functional_crossing is not None and functional_crossing > 0)
        or functional_large
        or functional_accident
    )
    official_risk = (
        (official_level is not None and official_level >= 2)
        or (official_crossing is not None and official_crossing > 0)
        or official_large
        or official_accident
    )
    hidden_if_official_only = functional_risk and not official_risk
    understated_if_official_only = bool(reasons)

    if understated_if_official_only:
        category = "activity_scale_route_understated_by_official_route"
    elif route_diff and functional_risk:
        category = "different_route_functional_risk_visible"
    elif route_diff:
        category = "different_route_no_extra_functional_risk"
    else:
        category = "aligned_route_basis"

    warning_text = ""
    if understated_if_official_only:
        warning_text = f"활동규모 공원 경로는 공식 최근접 공원 경로와 비교해 {'·'.join(reasons)} 항목이 더 불리하게 산정됩니다."
    elif route_diff:
        warning_text = "공식 최근접 공원과 활동규모 공원 대상지가 달라 경로 특성을 별도로 해석합니다."

    return {
        "school_id": text(row, "학교ID") or text(row, "school_id"),
        "school_name": text(row, "학교명"),
        "gu": text(row, "gu"),
        "access_condition_type": text(row, "access_condition_type"),
        "official_park": official_name,
        "functional_park": functional_name,
        "route_names_differ": str(route_diff),
        "official_barrier_level": fmt(official_level),
        "functional_barrier_level": fmt(functional_level),
        "official_crossing_count": fmt(official_crossing),
        "functional_crossing_count": fmt(functional_crossing),
        "official_large_intersection": str(official_large),
        "functional_large_intersection": str(functional_large),
        "official_accident_hotspot": str(official_accident),
        "functional_accident_hotspot": str(functional_accident),
        "functional_risk": str(functional_risk),
        "official_risk": str(official_risk),
        "hidden_if_official_only": str(hidden_if_official_only),
        "understated_if_official_only": str(understated_if_official_only),
        "mismatch_reasons": " · ".join(reasons),
        "ui_warning_text": warning_text,
        "audit_category": category,
    }


def write_markdown(records: list[dict[str, str]]) -> None:
    total = len(records)
    understated = [row for row in records if row["understated_if_official_only"] == "True"]
    hidden = [row for row in records if row["hidden_if_official_only"] == "True"]
    route_diff = [row for row in records if row["route_names_differ"] == "True"]
    functional_risk = [row for row in records if row["functional_risk"] == "True"]

    lines = [
        "# UI 경로 기준 정합성 전수 감사",
        "",
        "학교 상세 UI에서 공식 최근접 공원 경로와 활동규모 공원 경로를 혼용할 때 위험 신호가 누락될 수 있는지 전수 점검했다.",
        "",
        "## 요약",
        "",
        f"- 전체 학교: {total}개교",
        f"- 활동규모 공원 경로에 보행위험 신호가 있는 학교: {len(functional_risk)}개교",
        f"- 공식 최근접 공원과 활동규모 공원 대상지가 다른 학교: {len(route_diff)}개교",
        f"- 공식 경로만 보면 활동규모 경로 위험이 과소표시되는 학교: {len(understated)}개교",
        f"- 공식 경로만 보면 활동규모 경로 위험이 완전히 숨는 학교: {len(hidden)}개교",
        "",
        "## UI 반영 기준",
        "",
        "- 공식 최근접 공원 경로와 활동규모 공원 경로를 별도 카드로 표시한다.",
        "- 활동규모 공원 경로의 보행부담 등급, 간선도로 횡단, 대형 교차로, 사고위험 지점이 공식 경로보다 크면 노란 경고 문구를 표시한다.",
        "- 두 대상 공원이 다르면 경로 특성을 별도로 해석하라는 안내를 표시한다.",
        "",
        "## 과소표시 가능 학교",
        "",
        "| 학교 | 구 | 공식 최근접 공원 | 활동규모 공원 | 사유 | UI 경고 문구 |",
        "|---|---|---|---|---|---|",
    ]

    for row in understated[:80]:
        lines.append(
            f"| {row['school_name']} | {row['gu']} | {row['official_park']} | "
            f"{row['functional_park']} | {row['mismatch_reasons']} | {row['ui_warning_text']} |"
        )

    if len(understated) > 80:
        lines.append(f"| ... | ... | ... | ... | 나머지 {len(understated) - 80}개교는 CSV 참조 | ... |")

    OUT_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    with SCHOOL_CSV.open("r", encoding="utf-8-sig", newline="") as file:
        rows = list(csv.DictReader(file))

    records = [audit_row(row) for row in rows]
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    OUT_MD.parent.mkdir(parents=True, exist_ok=True)

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(records[0].keys()))
        writer.writeheader()
        writer.writerows(records)

    write_markdown(records)

    understated_count = sum(row["understated_if_official_only"] == "True" for row in records)
    hidden_count = sum(row["hidden_if_official_only"] == "True" for row in records)
    print(f"audited={len(records)} understated={understated_count} hidden={hidden_count}")
    print(f"csv={OUT_CSV.relative_to(ROOT)}")
    print(f"report={OUT_MD.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
